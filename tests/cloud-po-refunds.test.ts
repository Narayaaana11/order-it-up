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

const SECRET = 'cloud-po-refunds-secret-32-bytes-key';
const ORG = 'org-ops2';
const NOW = new Date().toISOString();

function seed(rawDb: DatabaseSync) {
  const migrations = path.resolve(__dirname, '../apps/cloud-api/migrations');
  for (const migration of fs.readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
    rawDb.exec(fs.readFileSync(path.join(migrations, migration), 'utf8'));
  }
  rawDb.prepare(`INSERT INTO organizations (id, name, currency, country, timezone, created_at, updated_at) VALUES (?, 'Ops2 Restaurant', 'INR', 'IN', 'Asia/Kolkata', ?, ?)`).run(ORG, NOW, NOW);
  rawDb.prepare(`INSERT INTO branches (id, organization_id, code, name, is_main_branch, status, created_at, updated_at) VALUES ('branch-ops2', ?, 'B1', 'Main', 1, 'active', ?, ?)`).run(ORG, NOW, NOW);
  const insertUser = rawDb.prepare(`INSERT INTO cloud_users (id, organization_id, email, name, role, assigned_branch_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`);
  insertUser.run('u-owner', ORG, 'owner@ops2.test', 'Owner', 'owner', null, NOW, NOW);
  insertUser.run('u-waiter', ORG, 'waiter@ops2.test', 'Waiter', 'server', 'branch-ops2', NOW, NOW);
  const insertMembership = rawDb.prepare(`INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, 'active', ?, ?)`);
  insertMembership.run('m-owner', ORG, 'u-owner', null, 'owner', NOW, NOW);
  insertMembership.run('m-waiter', ORG, 'u-waiter', 'branch-ops2', 'server', NOW, NOW);
  rawDb.prepare(`INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, subtotal, tax_total, discount_total, grand_total, payment_method, payment_status, ordered_at, synced_at, updated_at) VALUES ('ord-ref-1', ?, 'branch-ops2', 'ORD-R1', 'dine_in', 'active', 400, 0, 0, 400, 'cash', 'unpaid', ?, ?, ?)`).run(ORG, NOW, NOW, NOW);
}

async function run() {
  const rawDb = new DatabaseSync(':memory:');
  seed(rawDb);
  const env: any = { DB: new SqliteD1(rawDb), JWT_SECRET: SECRET, ENVIRONMENT: 'test', REQUIRE_PROVIDER_VERIFIED_NONCASH: 'true' };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const ownerToken = await createJWT({ sub: 'u-owner', email: 'owner@ops2.test', org: ORG, role: 'owner', exp }, SECRET);
  const waiterToken = await createJWT({ sub: 'u-waiter', email: 'waiter@ops2.test', org: ORG, role: 'server', exp }, SECRET);

  const call = (url: string, init: RequestInit = {}, token = ownerToken) =>
    cloudWorker.fetch(new Request(`https://worker.test${url}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    }), env);

  // 1. Create vendor + ingredient
  const vRes = await call('/api/vendors', { method: 'POST', body: JSON.stringify({ name: 'Fresh Farms' }) });
  assert.equal(vRes.status, 201);
  const vendor = (await vRes.json() as any).vendor;

  const ingRes = await call('/api/inventory/ingredients', {
    method: 'POST',
    body: JSON.stringify({ branch_id: 'branch-ops2', name: 'Basmati Rice', unit: 'kg', current_stock: 10, minimum_stock: 5, cost_per_unit: 80 }),
  });
  assert.equal(ingRes.status, 201);
  const ing = (await ingRes.json() as any).ingredient;

  // 2. Role denial: waiter cannot create PO
  const waiterPo = await call('/api/purchase-orders', {
    method: 'POST',
    body: JSON.stringify({ branch_id: 'branch-ops2', items: [{ ingredient_id: ing.id, quantity: 5, unit_cost: 75 }] }),
  }, waiterToken);
  assert.equal(waiterPo.status, 403);

  // 3. Create PO idempotently and Receive GRN
  const poKey = 'po-idem-1';
  const poRes = await call('/api/purchase-orders', {
    method: 'POST',
    body: JSON.stringify({
      branch_id: 'branch-ops2',
      vendor_id: vendor.id,
      idempotency_key: poKey,
      items: [{ ingredient_id: ing.id, quantity: 20, unit_cost: 75 }],
    }),
  });
  assert.equal(poRes.status, 201);
  const po = (await poRes.json() as any).purchase_order;
  assert.equal(po.total_amount, 1500);

  const poReplay = await call('/api/purchase-orders', {
    method: 'POST',
    body: JSON.stringify({
      branch_id: 'branch-ops2',
      vendor_id: vendor.id,
      idempotency_key: poKey,
      items: [{ ingredient_id: ing.id, quantity: 20, unit_cost: 75 }],
    }),
  });
  assert.equal(poReplay.status, 200);
  assert.equal((await poReplay.json() as any).idempotent, true);

  const grnRes = await call(`/api/purchase-orders/${po.id}/receive`, { method: 'POST', body: '{}' });
  assert.equal(grnRes.status, 200);
  const grnReplay = await call(`/api/purchase-orders/${po.id}/receive`, { method: 'POST', body: '{}' });
  assert.equal(grnReplay.status, 200);
  assert.equal((await grnReplay.json() as any).idempotent, true);

  const afterGrn = rawDb.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get(ing.id) as any;
  assert.equal(afterGrn.current_stock, 30);

  // 4. Record Wastage (idempotent) + fail closed when exceeding stock
  const wasteRes = await call('/api/inventory/wastage', {
    method: 'POST',
    body: JSON.stringify({ ingredient_id: ing.id, quantity: 2, reason: 'Spilled', idempotency_key: 'waste-1' }),
  });
  assert.equal(wasteRes.status, 201);
  assert.equal((await wasteRes.json() as any).balance_after, 28);

  const overWaste = await call('/api/inventory/wastage', {
    method: 'POST',
    body: JSON.stringify({ ingredient_id: ing.id, quantity: 100, reason: 'Too much' }),
  });
  assert.equal(overWaste.status, 409);

  // 5. Physical Stock Count adjusts variance
  const scRes = await call('/api/inventory/stock-counts', {
    method: 'POST',
    body: JSON.stringify({ branch_id: 'branch-ops2', notes: 'Night audit', items: [{ ingredient_id: ing.id, counted_stock: 26.5 }] }),
  });
  assert.equal(scRes.status, 201);
  const scData = await scRes.json() as any;
  assert.equal(scData.stock_count.items[0].variance, -1.5);
  const afterSc = rawDb.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get(ing.id) as any;
  assert.equal(afterSc.current_stock, 26.5);

  // 6. Cash Payment + Idempotent Partial & Full Refund
  const payRes = await call('/api/orders/ord-ref-1/payments', {
    method: 'POST',
    body: JSON.stringify({ amount: 400, payment_method: 'cash', idempotency_key: 'pay-ref-1' }),
  });
  assert.equal(payRes.status, 201);

  const ref1 = await call('/api/orders/ord-ref-1/refunds', {
    method: 'POST',
    body: JSON.stringify({ amount: 150, reason: 'Cold soup', idempotency_key: 'ref-key-1' }),
  });
  assert.equal(ref1.status, 201);
  const ref1Body = await ref1.json() as any;
  assert.equal(ref1Body.order_payment_status, 'partially_paid');
  assert.equal(ref1Body.outstanding_balance, 150);

  // Replay same idempotency key does not double refund
  const ref1Replay = await call('/api/orders/ord-ref-1/refunds', {
    method: 'POST',
    body: JSON.stringify({ amount: 150, reason: 'Cold soup', idempotency_key: 'ref-key-1' }),
  });
  assert.equal(ref1Replay.status, 200);
  assert.equal((await ref1Replay.json() as any).idempotent, true);

  // Refund remaining 250
  const ref2 = await call('/api/orders/ord-ref-1/refunds', {
    method: 'POST',
    body: JSON.stringify({ reason: 'Remaining refund', idempotency_key: 'ref-key-2' }),
  });
  assert.equal(ref2.status, 201);
  assert.equal((await ref2.json() as any).order_payment_status, 'refunded');

  // Over-refund rejected
  const overRef = await call('/api/orders/ord-ref-1/refunds', {
    method: 'POST',
    body: JSON.stringify({ amount: 10, reason: 'Extra' }),
  });
  assert.equal(overRef.status, 404);

  console.log('Cloud PO, GRN, Wastage, Stock Count, and Order Refund tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
