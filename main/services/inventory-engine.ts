import { getDatabase, now } from '../db';

export interface RecipeItem {
  id: string;
  product_id: string;
  ingredient_id: string;
  ingredient_name?: string;
  quantity_required: number;
  unit: string;
  wastage_percentage: number;
  cost_per_unit?: number;
}

export interface RawIngredient {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  cost_per_unit: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryDeductionResult {
  success: boolean;
  deductions: {
    ingredientId: string;
    ingredientName: string;
    quantityDeducted: number;
    remainingStock: number;
    isLowStock: boolean;
  }[];
  insufficientIngredients: {
    ingredientId: string;
    ingredientName: string;
    availableStock: number;
    requiredStock: number;
  }[];
}

/**
 * Calculates recipe cost (COGS) for a product based on current raw ingredient costs.
 */
export function calculateProductRecipeCost(productId: string): number {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT r.quantity_required, r.wastage_percentage, i.cost_per_unit
    FROM product_recipes r
    JOIN raw_ingredients i ON i.id = r.ingredient_id
    WHERE r.product_id = ? AND i.is_active = 1
  `).all(productId) as { quantity_required: number; wastage_percentage: number; cost_per_unit: number }[];

  if (!rows || rows.length === 0) return 0;

  return rows.reduce((total, item) => {
    const effectiveQty = item.quantity_required * (1 + (item.wastage_percentage || 0) / 100);
    return total + (effectiveQty * (item.cost_per_unit || 0));
  }, 0);
}

/**
 * Deducts raw ingredients for ordered items if recipes exist.
 * Runs atomically inside the caller's transaction or creates one.
 */
export function deductIngredientsForOrderItems(
  items: { product_id: string; quantity: number }[],
  orderNumber: string,
  allowNegativeStock = true,
): InventoryDeductionResult {
  const db = getDatabase();
  const deductionReference = `Order #${orderNumber}`;
  // Existing deductions are tracked per ingredient so retries are idempotent,
  // while later additions to the same open order only deduct the new delta.
  const previouslyDeductedRows = db.prepare(`
    SELECT ingredient_id, COALESCE(SUM(-quantity), 0) AS deducted_quantity
    FROM inventory_transactions
    WHERE type = 'order_deduction' AND reference_id = ?
    GROUP BY ingredient_id
  `).all(deductionReference) as { ingredient_id: string; deducted_quantity: number }[];
  const previouslyDeducted = new Map(
    previouslyDeductedRows.map((row) => [row.ingredient_id, Number(row.deducted_quantity || 0)])
  );

  const deductions: InventoryDeductionResult['deductions'] = [];
  const insufficient: InventoryDeductionResult['insufficientIngredients'] = [];

  const stmtGetRecipe = db.prepare(`
    SELECT r.ingredient_id, r.quantity_required, r.wastage_percentage, r.unit,
           i.name as ingredient_name, i.current_stock, i.minimum_stock
    FROM product_recipes r
    JOIN raw_ingredients i ON i.id = r.ingredient_id
    WHERE r.product_id = ? AND i.is_active = 1
  `);

  const stmtUpdateStock = db.prepare(`
    UPDATE raw_ingredients
    SET current_stock = current_stock - ?, updated_at = ?
    WHERE id = ?
  `);

  const stmtLogTx = db.prepare(`
    INSERT INTO inventory_transactions (ingredient_id, type, quantity, balance_after, reference_id, created_at)
    VALUES (?, 'order_deduction', ?, ?, ?, ?)
  `);

  // Aggregate required ingredients across all items in order
  const aggregatedNeeded = new Map<string, {
    name: string;
    needed: number;
    currentStock: number;
    minStock: number;
  }>();

  for (const item of items) {
    const recipes = stmtGetRecipe.all(item.product_id) as any[];
    for (const rec of recipes) {
      const perItemQty = rec.quantity_required * (1 + (rec.wastage_percentage || 0) / 100);
      const totalNeeded = perItemQty * item.quantity;
      const existing = aggregatedNeeded.get(rec.ingredient_id);
      if (existing) {
        existing.needed += totalNeeded;
      } else {
        aggregatedNeeded.set(rec.ingredient_id, {
          name: rec.ingredient_name,
          needed: totalNeeded,
          currentStock: rec.current_stock,
          minStock: rec.minimum_stock,
        });
      }
    }
  }

  // Only apply the outstanding quantity not already recorded for this order.
  for (const [ingredientId, requirement] of aggregatedNeeded.entries()) {
    requirement.needed = Math.max(0, requirement.needed - (previouslyDeducted.get(ingredientId) || 0));
  }

  // Pre-check for insufficient stock if strict check requested
  if (!allowNegativeStock) {
    for (const [ingId, req] of aggregatedNeeded.entries()) {
      if (req.needed <= 0) continue;
      if (req.currentStock < req.needed) {
        insufficient.push({
          ingredientId: ingId,
          ingredientName: req.name,
          availableStock: req.currentStock,
          requiredStock: req.needed,
        });
      }
    }
    if (insufficient.length > 0) {
      return { success: false, deductions: [], insufficientIngredients: insufficient };
    }
  }

  // Apply deductions
  const currentTime = now();
  for (const [ingId, req] of aggregatedNeeded.entries()) {
    if (req.needed <= 0) continue;
    stmtUpdateStock.run(req.needed, currentTime, ingId);
    const newStock = req.currentStock - req.needed;
    stmtLogTx.run(ingId, -req.needed, newStock, `Order #${orderNumber}`, currentTime);

    deductions.push({
      ingredientId: ingId,
      ingredientName: req.name,
      quantityDeducted: req.needed,
      remainingStock: newStock,
      isLowStock: newStock <= req.minStock,
    });
  }

  return { success: true, deductions, insufficientIngredients: [] };
}

/**
 * Restores raw ingredients when an order or item is cancelled/voided.
 */
export function restoreIngredientsForOrderItems(
  items: { product_id: string; quantity: number }[],
  orderNumber: string,
  reason = 'Order Cancellation',
): void {
  const db = getDatabase();
  const deductionReference = `Order #${orderNumber}`;
  const restorationReference = `${reason} (#${orderNumber})`;

  // A pending QR request has not consumed stock. Do not manufacture stock on
  // cancellation unless an order-deduction ledger entry exists.
  const hasDeduction = db.prepare(`
    SELECT 1 FROM inventory_transactions
    WHERE type = 'order_deduction' AND reference_id = ?
    LIMIT 1
  `).get(deductionReference);
  if (!hasDeduction) return;

  // Cancellation/retry events are at-least-once; restore a given order once.
  const hasRestoration = db.prepare(`
    SELECT 1 FROM inventory_transactions
    WHERE type = 'order_restoration' AND reference_id = ?
    LIMIT 1
  `).get(restorationReference);
  if (hasRestoration) return;

  const stmtGetRecipe = db.prepare(`
    SELECT r.ingredient_id, r.quantity_required, r.wastage_percentage,
           i.name as ingredient_name, i.current_stock
    FROM product_recipes r
    JOIN raw_ingredients i ON i.id = r.ingredient_id
    WHERE r.product_id = ?
  `);

  const stmtUpdateStock = db.prepare(`
    UPDATE raw_ingredients
    SET current_stock = current_stock + ?, updated_at = ?
    WHERE id = ?
  `);

  const stmtLogTx = db.prepare(`
    INSERT INTO inventory_transactions (ingredient_id, type, quantity, balance_after, reference_id, created_at)
    VALUES (?, 'order_restoration', ?, ?, ?, ?)
  `);

  const currentTime = now();
  for (const item of items) {
    const recipes = stmtGetRecipe.all(item.product_id) as any[];
    for (const rec of recipes) {
      const perItemQty = rec.quantity_required * (1 + (rec.wastage_percentage || 0) / 100);
      const totalRestore = perItemQty * item.quantity;
      stmtUpdateStock.run(totalRestore, currentTime, rec.ingredient_id);
      const newStock = rec.current_stock + totalRestore;
      stmtLogTx.run(rec.ingredient_id, totalRestore, newStock, `${reason} (#${orderNumber})`, currentTime);
    }
  }
}

/**
 * Queries low-stock alerts across raw materials.
 */
export function getLowStockIngredients(): RawIngredient[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM raw_ingredients
    WHERE is_active = 1 AND current_stock <= minimum_stock
    ORDER BY (current_stock - minimum_stock) ASC
  `).all() as RawIngredient[];
}

export interface WastageParams {
  ingredientId: string;
  quantity: number;
  reason: 'spoilage' | 'prep_waste' | 'spill' | 'expired' | 'other';
  notes?: string;
  reportedByUserId?: string;
}

export interface WastageResult {
  success: boolean;
  ingredientId: string;
  ingredientName: string;
  quantityWasted: number;
  costLoss: number;
  remainingStock: number;
}

/**
 * Records ingredient wastage (spoilage, prep loss, dropped food) and updates stock.
 */
export function recordWastage(params: WastageParams): WastageResult {
  const { ingredientId, quantity, reason, notes } = params;
  if (!ingredientId || quantity <= 0) {
    throw Object.assign(new Error('Invalid wastage parameters: ingredientId and positive quantity required'), { statusCode: 400 });
  }

  const db = getDatabase();
  const ingredient = db.prepare('SELECT * FROM raw_ingredients WHERE id = ? AND is_active = 1').get(ingredientId) as RawIngredient | undefined;
  if (!ingredient) {
    throw Object.assign(new Error('Ingredient not found'), { statusCode: 404 });
  }

  const timestamp = now();
  const costLoss = Math.round((quantity * (ingredient.cost_per_unit || 0)) * 100) / 100;
  const remainingStock = Math.max(0, ingredient.current_stock - quantity);
  const ref = `Waste: ${reason}${notes ? ` - ${notes}` : ''}`;

  db.transaction(() => {
    db.prepare(`
      UPDATE raw_ingredients
      SET current_stock = ?, updated_at = ?
      WHERE id = ?
    `).run(remainingStock, timestamp, ingredientId);

    db.prepare(`
      INSERT INTO inventory_transactions (ingredient_id, type, quantity, balance_after, reference_id, created_at)
      VALUES (?, 'wastage', ?, ?, ?, ?)
    `).run(ingredientId, -quantity, remainingStock, ref, timestamp);
  })();

  return {
    success: true,
    ingredientId,
    ingredientName: ingredient.name,
    quantityWasted: quantity,
    costLoss,
    remainingStock,
  };
}

/**
 * Aggregates wastage metrics and costs across reasons and dates.
 */
export function getWastageSummary(startDate?: string, endDate?: string) {
  const db = getDatabase();
  let sql = `
    SELECT t.reference_id, t.quantity, t.created_at, i.name as ingredient_name, i.unit, i.cost_per_unit
    FROM inventory_transactions t
    JOIN raw_ingredients i ON i.id = t.ingredient_id
    WHERE t.type = 'wastage'
  `;
  const params: any[] = [];
  if (startDate) {
    sql += ' AND date(t.created_at) >= date(?)';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND date(t.created_at) <= date(?)';
    params.push(endDate);
  }
  sql += ' ORDER BY t.created_at DESC';

  const rows = db.prepare(sql).all(...params) as any[];
  let totalCost = 0;
  let totalUnits = 0;
  const byReason: Record<string, { count: number; totalCost: number; totalUnits: number }> = {};

  for (const r of rows) {
    const qty = Math.abs(r.quantity || 0);
    const unitCost = r.cost_per_unit || 0;
    const loss = qty * unitCost;
    totalCost += loss;
    totalUnits += qty;

    const ref = String(r.reference_id || '');
    let reason = 'other';
    if (ref.includes('spoilage')) reason = 'spoilage';
    else if (ref.includes('prep_waste')) reason = 'prep_waste';
    else if (ref.includes('spill')) reason = 'spill';
    else if (ref.includes('expired')) reason = 'expired';

    if (!byReason[reason]) {
      byReason[reason] = { count: 0, totalCost: 0, totalUnits: 0 };
    }
    byReason[reason].count += 1;
    byReason[reason].totalCost = Math.round((byReason[reason].totalCost + loss) * 100) / 100;
    byReason[reason].totalUnits = Math.round((byReason[reason].totalUnits + qty) * 100) / 100;
  }

  return {
    totalTransactions: rows.length,
    totalCost: Math.round(totalCost * 100) / 100,
    totalUnits: Math.round(totalUnits * 100) / 100,
    byReason,
    recentEntries: rows.slice(0, 50),
  };
}
