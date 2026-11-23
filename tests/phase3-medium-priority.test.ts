/**
 * Integration Test: Phase 3 Medium Priority Gaps
 * Tests: Procurement PO & GRN stock inwarding, Labor & Staff Performance Reports, Table Waitlist & Seating.
 *
 * Usage: node tests/run-electron-node-test.cjs tests/phase3-medium-priority.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-p3-test-'));

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
const { verifyAuditChain } = require('../main/services/audit');

async function main() {
  console.log('🧪 Phase 3 Medium Priority: Procurement GRN, Labor Analytics, & Waitlist');
  console.log('='.repeat(70));

  const db = initTestDb();
  const { authHeader } = seedOwnerUser(db);
  seedCategory(db, 'cat_general', 'General');

  const app = createApp({});
  registerRoutes(app);
  const { baseUrl, server } = await startServer(app);

  try {
    // ── 1. Procurement & Supplier PO with Inward GRN Stock Updates ───────────
    console.log('\nPart 1: Procurement & Inward GRN Stock Updates');

    // 1. Create raw ingredient and vendor
    db.prepare(`
      INSERT INTO raw_ingredients (id, name, unit, current_stock, minimum_stock, cost_per_unit, is_active)
      VALUES ('ing_flour', 'All-Purpose Flour', 'kg', 10, 5, 45.0, 1)
    `).run();

    const vendorRes = await api(baseUrl, '/api/vendors', {
      method: 'POST',
      headers: authHeader,
      body: {
        name: 'Apex Flour Millers',
        phone: '9876543210',
        gstin: '07AAAAA1234A1Z1',
      },
    });
    assertEqual(vendorRes.status, 201, 'Vendor created');
    const vendorId = vendorRes.data.vendor.id;

    // 2. Create Purchase Order with GRN receipt (inward 25 kg of flour)
    const poRes = await api(baseUrl, '/api/vendors/purchases', {
      method: 'POST',
      headers: authHeader,
      body: {
        vendor_id: vendorId,
        invoice_number: 'INV-APEX-901',
        paid_amount: 1125.0,
        items: [
          { ingredient_id: 'ing_flour', quantity: 25, unit_price: 45.0, tax_rate: 0 },
        ],
      },
    });
    assertEqual(poRes.status, 201, 'Purchase Order created and inward GRN executed');
    assertEqual(poRes.data.total_amount, 1125.0, 'PO total calculated accurately');

    // Assert that ingredient current_stock was incremented by exactly 25 kg (10 + 25 = 35)
    const flour = db.prepare('SELECT current_stock, cost_per_unit FROM raw_ingredients WHERE id = ?').get('ing_flour');
    assertEqual(flour.current_stock, 35, 'Raw ingredient stock incremented by 25kg (10 -> 35)');
    assertEqual(flour.cost_per_unit, 45.0, 'Unit cost updated from PO');

    // ── 2. Labor & Staff Performance Reports ─────────────────────────────────
    console.log('\nPart 2: Labor & Staff Performance Reports');

    // Seed waiter and sales orders
    db.prepare(`
      INSERT INTO users (id, name, email, password, role, is_active, created_at, updated_at)
      VALUES ('server_neha', 'Neha Server', 'neha@restaurant.com', 'dummy_hash', 'server', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();

    const todayDate = new Date().toISOString().slice(0, 10);
    const orderTimestamp = todayDate + ' 13:00:00';

    // 2 orders served by Neha
    db.prepare(`
      INSERT INTO orders (order_number, type, status, subtotal, total, user_id, created_at, updated_at)
      VALUES 
        ('ORD-N1', 'dine_in', 'completed', 1000, 1000, 'server_neha', ?, ?),
        ('ORD-N2', 'dine_in', 'completed', 2000, 2000, 'server_neha', ?, ?)
    `).run(orderTimestamp, orderTimestamp, orderTimestamp, orderTimestamp);

    // Seed payroll expense category and salary entry of 600 INR
    db.prepare(`
      INSERT INTO expense_categories (id, name) VALUES ('cat_payroll', 'Staff Salaries')
    `).run();
    db.prepare(`
      INSERT INTO expenses (id, category_id, amount, expense_date, payment_method, notes, created_at)
      VALUES ('exp_sal_1', 'cat_payroll', 600, ?, 'cash', 'Daily staff wages', CURRENT_TIMESTAMP)
    `).run(todayDate);

    const reportRes = await api(baseUrl, `/api/reports/staff-performance?start_date=${todayDate}&end_date=${todayDate}`, {
      method: 'GET',
      headers: authHeader,
    });

    assertEqual(reportRes.status, 200, 'Staff performance report returns 200');
    assertEqual(reportRes.data.total_revenue, 3000, 'Total revenue is 3000 (1000 + 2000)');
    assertEqual(reportRes.data.total_labor_cost, 600, 'Labor cost is 600');
    assertEqual(reportRes.data.labor_cost_percentage, 20.0, 'Labor cost is exactly 20.0% of revenue');

    const nehaStats = reportRes.data.staff.find((s: any) => s.id === 'server_neha');
    assert(nehaStats !== undefined, 'Neha Server present in performance report');
    assertEqual(nehaStats.orders_served, 2, '2 orders served');
    assertEqual(nehaStats.total_sales, 3000, '3000 total sales');
    assertEqual(nehaStats.average_check_size, 1500, 'Average check size is 1500');

    // ── 3. Table Waitlist & Seating Management ────────────────────────────────
    console.log('\nPart 3: Table Waitlist & Seating Management');

    // Seed a table
    db.prepare(`
      INSERT INTO tables (id, number, capacity, status, is_active, created_at, updated_at)
      VALUES ('tbl_5', '5', 4, 'available', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();

    // 1. Add walk-in customer to waitlist
    const waitlistRes = await api(baseUrl, '/api/reservations/waitlist', {
      method: 'POST',
      headers: authHeader,
      body: {
        customer_name: 'Vikram Mehta',
        customer_phone: '9988776655',
        party_size: 4,
        estimated_wait_minutes: 20,
      },
    });

    assertEqual(waitlistRes.status, 201, 'Customer added to waitlist');
    const waitlistId = waitlistRes.data.entry.id;
    assertEqual(waitlistRes.data.entry.status, 'waiting', 'Initial status is waiting');

    // 2. Seat customer at Table 5
    const seatRes = await api(baseUrl, `/api/reservations/waitlist/${waitlistId}/status`, {
      method: 'PATCH',
      headers: authHeader,
      body: {
        status: 'seated',
        table_id: 'tbl_5',
      },
    });

    assertEqual(seatRes.status, 200, 'Waitlist entry status updated to seated');
    assertEqual(seatRes.data.entry.status, 'seated', 'Status is seated');
    assertEqual(seatRes.data.entry.seated_table_id, 'tbl_5', 'Bound to Table 5');

    // Verify Table 5 status automatically switched to occupied
    const table5 = db.prepare('SELECT status FROM tables WHERE id = ?').get('tbl_5');
    assertEqual(table5.status, 'occupied', 'Table status automatically transitioned to occupied');

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
  console.error('Fatal error in phase 3 test:', err);
  process.exit(1);
});
