import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import cloudWorker from '../apps/cloud-api/src/index';
import { createJWT } from '../apps/cloud-api/src/auth';
import { handleDashboardReport } from '../apps/cloud-api/src/routes/dashboard-reports';
import { UserMembership } from '../apps/cloud-api/src/rbac';

type QueryRecord = { sql: string; params: unknown[] };

class SqliteD1 {
  queries: QueryRecord[] = [];
  constructor(readonly db: DatabaseSync) {}

  prepare(sql: string) {
    const record: QueryRecord = { sql: sql.replace(/\s+/g, ' ').trim(), params: [] };
    this.queries.push(record);
    const statement: any = {
      bind: (...params: unknown[]) => { record.params = params; return statement; },
      first: async () => {
        return this.db.prepare(record.sql).get(...record.params) || null;
      },
      all: async () => {
        return { results: this.db.prepare(record.sql).all(...record.params) };
      },
    };
    return statement;
  }
}

const membership: UserMembership = {
  id: 'membership-a', organization_id: 'org-a', user_id: 'user-a',
  restaurant_id: null, branch_id: 'branch-a', role: 'accountant', status: 'active',
};

async function run() {
  const rawDb = new DatabaseSync(':memory:');
  const migrations = path.resolve(__dirname, '../apps/cloud-api/migrations');
  for (const migration of fs.readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
    rawDb.exec(fs.readFileSync(path.join(migrations, migration), 'utf8'));
  }
  const now = '2026-11-03T06:00:00.000Z';
  rawDb.prepare(`INSERT INTO organizations (id, name, currency, country, timezone, created_at, updated_at) VALUES (?, ?, 'INR', 'IN', 'Asia/Kolkata', ?, ?)`).run('org-a', 'Restaurant A', now, now);
  rawDb.prepare(`INSERT INTO branches (id, organization_id, code, name, is_main_branch, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run('branch-a', 'org-a', 'A', 'Branch A', 1, now, now);
  rawDb.prepare(`INSERT INTO branches (id, organization_id, code, name, is_main_branch, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run('branch-b', 'org-a', 'B', 'Branch B', 0, now, now);
  rawDb.prepare(`INSERT INTO cloud_users (id, organization_id, email, name, role, assigned_branch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('user-a', 'org-a', 'accountant@example.test', 'Test Accountant', 'accountant', 'branch-a', now, now);
  rawDb.prepare(`INSERT INTO memberships (id, organization_id, user_id, branch_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`)
    .run('membership-a', 'org-a', 'user-a', 'branch-a', 'accountant', now, now);
  rawDb.prepare(`INSERT INTO master_categories (id, organization_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run('category-a', 'org-a', 'Mains', now, now);
  rawDb.prepare(`INSERT INTO master_products (id, organization_id, category_id, name, base_price, tax_rate, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('product-a', 'org-a', 'category-a', 'Test Meal', 100, 5, now, now);
  const insertOrder = rawDb.prepare(`INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, subtotal, tax_total, discount_total, grand_total, payment_method, ordered_at, synced_at, table_number, customer_name, customer_phone, created_by_user_id, created_by_name, kitchen_status, payment_status, updated_at) VALUES (?, 'org-a', 'branch-a', ?, 'dine_in', ?, ?, 0, 0, ?, 'cash', ?, ?, 'T-1', 'Test Customer', '5550011', 'user-a', 'Casey', 'pending', ?, ?)`);
  insertOrder.run('order-a', 'A-1', 'preparing', 1200, 1275, now, now, 'paid', now);
  insertOrder.run('order-pending', 'A-2', 'pending', 300, 300, now, now, 'unpaid', now);
  insertOrder.run('order-completed', 'A-3', 'completed', 300, 300, now, now, 'unpaid', now);
  rawDb.prepare('UPDATE synced_orders SET completed_at = ? WHERE id = ?').run('2026-11-03T06:30:00.000Z', 'order-completed');
  rawDb.prepare(`INSERT INTO dining_tables (id, organization_id, branch_id, table_number, capacity, status, is_active, created_at, updated_at) VALUES (?, 'org-a', 'branch-a', ?, 4, 'occupied', 1, ?, ?)`)
    .run('table-a', 'T-1', now, now);
  rawDb.prepare(`INSERT INTO synced_order_items (id, order_id, branch_id, product_id, product_name, quantity, unit_price, subtotal, tax_amount, discount_amount, ordered_at) VALUES (?, 'order-a', 'branch-a', 'product-a', 'Test Meal', 2, 600, 1200, 0, 0, ?)`)
    .run('item-a', now);
  rawDb.prepare(`INSERT INTO customer_payments (id, organization_id, branch_id, order_id, payment_method, amount, status, verification_method, created_at, updated_at) VALUES (?, 'org-a', 'branch-a', 'order-a', 'cash', 1275, 'completed', 'cashier_collected', ?, ?)`)
    .run('payment-a', now, now);
  rawDb.prepare(`INSERT INTO customer_payments (id, organization_id, branch_id, order_id, payment_method, amount, status, verification_method, parent_payment_id, refund_reason, cashier_name, created_at, updated_at) VALUES (?, 'org-a', 'branch-a', 'order-a', 'cash', -25, 'refunded', 'cashier_collected', 'payment-a', 'Test refund', 'Casey', ?, ?)`)
    .run('refund-a', now, now);
  rawDb.prepare(`INSERT INTO kitchen_tickets (id, organization_id, branch_id, order_id, ticket_number, station, status, items_json, started_at, ready_at, created_at, updated_at) VALUES (?, 'org-a', 'branch-a', 'order-a', 'K-1', 'main', 'ready', '[]', ?, ?, ?, ?)`)
    .run('ticket-a', '2026-11-03T06:01:00.000Z', '2026-11-03T06:16:00.000Z', now, now);
  const db = new SqliteD1(rawDb);
  const env = { DB: db } as any;
  const report = await handleDashboardReport(
    new Request('https://cloud.test/reports/daily-stats?date=2026-11-03'),
    env, 'org-a', [membership],
  );
  assert.equal(report.status, 200);
  assert.deepEqual(await report.json(), {
    sales: 1250,
    runningOrders: 2,
    pendingOrders: 1,
    tablesOccupied: 1,
    avgTableTurnMinutes: 30,
    paymentMethods: [{ method: 'cash', count: 1, total: 1275 }],
  });

  const scopedQueries = db.queries.filter((query) => query.sql.includes('branch_id IN'));
  assert.ok(scopedQueries.length > 0);
  for (const query of scopedQueries) {
    assert.ok(query.params.includes('branch-a'), 'report query is scoped to the accountant branch');
    assert.ok(!query.params.includes('branch-b'), 'report query excludes an unauthorized branch');
  }
  const dailyQuery = db.queries.find((query) => query.sql.includes('SUM(amount), 0) AS total FROM customer_payments'));
  assert.ok(dailyQuery);
  assert.ok(dailyQuery.params.includes('2026-11-02T18:30:00.000Z'), 'business date begins at Asia/Kolkata midnight');
  assert.ok(dailyQuery.params.includes('2026-11-03T18:30:00.000Z'), 'business date uses an exclusive next-day boundary');

  const summary = await handleDashboardReport(
    new Request('https://cloud.test/reports/summary?date=2026-11-03'), env, 'org-a', [membership],
  );
  assert.equal(summary.status, 200);
  const summaryData = (await summary.json() as any).summary;
  assert.equal(summaryData.customers.new, null, 'Cloud does not fabricate customer acquisition without a customer registry');
  assert.deepEqual(summaryData.orders, { count: 3, total: 1875 });
  assert.deepEqual(summaryData.bills, { count: 1, total: 1275, collected: 1250 });
  const financial = await handleDashboardReport(
    new Request('https://cloud.test/reports/financial-summary?start_date=2026-11-01&end_date=2026-11-03'), env, 'org-a', [membership],
  );
  assert.equal(financial.status, 200);
  const financialData = (await financial.json() as any).financialSummary;
  assert.equal(financialData.grossCollected, 1275);
  assert.equal(financialData.refunded, 25);
  assert.equal(financialData.netCollected, 1250);
  assert.equal(financialData.refundCount, 1);
  const topProducts = await handleDashboardReport(new Request('https://cloud.test/reports/topProducts?date=2026-11-03&limit=5'), env, 'org-a', [membership]);
  assert.equal((await topProducts.json() as any).topProducts[0].product_name, 'Test Meal');
  const recentOrders = await handleDashboardReport(new Request('https://cloud.test/reports/recentOrders?date=2026-11-03&limit=6'), env, 'org-a', [membership]);
  assert.ok((await recentOrders.json() as any).recentOrders.some((order: any) => order.order_number === 'A-1'));
  const insights = await handleDashboardReport(new Request('https://cloud.test/reports/insights?days=30'), env, 'org-a', [membership]);
  const insightData = await insights.json() as any;
  assert.equal(insightData.avgPrepTimeMinutes, 15);
  assert.equal(insightData.topStaff[0].orderCount, 3);
  assert.equal(insightData.topCategories[0].name, 'Mains');
  const forbidden = await handleDashboardReport(
    new Request('https://cloud.test/reports/daily-stats?branch_id=branch-b&date=2026-11-03'),
    env, 'org-a', [membership],
  );
  assert.equal(forbidden.status, 403, 'an accountant cannot query another branch by changing the URL');

  const invalidDate = await handleDashboardReport(
    new Request('https://cloud.test/reports/financial-summary?start_date=2026-02-30&end_date=2026-03-01'),
    env, 'org-a', [membership],
  );
  assert.equal(invalidDate.status, 400, 'invalid calendar dates are rejected');

  const secret = 'cloud-dashboard-report-integration-secret-32-bytes';
  const token = await createJWT({ sub: 'user-a', org: 'org-a', email: 'accountant@example.test', role: 'accountant', branch: 'branch-a', exp: Math.floor(Date.now() / 1000) + 300 }, secret);
  const workerResponse = await cloudWorker.fetch(new Request('https://cloud.test/reports/daily-stats?date=2026-11-03', {
    headers: { Authorization: `Bearer ${token}` },
  }), { DB: db, JWT_SECRET: secret } as any);
  assert.equal(workerResponse.status, 200, 'the public Worker route normalizes and serves the browser report path');
  assert.equal((await workerResponse.json() as any).sales, 1250);

  console.log('Cloud dashboard reports passed: live totals, timezone bounds, branch isolation, and input validation.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
