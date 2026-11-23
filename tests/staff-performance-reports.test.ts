/**
 * Integration Test: Labor & Staff Performance Reporting
 *
 * Usage: node tests/run-electron-node-test.cjs tests/staff-performance-reports.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-staff-reports-test-'));

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
  console.log('Testing Labor & Staff Performance Reporting...');
  console.log('='.repeat(55));

  const db = initTestDb();
  const { authHeader } = seedOwnerUser(db);
  const { now } = require('../main/db');
  seedCategory(db, 'cat-main', 'Mains');
  seedProduct(db, 'prod-1', 'cat-main', 'Pasta', 250);

  const app = createApp({});
  registerRoutes(app);
  const { baseUrl, server } = await startServer(app);

  try {
    const nowTs = now();
    const today = nowTs.substring(0, 10);

    // 1. Seed Staff Users (Server 1 and Server 2)
    db.prepare(`
      INSERT INTO users (id, name, email, password, pin, role, is_active, created_at, updated_at)
      VALUES ('user-s1', 'Aarav Waiter', 'aarav@example.com', 'dummy_hash', '1111', 'server', 1, ?, ?)
    `).run(nowTs, nowTs);

    db.prepare(`
      INSERT INTO users (id, name, email, password, pin, role, is_active, created_at, updated_at)
      VALUES ('user-s2', 'Deepa Waiter', 'deepa@example.com', 'dummy_hash', '2222', 'server', 1, ?, ?)
    `).run(nowTs, nowTs);

    // 2. Create Orders for Server 1 (2 orders: 500 and 1000 => avg check 750, total 1500)
    db.prepare(`
      INSERT INTO orders (id, order_number, user_id, status, subtotal, tax_amount, total, created_at, updated_at)
      VALUES (101, 'ORD-101', 'user-s1', 'completed', 476.19, 23.81, 500, ?, ?)
    `).run(nowTs, nowTs);

    db.prepare(`
      INSERT INTO orders (id, order_number, user_id, status, subtotal, tax_amount, total, created_at, updated_at)
      VALUES (102, 'ORD-102', 'user-s1', 'completed', 952.38, 47.62, 1000, ?, ?)
    `).run(nowTs, nowTs);

    // 3. Create Orders for Server 2 (1 order: 1500 => avg check 1500, total 1500)
    db.prepare(`
      INSERT INTO orders (id, order_number, user_id, status, subtotal, tax_amount, total, created_at, updated_at)
      VALUES (103, 'ORD-103', 'user-s2', 'completed', 1428.57, 71.43, 1500, ?, ?)
    `).run(nowTs, nowTs);

    // Total revenue = 500 + 1000 + 1500 = 3000

    // 4. Seed Payroll/Salaries Expense (e.g. 600 labor cost)
    db.prepare(`
      INSERT INTO expense_categories (id, name, is_active, created_at)
      VALUES ('cat-payroll', 'Staff Salaries & Wages', 1, ?)
    `).run(nowTs);

    db.prepare(`
      INSERT INTO expenses (id, category_id, amount, payment_method, expense_date, notes, created_at)
      VALUES ('exp-pay-1', 'cat-payroll', 600, 'cash', ?, 'Daily staff wages', ?)
    `).run(today, nowTs);

    // 5. Query /api/reports/staff-performance
    const res = await api(baseUrl, `/api/reports/staff-performance?start_date=${today}&end_date=${today}`, {
      headers: authHeader,
    });

    assertEqual(res.status, 200, 'staff-performance returns 200');
    assertEqual(res.data.ok, true, 'ok is true');
    assertEqual(res.data.total_revenue, 3000, 'total_revenue is 3000');
    assertEqual(res.data.total_labor_cost, 600, 'total_labor_cost is 600');
    assertEqual(res.data.labor_cost_percentage, 20, 'labor_cost_percentage is (600/3000)*100 = 20%');

    // 6. Verify Server 1 performance breakdown
    const s1 = res.data.staff.find((s: any) => s.id === 'user-s1');
    assert(Boolean(s1), 'Aarav Waiter present in report');
    assertEqual(s1.orders_served, 2, 'Aarav served 2 orders');
    assertEqual(s1.total_sales, 1500, 'Aarav total sales is 1500');
    assertEqual(s1.average_check_size, 750, 'Aarav average check size is 750');

    // 7. Verify Server 2 performance breakdown
    const s2 = res.data.staff.find((s: any) => s.id === 'user-s2');
    assert(Boolean(s2), 'Deepa Waiter present in report');
    assertEqual(s2.orders_served, 1, 'Deepa served 1 order');
    assertEqual(s2.total_sales, 1500, 'Deepa total sales is 1500');
    assertEqual(s2.average_check_size, 1500, 'Deepa average check size is 1500');

    console.log('  ✓ Staff sales per server verified');
    console.log('  ✓ Average check size per employee verified');
    console.log('  ✓ Labor cost percentage of revenue verified (20.0%)');

    console.log('\n' + '='.repeat(55));
    const { passed, failed } = getResults();
    console.log(`Results: ${passed} passed, ${failed} failed`);
    assert(failed === 0, `Expected 0 failures, got ${failed}`);
  } finally {
    server.close();
    closeDatabase();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
