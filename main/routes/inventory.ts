import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getDatabase, now } from '../db';
import { requireRole } from '../middleware/security';
import { ROLE_ACCESS } from '../../shared/role-permissions';
import { asyncHandler } from '../middleware/async-handler';
import { calculateProductRecipeCost, getLowStockIngredients } from '../services/inventory-engine';

const router = Router();

// ── Raw Ingredients ─────────────────────────────────────────────────────────

router.get('/ingredients', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (_req: Request, res: Response) => {
  const db = getDatabase();
  const ingredients = db.prepare(`
    SELECT * FROM raw_ingredients
    WHERE is_active = 1
    ORDER BY name ASC
  `).all();
  res.json({ ok: true, ingredients });
}));

router.post('/ingredients', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const { name, unit, current_stock, minimum_stock, cost_per_unit } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Ingredient name is required' });
  }

  const id = `ing_${randomUUID()}`;
  const db = getDatabase();
  const timestamp = now();

  db.prepare(`
    INSERT INTO raw_ingredients (id, name, unit, current_stock, minimum_stock, cost_per_unit, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    id,
    name.trim(),
    unit || 'kg',
    Number(current_stock) || 0,
    Number(minimum_stock) || 0,
    Number(cost_per_unit) || 0,
    timestamp,
    timestamp
  );

  const ingredient = db.prepare('SELECT * FROM raw_ingredients WHERE id = ?').get(id);
  res.status(201).json({ ok: true, ingredient });
}));

router.put('/ingredients/:id', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, unit, minimum_stock, cost_per_unit } = req.body || {};

  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM raw_ingredients WHERE id = ? AND is_active = 1').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Ingredient not found' });
  }

  const timestamp = now();
  db.prepare(`
    UPDATE raw_ingredients
    SET name = COALESCE(?, name),
        unit = COALESCE(?, unit),
        minimum_stock = COALESCE(?, minimum_stock),
        cost_per_unit = COALESCE(?, cost_per_unit),
        updated_at = ?
    WHERE id = ?
  `).run(
    name?.trim() ?? null,
    unit ?? null,
    minimum_stock != null ? Number(minimum_stock) : null,
    cost_per_unit != null ? Number(cost_per_unit) : null,
    timestamp,
    id
  );

  const updated = db.prepare('SELECT * FROM raw_ingredients WHERE id = ?').get(id);
  res.json({ ok: true, ingredient: updated });
}));

router.delete('/ingredients/:id', requireRole(...ROLE_ACCESS.owner), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  db.prepare('UPDATE raw_ingredients SET is_active = 0, updated_at = ? WHERE id = ?').run(now(), id);
  res.json({ ok: true, message: 'Ingredient deactivated' });
}));

// ── Recipe BOM (Bill of Materials) ──────────────────────────────────────────

router.get('/recipes/:productId', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const productId = String(req.params.productId);
  const db = getDatabase();
  const recipes = db.prepare(`
    SELECT r.id, r.product_id, r.ingredient_id, r.quantity_required, r.unit, r.wastage_percentage,
           i.name as ingredient_name, i.unit as ingredient_unit, i.cost_per_unit, i.current_stock
    FROM product_recipes r
    JOIN raw_ingredients i ON i.id = r.ingredient_id
    WHERE r.product_id = ? AND i.is_active = 1
  `).all(productId);

  const calculatedCost = calculateProductRecipeCost(productId);
  res.json({ ok: true, recipes, recipe_cogs: calculatedCost });
}));

router.post('/recipes/:productId', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const productId = String(req.params.productId);
  const { items } = req.body || {}; // Array of { ingredient_id, quantity_required, unit, wastage_percentage }

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Recipe items array is required' });
  }

  const db = getDatabase();
  db.transaction(() => {
    // Clear existing recipe items for product to replace atomically
    db.prepare('DELETE FROM product_recipes WHERE product_id = ?').run(productId);

    const insertStmt = db.prepare(`
      INSERT INTO product_recipes (id, product_id, ingredient_id, quantity_required, unit, wastage_percentage)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      if (!item.ingredient_id || Number(item.quantity_required) <= 0) continue;
      insertStmt.run(
        `rec_${randomUUID()}`,
        productId,
        item.ingredient_id,
        Number(item.quantity_required),
        item.unit || 'g',
        Number(item.wastage_percentage || 0)
      );
    }
  })();

  const recipeCost = calculateProductRecipeCost(productId);
  res.json({ ok: true, message: 'Recipe updated successfully', recipe_cogs: recipeCost });
}));

// ── Manual Stock Adjustment ─────────────────────────────────────────────────

router.post('/adjust', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const { ingredient_id, adjustment_type, quantity, reason } = req.body || {};
  // adjustment_type: 'increase', 'decrease', 'set'
  if (!ingredient_id || quantity == null || isNaN(Number(quantity))) {
    return res.status(400).json({ error: 'ingredient_id and numeric quantity are required' });
  }

  const db = getDatabase();
  const ing = db.prepare('SELECT * FROM raw_ingredients WHERE id = ? AND is_active = 1').get(ingredient_id) as any;
  if (!ing) return res.status(404).json({ error: 'Ingredient not found' });

  let newStock = ing.current_stock;
  let delta = 0;
  const qtyNum = Math.abs(Number(quantity));

  if (adjustment_type === 'increase') {
    newStock += qtyNum;
    delta = qtyNum;
  } else if (adjustment_type === 'decrease') {
    newStock = Math.max(0, newStock - qtyNum);
    delta = -qtyNum;
  } else if (adjustment_type === 'set') {
    delta = qtyNum - newStock;
    newStock = qtyNum;
  } else {
    return res.status(400).json({ error: 'adjustment_type must be increase, decrease, or set' });
  }

  const timestamp = now();
  db.transaction(() => {
    db.prepare('UPDATE raw_ingredients SET current_stock = ?, updated_at = ? WHERE id = ?')
      .run(newStock, timestamp, ingredient_id);

    db.prepare(`
      INSERT INTO inventory_transactions (ingredient_id, type, quantity, balance_after, reference_id, created_at)
      VALUES (?, 'manual_adjustment', ?, ?, ?, ?)
    `).run(ingredient_id, delta, newStock, reason || 'Manual Stock Count', timestamp);
  })();

  res.json({ ok: true, ingredient_id, previous_stock: ing.current_stock, current_stock: newStock });
}));

// ── Low Stock & Transactions Audit ──────────────────────────────────────────

router.get('/low-stock', requireRole(...ROLE_ACCESS.ownerManagerCashier), asyncHandler(async (_req: Request, res: Response) => {
  const lowStock = getLowStockIngredients();
  res.json({ ok: true, low_stock: lowStock, count: lowStock.length });
}));

router.get('/transactions', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const db = getDatabase();
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const txs = db.prepare(`
    SELECT t.*, i.name as ingredient_name, i.unit as ingredient_unit
    FROM inventory_transactions t
    JOIN raw_ingredients i ON i.id = t.ingredient_id
    ORDER BY t.created_at DESC
    LIMIT ?
  `).all(limit);

  res.json({ ok: true, transactions: txs });
}));

export const inventoryRoutes = router;
