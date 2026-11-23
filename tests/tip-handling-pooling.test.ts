/**
 * Integration Test: Tip Handling, Pooling & Distribution
 *
 * Usage: node tests/run-electron-node-test.cjs tests/tip-handling-pooling.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-tip-test-'));

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
  console.log('Integration Test: Tip Handling, Pooling & Distribution');
  console.log('='.repeat(55));

  const db = initTestDb();
  const { authHeader } = seedOwnerUser(db);

  // Seed two operational staff members
  db.prepare(`
    INSERT INTO users (id, name, email, password, role, is_active, created_at, updated_at)
    VALUES ('server-1', 'Alice Waiter', 'alice@test.com', 'hash', 'server', 1, datetime('now'), datetime('now')),
           ('kitchen-1', 'Bob Chef', 'bob@test.com', 'hash', 'chef', 1, datetime('now'), datetime('now'))
  `).run();

  seedCategory(db, 'cat-food', 'Food');
  seedProduct(db, 'prod-pasta', 'cat-food', 'Pasta', 200);

  const app = createApp({});
  registerRoutes(app);
  const { baseUrl, server } = await startServer(app);

  try {
    console.log('\nStep 1: Create Orders and Settle Bills with Tips');

    // Order 1
    const order1 = await api(baseUrl, '/api/orders', {
      method: 'POST',
      body: { type: 'takeaway', items: [{ product_id: 'prod-pasta', quantity: 1 }] },
      headers: authHeader,
    });
    const bill1Res = await api(baseUrl, '/api/bills/generate', {
      method: 'POST',
      body: { order_id: order1.data.order.id },
      headers: authHeader,
    });
    const bill1Id = bill1Res.data.bill.id;

    // Pay Bill 1 with Tip of 100
    const pay1 = await api(baseUrl, `/api/bills/${bill1Id}/payment`, {
      method: 'POST',
      body: { method: 'card', amount: bill1Res.data.bill.total, tip_amount: 100 },
      headers: authHeader,
    });
    assertEqual(pay1.status, 200, 'Payment with tip accepted (200)');

    const bill1Db = db.prepare('SELECT tip_amount, tip_payment_method FROM bills WHERE id = ?').get(bill1Id) as any;
    assertEqual(bill1Db.tip_amount, 100, 'Bill 1 tip_amount is 100');
    assertEqual(bill1Db.tip_payment_method, 'card', 'Bill 1 tip_payment_method is card');

    // Order 2
    const order2 = await api(baseUrl, '/api/orders', {
      method: 'POST',
      body: { type: 'takeaway', items: [{ product_id: 'prod-pasta', quantity: 2 }] },
      headers: authHeader,
    });
    const bill2Res = await api(baseUrl, '/api/bills/generate', {
      method: 'POST',
      body: { order_id: order2.data.order.id },
      headers: authHeader,
    });
    const bill2Id = bill2Res.data.bill.id;

    // Pay Bill 2 with Tip of 150
    const pay2 = await api(baseUrl, `/api/bills/${bill2Id}/payment`, {
      method: 'POST',
      body: { method: 'cash', amount: bill2Res.data.bill.total, tip_amount: 150 },
      headers: authHeader,
    });
    assertEqual(pay2.status, 200, 'Second payment with tip accepted (200)');

    console.log('\nStep 2: Query Tip Pool Summary');
    const summaryRes1 = await api(baseUrl, '/api/bills/tips/summary', { headers: authHeader });
    assertEqual(summaryRes1.status, 200, 'Tip summary returned 200');
    assertEqual(summaryRes1.data.summary.totalTipsCollected, 250, 'Total tips collected is 250 (100 + 150)');
    assertEqual(summaryRes1.data.summary.pendingTips, 250, 'Pending tips to distribute is 250');

    console.log('\nStep 3: Distribute Shift Tips (Equal Split between Alice & Bob)');
    const distRes = await api(baseUrl, '/api/bills/tips/distribute', {
      method: 'POST',
      body: {
        distribution_rule: 'equal_split',
        staff_ids: ['server-1', 'kitchen-1'],
      },
      headers: authHeader,
    });
    assertEqual(distRes.status, 201, 'Tip distribution executed (201)');
    assertEqual(distRes.data.distribution.total_tips, 250, 'Distributed pool total is 250');
    assertEqual(distRes.data.distribution.allocations.length, 2, '2 staff allocated');

    const aliceAlloc = distRes.data.distribution.allocations.find((a: any) => a.userId === 'server-1');
    const bobAlloc = distRes.data.distribution.allocations.find((a: any) => a.userId === 'kitchen-1');
    assertEqual(aliceAlloc.allocatedAmount, 125, 'Alice received 125');
    assertEqual(bobAlloc.allocatedAmount, 125, 'Bob received 125');

    console.log('\nStep 4: Query Updated Summary and Allocations');
    const summaryRes2 = await api(baseUrl, '/api/bills/tips/summary', { headers: authHeader });
    assertEqual(summaryRes2.data.summary.totalTipsDistributed, 250, 'Total distributed is 250');
    assertEqual(summaryRes2.data.summary.pendingTips, 0, 'Pending tips is now 0');

    console.log('\nStep 5: Points Percentage Distribution Test (60/40 Split)');
    // Add another order with 100 tip
    const order3 = await api(baseUrl, '/api/orders', {
      method: 'POST',
      body: { type: 'takeaway', items: [{ product_id: 'prod-pasta', quantity: 1 }] },
      headers: authHeader,
    });
    const bill3Res = await api(baseUrl, '/api/bills/generate', {
      method: 'POST',
      body: { order_id: order3.data.order.id },
      headers: authHeader,
    });
    await api(baseUrl, `/api/bills/${bill3Res.data.bill.id}/payment`, {
      method: 'POST',
      body: { method: 'cash', amount: bill3Res.data.bill.total, tip_amount: 100 },
      headers: authHeader,
    });

    const distRes2 = await api(baseUrl, '/api/bills/tips/distribute', {
      method: 'POST',
      body: {
        distribution_rule: 'points_percentage',
        staff_ids: ['server-1', 'kitchen-1'],
      },
      headers: authHeader,
    });
    assertEqual(distRes2.status, 201, 'Points distribution executed (201)');
    const aliceP = distRes2.data.distribution.allocations.find((a: any) => a.userId === 'server-1');
    const bobP = distRes2.data.distribution.allocations.find((a: any) => a.userId === 'kitchen-1');
    assertEqual(aliceP.allocatedAmount, 60, 'Alice received 60% (60 INR)');
    assertEqual(bobP.allocatedAmount, 40, 'Bob received 40% (40 INR)');

    console.log('\nAll Tip Handling & Pooling tests passed successfully!');
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
