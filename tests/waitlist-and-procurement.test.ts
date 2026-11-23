/**
 * Integration Test: Procurement Inward GRN Stock Updates & Walk-in Waitlist
 *
 * Usage: node tests/run-electron-node-test.cjs tests/waitlist-and-procurement.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-waitlist-procure-test-'));

Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') return { app: { isPackaged: true, getPath: () => testDir, getVersion: () => 'test' } };
  return originalLoad.apply(this, arguments as any);
};

const {
  initTestDb, createApp, startServer,
  seedOwnerUser,
  api, assert, assertEqual,
  getResults, closeDatabase,
} = require('./helpers/test-setup');

const { registerRoutes } = require('../main/routes/index');

async function main() {
  console.log('Testing Procurement GRN & Table Waitlist Flow...');
  console.log('='.repeat(55));

  const db = initTestDb();
  const { authHeader } = seedOwnerUser(db);
  const app = createApp({});
  registerRoutes(app);
  const { baseUrl, server } = await startServer(app);

  try {
    // ── Part 1: Walk-in Waitlist Flow ─────────────────────────────────────────
    console.log('\n--- Part 1: Walk-in Waitlist Management ---');

    // 1. Add walk-in party to waitlist
    const addWlRes = await api(baseUrl, '/api/reservations/waitlist', {
      method: 'POST',
      headers: authHeader,
      body: {
        customer_name: 'Rahul Verma',
        customer_phone: '+919876543210',
        party_size: 4,
        estimated_wait_minutes: 20,
        notes: 'Needs high chair',
      },
    });

    assertEqual(addWlRes.status, 201, 'Should add party to waitlist');
    assertEqual(addWlRes.data.ok, true, 'ok is true');
    assertEqual(addWlRes.data.entry.customer_name, 'Rahul Verma', 'customer_name matches');
    assertEqual(addWlRes.data.entry.party_size, 4, 'party_size is 4');
    assertEqual(addWlRes.data.entry.status, 'waiting', 'status is waiting');
    const wlId = addWlRes.data.entry.id;
    console.log('  ✓ Party added to waitlist with status waiting');

    // 2. Fetch active waitlist
    const listWlRes = await api(baseUrl, '/api/reservations/waitlist', {
      headers: authHeader,
    });
    assertEqual(listWlRes.status, 200, 'list waitlist returns 200');
    assert(listWlRes.data.waitlist.some((w: any) => w.id === wlId), 'Waitlist should contain Rahul');
    console.log('  ✓ Active waitlist contains the queued party');

    // 3. Notify party
    const notifyRes = await api(baseUrl, `/api/reservations/waitlist/${wlId}/status`, {
      method: 'PATCH',
      headers: authHeader,
      body: { status: 'notified' },
    });
    assertEqual(notifyRes.status, 200, 'notify returns 200');
    assertEqual(notifyRes.data.entry.status, 'notified', 'status is notified');
    assert(Boolean(notifyRes.data.entry.notified_at), 'notified_at timestamp set');
    console.log('  ✓ Party marked notified with notification timestamp');

    // 4. Seed a table and seat party
    const nowTs = new Date().toISOString();
    db.prepare(`
      INSERT INTO tables (id, number, capacity, status, created_at, updated_at)
      VALUES ('tbl-wl-1', 'T-40', 4, 'available', ?, ?)
    `).run(nowTs, nowTs);

    const seatRes = await api(baseUrl, `/api/reservations/waitlist/${wlId}/status`, {
      method: 'PATCH',
      headers: authHeader,
      body: {
        status: 'seated',
        table_id: 'tbl-wl-1',
      },
    });
    assertEqual(seatRes.status, 200, 'seat returns 200');
    assertEqual(seatRes.data.entry.status, 'seated', 'status is seated');
    assertEqual(seatRes.data.entry.seated_table_id, 'tbl-wl-1', 'seated_table_id matches');
    assert(Boolean(seatRes.data.entry.seated_at), 'seated_at timestamp set');

    // Check table status became occupied
    const tableRow = db.prepare('SELECT status FROM tables WHERE id = ?').get('tbl-wl-1') as any;
    assertEqual(tableRow.status, 'occupied', 'Table status changed to occupied');
    console.log('  ✓ Party seated and table automatically marked occupied');

    // ── Part 2: Procurement Inward GRN Stock Updates ──────────────────────────
    console.log('\n--- Part 2: Procurement PO & Inward GRN Stock Updates ---');

    // 1. Create a vendor
    const vendorRes = await api(baseUrl, '/api/vendors', {
      method: 'POST',
      headers: authHeader,
      body: {
        name: 'Metro Daily Farm Supplies',
        contact_person: 'Suresh Kumar',
        phone: '9988776655',
        gstin: '29ABCDE1234F1Z5',
      },
    });
    assertEqual(vendorRes.status, 201, 'vendor creation returns 201');
    const vendorId = vendorRes.data.vendor.id;

    // 2. Create raw ingredient
    const ingId = 'raw-tomatoes-1';
    db.prepare(`
      INSERT INTO raw_ingredients (id, name, unit, cost_per_unit, current_stock, minimum_stock, is_active, created_at, updated_at)
      VALUES (?, 'Farm Tomatoes', 'kg', 30.0, 10.0, 5.0, 1, ?, ?)
    `).run(ingId, nowTs, nowTs);
    const initialStock = 10.0;

    // 3. Create purchase order (GRN receipt)
    const inwardQty = 50.0;
    const poRes = await api(baseUrl, '/api/vendors/purchases', {
      method: 'POST',
      headers: authHeader,
      body: {
        vendor_id: vendorId,
        invoice_number: 'INV-2026-009',
        items: [
          {
            ingredient_id: ingId,
            quantity: inwardQty,
            unit_price: 35.0,
            tax_rate: 5,
          },
        ],
        paid_amount: 1000,
        payment_method: 'bank_transfer',
      },
    });
    assertEqual(poRes.status, 201, 'Should create purchase order');
    console.log('  ✓ Purchase order recorded with inward goods');

    // 4. Verify raw ingredient stock incremented
    const ingredientAfter = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(ingId) as any;
    assertEqual(
      ingredientAfter.current_stock,
      initialStock + inwardQty,
      'Raw ingredient stock should be incremented by inward GRN quantity'
    );
    console.log(`  ✓ Raw ingredient stock incremented from ${initialStock} to ${ingredientAfter.current_stock}`);

    // 5. Verify vendor balance updated
    const vendorAfter = db.prepare('SELECT balance FROM vendors WHERE id = ?').get(vendorId) as any;
    assert(vendorAfter.balance > 0, 'Vendor balance tracks unpaid amount');
    console.log(`  ✓ Vendor balance updated with outstanding balance (${vendorAfter.balance})`);

    // 6. Verify inventory transaction logged
    const txRow = db.prepare('SELECT * FROM inventory_transactions WHERE ingredient_id = ? AND type = ?').get(ingId, 'purchase_inward') as any;
    assert(Boolean(txRow), 'inventory transaction with type purchase_inward logged');
    assertEqual(txRow.quantity, inwardQty, 'transaction quantity matches inward qty');
    assertEqual(txRow.balance_after, initialStock + inwardQty, 'balance_after matches new stock');
    console.log('  ✓ Inventory transaction recorded with type purchase_inward');

    console.log('\n' + '='.repeat(55));
    const { passed, failed } = getResults();
    console.log(`Results: ${passed} passed, ${failed} failed`);
    assert(failed === 0, `Expected 0 failures, got ${failed}`);
  } finally {
    server.close();
    closeDatabase();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

main().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
