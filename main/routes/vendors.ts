import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getDatabase, now } from '../db';
import { requireRole } from '../middleware/security';
import { ROLE_ACCESS } from '../../shared/role-permissions';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

// ── Vendor Master ───────────────────────────────────────────────────────────

router.get('/', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (_req: Request, res: Response) => {
  const db = getDatabase();
  const vendors = db.prepare(`
    SELECT * FROM vendors
    WHERE is_active = 1
    ORDER BY name ASC
  `).all();
  res.json({ ok: true, vendors });
}));

router.post('/', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const { name, contact_person, phone, email, gstin, address } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Vendor name is required' });
  }

  const id = `ven_${randomUUID()}`;
  const db = getDatabase();
  const timestamp = now();

  db.prepare(`
    INSERT INTO vendors (id, name, contact_person, phone, email, gstin, address, balance, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
  `).run(
    id,
    name.trim(),
    contact_person || null,
    phone || null,
    email || null,
    gstin || null,
    address || null,
    timestamp,
    timestamp
  );

  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(id);
  res.status(201).json({ ok: true, vendor });
}));

router.put('/:id', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, contact_person, phone, email, gstin, address } = req.body || {};

  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM vendors WHERE id = ? AND is_active = 1').get(id);
  if (!existing) return res.status(404).json({ error: 'Vendor not found' });

  const timestamp = now();
  db.prepare(`
    UPDATE vendors
    SET name = COALESCE(?, name),
        contact_person = COALESCE(?, contact_person),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        gstin = COALESCE(?, gstin),
        address = COALESCE(?, address),
        updated_at = ?
    WHERE id = ?
  `).run(
    name?.trim() ?? null,
    contact_person ?? null,
    phone ?? null,
    email ?? null,
    gstin ?? null,
    address ?? null,
    timestamp,
    id
  );

  const updated = db.prepare('SELECT * FROM vendors WHERE id = ?').get(id);
  res.json({ ok: true, vendor: updated });
}));

// ── Purchase Orders & Inward Goods (GRN) ────────────────────────────────────

router.get('/purchases', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const db = getDatabase();
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const purchases = db.prepare(`
    SELECT p.*, v.name as vendor_name
    FROM purchase_orders p
    JOIN vendors v ON v.id = p.vendor_id
    ORDER BY p.created_at DESC
    LIMIT ?
  `).all(limit);

  res.json({ ok: true, purchases });
}));

router.get('/purchases/:id', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const purchase = db.prepare(`
    SELECT p.*, v.name as vendor_name, v.phone as vendor_phone, v.gstin as vendor_gstin
    FROM purchase_orders p
    JOIN vendors v ON v.id = p.vendor_id
    WHERE p.id = ?
  `).get(id) as any;

  if (!purchase) return res.status(404).json({ error: 'Purchase order not found' });

  const items = db.prepare(`
    SELECT pi.*, i.name as ingredient_name, i.unit as ingredient_unit
    FROM purchase_order_items pi
    JOIN raw_ingredients i ON i.id = pi.ingredient_id
    WHERE pi.purchase_id = ?
  `).all(id);

  res.json({ ok: true, purchase, items });
}));

router.post('/purchases', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const {
    vendor_id,
    invoice_number,
    invoice_date,
    items, // Array of { ingredient_id, quantity, unit_price, tax_rate }
    paid_amount,
    payment_method,
    notes,
  } = req.body || {};

  if (!vendor_id) return res.status(400).json({ error: 'vendor_id is required' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one purchase item is required' });
  }

  const db = getDatabase();
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ? AND is_active = 1').get(vendor_id) as any;
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

  const poId = `po_${randomUUID()}`;
  const countRow = db.prepare('SELECT COUNT(*) as count FROM purchase_orders').get() as { count: number };
  const poNumber = `PO-${String((countRow?.count || 0) + 1).padStart(5, '0')}`;
  const timestamp = now();

  let totalAmount = 0;
  let taxAmount = 0;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const taxRate = Number(item.tax_rate) || 0;
    const itemSubtotal = qty * price;
    const itemTax = itemSubtotal * (taxRate / 100);
    totalAmount += (itemSubtotal + itemTax);
    taxAmount += itemTax;
  }

  const initialPaid = Math.min(totalAmount, Math.max(0, Number(paid_amount) || 0));
  const paymentStatus = initialPaid >= totalAmount ? 'paid' : initialPaid > 0 ? 'partial' : 'unpaid';
  const balanceDelta = totalAmount - initialPaid;

  db.transaction(() => {
    // 1. Insert Purchase Order Header
    db.prepare(`
      INSERT INTO purchase_orders (id, po_number, vendor_id, invoice_number, invoice_date, total_amount, tax_amount, paid_amount, payment_status, payment_method, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      poId,
      poNumber,
      vendor_id,
      invoice_number || null,
      invoice_date || timestamp.substring(0, 10),
      totalAmount,
      taxAmount,
      initialPaid,
      paymentStatus,
      payment_method || (initialPaid > 0 ? 'cash' : null),
      notes || null,
      timestamp,
      timestamp
    );

    // 2. Insert Items & Increment Ingredient Stock
    const insertItemStmt = db.prepare(`
      INSERT INTO purchase_order_items (purchase_id, ingredient_id, quantity, unit_price, tax_rate, total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateIngStmt = db.prepare(`
      UPDATE raw_ingredients
      SET current_stock = current_stock + ?,
          cost_per_unit = ?,
          updated_at = ?
      WHERE id = ?
    `);

    const logTxStmt = db.prepare(`
      INSERT INTO inventory_transactions (ingredient_id, type, quantity, balance_after, reference_id, created_at)
      VALUES (?, 'purchase_inward', ?, ?, ?, ?)
    `);

    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      const taxRate = Number(item.tax_rate) || 0;
      const itemTotal = (qty * price) * (1 + taxRate / 100);

      insertItemStmt.run(poId, item.ingredient_id, qty, price, taxRate, itemTotal);

      // Get current stock to log transaction
      const ingRow = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(item.ingredient_id) as any;
      const currentStock = ingRow ? ingRow.current_stock : 0;
      const newStock = currentStock + qty;

      updateIngStmt.run(qty, price, timestamp, item.ingredient_id);
      logTxStmt.run(item.ingredient_id, qty, newStock, `Purchase ${poNumber}`, timestamp);
    }

    // 3. Update Vendor Outstanding Balance
    if (balanceDelta > 0) {
      db.prepare('UPDATE vendors SET balance = balance + ?, updated_at = ? WHERE id = ?')
        .run(balanceDelta, timestamp, vendor_id);
    }
  })();

  res.status(201).json({
    ok: true,
    purchase_id: poId,
    po_number: poNumber,
    total_amount: totalAmount,
    paid_amount: initialPaid,
    payment_status: paymentStatus,
  });
}));

router.post('/purchases/:id/payment', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount, payment_method } = req.body || {};
  const payNum = Number(amount);
  if (isNaN(payNum) || payNum <= 0) {
    return res.status(400).json({ error: 'Valid payment amount is required' });
  }

  const db = getDatabase();
  const purchase = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id) as any;
  if (!purchase) return res.status(404).json({ error: 'Purchase order not found' });

  const remainingDue = purchase.total_amount - purchase.paid_amount;
  const actualPayment = Math.min(payNum, remainingDue);
  if (actualPayment <= 0) {
    return res.status(400).json({ error: 'Purchase order is already fully paid' });
  }

  const newPaid = purchase.paid_amount + actualPayment;
  const newStatus = newPaid >= purchase.total_amount ? 'paid' : 'partial';
  const timestamp = now();

  db.transaction(() => {
    db.prepare(`
      UPDATE purchase_orders
      SET paid_amount = ?, payment_status = ?, payment_method = COALESCE(?, payment_method), updated_at = ?
      WHERE id = ?
    `).run(newPaid, newStatus, payment_method ?? null, timestamp, id);

    db.prepare(`
      UPDATE vendors
      SET balance = MAX(0, balance - ?), updated_at = ?
      WHERE id = ?
    `).run(actualPayment, timestamp, purchase.vendor_id);
  })();

  res.json({ ok: true, paid_amount: newPaid, remaining_due: purchase.total_amount - newPaid, payment_status: newStatus });
}));

export const vendorRoutes = router;
