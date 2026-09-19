import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getDatabase, now, dayBoundsInTimezone, getSettingValue, localDateInTimezone } from '../db';
import { requireRole } from '../middleware/security';
import { ROLE_ACCESS } from '../../shared/role-permissions';
import { asyncHandler } from '../middleware/async-handler';
import { getTenantCurrency } from '../services/refund';
import { getCurrencyMinorUnitFactor } from '../countries';

const router = Router();

function tenantTimezone(): string {
  return getSettingValue('timezone') || 'Asia/Kolkata';
}

function reportToday(): string {
  return localDateInTimezone(new Date(), tenantTimezone());
}

function reportDayBounds(date: string): [string, string] {
  return dayBoundsInTimezone(date, tenantTimezone());
}

// ── Categories ──────────────────────────────────────────────────────────────

router.get('/categories', requireRole(...ROLE_ACCESS.ownerManagerCashier), asyncHandler(async (_req: Request, res: Response) => {
  const db = getDatabase();
  const categories = db.prepare(`
    SELECT * FROM expense_categories
    WHERE is_active = 1
    ORDER BY name ASC
  `).all();
  res.json({ ok: true, categories });
}));

router.post('/categories', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const { name, description } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const id = `exp_cat_${randomUUID().substring(0, 8)}`;
  const db = getDatabase();
  db.prepare(`
    INSERT INTO expense_categories (id, name, description, is_active, created_at)
    VALUES (?, ?, ?, 1, ?)
  `).run(id, name.trim(), description || null, now());

  const category = db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id);
  res.status(201).json({ ok: true, category });
}));

// ── Expenses ────────────────────────────────────────────────────────────────

router.get('/', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const db = getDatabase();
  const { start_date, end_date, category_id } = req.query;
  const today = reportToday();
  const sDate = typeof start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start_date) ? start_date : today;
  const eDate = typeof end_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(end_date) ? end_date : sDate;

  let sql = `
    SELECT e.*, c.name as category_name, u.name as created_by_name
    FROM expenses e
    JOIN expense_categories c ON c.id = e.category_id
    LEFT JOIN users u ON u.id = e.created_by
    WHERE e.expense_date >= ? AND e.expense_date <= ?
  `;
  const params: any[] = [sDate, eDate];

  if (category_id && typeof category_id === 'string') {
    sql += ' AND e.category_id = ?';
    params.push(category_id);
  }

  sql += ' ORDER BY e.created_at DESC';
  const expenses = db.prepare(sql).all(...params);

  const total = expenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0);
  res.json({ ok: true, expenses, total });
}));

router.post('/', requireRole(...ROLE_ACCESS.ownerManagerCashier), asyncHandler(async (req: Request, res: Response) => {
  const { category_id, amount, payment_method, paid_to, reference_number, notes, expense_date } = req.body || {};
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Valid expense amount is required' });
  }
  if (!category_id) {
    return res.status(400).json({ error: 'category_id is required' });
  }

  const db = getDatabase();
  const cat = db.prepare('SELECT * FROM expense_categories WHERE id = ? AND is_active = 1').get(category_id);
  if (!cat) return res.status(404).json({ error: 'Expense category not found' });

  const id = `exp_${randomUUID()}`;
  const today = reportToday();
  const expDate = typeof expense_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expense_date) ? expense_date : today;
  const userId = (req as any).user?.userId || null;
  const timestamp = now();

  db.prepare(`
    INSERT INTO expenses (id, expense_date, category_id, amount, payment_method, paid_to, reference_number, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    expDate,
    category_id,
    numAmount,
    payment_method || 'cash',
    paid_to || null,
    reference_number || null,
    notes || null,
    userId,
    timestamp
  );

  const created = db.prepare(`
    SELECT e.*, c.name as category_name
    FROM expenses e
    JOIN expense_categories c ON c.id = e.category_id
    WHERE e.id = ?
  `).get(id);

  res.status(201).json({ ok: true, expense: created });
}));

router.delete('/:id', requireRole(...ROLE_ACCESS.owner), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  res.json({ ok: true, message: 'Expense deleted' });
}));

// ── Profit & Loss (P&L) Report ──────────────────────────────────────────────

router.get('/pnl', requireRole(...ROLE_ACCESS.owner), asyncHandler(async (req: Request, res: Response) => {
  const db = getDatabase();
  const { start_date, end_date } = req.query;
  const today = reportToday();
  const sDate = typeof start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start_date) ? start_date : today;
  const eDate = typeof end_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(end_date) ? end_date : sDate;

  const [startUtc] = reportDayBounds(sDate);
  const [, endUtc] = reportDayBounds(eDate);

  const minorFactor = getCurrencyMinorUnitFactor(getTenantCurrency(db));

  // 1. Revenue: Collected amount - refunds
  const collections = db.prepare(`
    SELECT COALESCE(SUM(paid_amount), 0) AS gross_revenue
    FROM bills WHERE paid_at >= ? AND paid_at < ?
  `).get(startUtc, endUtc) as { gross_revenue: number };

  const refunds = db.prepare(`
    SELECT COALESCE(SUM(CAST(amount_cents AS REAL)) / ?, 0) AS total_refunds
    FROM refunds WHERE created_at >= ? AND created_at < ?
  `).get(minorFactor, startUtc, endUtc) as { total_refunds: number };

  const netRevenue = Math.max(0, collections.gross_revenue - refunds.total_refunds);

  // 2. Cost of Goods Sold (COGS): Recipe food cost for completed items in period
  const cogsRow = db.prepare(`
    SELECT COALESCE(SUM(
      oi.quantity * (
        SELECT COALESCE(SUM(pr.quantity_required * (1 + pr.wastage_percentage / 100) * ri.cost_per_unit), p.cost, 0)
        FROM product_recipes pr
        JOIN raw_ingredients ri ON ri.id = pr.ingredient_id
        WHERE pr.product_id = oi.product_id
      )
    ), 0) AS estimated_cogs
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.status = 'completed' AND o.completed_at >= ? AND o.completed_at < ?
  `).get(startUtc, endUtc) as { estimated_cogs: number };

  const cogs = cogsRow.estimated_cogs;
  const grossProfit = netRevenue - cogs;
  const grossMarginPercent = netRevenue > 0 ? ((grossProfit / netRevenue) * 100) : 0;

  // 3. Operating Expenses grouped by category
  const expenseRows = db.prepare(`
    SELECT c.name as category_name, COALESCE(SUM(e.amount), 0) as total_amount
    FROM expenses e
    JOIN expense_categories c ON c.id = e.category_id
    WHERE e.expense_date >= ? AND e.expense_date <= ?
    GROUP BY c.id
  `).all(sDate, eDate) as { category_name: string; total_amount: number }[];

  const totalExpenses = expenseRows.reduce((acc, row) => acc + row.total_amount, 0);
  const netProfit = grossProfit - totalExpenses;
  const netMarginPercent = netRevenue > 0 ? ((netProfit / netRevenue) * 100) : 0;

  res.json({
    ok: true,
    period: { start_date: sDate, end_date: eDate },
    revenue: {
      gross: collections.gross_revenue,
      refunds: refunds.total_refunds,
      net: netRevenue,
    },
    cogs: {
      total: cogs,
      food_cost_percentage: netRevenue > 0 ? ((cogs / netRevenue) * 100) : 0,
    },
    gross_profit: grossProfit,
    gross_margin_percent: grossMarginPercent,
    expenses: {
      by_category: expenseRows,
      total: totalExpenses,
    },
    net_profit: netProfit,
    net_margin_percent: netMarginPercent,
  });
}));

export const expenseRoutes = router;
