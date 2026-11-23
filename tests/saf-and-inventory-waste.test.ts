/**
 * Integration Test: Store-and-Forward (SAF) Offline Cards & Inventory Wastage
 *
 * Usage: node tests/run-electron-node-test.cjs tests/saf-and-inventory-waste.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-saf-waste-test-'));

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
  console.log('Integration Test: Store-and-Forward (SAF) & Wastage Tracking');
  console.log('='.repeat(55));

  const db = initTestDb();
  const { authHeader } = seedOwnerUser(db);

  seedCategory(db, 'cat-main', 'Mains');
  seedProduct(db, 'prod-biryani', 'cat-main', 'Biryani', 200);

  const app = createApp({});
  registerRoutes(app);
  const { baseUrl, server } = await startServer(app);

  try {
    // ── Part 1: Wastage Tracking ─────────────────────────────────────────────
    console.log('\nPart 1: Wastage Tracking');

    // Create raw ingredient
    const resIng = await api(baseUrl, '/api/inventory/ingredients', {
      method: 'POST',
      body: { name: 'Fresh Milk', unit: 'L', current_stock: 20, minimum_stock: 5, cost_per_unit: 50 },
      headers: authHeader,
    });
    assertEqual(resIng.status, 201, 'Ingredient created (201)');
    const milkId = resIng.data.ingredient.id;

    // Log wastage
    const resWaste = await api(baseUrl, '/api/inventory/waste', {
      method: 'POST',
      body: { ingredient_id: milkId, quantity: 3, reason: 'spoilage', notes: 'Refrigerator failure overnight' },
      headers: authHeader,
    });
    assertEqual(resWaste.status, 201, 'Wastage logged (201)');
    assertEqual(resWaste.data.wastage.quantityWasted, 3, '3 units wasted');
    assertEqual(resWaste.data.wastage.costLoss, 150, 'Cost loss is 3 * 50 = 150');
    assertEqual(resWaste.data.wastage.remainingStock, 17, 'Stock decremented from 20 to 17');

    // Query waste summary
    const resSummary = await api(baseUrl, '/api/inventory/waste-summary', {
      headers: authHeader,
    });
    assertEqual(resSummary.status, 200, 'Waste summary returned (200)');
    assertEqual(resSummary.data.summary.totalUnits, 3, 'Total units in summary is 3');
    assertEqual(resSummary.data.summary.totalCost, 150, 'Total cost in summary is 150');
    assert(Boolean(resSummary.data.summary.byReason.spoilage), 'Reason spoilage present in summary');

    // ── Part 2: Store-and-Forward (SAF) Offline Cards ────────────────────────
    console.log('\nPart 2: Store-and-Forward (SAF) Offline Cards');

    // Create test order & bill
    const orderRes = await api(baseUrl, '/api/orders', {
      method: 'POST',
      body: {
        type: 'takeaway',
        items: [{ product_id: 'prod-biryani', quantity: 2 }],
      },
      headers: authHeader,
    });
    assertEqual(orderRes.status, 201, 'Order created for bill');
    const orderId = orderRes.data.order.id;

    const billRes = await api(baseUrl, '/api/bills/generate', {
      method: 'POST',
      body: { order_id: orderId },
      headers: authHeader,
    });
    assertEqual(billRes.status, 201, 'Bill generated for order');
    const billId = billRes.data.bill.id;

    // Check SAF status & limits
    const statusRes = await api(baseUrl, '/api/saf/status', { headers: authHeader });
    assertEqual(statusRes.status, 200, 'SAF status returned (200)');
    assert(statusRes.data.limits.enabled, 'SAF is enabled');
    assertEqual(statusRes.data.limits.floorLimit, 5000, 'SAF floor limit is 5000');

    // Test Floor limit enforcement: Amount over 5000 should be rejected
    const overLimitRes = await api(baseUrl, '/api/saf/queue', {
      method: 'POST',
      body: {
        order_id: orderId,
        bill_id: billId,
        amount: 8000,
        card_last4: '4242',
        card_brand: 'Visa',
        auth_code: 'APPR9988',
      },
      headers: authHeader,
    });
    assertEqual(overLimitRes.status, 400, 'Transaction over floor limit is rejected (400)');

    // Queue valid offline transaction (amount = 400)
    const queueRes = await api(baseUrl, '/api/saf/queue', {
      method: 'POST',
      body: {
        order_id: orderId,
        bill_id: billId,
        amount: 400,
        card_last4: '4242',
        card_brand: 'Visa',
        auth_code: 'AUTH_OFFLINE_123',
      },
      headers: authHeader,
    });
    assertEqual(queueRes.status, 201, 'Offline card payment queued (201)');
    assertEqual(queueRes.data.transaction.status, 'queued', 'Status is queued');
    assertEqual(queueRes.data.transaction.card_last4, '4242', 'Card last 4 is 4242');
    const safId = queueRes.data.transaction.id;

    // Verify transaction listed
    const listRes = await api(baseUrl, '/api/saf/transactions', { headers: authHeader });
    assertEqual(listRes.status, 200, 'Transactions listed (200)');
    assert(listRes.data.transactions.some((t: any) => t.id === safId), 'Queued transaction is in list');

    // Trigger batch forward settlement
    const forwardRes = await api(baseUrl, '/api/saf/forward-batch', {
      method: 'POST',
      headers: authHeader,
    });
    assertEqual(forwardRes.status, 200, 'Forward batch executed (200)');
    assertEqual(forwardRes.data.result.settled, 1, '1 transaction settled');

    // Verify settled status in database and bill update
    const settledTx = db.prepare('SELECT * FROM saf_card_transactions WHERE id = ?').get(safId) as any;
    assertEqual(settledTx.status, 'settled', 'Transaction status is settled');
    assert(Boolean(settledTx.forwarded_at), 'forwarded_at timestamp is populated');

    const updatedBill = db.prepare('SELECT payment_details FROM bills WHERE id = ?').get(billId) as any;
    assert(updatedBill.payment_details && updatedBill.payment_details.includes('saf_settlement'), 'Bill updated with saf_settlement');

    console.log('\nAll Wastage & SAF Card tests passed successfully!');
  } finally {
    server.close();
    closeDatabase();
  }

  const { total, passed, failed } = getResults();
  console.log(`\nResults: ${passed}/${total} passed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
