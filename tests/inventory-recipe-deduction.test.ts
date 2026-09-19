/**
 * Integration Test: Inventory & Recipe BOM Deduction and Restoration
 *
 * Tests:
 * 1. Creating raw ingredients (e.g. Basmati Rice, Chicken, Cooking Oil).
 * 2. Assigning a Recipe (BOM) to a menu product (e.g. Chicken Biryani).
 * 3. Computing Recipe COGS (Food Cost).
 * 4. Placing an order automatically deducts raw ingredient stocks atomically.
 * 5. Cancelling the order automatically restores raw ingredient stocks.
 * 6. Low stock thresholds trigger low-stock alerts.
 *
 * Usage: node tests/run-electron-node-test.cjs tests/inventory-recipe-deduction.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-inv-test-'));
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') return { app: { isPackaged: true, getPath: () => testDir, getVersion: () => 'test' } };
  return originalLoad.apply(this, arguments as any);
};

const {
  initTestDb, createApp, startServer,
  seedOwnerUser, seedCategory, seedProduct,
  api, assert, assertEqual,
  getResults, closeDatabase,
} = require('./helpers/test-setup');

const { registerRoutes } = require('../main/routes/index');

async function main() {
  console.log('Integration Test: Inventory & Recipe BOM System');
  console.log('='.repeat(50));

  const db = initTestDb();
  const { authHeader } = seedOwnerUser(db);

  seedCategory(db, 'cat-mains', 'Mains');
  seedProduct(db, 'prod-biryani', 'cat-mains', 'Chicken Biryani', 250);

  const app = createApp({});
  registerRoutes(app);
  const { baseUrl, server } = await startServer(app);

  try {
    // 1. Create Raw Ingredients
    console.log('\nStep 1: Create Raw Ingredients');
    const resRice = await api(baseUrl, '/api/inventory/ingredients', {
      method: 'POST',
      body: {
        name: 'Basmati Rice',
        unit: 'kg',
        current_stock: 10,
        minimum_stock: 2,
        cost_per_unit: 80, // Rs 80 per kg
      },
      headers: authHeader,
    });
    assertEqual(resRice.status, 201, 'Rice ingredient created (201)');
    const riceId = resRice.data.ingredient.id;

    const resChicken = await api(baseUrl, '/api/inventory/ingredients', {
      method: 'POST',
      body: {
        name: 'Fresh Chicken',
        unit: 'kg',
        current_stock: 15,
        minimum_stock: 3,
        cost_per_unit: 200, // Rs 200 per kg
      },
      headers: authHeader,
    });
    assertEqual(resChicken.status, 201, 'Chicken ingredient created (201)');
    const chickenId = resChicken.data.ingredient.id;

    // 2. Configure Recipe for Chicken Biryani
    // 1 Biryani = 0.25kg Rice (Rs 20) + 0.3kg Chicken (Rs 60) = Rs 80 COGS
    console.log('\nStep 2: Configure Recipe BOM');
    const resRecipe = await api(baseUrl, '/api/inventory/recipes/prod-biryani', {
      method: 'POST',
      body: {
        items: [
          { ingredient_id: riceId, quantity_required: 0.25, unit: 'kg', wastage_percentage: 0 },
          { ingredient_id: chickenId, quantity_required: 0.3, unit: 'kg', wastage_percentage: 0 },
        ],
      },
      headers: authHeader,
    });
    assertEqual(resRecipe.status, 200, 'Recipe BOM configured (200)');
    assertEqual(resRecipe.data.recipe_cogs, 80, 'Calculated Recipe COGS is exactly Rs 80');

    // 3. Place an Order for 2x Chicken Biryani
    console.log('\nStep 3: Place Order with Recipe Ingredients');
    const resOrder = await api(baseUrl, '/api/orders', {
      method: 'POST',
      body: {
        type: 'takeaway',
        items: [
          { product_id: 'prod-biryani', quantity: 2 },
        ],
      },
      headers: authHeader,
    });
    assertEqual(resOrder.status, 201, 'Order placed (201)');
    const orderId = resOrder.data.order.id;

    // Check that ingredient stock decreased:
    // Rice was 10kg, ordered 2 * 0.25 = 0.5kg -> should be 9.5kg
    // Chicken was 15kg, ordered 2 * 0.3 = 0.6kg -> should be 14.4kg
    const updatedRice = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(riceId) as any;
    const updatedChicken = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(chickenId) as any;

    assertEqual(updatedRice.current_stock, 9.5, 'Rice stock decremented to 9.5 kg');
    assertEqual(updatedChicken.current_stock, 14.4, 'Chicken stock decremented to 14.4 kg');

    // Verify inventory transactions log
    const txCount = db.prepare("SELECT COUNT(*) as count FROM inventory_transactions WHERE type = 'order_deduction'").get() as any;
    assert(txCount.count >= 2, 'Inventory deduction transactions were logged in SQLite');

    // 4. Cancel the Order
    console.log('\nStep 4: Cancel Order & Verify Stock Restoration');
    const resCancel = await api(baseUrl, `/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: {
        status: 'cancelled',
        reason: 'Customer changed mind',
      },
      headers: authHeader,
    });
    assertEqual(resCancel.status, 200, 'Order cancelled (200)');

    const restoredRice = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(riceId) as any;
    const restoredChicken = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(chickenId) as any;

    assertEqual(restoredRice.current_stock, 10, 'Rice stock restored back to 10 kg');
    assertEqual(restoredChicken.current_stock, 15, 'Chicken stock restored back to 15 kg');

    // 5. Test Low Stock Alert
    console.log('\nStep 5: Test Low Stock Alert');
    // Adjust Rice stock down to 1kg (minimum is 2kg)
    await api(baseUrl, '/api/inventory/adjust', {
      method: 'POST',
      body: {
        ingredient_id: riceId,
        adjustment_type: 'set',
        quantity: 1,
        reason: 'Physical inventory audit',
      },
      headers: authHeader,
    });

    const resLowStock = await api(baseUrl, '/api/inventory/low-stock', { headers: authHeader });
    assertEqual(resLowStock.status, 200, 'Low stock API returned (200)');
    assert(resLowStock.data.low_stock.some((i: any) => i.id === riceId), 'Rice identified in low-stock alerts');

    console.log('\nAll Inventory & Recipe BOM tests passed!');
  } finally {
    server.close();
    closeDatabase();
  }

  const results = getResults();
  console.log(`\nResults: ${results.passed}/${results.total} passed`);
  if (results.failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Test failed with exception:', err);
  process.exit(1);
});
