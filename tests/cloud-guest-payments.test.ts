import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac } from 'node:crypto';
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

const SECRET = 'guest-payments-integration-secret-32-bytes';
const KEY_ID = 'rzp_test_key_guest';
const KEY_SECRET = 'rzp_test_secret_guest';
const WEBHOOK_SECRET = 'rzp_test_webhook_secret_guest';
const ORG = 'org-pay';
const NOW = new Date().toISOString();

function seed(rawDb: DatabaseSync) {
  const migrations = path.resolve(__dirname, '../apps/cloud-api/migrations');
  for (const migration of fs.readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
    rawDb.exec(fs.readFileSync(path.join(migrations, migration), 'utf8'));
  }
  rawDb.prepare(`INSERT INTO organizations (id, name, currency, country, timezone, created_at, updated_at) VALUES (?, 'Pay Restaurant', 'INR', 'IN', 'Asia/Kolkata', ?, ?)`).run(ORG, NOW, NOW);
  rawDb.prepare(`INSERT INTO branches (id, organization_id, code, name, is_main_branch, status, created_at, updated_at) VALUES ('branch-pay', ?, 'B1', 'Main', 1, 'active', ?, ?)`).run(ORG, NOW, NOW);
  const insertUser = rawDb.prepare(`INSERT INTO cloud_users (id, organization_id, email, name, role, assigned_branch_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`);
  insertUser.run('user-pay-owner', ORG, 'owner@pay.test', 'Pay Owner', 'owner', null, NOW, NOW);
  insertUser.run('user-pay-waiter', ORG, 'waiter@pay.test', 'Pay Waiter', 'server', 'branch-pay', NOW, NOW);
  const insertMembership = rawDb.prepare(`INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, 'active', ?, ?)`);
  insertMembership.run('m-pay-owner', ORG, 'user-pay-owner', null, 'owner', NOW, NOW);
  insertMembership.run('m-pay-waiter', ORG, 'user-pay-waiter', 'branch-pay', 'server', NOW, NOW);
  const insertOrder = rawDb.prepare(`INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, subtotal, tax_total, discount_total, grand_total, payment_method, payment_status, ordered_at, synced_at, updated_at) VALUES (?, ?, 'branch-pay', ?, 'dine_in', 'active', 500, 0, 0, 500, 'cash', 'unpaid', ?, ?, ?)`);
  insertOrder.run('order-pay-1', ORG, 'P-1', NOW, NOW, NOW);
  insertOrder.run('order-pay-2', ORG, 'P-2', NOW, NOW, NOW);
  insertOrder.run('order-pay-3', ORG, 'P-3', NOW, NOW, NOW);
}

async function run() {
  const rawDb = new DatabaseSync(':memory:');
  seed(rawDb);
  const db = new SqliteD1(rawDb);
  const env = {
    DB: db, JWT_SECRET: SECRET, ENVIRONMENT: 'test',
    RAZORPAY_KEY_ID: KEY_ID, RAZORPAY_KEY_SECRET: KEY_SECRET, RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
  } as any;
  const envNoKeys = { DB: db, JWT_SECRET: SECRET, ENVIRONMENT: 'test' } as any;

  const tokens = new Map<string, string>();
  for (const [userId, role, branch] of [['user-pay-owner', 'owner', null], ['user-pay-waiter', 'server', 'branch-pay']] as const) {
    tokens.set(userId, await createJWT({ sub: userId, org: ORG, email: `${userId}@pay.test`, role, branch, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET));
  }
  const callWith = (targetEnv: any, userId: string, pathname: string, init: RequestInit = {}) => cloudWorker.fetch(
    new Request(`https://cloud.test${pathname}`, {
      ...init,
      headers: { Authorization: `Bearer ${tokens.get(userId)}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    }), targetEnv,
  );
  const call = (userId: string, pathname: string, init: RequestInit = {}) => callWith(env, userId, pathname, init);

  // ── Provider fetch mock ────────────────────────────────────────────────
  const payments: Record<string, any> = {
    pay_ok: { id: 'pay_ok', order_id: 'order_rzp1', amount: 50000, currency: 'INR', status: 'captured', method: 'upi' },
    pay_wrong_sig: { id: 'pay_wrong_sig', order_id: 'order_rzp2', amount: 50000, currency: 'INR', status: 'captured', method: 'card' },
    pay_authorized: { id: 'pay_authorized', order_id: 'order_rzp3', amount: 50000, currency: 'INR', status: 'authorized', method: 'card' },
    pay_mismatch: { id: 'pay_mismatch', order_id: 'order_rzp4', amount: 100, currency: 'INR', status: 'captured', method: 'card' },
  };
  let providerOrders = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = String(input);
    if (url.endsWith('/v1/orders') && init.method === 'POST') {
      providerOrders += 1;
      const body = JSON.parse(init.body);
      assert.match(String(init.headers.Authorization), /^Basic /);
      return Response.json({ id: `order_rzp${providerOrders}`, amount: body.amount, currency: body.currency, status: 'created' });
    }
    const match = url.match(/\/v1\/payments\/([^/]+)$/);
    if (match) {
      const payment = payments[decodeURIComponent(match[1])];
      return payment ? Response.json(payment) : Response.json({ error: 'not found' }, { status: 404 });
    }
    throw new Error(`Unexpected provider call: ${url}`);
  }) as typeof fetch;

  try {
    // ── Capabilities ─────────────────────────────────────────────────────
    const noKeys = await (await callWith(envNoKeys, 'user-pay-owner', '/api/payments/capabilities')).json() as any;
    assert.equal(noKeys.configured, false);
    assert.equal(noKeys.card, false);
    assert.equal(noKeys.cash, true);

    const withKeys = await (await call('user-pay-owner', '/api/payments/capabilities')).json() as any;
    assert.equal(withKeys.configured, true);
    assert.equal(withKeys.provider, 'razorpay');

    // ── Fail closed without credentials ──────────────────────────────────
    const unavailable = await callWith(envNoKeys, 'user-pay-owner', '/api/orders/order-pay-1/payment-intent', { method: 'POST', body: '{}' });
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json() as any).code, 'PAYMENT_PROVIDER_NOT_CONFIGURED');

    // ── Create + verify ──────────────────────────────────────────────────
    const waiterIntent = await call('user-pay-waiter', '/api/orders/order-pay-1/payment-intent', { method: 'POST', body: '{}' });
    assert.equal(waiterIntent.status, 403, 'waiters cannot create provider intents');

    const created = await call('user-pay-owner', '/api/orders/order-pay-1/payment-intent', {
      method: 'POST', body: JSON.stringify({ idempotency_key: 'intent-key-1' }),
    });
    assert.equal(created.status, 201, JSON.stringify(await created.clone().json()));
    const intent = (await created.json() as any).intent;
    assert.equal(intent.amount, 500);
    assert.equal(intent.provider_order_id, 'order_rzp1');

    const replayed = await call('user-pay-owner', '/api/orders/order-pay-1/payment-intent', {
      method: 'POST', body: JSON.stringify({ idempotency_key: 'intent-key-1' }),
    });
    assert.equal((await replayed.json() as any).idempotent, true, 'intent creation is idempotent');

    const signature = createHmac('sha256', KEY_SECRET).update(`${intent.provider_order_id}|pay_ok`).digest('hex');
    const verified = await call('user-pay-owner', '/api/payments/verify', {
      method: 'POST', body: JSON.stringify({ intent_id: intent.id, provider_payment_id: 'pay_ok', signature }),
    });
    assert.equal(verified.status, 200, JSON.stringify(await verified.clone().json()));
    const verifiedData = await verified.json() as any;
    assert.equal(verifiedData.order_payment_status, 'paid');

    const ledger = rawDb.prepare("SELECT * FROM customer_payments WHERE order_id = 'order-pay-1'").all() as any[];
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].verification_method, 'gateway_verified');
    assert.equal(Number(ledger[0].amount), 500);
    assert.equal(rawDb.prepare("SELECT payment_status FROM synced_orders WHERE id = 'order-pay-1'").get().payment_status, 'paid');

    const replayVerify = await call('user-pay-owner', '/api/payments/verify', {
      method: 'POST', body: JSON.stringify({ intent_id: intent.id, provider_payment_id: 'pay_ok', signature }),
    });
    assert.equal((await replayVerify.json() as any).idempotent, true);
    assert.equal((rawDb.prepare("SELECT COUNT(*) AS count FROM customer_payments WHERE order_id = 'order-pay-1'").get() as any).count, 1);

    // ── Negative verification paths ──────────────────────────────────────
    const intent2 = (await (await call('user-pay-owner', '/api/orders/order-pay-2/payment-intent', { method: 'POST', body: '{}' })).json() as any).intent;
    const badSignature = await call('user-pay-owner', '/api/payments/verify', {
      method: 'POST', body: JSON.stringify({ intent_id: intent2.id, provider_payment_id: 'pay_wrong_sig', signature: 'deadbeef' }),
    });
    assert.equal(badSignature.status, 400);
    assert.equal((await badSignature.json() as any).code, 'PAYMENT_SIGNATURE_INVALID');

    const intent3 = (await (await call('user-pay-owner', '/api/orders/order-pay-2/payment-intent', { method: 'POST', body: '{}' })).json() as any).intent;
    const authSignature = createHmac('sha256', KEY_SECRET).update(`${intent3.provider_order_id}|pay_authorized`).digest('hex');
    const notCaptured = await call('user-pay-owner', '/api/payments/verify', {
      method: 'POST', body: JSON.stringify({ intent_id: intent3.id, provider_payment_id: 'pay_authorized', signature: authSignature }),
    });
    assert.equal(notCaptured.status, 409);
    assert.equal((await notCaptured.json() as any).code, 'PAYMENT_NOT_CAPTURED');

    const intent4 = (await (await call('user-pay-owner', '/api/orders/order-pay-2/payment-intent', { method: 'POST', body: '{}' })).json() as any).intent;
    const mismatchSignature = createHmac('sha256', KEY_SECRET).update(`${intent4.provider_order_id}|pay_mismatch`).digest('hex');
    const mismatch = await call('user-pay-owner', '/api/payments/verify', {
      method: 'POST', body: JSON.stringify({ intent_id: intent4.id, provider_payment_id: 'pay_mismatch', signature: mismatchSignature }),
    });
    assert.equal(mismatch.status, 409);
    assert.equal((await mismatch.json() as any).code, 'PAYMENT_AMOUNT_MISMATCH');

    assert.equal((rawDb.prepare("SELECT COUNT(*) AS count FROM customer_payments WHERE order_id = 'order-pay-2'").get() as any).count, 0, 'failed verifications never write the ledger');

    // ── Signed provider webhook ──────────────────────────────────────────
    const webhookIntent = (await (await call('user-pay-owner', '/api/orders/order-pay-3/payment-intent', { method: 'POST', body: '{}' })).json() as any).intent;
    payments.pay_webhook = {
      id: 'pay_webhook', order_id: webhookIntent.provider_order_id,
      amount: 50000, currency: 'INR', status: 'captured', method: 'upi',
    };
    const webhookBody = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_webhook', order_id: webhookIntent.provider_order_id, amount: 50000, currency: 'INR', status: 'captured' } } },
    });
    const webhookSignature = createHmac('sha256', WEBHOOK_SECRET).update(webhookBody).digest('hex');
    const webhook = (body: string, signature: string, eventId: string) => cloudWorker.fetch(
      new Request('https://cloud.test/api/webhooks/razorpay-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': signature, 'X-Razorpay-Event-Id': eventId },
        body,
      }), env,
    );

    assert.equal((await webhook(webhookBody, 'deadbeef', 'evt-bad')).status, 401, 'invalid webhook signatures are rejected');

    const settled = await webhook(webhookBody, webhookSignature, 'evt-1');
    assert.equal(settled.status, 200, JSON.stringify(await settled.clone().json()));
    assert.equal((await settled.json() as any).settled, true);
    assert.equal((rawDb.prepare("SELECT payment_status FROM synced_orders WHERE id = 'order-pay-3'").get() as any).payment_status, 'paid');
    assert.equal((rawDb.prepare("SELECT COUNT(*) AS count FROM customer_payments WHERE order_id = 'order-pay-3'").get() as any).count, 1);
    assert.equal((rawDb.prepare("SELECT status FROM payment_intents WHERE id = ?").get(webhookIntent.id) as any).status, 'verified');

    const replayWebhook = await webhook(webhookBody, webhookSignature, 'evt-1');
    assert.equal(replayWebhook.status, 200);
    assert.equal((await replayWebhook.json() as any).duplicate, true, 'a replayed webhook event is deduplicated');
    assert.equal((rawDb.prepare("SELECT COUNT(*) AS count FROM customer_payments WHERE order_id = 'order-pay-3'").get() as any).count, 1);

    const unknownOrderBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_unknown', order_id: 'order_missing', amount: 100 } } } });
    const unknownOrder = await webhook(unknownOrderBody, createHmac('sha256', WEBHOOK_SECRET).update(unknownOrderBody).digest('hex'), 'evt-unknown');
    assert.equal(unknownOrder.status, 200);
    assert.equal((await unknownOrder.json() as any).ignored, true);

    console.log('Guest payment intents passed: capabilities, fail-closed creation, signature/capture/amount checks, idempotency, webhook settlement and replay dedupe.');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
