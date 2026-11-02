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

const SECRET = 'staff-management-integration-secret-32-bytes';
const ORG = 'org-staff';
const NOW = new Date().toISOString();

function seed(rawDb: DatabaseSync) {
  const migrations = path.resolve(__dirname, '../apps/cloud-api/migrations');
  for (const migration of fs.readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
    rawDb.exec(fs.readFileSync(path.join(migrations, migration), 'utf8'));
  }
  for (const [orgId, name] of [[ORG, 'Staff Restaurant'], ['org-staff-other', 'Other']] as const) {
    rawDb.prepare(`INSERT INTO organizations (id, name, currency, country, timezone, created_at, updated_at) VALUES (?, ?, 'INR', 'IN', 'Asia/Kolkata', ?, ?)`).run(orgId, name, NOW, NOW);
    rawDb.prepare(`INSERT INTO branches (id, organization_id, code, name, is_main_branch, status, created_at, updated_at) VALUES (?, ?, 'B1', 'Main', 1, 'active', ?, ?)`).run(`${orgId}-branch`, orgId, NOW, NOW);
  }
  const insertUser = rawDb.prepare(`INSERT INTO cloud_users (id, organization_id, email, name, role, assigned_branch_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`);
  insertUser.run('user-staff-owner', ORG, 'owner@staff.test', 'Staff Owner', 'owner', null, NOW, NOW);
  insertUser.run('user-staff-manager', ORG, 'manager@staff.test', 'Staff Manager', 'manager', `${ORG}-branch`, NOW, NOW);
  insertUser.run('user-staff-other', 'org-staff-other', 'other@staff.test', 'Other Owner', 'owner', null, NOW, NOW);
  const insertMembership = rawDb.prepare(`INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, 'active', ?, ?)`);
  insertMembership.run('m-staff-owner', ORG, 'user-staff-owner', null, 'owner', NOW, NOW);
  insertMembership.run('m-staff-manager', ORG, 'user-staff-manager', `${ORG}-branch`, 'manager', NOW, NOW);
  insertMembership.run('m-staff-other', 'org-staff-other', 'user-staff-other', null, 'owner', NOW, NOW);
}

async function run() {
  const rawDb = new DatabaseSync(':memory:');
  seed(rawDb);
  const env = { DB: new SqliteD1(rawDb), JWT_SECRET: SECRET, ENVIRONMENT: 'test' } as any;
  const tokens = new Map<string, string>();
  for (const [userId, role, orgId] of [
    ['user-staff-owner', 'owner', ORG],
    ['user-staff-manager', 'manager', ORG],
    ['user-staff-other', 'owner', 'org-staff-other'],
  ] as const) {
    tokens.set(userId, await createJWT({ sub: userId, org: orgId, email: `${userId}@staff.test`, role, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET));
  }
  const call = (userId: string, pathname: string, init: RequestInit = {}) => cloudWorker.fetch(
    new Request(`https://cloud.test${pathname}`, {
      ...init,
      headers: { Authorization: `Bearer ${tokens.get(userId)}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    }), env,
  );
  const login = (email: string, password: string) => cloudWorker.fetch(new Request('https://cloud.test/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  }), env);

  const initial = await call('user-staff-owner', '/api/staff');
  assert.equal(initial.status, 200);
  assert.equal((await initial.json() as any).staff.length, 2);

  const waiterStaff = await call('user-staff-manager', '/api/staff', {
    method: 'POST', body: JSON.stringify({ name: 'Ravi Server', email: 'ravi@staff.test', password: 'password123', role: 'server' }),
  });
  assert.equal(waiterStaff.status, 201, JSON.stringify(await waiterStaff.clone().json()));
  const staff = (await waiterStaff.json() as any).staff;
  assert.equal(staff.role, 'server');
  assert.equal(staff.is_active, 1);
  assert.ok(staff.branch_id, 'branch staff are assigned to the default branch');

  const loginBefore = await login('ravi@staff.test', 'password123');
  assert.equal(loginBefore.status, 200, 'a created staff member can sign in');

  const duplicate = await call('user-staff-owner', '/api/staff', {
    method: 'POST', body: JSON.stringify({ name: 'Duplicate', email: 'ravi@staff.test', password: 'password123', role: 'cashier' }),
  });
  assert.equal(duplicate.status, 409);

  const managerOwnerCreate = await call('user-staff-manager', '/api/staff', {
    method: 'POST', body: JSON.stringify({ name: 'Sneaky Owner', email: 'sneaky@staff.test', password: 'password123', role: 'owner' }),
  });
  assert.equal(managerOwnerCreate.status, 403, 'a manager cannot create an owner');

  const managerOwnerEdit = await call('user-staff-manager', '/api/staff/user-staff-owner', {
    method: 'PUT', body: JSON.stringify({ name: 'Renamed Owner' }),
  });
  assert.equal(managerOwnerEdit.status, 403, 'a manager cannot edit an owner');

  const resetPassword = await call('user-staff-owner', `/api/staff/${staff.id}`, {
    method: 'PUT', body: JSON.stringify({ password: 'newpassword456', role: 'cashier' }),
  });
  assert.equal(resetPassword.status, 200);
  assert.equal((await resetPassword.json() as any).staff.role, 'cashier');
  const oldLogin = await login('ravi@staff.test', 'password123');
  assert.equal(oldLogin.status, 401, 'the previous password no longer works');
  const newLogin = await login('ravi@staff.test', 'newpassword456');
  assert.equal(newLogin.status, 200, 'the reset password works');

  const managerPromote = await call('user-staff-manager', `/api/staff/${staff.id}`, {
    method: 'PUT', body: JSON.stringify({ role: 'owner' }),
  });
  assert.equal(managerPromote.status, 403, 'a manager cannot grant owner access');

  const selfDeactivate = await call('user-staff-owner', '/api/staff/user-staff-owner/deactivate', { method: 'POST' });
  assert.equal(selfDeactivate.status, 409, 'an owner cannot deactivate their own account');

  const lastOwnerDemote = await call('user-staff-owner', '/api/staff/user-staff-owner', {
    method: 'PUT', body: JSON.stringify({ role: 'manager' }),
  });
  assert.equal(lastOwnerDemote.status, 409, 'the last owner cannot be demoted');

  const deactivated = await call('user-staff-owner', `/api/staff/${staff.id}/deactivate`, { method: 'POST' });
  assert.equal(deactivated.status, 200);
  assert.equal((await deactivated.json() as any).staff.is_active, 0);
  const blockedLogin = await login('ravi@staff.test', 'newpassword456');
  assert.equal(blockedLogin.status, 401, 'deactivated staff cannot sign in');

  const reactivated = await call('user-staff-owner', `/api/staff/${staff.id}/reactivate`, { method: 'POST' });
  assert.equal(reactivated.status, 200);
  const restoredLogin = await login('ravi@staff.test', 'newpassword456');
  assert.equal(restoredLogin.status, 200, 'reactivated staff can sign in again');

  const otherList = await call('user-staff-other', '/api/staff');
  assert.equal((await otherList.json() as any).staff.length, 1, 'staff lists stay tenant-scoped');

  const staffDelete = await call('user-staff-owner', `/api/staff/${staff.id}`, { method: 'DELETE' });
  assert.equal(staffDelete.status, 404, 'staff are deactivated, never hard-deleted through this contract');

  console.log('Cloud staff management passed: create, login, reset, role changes, owner protections, deactivation, and tenant isolation.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
