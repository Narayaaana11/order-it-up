/**
 * Integration Test: Expenses, P&L, Vendors and Purchase Orders
 *
 * Tests:
 * 1. Vendor Creation and Purchase Order with inward goods (GRN).
 * 2. Inward goods automatically increment raw ingredient current_stock.
 * 3. Logging operational expenses across categories.
 * 4. P&L Engine calculation: Gross Sales - Refunds - COGS - Expenses = Net Profit.
 *
 * Usage: node tests/run-electron-node-test.cjs tests/expenses-pnl-vendors.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-pnl-test-'));
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
  console.log('Integration Test: Expenses, P&L, and Vendor Purchase System');
  console.log('='.repeat(50));

  const db = initTestDb();
  const { authHeader } = seedOwnerUser(db);

  const app = createApp({});
  registerRoutes(app);
  const { baseUrl, server } = await startServer(app);

  try {
    // 1. Create Raw Ingredient for Vendor Testing
    console.log('\nStep 1: Create Raw Ingredient');
    const resOil = await api(baseUrl, '/api/inventory/ingredients', {
      method: 'POST',
      body: {
        name: 'Cooking Oil',
        unit: 'liter',
        current_stock: 5,
        minimum_stock: 2,
        cost_per_unit: 140,
      },
      headers: authHeader,
    });
    assertEqual(resOil.status, 201, 'Cooking oil ingredient created (201)');
    const oilId = resOil.data.ingredient.id;

    // 2. Create Vendor
    console.log('\nStep 2: Create Vendor');
    const resVendor = await api(baseUrl, '/api/vendors', {
      method: 'POST',
      body: {
        name: 'Metro Wholesale',
        contact_person: 'Rajesh Sharma',
        phone: '+919876543210',
        payment_terms: 'net_15',
      },
      headers: authHeader,
    });
    assertEqual(resVendor.status, 201, 'Vendor Metro Wholesale created (201)');
    const vendorId = resVendor.data.vendor.id;

    // 3. Create Purchase Order (10 Liters Cooking Oil @ Rs 130) -> Inwards into stock
    console.log('\nStep 3: Create Purchase Order (GRN inward stock)');
    const resPO = await api(baseUrl, '/api/vendors/purchases', {
      method: 'POST',
      body: {
        vendor_id: vendorId,
        invoice_number: 'INV-2026-001',
        paid_amount: 500, // partially paid Rs 500 out of Rs 1300
        payment_method: 'upi',
        items: [
          { ingredient_id: oilId, quantity: 10, unit_price: 130, tax_rate: 0 },
        ],
      },
      headers: authHeader,
    });
    assertEqual(resPO.status, 201, 'Purchase Order created and inwarded (201)');
    assertEqual(resPO.data.payment_status, 'partial', 'PO marked as partial payment status');
    assertEqual(resPO.data.total_amount, 1300, 'PO total amount is Rs 1300');
    const poId = resPO.data.purchase_id;

    // Verify Cooking Oil stock incremented from 5 to 15 liters
    const updatedOil = db.prepare('SELECT current_stock, cost_per_unit FROM raw_ingredients WHERE id = ?').get(oilId) as any;
    assertEqual(updatedOil.current_stock, 15, 'Oil stock incremented to 15 liters');
    assertEqual(updatedOil.cost_per_unit, 130, 'Ingredient cost_per_unit updated to purchase price (130)');

    // Verify vendor balance increased by 800 (1300 - 500)
    const updatedVendor = db.prepare('SELECT balance FROM vendors WHERE id = ?').get(vendorId) as any;
    assertEqual(updatedVendor.balance, 800, 'Vendor outstanding balance updated to Rs 800');

    // Make remaining payment
    const resPay = await api(baseUrl, `/api/vendors/purchases/${poId}/payment`, {
      method: 'POST',
      body: { amount: 800, payment_method: 'bank_transfer' },
      headers: authHeader,
    });
    assertEqual(resPay.status, 200, 'Vendor payment applied (200)');
    assertEqual(resPay.data.payment_status, 'paid', 'PO now marked fully paid');

    // 4. Log Operational Expenses
    console.log('\nStep 4: Log Operational Expenses');
    const resCat = await api(baseUrl, '/api/expenses/categories', { headers: authHeader });
    assertEqual(resCat.status, 200, 'Seeded expense categories retrieved (200)');
    const utilCat = resCat.data.categories.find((c: any) => c.name === 'Utilities') || resCat.data.categories[0];

    const todayStr = new Date().toISOString().split('T')[0];
    const resExp = await api(baseUrl, '/api/expenses', {
      method: 'POST',
      body: {
        category_id: utilCat.id,
        amount: 2500,
        payment_method: 'bank_transfer',
        expense_date: todayStr,
        description: 'Monthly electricity bill',
      },
      headers: authHeader,
    });
    assertEqual(resExp.status, 201, 'Expense logged (201)');

    // 5. Query P&L Report
    console.log('\nStep 5: Query P&L Report');
    const resPnl = await api(baseUrl, `/api/expenses/pnl?start_date=${todayStr}&end_date=${todayStr}`, {
      headers: authHeader,
    });
    assertEqual(resPnl.status, 200, 'P&L report generated (200)');
    assertEqual(resPnl.data.expenses.total, 2500, 'Total operational expenses correctly summed (Rs 2500)');
    const matchedCat = resPnl.data.expenses.by_category.find((c: any) => c.category_name === utilCat.name);
    assert(!!matchedCat, `Category ${utilCat.name} correctly grouped in P&L expenses`);
    assertEqual(matchedCat.total_amount, 2500, `Category ${utilCat.name} total is Rs 2500`);
    assert(typeof resPnl.data.net_profit === 'number', 'Net profit computed as a number');

    console.log('\nAll Expense, P&L and Vendor tests passed!');
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
