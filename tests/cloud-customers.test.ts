import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import cloudWorker from '../apps/cloud-api/src/index';
import { createJWT } from '../apps/cloud-api/src/auth';

class SqliteD1 {
  constructor(readonly db: DatabaseSync) {}
  prepare(sql: string) {
    const record: { sql: string; params: unknown[] } = { sql: sql.replace(/\s+/g, ' ').trim(), params: [] };
    const statement: any = {
      bind: (...params: unknown[]) => { record.params = params; return statement; },
      first: async () => this.db.prepare(record.sql).get(...record.params) || null,
      all: async () => ({ results: this.db.prepare(record.sql).all(...record.params) }),
      run: async () => {
        const result = this.db.prepare(record.sql).run(...record.params);
        return { success: true, meta: { changes: Number(result.changes) } };
      },
    };
    return statement;
  }
  async batch(statements: any[]) {
    const results: any[] = [];
    this.db.exec('BEGIN');
    try { for (const statement of statements) results.push(await statement.run()); this.db.exec('COMMIT'); }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return results;
  }
}

const SECRET = 'customer-registry-integration-secret-32-bytes';
const ORG = 'org-crm';
const NOW = new Date().toISOString();

function seed(rawDb: DatabaseSync) {
  const migrations = path.resolve(__dirname, '../apps/cloud-api/migrations');
  for (const migration of fs.readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
    rawDb.exec(fs.readFileSync(path.join(migrations, migration), 'utf8'));
  }
  for (const [orgId, name] of [[ORG, 'CRM Restaurant'], ['org-crm-other', 'Other']] as const) {
    rawDb.prepare(`INSERT INTO organizations (id, name, currency, country, timezone, created_at, updated_at) VALUES (?, ?, 'INR', 'IN', 'Asia/Kolkata', ?, ?)`).run(orgId, name, NOW, NOW);
    rawDb.prepare(`INSERT INTO branches (id, organization_id, code, name, is_main_branch, status, created_at, updated_at) VALUES (?, ?, 'B1', 'Main', 1, 'active', ?, ?)`).run(`${orgId}-branch`, orgId, NOW, NOW);
  }
  const insertUser = rawDb.prepare(`INSERT INTO cloud_users (id, organization_id, email, name, role, assigned_branch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  insertUser.run('user-crm-owner', ORG, 'owner@crm.test', 'CRM Owner', 'owner', null, NOW, NOW);
  insertUser.run('user-crm-waiter', ORG, 'waiter@crm.test', 'CRM Waiter', 'server', `${ORG}-branch`, NOW, NOW);
  insertUser.run('user-crm-other', 'org-crm-other', 'other@crm.test', 'Other Owner', 'owner', null, NOW, NOW);
  const insertMembership = rawDb.prepare(`INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, 'active', ?, ?)`);
  insertMembership.run('m-crm-owner', ORG, 'user-crm-owner', null, 'owner', NOW, NOW);
  insertMembership.run('m-crm-waiter', ORG, 'user-crm-waiter', `${ORG}-branch`, 'server', NOW, NOW);
  insertMembership.run('m-crm-other', 'org-crm-other', 'user-crm-other', null, 'owner', NOW, NOW);

  rawDb.prepare(`INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, subtotal, tax_total, discount_total, grand_total, payment_method, customer_name, customer_phone, ordered_at, synced_at, updated_at) VALUES ('order-crm', ?, ?, 'C-1', 'dine_in', 'completed', 250, 0, 0, 250, 'cash', 'Asha Rao', '+919876543210', ?, ?, ?)`)
    .run(ORG, `${ORG}-branch`, NOW, NOW, NOW);
  rawDb.prepare(`INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, subtotal, tax_total, discount_total, grand_total, payment_method, customer_name, customer_phone, ordered_at, synced_at, updated_at) VALUES ('order-crm-2', ?, ?, 'C-2', 'dine_in', 'active', 400, 0, 0, 400, 'cash', 'Asha Rao', '+919876543210', ?, ?, ?)`)
    .run(ORG, `${ORG}-branch`, NOW, NOW, NOW);
}

async function run() {
  const rawDb = new DatabaseSync(':memory:');
  seed(rawDb);
  const env = { DB: new SqliteD1(rawDb), JWT_SECRET: SECRET, ENVIRONMENT: 'test' } as any;
  const tokens = new Map<string, string>();
  for (const [userId, role, orgId] of [
    ['user-crm-owner', 'owner', ORG],
    ['user-crm-waiter', 'server', ORG],
    ['user-crm-other', 'owner', 'org-crm-other'],
  ] as const) {
    tokens.set(userId, await createJWT({ sub: userId, org: orgId, email: `${userId}@crm.test`, role, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET));
  }
  const call = (userId: string, pathname: string, init: RequestInit = {}) => cloudWorker.fetch(
    new Request(`https://cloud.test${pathname}`, {
      ...init,
      headers: { Authorization: `Bearer ${tokens.get(userId)}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    }), env,
  );

  const invalid = await call('user-crm-owner', '/api/customers', { method: 'POST', body: JSON.stringify({ name: 'Bad Phone', phone: '12' }) });
  assert.equal(invalid.status, 400);

  const created = await call('user-crm-waiter', '/api/customers', {
    method: 'POST',
    body: JSON.stringify({ name: 'Asha Rao', phone: '+919876543210', country_code: '+91', email: 'asha@example.test', dietary_preferences: ['veg'] }),
  });
  assert.equal(created.status, 201);
  const customer = (await created.json() as any).customer;
  assert.equal(customer.phone_digits, '919876543210');
  assert.deepEqual(customer.dietary_preferences, ['veg']);

  const duplicate = await call('user-crm-owner', '/api/customers', {
    method: 'POST', body: JSON.stringify({ name: 'Duplicate', phone: '+919876543210' }),
  });
  assert.equal(duplicate.status, 409);

  const list = await call('user-crm-owner', '/api/customers?search=Asha&sort=total_spent&order=desc');
  assert.equal(list.status, 200);
  const listed = (await list.json() as any);
  assert.equal(listed.data.length, 1);
  assert.equal(listed.total, 1);
  assert.equal(listed.data[0].total_spent, 650, 'spend includes completed and open non-cancelled orders');
  assert.equal(listed.data[0].visits_count, 1, 'only completed orders count as visits');

  const noMatch = await call('user-crm-owner', '/api/customers?search=Nobody');
  assert.equal((await noMatch.json() as any).data.length, 0);

  const search = await call('user-crm-owner', '/api/customers-search?q=9876');
  assert.equal((await search.json() as any).customers.length, 1, 'phone search matches phone digits');

  const updated = await call('user-crm-owner', `/api/customers/${customer.id}`, {
    method: 'PUT', body: JSON.stringify({ name: 'Asha R.', email: 'asha.r@example.test' }),
  });
  assert.equal(updated.status, 200);
  const updatedData = await updated.json() as any;
  assert.equal(updatedData.customer.name, 'Asha R.');
  assert.equal(updatedData.customer.phone, '+919876543210', 'a partial update keeps the phone');

  const wallet = await call('user-crm-owner', `/api/customers/${customer.id}/wallet`);
  assert.equal(wallet.status, 200);
  const walletData = await wallet.json() as any;
  assert.equal(walletData.balance, 0);
  assert.equal(walletData.bills.length, 2);
  assert.equal(walletData.summary.totalSpent, 650);
  assert.equal(walletData.summary.totalPointsEarned, 0, 'Cloud does not fabricate loyalty points');

  const otherTenant = await call('user-crm-other', `/api/customers/${customer.id}/wallet`);
  assert.equal(otherTenant.status, 404, 'another tenant cannot read this customer');

  const otherList = await call('user-crm-other', '/api/customers');
  assert.equal((await otherList.json() as any).data.length, 0, 'customer lists stay tenant-scoped');

  console.log('Cloud customer registry passed: create, duplicate detection, search, aggregates, wallet, and tenant isolation.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
