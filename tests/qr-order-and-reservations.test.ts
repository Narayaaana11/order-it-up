/**
 * Integration Test: QR Self-Ordering and Table Reservations Module
 *
 * Tests:
 * 1. Generating Table QR Code / Payload for digital ordering.
 * 2. Public customer QR Menu fetching (categories, products, modifiers).
 * 3. Customer placing a self-order directly from the table (status: pending).
 * 4. Tracking live status of customer order (pending -> preparing -> completed).
 * 5. Booking a table reservation (guest party, time, phone).
 * 6. Seating a party updates table status to occupied.
 * 7. Completing a reservation marks table available.
 *
 * Usage: node tests/run-electron-node-test.cjs tests/qr-order-and-reservations.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-qr-test-'));
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') return { app: { isPackaged: true, getPath: () => testDir, getVersion: () => 'test' } };
  return originalLoad.apply(this, arguments as any);
};

const {
  initTestDb, createApp, startServer,
  seedOwnerUser, seedManagerUser, seedCategory, seedProduct, seedTable,
  api, assert, assertEqual,
  getResults, closeDatabase,
} = require('./helpers/test-setup');

const { registerRoutes } = require('../main/routes/index');
const { deductIngredientsForOrderItems } = require('../main/services/inventory-engine');

async function main() {
  console.log('Integration Test: QR Self-Ordering & Reservations');
  console.log('='.repeat(50));

  const db = initTestDb();
  const { authHeader } = seedOwnerUser(db);
  const { authHeader: managerAuthHeader } = seedManagerUser(db);

  seedCategory(db, 'cat-desserts', 'Desserts');
  seedProduct(db, 'prod-gulab-jamun', 'cat-desserts', 'Gulab Jamun (2 pcs)', 90);
  seedTable(db, 'tbl-12', 12, 4);

  // Recipe stock lets the test verify that a pending QR request does not
  // consume ingredients before staff approval.
  db.prepare(`
    INSERT INTO raw_ingredients (id, name, unit, current_stock, minimum_stock, cost_per_unit, is_active)
    VALUES ('ing-milk-qr', 'Milk', 'litre', 10, 1, 60, 1)
  `).run();
  db.prepare(`
    INSERT INTO product_recipes (id, product_id, ingredient_id, quantity_required, unit, wastage_percentage)
    VALUES ('recipe-gulab-jamun-milk', 'prod-gulab-jamun', 'ing-milk-qr', 1.5, 'litre', 0)
  `).run();

  const app = createApp({});
  registerRoutes(app);
  const { baseUrl, server } = await startServer(app);

  try {
    // 1. Table QR Code Generation
    console.log('\nStep 1: Generate Table QR Payload');
    const resQR = await api(baseUrl, '/api/qr/tables/tbl-12/code', { headers: authHeader });
    assertEqual(resQR.status, 200, 'Table QR endpoint returned (200)');
    assertEqual(Number(resQR.data.table_number), 12, 'QR mapped to Table #12');
    assert(resQR.data.qr_url.includes('/qr/tbl-12'), 'QR URL contains table order URL');
    assert(resQR.data.qr_data_url.startsWith('data:image/png;base64,'), 'QR data URL contains valid base64 PNG');

    // 2. Fetch Public Menu for Customer
    console.log('\nStep 2: Fetch Public Menu for Customer QR');
    const resMenu = await api(baseUrl, '/api/qr/menu');
    assertEqual(resMenu.status, 200, 'Public QR menu retrieved without auth (200)');
    assert(resMenu.data.categories.length > 0, 'Categories available in QR menu');
    assert(resMenu.data.products.some((p: any) => p.id === 'prod-gulab-jamun'), 'Gulab Jamun listed in QR menu');

    // 3. Place Customer Self-Order from Table 12
    console.log('\nStep 3: Customer Places Self-Order from Table');
    const resOrder = await api(baseUrl, '/api/qr/order', {
      method: 'POST',
      body: {
        table_id: 'tbl-12',
        customer_name: 'Ananya Roy',
        customer_phone: '+919988776655',
        notes: 'Serve warm please',
        items: [
          { product_id: 'prod-gulab-jamun', quantity: 2 },
        ],
      },
    });
    assertEqual(resOrder.status, 201, 'Customer self-order placed successfully (201)');
    assertEqual(Number(resOrder.data.order.table_number), 12, 'Self-order tied to Table 12');
    assertEqual(resOrder.data.order.status, 'pending', 'Self-order initial status is pending');
    const orderId = resOrder.data.order.id;
    const stockBeforeApproval = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get('ing-milk-qr') as any;
    assertEqual(Number(stockBeforeApproval.current_stock), 10, 'Pending QR request does not deduct recipe ingredients');
    const pendingDeductions = db.prepare(
      "SELECT COUNT(*) as count FROM inventory_transactions WHERE type = 'order_deduction'"
    ).get() as any;
    assertEqual(Number(pendingDeductions.count), 0, 'Pending QR request creates no inventory deduction ledger entries');

    // 4. Staff approval moves the request to preparation and deducts ingredients once.
    const resAccept = await api(baseUrl, `/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: { status: 'preparing' },
      headers: authHeader,
    });
    assertEqual(resAccept.status, 200, 'Waiter can accept QR request into preparation');
    const stockAfterApproval = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get('ing-milk-qr') as any;
    assertEqual(Number(stockAfterApproval.current_stock), 7, 'Recipe ingredients deducted after staff approval');
    const deductionCount = db.prepare(
      "SELECT COUNT(*) as count FROM inventory_transactions WHERE type = 'order_deduction'"
    ).get() as any;
    assertEqual(Number(deductionCount.count), 1, 'Approval creates one inventory ledger movement');

    const resRepeatAccept = await api(baseUrl, `/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: { status: 'preparing' },
      headers: authHeader,
    });
    assertEqual(resRepeatAccept.status, 200, 'Repeated approval request is idempotent');
    const stockAfterRepeat = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get('ing-milk-qr') as any;
    assertEqual(Number(stockAfterRepeat.current_stock), 7, 'Repeated approval does not deduct ingredients twice');

    const duplicateDeduction = deductIngredientsForOrderItems(
      [{ product_id: 'prod-gulab-jamun', quantity: 2 }],
      resOrder.data.order.order_number,
      false
    );
    assertEqual(duplicateDeduction.success, true, 'Direct retry of the same order deduction is accepted idempotently');
    const stockAfterDirectRetry = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get('ing-milk-qr') as any;
    assertEqual(Number(stockAfterDirectRetry.current_stock), 7, 'Direct retry does not deduct the same recipe twice');

    const cancelAccepted = await api(baseUrl, `/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: { status: 'cancelled', reason: 'Guest cancelled after acceptance', override_pin: '1234' },
      headers: managerAuthHeader,
    });
    assertEqual(cancelAccepted.status, 200, 'Accepted QR order can be cancelled with manager override');
    const stockAfterAcceptedCancel = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get('ing-milk-qr') as any;
    assertEqual(Number(stockAfterAcceptedCancel.current_stock), 10, 'Cancelling accepted QR order restores recipe ingredients');
    const firstRestorationCount = db.prepare(
      "SELECT COUNT(*) as count FROM inventory_transactions WHERE type = 'order_restoration'"
    ).get() as any;
    assertEqual(Number(firstRestorationCount.count), 1, 'Accepted QR cancellation creates one restoration ledger movement');

    const repeatCancelAccepted = await api(baseUrl, `/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: { status: 'cancelled', reason: 'Repeated cancellation', override_pin: '1234' },
      headers: managerAuthHeader,
    });
    assertEqual(repeatCancelAccepted.status, 200, 'Repeated accepted-order cancellation is idempotent');
    const stockAfterRepeatCancel = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get('ing-milk-qr') as any;
    assertEqual(Number(stockAfterRepeatCancel.current_stock), 10, 'Repeated cancellation does not restore ingredients twice');

    // A pending QR request cancelled before acceptance must not restore stock
    // that was never deducted.
    const resSecondOrder = await api(baseUrl, '/api/qr/order', {
      method: 'POST',
      body: { table_id: 'tbl-12', items: [{ product_id: 'prod-gulab-jamun', quantity: 1 }] },
    });
    assertEqual(resSecondOrder.status, 201, 'Second QR request is created for cancellation check');
    const pendingOrderId = resSecondOrder.data.order.id;
    const cancelPending = await api(baseUrl, `/api/orders/${pendingOrderId}/status`, {
      method: 'PATCH',
      body: { status: 'cancelled', reason: 'Guest cancelled before approval' },
      headers: authHeader,
    });
    assertEqual(cancelPending.status, 200, 'Pending QR request can be cancelled');
    const stockAfterPendingCancel = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get('ing-milk-qr') as any;
    assertEqual(Number(stockAfterPendingCancel.current_stock), 7, 'Cancelling unaccepted QR request does not create stock');
    const restorationCount = db.prepare(
      "SELECT COUNT(*) as count FROM inventory_transactions WHERE type = 'order_restoration'"
    ).get() as any;
    assertEqual(Number(restorationCount.count), 1, 'Cancelling unaccepted QR request creates no additional restoration ledger entry');

    // 5. Live Order Status Tracking
    console.log('\nStep 4: Live Order Status Tracking');
    const resTrack = await api(baseUrl, `/api/qr/order/${orderId}`);
    assertEqual(resTrack.status, 200, 'Live tracking status retrieved (200)');
    assertEqual(Number(resTrack.data.order.table_number), 12, 'Table number preserved in tracking');

    // 5. Table Reservations Module
    console.log('\nStep 5: Table Reservation Lifecycle');
    const resReserve = await api(baseUrl, '/api/reservations', {
      method: 'POST',
      body: {
        customer_name: 'Vikram Mehta',
        customer_phone: '+919123456780',
        table_id: 'tbl-12',
        party_size: 4,
        reservation_date: '2026-09-12',
        reservation_time: '19:30',
        special_requests: 'Anniversary celebration',
      },
      headers: authHeader,
    });
    assertEqual(resReserve.status, 201, 'Reservation booked (201)');
    const resId = resReserve.data.reservation.id;

    // Transition reservation to seated
    const resSeat = await api(baseUrl, `/api/reservations/${resId}/status`, {
      method: 'PATCH',
      body: { status: 'seated' },
      headers: authHeader,
    });
    assertEqual(resSeat.status, 200, 'Party seated (200)');

    // Verify table status is occupied
    const seatedTable = db.prepare('SELECT status FROM tables WHERE id = ?').get('tbl-12') as any;
    assertEqual(seatedTable.status, 'occupied', 'Table status changed to occupied upon seating');

    // Transition reservation to completed
    const resDone = await api(baseUrl, `/api/reservations/${resId}/status`, {
      method: 'PATCH',
      body: { status: 'completed' },
      headers: authHeader,
    });
    assertEqual(resDone.status, 200, 'Reservation completed (200)');

    const freedTable = db.prepare('SELECT status FROM tables WHERE id = ?').get('tbl-12') as any;
    assertEqual(freedTable.status, 'available', 'Table status restored to available upon completion');

    console.log('\nAll QR Self-Ordering & Reservation tests passed!');
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
