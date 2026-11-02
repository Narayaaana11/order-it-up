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
  db.prepare(`
    INSERT INTO addon_groups (id, name, is_required, min_selection, max_selection, allow_multiple_quantities, is_active)
    VALUES ('group-jamun-syrup', 'Syrup', 1, 1, 1, 0, 1), ('group-unlinked', 'Unlinked', 0, 0, 1, 0, 1)
  `).run();
  db.prepare(`
    INSERT INTO addons (id, addon_group_id, name, price, is_active)
    VALUES ('addon-jamun-syrup', 'group-jamun-syrup', 'Extra syrup', 15, 1),
           ('addon-unlinked', 'group-unlinked', 'Unlinked extra', 1, 1)
  `).run();
  db.prepare('INSERT INTO addon_group_product (product_id, addon_group_id) VALUES (?, ?)')
    .run('prod-gulab-jamun', 'group-jamun-syrup');
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
    assert(resQR.data.qr_url.includes('#token='), 'Table capability is carried in the URL fragment, not sent to the web server');
    assert(!resQR.data.qr_url.includes('?token='), 'Table capability is absent from the HTTP query string');
    assertEqual(typeof resQR.data.table_token, 'string', 'Generated QR includes a table capability');
    assertEqual(resQR.data.table_token.length, 43, 'Table capability has 256 bits of random entropy');
    const tableToken = resQR.data.table_token;
    const storedQrToken = db.prepare('SELECT token_hash FROM qr_table_tokens WHERE table_id = ?').get('tbl-12') as any;
    assertEqual(storedQrToken.token_hash.length, 64, 'Only a SHA-256 digest of the table capability is stored');
    assert(storedQrToken.token_hash !== tableToken, 'Raw table capability is not stored in the database');
    assert(resQR.data.qr_data_url.startsWith('data:image/png;base64,'), 'QR data URL contains valid base64 PNG');

    const unauthenticatedQr = await api(baseUrl, '/api/qr/tables/tbl-12/code');
    assertEqual(unauthenticatedQr.status, 401, 'Unauthenticated callers cannot mint or rotate table QR capabilities');

    // 2. Fetch Public Menu for Customer
    console.log('\nStep 2: Fetch Public Menu for Customer QR');
    const resMenu = await api(baseUrl, '/api/qr/menu');
    assertEqual(resMenu.status, 200, 'Public QR menu retrieved without auth (200)');
    assert(resMenu.data.categories.length > 0, 'Categories available in QR menu');
    assert(resMenu.data.products.some((p: any) => p.id === 'prod-gulab-jamun'), 'Gulab Jamun listed in QR menu');
    const publicMenuProduct = resMenu.data.products.find((p: any) => p.id === 'prod-gulab-jamun');
    assertEqual(publicMenuProduct.addon_groups[0].is_required, true, 'Public QR menu exposes required modifier rules');
    assert(!Object.prototype.hasOwnProperty.call(publicMenuProduct, 'track_inventory'), 'Public QR menu does not disclose inventory tracking configuration');
    assert(!Object.prototype.hasOwnProperty.call(publicMenuProduct, 'stock_quantity'), 'Public QR menu does not disclose exact stock quantities');
    const menuWithoutTableProof = await api(baseUrl, '/api/qr/menu?table_id=tbl-12');
    assertEqual(menuWithoutTableProof.status, 404, 'A table ID alone cannot access a table-scoped QR menu');
    const tableMenu = await api(baseUrl, '/api/qr/menu?table_id=tbl-12', {
      headers: { Authorization: `Bearer ${tableToken}` },
    });
    assertEqual(tableMenu.status, 200, 'The issued table capability grants access to its table menu');
    const invalidTableMenu = await api(baseUrl, '/api/qr/menu?table_id=tbl-12', {
      headers: { Authorization: `Bearer ${'A'.repeat(43)}` },
    });
    assertEqual(invalidTableMenu.status, 404, 'Invalid table capability does not disclose table menu');

    const missingRequiredAddon = await api(baseUrl, '/api/qr/order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tableToken}` },
      body: { table_id: 'tbl-12', items: [{ product_id: 'prod-gulab-jamun', quantity: 1 }] },
    });
    assertEqual(missingRequiredAddon.status, 400, 'Required product modifier cannot be omitted');
    const unrelatedAddon = await api(baseUrl, '/api/qr/order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tableToken}` },
      body: { table_id: 'tbl-12', items: [{ product_id: 'prod-gulab-jamun', quantity: 1, addons: ['addon-unlinked'] }] },
    });
    assertEqual(unrelatedAddon.status, 400, 'An active add-on from an unrelated product group is rejected');
    const invalidQuantity = await api(baseUrl, '/api/qr/order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tableToken}` },
      body: { table_id: 'tbl-12', items: [{ product_id: 'prod-gulab-jamun', quantity: 1.5, addons: ['addon-jamun-syrup'] }] },
    });
    assertEqual(invalidQuantity.status, 400, 'Fractional QR item quantities are rejected');

    // 3. Place Customer Self-Order from Table 12
    console.log('\nStep 3: Customer Places Self-Order from Table');
    const forgedTableOrder = await api(baseUrl, '/api/qr/order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${'A'.repeat(43)}` },
      body: {
        table_id: 'tbl-12',
        items: [{ product_id: 'prod-gulab-jamun', quantity: 2 }],
      },
    });
    assertEqual(forgedTableOrder.status, 404, 'A guessed table ID without its capability cannot create an order');

    const resOrder = await api(baseUrl, '/api/qr/order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tableToken}` },
      body: {
        table_id: 'tbl-12',
        customer_name: 'Ananya Roy',
        customer_phone: '+919988776655',
        notes: 'Serve warm please',
        items: [
          { product_id: 'prod-gulab-jamun', quantity: 2, addons: ['addon-jamun-syrup'] },
        ],
      },
    });
    assertEqual(resOrder.status, 201, 'Customer self-order placed successfully (201)');
    assertEqual(Number(resOrder.data.order.table_number), 12, 'Self-order tied to Table 12');
    assertEqual(resOrder.data.order.status, 'pending', 'Self-order initial status is pending');
    const trackingToken = resOrder.data.order.tracking_token;
    assertEqual(typeof trackingToken, 'string', 'Self-order returns a private tracking capability');
    assertEqual(trackingToken.length, 43, 'Tracking capability has 256 bits of random entropy');
    const noTrackingAccess = await api(baseUrl, `/api/qr/order/${resOrder.data.order.id}`);
    assertEqual(noTrackingAccess.status, 404, 'Sequential order ID alone cannot read private tracking details');
    const invalidTrackingAccess = await api(baseUrl, `/api/qr/order/${resOrder.data.order.id}`, {
      headers: { Authorization: `Bearer ${'A'.repeat(43)}` },
    });
    assertEqual(invalidTrackingAccess.status, 404, 'Invalid tracking token does not disclose order existence');
    const tableBeforeApproval = db.prepare('SELECT status FROM tables WHERE id = ?').get('tbl-12') as any;
    assertEqual(tableBeforeApproval.status, 'available', 'Pending QR request does not occupy the table before staff approval');
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
    const tableAfterApproval = db.prepare('SELECT status FROM tables WHERE id = ?').get('tbl-12') as any;
    assertEqual(tableAfterApproval.status, 'occupied', 'Staff acceptance marks the table occupied');
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
      headers: { Authorization: `Bearer ${tableToken}` },
      body: { table_id: 'tbl-12', items: [{ product_id: 'prod-gulab-jamun', quantity: 1, addons: ['addon-jamun-syrup'] }] },
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
    // The accepted order was cancelled above, restoring stock to its original value (10).
    // Cancelling this still-pending request must leave that restored stock unchanged.
    assertEqual(Number(stockAfterPendingCancel.current_stock), 10, 'Cancelling unaccepted QR request leaves stock unchanged');
    const restorationCount = db.prepare(
      "SELECT COUNT(*) as count FROM inventory_transactions WHERE type = 'order_restoration'"
    ).get() as any;
    assertEqual(Number(restorationCount.count), 1, 'Cancelling unaccepted QR request creates no additional restoration ledger entry');

    // 5. Live Order Status Tracking
    console.log('\nStep 4: Live Order Status Tracking');
    const resTrack = await api(baseUrl, `/api/qr/order/${orderId}`, {
      headers: { Authorization: `Bearer ${trackingToken}` },
    });
    assertEqual(resTrack.status, 200, 'Live tracking status retrieved (200)');
    assertEqual(Number(resTrack.data.order.table_number), 12, 'Table number preserved in tracking');

    const rotatedQr = await api(baseUrl, '/api/qr/tables/tbl-12/code', { headers: authHeader });
    assertEqual(rotatedQr.status, 200, 'Authorized staff can rotate a table capability by issuing a replacement QR code');
    const oldTableCapability = await api(baseUrl, '/api/qr/menu?table_id=tbl-12', {
      headers: { Authorization: `Bearer ${tableToken}` },
    });
    assertEqual(oldTableCapability.status, 404, 'Reissuing a table code revokes the previously printed capability');
    const newTableCapability = await api(baseUrl, '/api/qr/menu?table_id=tbl-12', {
      headers: { Authorization: `Bearer ${rotatedQr.data.table_token}` },
    });
    assertEqual(newTableCapability.status, 200, 'Replacement table capability grants table menu access');

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
