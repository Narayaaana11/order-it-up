/**
 * Integration Test: Phase 2 High Priority Gaps
 * Tests: Course Firing & Table Pacing, Tip Handling & Zero-Leakage Pooling, and e-Invoicing IRN Generation with Audit Trail.
 *
 * Usage: node tests/run-electron-node-test.cjs tests/phase2-high-priority.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-p2-test-'));

Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') {
    return {
      app: {
        isPackaged: true,
        getPath: () => testDir,
        getVersion: () => 'test',
      },
    };
  }
  return originalLoad.apply(this, arguments as any);
};

const {
  initTestDb, createApp, startServer,
  seedOwnerUser, seedCategory, seedProduct,
  api, assert, assertEqual,
  getResults, closeDatabase,
} = require('./helpers/test-setup');

const { registerRoutes } = require('../main/routes/index');
const { distributeTips, getTipSummary } = require('../main/services/tip-engine');
const { registerIrn, generateB2BEinvoiceJson } = require('../main/services/einvoice');
const { verifyAuditChain } = require('../main/services/audit');

async function main() {
  console.log('🧪 Phase 2 High Priority: Course Firing, Tip Pooling, & IRN e-Invoicing');
  console.log('='.repeat(70));

  const db = initTestDb();
  const { authHeader } = seedOwnerUser(db);
  seedCategory(db, 'cat_dining', 'Full Service Dining');
  seedProduct(db, 'prod_appetizer', 'cat_dining', 'Crispy Calamari', 350);
  seedProduct(db, 'prod_entree', 'cat_dining', 'Grilled Ribeye Steak', 950);

  const app = createApp({});
  registerRoutes(app);
  const { baseUrl, server } = await startServer(app);

  try {
    // ── 1. Course Firing & Table Pacing ──────────────────────────────────────
    console.log('\nPart 1: Course Firing & Table Pacing');

    // Place an order with 1 Appetizer (fired) and 1 Main Entree (held)
    const orderRes = await api(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeader,
      body: {
        type: 'dine_in',
        items: [
          { product_id: 'prod_appetizer', quantity: 1, course: 'appetizer', firing_status: 'fired' },
          { product_id: 'prod_entree', quantity: 1, course: 'main', firing_status: 'held' },
        ],
      },
    });

    assertEqual(orderRes.status, 201, 'Order created with courses');
    const orderId = orderRes.data.order.id;

    // Check items in DB
    const items = db.prepare('SELECT id, product_name, course, firing_status FROM order_items WHERE order_id = ?').all(orderId);
    assertEqual(items.length, 2, '2 order items stored');

    const appItem = items.find((i: any) => i.course === 'appetizer');
    const mainItem = items.find((i: any) => i.course === 'main');
    assertEqual(appItem.firing_status, 'fired', 'Appetizer is fired immediately');
    assertEqual(mainItem.firing_status, 'held', 'Main course is initially held');

    // Waiter triggers "Fire Mains"
    const fireRes = await api(baseUrl, `/api/orders/${orderId}/fire-course`, {
      method: 'POST',
      headers: authHeader,
      body: { course: 'main' },
    });

    assertEqual(fireRes.status, 200, 'Fire course endpoint returns 200');
    assertEqual(fireRes.data.firedCount, 1, '1 held main course item fired');

    const updatedMain = db.prepare('SELECT firing_status, fired_at FROM order_items WHERE id = ?').get(mainItem.id);
    assertEqual(updatedMain.firing_status, 'fired', 'Main course updated to fired');
    assert(updatedMain.fired_at !== null, 'fired_at timestamp populated');

    // ── 2. Tip Handling & Zero-Leakage Pooling ────────────────────────────────
    console.log('\nPart 2: Tip Handling & Zero-Leakage Pooling');

    // Seed 3 waiters for tip distribution
    db.prepare(`
      INSERT INTO users (id, name, email, password, role, is_active, created_at, updated_at)
      VALUES 
        ('waiter_1', 'Kavita Server', 'kavita@restaurant.com', 'dummy_hash', 'server', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('waiter_2', 'Rahul Server', 'rahul@restaurant.com', 'dummy_hash', 'server', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('waiter_3', 'Amit Server', 'amit@restaurant.com', 'dummy_hash', 'server', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();

    // Create a bill with tip amount of 100.00 INR (100 / 3 = 33.33 + 33.33 + 33.34 = 100.00 exactly)
    const todayStr = new Date().toISOString().slice(0, 10);
    db.prepare(`
      INSERT INTO bills (order_id, bill_number, subtotal, tax_amount, total, paid_amount, balance, payment_status, tip_amount, tip_payment_method, created_at, updated_at)
      VALUES (?, 'BILL-TIP-100', 1300, 100, 1500, 1500, 0, 'paid', 100.00, 'card', ?, ?)
    `).run(orderId, todayStr + ' 12:00:00', todayStr + ' 12:00:00');

    const tipDist = distributeTips({
      date: todayStr,
      distributionRule: 'equal_split',
      staffIds: ['waiter_1', 'waiter_2', 'waiter_3'],
    });

    assertEqual(tipDist.total_tips, 100.00, 'Total distributed is 100.00');
    assertEqual(tipDist.allocations.length, 3, '3 staff allocations created');

    const totalAllocated = tipDist.allocations.reduce((sum: number, a: any) => sum + a.allocatedAmount, 0);
    assertEqual(Math.round(totalAllocated * 100) / 100, 100.00, 'Zero penny leakage across pool (sum equals exact pool total)');

    // ── 3. Indian GST e-Invoicing (IRN) Readiness ─────────────────────────────
    console.log('\nPart 3: Indian GST e-Invoicing (IRN) Readiness');

    // Configure store GSTIN
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES 
        ('tax_registration_number', '07AAAAA0000A1Z5'),
        ('business_name', 'The Grand Bistro'),
        ('b2b_einvoice_enabled', 'true')
    `).run();

    // Create a B2B bill with buyer GSTIN
    const b2bBillRes = db.prepare(`
      INSERT INTO bills (order_id, bill_number, customer_gstin, customer_legal_name, subtotal, tax_amount, total, paid_amount, balance, payment_status, created_at, updated_at)
      VALUES (?, 'INV-B2B-889', '27BBBBB1111B1Z2', 'Acme Corp Hospitality', 20000, 1000, 21000, 21000, 0, 'paid', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(orderId);

    const b2bBillId = Number(b2bBillRes.lastInsertRowid);

    // Generate IRP IRN
    const irnResult = registerIrn(b2bBillId);
    assertEqual(irnResult.ok, true, 'IRN registration succeeded');
    assertEqual(irnResult.irn.length, 64, 'IRN hash is 64-character uppercase SHA256 hex');
    assert(irnResult.ackNo.length >= 15, 'NIC Ack No has compliant length');
    assert(irnResult.signedQr.includes(irnResult.irn), 'Signed QR payload binds the generated IRN');

    const updatedBill = db.prepare('SELECT einvoice_status, einvoice_irn FROM bills WHERE id = ?').get(b2bBillId);
    assertEqual(updatedBill.einvoice_status, 'generated', 'Bill einvoice_status marked as generated');
    assertEqual(updatedBill.einvoice_irn, irnResult.irn, 'IRN persisted on bill');

    // ── 4. Cryptographic Audit Chain Verification ────────────────────────────
    console.log('\nPart 4: Cryptographic Audit Chain Verification');
    const verification = verifyAuditChain(db);
    assert(verification.valid, `Audit chain valid: ${verification.reason || ''}`);
    assert(verification.totalRows > 0, `Total audit rows checked: ${verification.totalRows}`);

  } finally {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  }

  const results = getResults();
  console.log(`\nResults: ${results.passed}/${results.passed + results.failed} passed`);
  if (results.failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error in phase 2 test:', err);
  process.exit(1);
});
