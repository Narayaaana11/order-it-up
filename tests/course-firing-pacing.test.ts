/**
 * Integration Test: Course Firing & Table Pacing
 *
 * Usage: node tests/run-electron-node-test.cjs tests/course-firing-pacing.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-course-pacing-test-'));

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
  console.log('Integration Test: Course Firing & Table Pacing');
  console.log('='.repeat(50));

  const db = initTestDb();
  const { authHeader } = seedOwnerUser(db);

  seedCategory(db, 'cat-courses', 'Food');
  seedProduct(db, 'prod-soup', 'cat-courses', 'Tomato Soup', 120);
  seedProduct(db, 'prod-steak', 'cat-courses', 'T-Bone Steak', 450);
  seedProduct(db, 'prod-cake', 'cat-courses', 'Chocolate Cake', 180);

  const app = createApp({});
  registerRoutes(app);
  const { baseUrl, server } = await startServer(app);

  try {
    console.log('\nStep 1: Place Dine-In Order with Multi-Course Hold & Fire');
    const orderRes = await api(baseUrl, '/api/orders', {
      method: 'POST',
      body: {
        type: 'dine_in',
        items: [
          { product_id: 'prod-soup', quantity: 2, course: 'appetizer', firing_status: 'fired' },
          { product_id: 'prod-steak', quantity: 2, course: 'main', firing_status: 'held' },
          { product_id: 'prod-cake', quantity: 1, course: 'dessert', firing_status: 'held' },
        ],
      },
      headers: authHeader,
    });
    assertEqual(orderRes.status, 201, 'Order placed with courses (201)');
    const orderId = orderRes.data.order.id;

    // Verify initial states in database
    const items = db.prepare('SELECT id, product_id, course, firing_status, fired_at FROM order_items WHERE order_id = ? ORDER BY id ASC').all(orderId) as any[];
    assertEqual(items.length, 3, '3 order items created');

    const soup = items.find((i: any) => i.product_id === 'prod-soup');
    assertEqual(soup.course, 'appetizer', 'Soup course is appetizer');
    assertEqual(soup.firing_status, 'fired', 'Soup is initially fired');
    assert(Boolean(soup.fired_at), 'Soup has fired_at timestamp');

    const steak = items.find((i: any) => i.product_id === 'prod-steak');
    assertEqual(steak.course, 'main', 'Steak course is main');
    assertEqual(steak.firing_status, 'held', 'Steak is held');
    assertEqual(steak.fired_at, null, 'Steak fired_at is null');

    const cake = items.find((i: any) => i.product_id === 'prod-cake');
    assertEqual(cake.course, 'dessert', 'Cake course is dessert');
    assertEqual(cake.firing_status, 'held', 'Cake is held');

    console.log('\nStep 2: Fire Main Course');
    const fireMainsRes = await api(baseUrl, `/api/orders/${orderId}/fire-course`, {
      method: 'POST',
      body: { course: 'main' },
      headers: authHeader,
    });
    assertEqual(fireMainsRes.status, 200, 'Fire course returned 200');
    assertEqual(fireMainsRes.data.firedCount, 1, '1 item fired');
    assertEqual(fireMainsRes.data.firedCourse, 'main', 'Fired course is main');

    const updatedSteak = db.prepare('SELECT firing_status, fired_at FROM order_items WHERE id = ?').get(steak.id) as any;
    assertEqual(updatedSteak.firing_status, 'fired', 'Steak firing_status is now fired');
    assert(Boolean(updatedSteak.fired_at), 'Steak has fired_at populated');

    const currentCake = db.prepare('SELECT firing_status FROM order_items WHERE id = ?').get(cake.id) as any;
    assertEqual(currentCake.firing_status, 'held', 'Dessert remains held');

    console.log('\nStep 3: Fire Individual Item (Dessert)');
    const fireCakeRes = await api(baseUrl, `/api/orders/${orderId}/items/${cake.id}/fire`, {
      method: 'POST',
      headers: authHeader,
    });
    assertEqual(fireCakeRes.status, 200, 'Individual item fire returned 200');
    assertEqual(fireCakeRes.data.item.firing_status, 'fired', 'Cake is now fired');

    console.log('\nStep 4: Error Handling & Validation');
    const invalidCourseRes = await api(baseUrl, `/api/orders/${orderId}/fire-course`, {
      method: 'POST',
      body: { course: 'midnight_snack' },
      headers: authHeader,
    });
    assertEqual(invalidCourseRes.status, 400, 'Invalid course returns 400');

    console.log('\nAll Course Firing & Pacing tests passed successfully!');
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
