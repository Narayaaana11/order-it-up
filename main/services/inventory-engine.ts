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

  // Pre-check for insufficient stock if strict check requested
  if (!allowNegativeStock) {
    for (const [ingId, req] of aggregatedNeeded.entries()) {
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
