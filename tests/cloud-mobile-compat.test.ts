import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import cloudWorker from '../apps/cloud-api/src/index';
import { createJWT, hashString } from '../apps/cloud-api/src/auth';

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

const SECRET = 'mobile-compat-integration-secret-32-bytes';
const ORG = 'org-mobile';
const NOW = new Date().toISOString();

function seed(rawDb: DatabaseSync) {
  const migrations = path.resolve(__dirname, '../apps/cloud-api/migrations');
  for (const migration of fs.readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
    rawDb.exec(fs.readFileSync(path.join(migrations, migration), 'utf8'));
  }
  rawDb.prepare(`INSERT INTO organizations (id, name, currency, country, timezone, created_at, updated_at) VALUES (?, 'Mobile Restaurant', 'INR', 'IN', 'Asia/Kolkata', ?, ?)`).run(ORG, NOW, NOW);
  rawDb.prepare(`INSERT INTO branches (id, organization_id, code, name, is_main_branch, status, created_at, updated_at) VALUES ('branch-mobile', ?, 'B1', 'Main', 1, 'active', ?, ?)`).run(ORG, NOW, NOW);
  const insertUser = rawDb.prepare(`INSERT INTO cloud_users (id, organization_id, email, name, role, assigned_branch_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`);
  insertUser.run('user-mobile-owner', ORG, 'owner@mobile.test', 'Mobile Owner', 'owner', null, NOW, NOW);
  insertUser.run('user-mobile-cashier', ORG, 'cashier@mobile.test', 'Mobile Cashier', 'cashier', 'branch-mobile', NOW, NOW);
  insertUser.run('user-mobile-waiter', ORG, 'waiter@mobile.test', 'Mobile Waiter', 'server', 'branch-mobile', NOW, NOW);
  const insertMembership = rawDb.prepare(`INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, 'active', ?, ?)`);
  insertMembership.run('m-mobile-owner', ORG, 'user-mobile-owner', null, 'owner', NOW, NOW);
  insertMembership.run('m-mobile-cashier', ORG, 'user-mobile-cashier', 'branch-mobile', 'cashier', NOW, NOW);
  insertMembership.run('m-mobile-waiter', ORG, 'user-mobile-waiter', 'branch-mobile', 'server', NOW, NOW);
}

async function run() {
  const rawDb = new DatabaseSync(':memory:');
  seed(rawDb);
  const env = { DB: new SqliteD1(rawDb), JWT_SECRET: SECRET, ENVIRONMENT: 'test' } as any;

  const makeToken = (userId: string, role: string, branch: string | null = null, expOffset = 3600) => createJWT({
    sub: userId, org: ORG, email: `${userId}@mobile.test`, role, branch,
    exp: Math.floor(Date.now() / 1000) + expOffset,
  }, SECRET);
  const tokens = new Map<string, string>();
  tokens.set('user-mobile-owner', await makeToken('user-mobile-owner', 'owner'));
  tokens.set('user-mobile-cashier', await makeToken('user-mobile-cashier', 'cashier', 'branch-mobile'));
  tokens.set('user-mobile-waiter', await makeToken('user-mobile-waiter', 'server', 'branch-mobile'));

  const call = (userId: string, pathname: string, init: RequestInit = {}, tokenOverride?: string) => cloudWorker.fetch(
    new Request(`https://cloud.test${pathname}`, {
      ...init,
      headers: { Authorization: `Bearer ${tokenOverride || tokens.get(userId)}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    }), env,
  );

  // ── Session refresh ─────────────────────────────────────────────────────
  const refresh = await call('user-mobile-cashier', '/api/auth/refresh', { method: 'POST' });
  assert.equal(refresh.status, 200);
  const refreshed = await refresh.json() as any;
  assert.ok(refreshed.access_token && refreshed.access_token !== tokens.get('user-mobile-cashier'));
  assert.equal(refreshed.expires_in, 604800);

  const meWithNewToken = await call('user-mobile-cashier', '/api/auth/me', {}, refreshed.access_token);
  assert.equal(meWithNewToken.status, 200, 'the refreshed token authenticates');
  assert.equal((await meWithNewToken.json() as any).user.role, 'cashier');

  const revokedToken = await makeToken('user-mobile-cashier', 'cashier', 'branch-mobile', 7200);
  rawDb.prepare(`INSERT INTO cloud_token_revocations (token_hash, expires_at, revoked_at) VALUES (?, ?, ?)`)
    .run(await hashString(revokedToken), Math.floor(Date.now() / 1000) + 3600, NOW);
  const revokedRefresh = await call('user-mobile-cashier', '/api/auth/refresh', { method: 'POST' }, revokedToken);
  assert.equal(revokedRefresh.status, 401, 'a revoked session cannot refresh');

  rawDb.prepare("UPDATE cloud_users SET status = 'inactive' WHERE id = 'user-mobile-waiter'").run();
  const inactiveRefresh = await call('user-mobile-waiter', '/api/auth/refresh', { method: 'POST' });
  assert.equal(inactiveRefresh.status, 401, 'an inactive account cannot refresh');
  rawDb.prepare("UPDATE cloud_users SET status = 'active' WHERE id = 'user-mobile-waiter'").run();

  // ── Cash closures ───────────────────────────────────────────────────────
  const emptyList = await call('user-mobile-owner', '/api/cash-closures');
  assert.equal(emptyList.status, 200);
  assert.deepEqual(await emptyList.json(), { closures: [], count: 0 });

  rawDb.prepare(`INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, subtotal, tax_total, discount_total, grand_total, payment_method, ordered_at, synced_at, updated_at) VALUES ('order-mobile', ?, 'branch-mobile', 'M-1', 'dine_in', 'completed', 100, 0, 0, 100, 'cash', ?, ?, ?)`)
    .run(ORG, NOW, NOW, NOW);
  rawDb.prepare(`INSERT INTO customer_payments (id, organization_id, branch_id, order_id, payment_method, amount, status, created_at, updated_at) VALUES ('pay-mobile', ?, 'branch-mobile', 'order-mobile', 'cash', 100, 'completed', ?, ?)`)
    .run(ORG, NOW, NOW);

  const waiterCreate = await call('user-mobile-waiter', '/api/cash-closures', {
    method: 'POST', body: JSON.stringify({ counted_cash_cents: 10000 }),
  });
  assert.equal(waiterCreate.status, 403, 'waiters cannot close a cash shift');

  const created = await call('user-mobile-cashier', '/api/cash-closures', {
    method: 'POST', body: JSON.stringify({ counted_cash_cents: 9500, notes: 'Mobile evening close' }),
  });
  assert.equal(created.status, 201, JSON.stringify(await created.clone().json()));
  const closure = (await created.json() as any).closure;
  assert.equal(closure.counted_cash, 95);
  assert.equal(closure.expected_cash, 100);
  assert.equal(closure.variance, -5);
  assert.equal(closure.gross_sales, 100);
  assert.match(String(closure.business_date), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(closure.closed_by, 'Mobile Cashier');

  const list = await call('user-mobile-cashier', '/api/cash-closures');
  assert.equal(list.status, 200);
  const listed = await list.json() as any;
  assert.equal(listed.count, 1);
  assert.equal(listed.closures[0].z_number, 1);
  assert.equal(listed.closures[0].counted_cash, 95);

  const waiterList = await call('user-mobile-waiter', '/api/cash-closures');
  assert.equal(waiterList.status, 403, 'waiters cannot read cash closures');

  console.log('Mobile compatibility passed: session refresh, revocation/inactive rejection, and cash closure mapping.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
