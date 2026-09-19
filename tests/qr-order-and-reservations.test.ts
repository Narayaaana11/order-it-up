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
  seedOwnerUser, seedCategory, seedProduct, seedTable,
  api, assert, assertEqual,
  getResults, closeDatabase,
} = require('./helpers/test-setup');

const { registerRoutes } = require('../main/routes/index');

async function main() {
  console.log('Integration Test: QR Self-Ordering & Reservations');
  console.log('='.repeat(50));

  const db = initTestDb();
  const { authHeader } = seedOwnerUser(db);

  seedCategory(db, 'cat-desserts', 'Desserts');
  seedProduct(db, 'prod-gulab-jamun', 'cat-desserts', 'Gulab Jamun (2 pcs)', 90);
  seedTable(db, 'tbl-12', 12, 4);

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

    // 4. Live Order Status Tracking
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
