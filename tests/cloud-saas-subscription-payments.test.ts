import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  handleCreateSaasSubscriptionOrder,
  handleRazorpaySubscriptionWebhook,
  handleVerifySaasSubscriptionPayment,
} from '../apps/cloud-api/src/routes/subscription-payments';

class SubscriptionBillingD1 {
  private db = new Database(':memory:');

  constructor() {
    this.db.pragma('foreign_keys = ON');
    const migrationDirectory = path.resolve(__dirname, '../apps/cloud-api/migrations');
    const migrations = fs.readdirSync(migrationDirectory).filter((file) => file.endsWith('.sql')).sort();
    for (const migration of migrations) this.db.exec(fs.readFileSync(path.join(migrationDirectory, migration), 'utf8'));
    const now = new Date().toISOString();
    this.db.prepare('INSERT INTO organizations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run('org-1', 'Test Restaurant', now, now);
  }

  get orders(): any[] {
    return this.db.prepare('SELECT * FROM saas_subscription_payment_orders ORDER BY created_at').all();
  }

  get subscriptions(): any[] {
    return this.db.prepare('SELECT * FROM organization_subscriptions').all();
  }

  get events(): any[] {
    return this.db.prepare('SELECT * FROM subscription_events').all();
  }

  get webhookEvents(): any[] {
    return this.db.prepare('SELECT * FROM saas_payment_webhook_events ORDER BY received_at').all();
  }

  setAccountStatus(status: 'active' | 'suspended' | 'closed') {
    this.db.prepare('UPDATE organizations SET account_status = ? WHERE id = ?').run(status, 'org-1');
  }

  prepare(sql: string) {
    let params: any[] = [];
    const prepared = this.db.prepare(sql);
    const statement: any = {
      bind: (...values: any[]) => { params = values; return statement; },
      first: async <T = any>(): Promise<T | null> => (prepared.get(...params) as T) || null,
      all: async <T = any>(): Promise<{ results: T[] }> => ({ results: prepared.all(...params) as T[] }),
      runSync: () => {
        const result = prepared.run(...params);
        return { success: true, meta: { changes: result.changes }, changes: result.changes };
      },
      run: async () => statement.runSync(),
    };
    return statement;
  }

  async batch(statements: any[]) {
    return this.db.transaction(() => statements.map((statement) => statement.runSync()))();
  }
}

function jsonRequest(body: unknown, idempotencyKey?: string): Request {
  return new Request('https://api.orderitup.in/api/subscription/create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function signature(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function webhookSignature(secret: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function run() {
  const previousFetch = globalThis.fetch;
  const env: any = {
    DB: new SubscriptionBillingD1(),
    JWT_SECRET: 'test-only-tenant-jwt-secret-with-more-than-32-characters',
    RAZORPAY_KEY_ID: 'rzp_test_key1',
    RAZORPAY_KEY_SECRET: 'test-secret-do-not-use-outside-this-test',
    RAZORPAY_WEBHOOK_SECRET: 'independent-webhook-secret-for-tests',
  };
  const owner = [{ id: 'member-1', organization_id: 'org-1', user_id: 'user-1', restaurant_id: null, branch_id: null, role: 'owner', status: 'active' }];
  const manager = [{ ...owner[0], role: 'manager' }];
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let providerOrderCount = 0;
  let racePaymentBarrier: { arrivals: number; promise: Promise<void>; release: () => void } | null = null;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url) === 'https://api.razorpay.com/v1/orders') {
      const payload = JSON.parse(String(init?.body));
      providerOrderCount += 1;
      const id = ['order_test123abc', 'order_hook123abc', 'order_raceA123', 'order_raceB123'][providerOrderCount - 1];
      return new Response(JSON.stringify({ id, amount: payload.amount, currency: payload.currency, receipt: payload.receipt }), { status: 200 });
    }
    if (String(url) === 'https://api.razorpay.com/v1/payments/pay_test123abc') {
      return new Response(JSON.stringify({ id: 'pay_test123abc', order_id: 'order_test123abc', amount: 129900, currency: 'INR', status: 'captured', captured: true }), { status: 200 });
    }
    if (String(url) === 'https://api.razorpay.com/v1/payments/pay_hook123abc') {
      return new Response(JSON.stringify({ id: 'pay_hook123abc', order_id: 'order_hook123abc', amount: 129900, currency: 'INR', status: 'captured', captured: true }), { status: 200 });
    }
    const racePayment = String(url).match(/\/payments\/(pay_race[AB]123)$/)?.[1];
    if (racePayment) {
      if (racePaymentBarrier) {
        racePaymentBarrier.arrivals += 1;
        if (racePaymentBarrier.arrivals === 2) racePaymentBarrier.release();
        await racePaymentBarrier.promise;
      }
      const suffix = racePayment === 'pay_raceA123' ? 'A' : 'B';
      return new Response(JSON.stringify({ id: racePayment, order_id: `order_race${suffix}123`, amount: 129900, currency: 'INR', status: 'captured', captured: true }), { status: 200 });
    }
    throw new Error(`Unexpected provider request ${String(url)}`);
  }) as typeof fetch;

  try {
    const productionTestKeys = await handleCreateSaasSubscriptionOrder(
      jsonRequest({ plan_code: 'pro', billing_cycle: 'monthly' }, 'production-key-check-0001'),
      { ...env, ENVIRONMENT: 'production' }, 'org-1', owner,
    );
    assert.equal(productionTestKeys.status, 503, 'Production refuses test-mode Razorpay keys before contacting the provider');
    assert.equal(calls.length, 0);

    const managerDenied = await handleCreateSaasSubscriptionOrder(jsonRequest({ plan_code: 'pro', billing_cycle: 'monthly' }, 'checkout-key-manager-0001'), env, 'org-1', manager);
    assert.equal(managerDenied.status, 403, 'Managers cannot create subscription payment orders');
    const missingKey = await handleCreateSaasSubscriptionOrder(jsonRequest({ plan_code: 'pro', billing_cycle: 'monthly' }), env, 'org-1', owner);
    assert.equal(missingKey.status, 400, 'A request key is required before provider access');

    const key = 'checkout-request-000000000001';
    const created = await handleCreateSaasSubscriptionOrder(jsonRequest({ plan_code: 'pro', billing_cycle: 'monthly' }, key), env, 'org-1', owner);
    assert.equal(created.status, 201);
    const createdData = await created.json() as any;
    assert.equal(createdData.order.amount, 129900, 'Razorpay receives the server-side D1 plan price in minor units');
    assert.equal(createdData.order.currency, 'INR');
    assert.equal(createdData.order.key_id, env.RAZORPAY_KEY_ID);
    assert.equal(JSON.stringify(createdData).includes(env.RAZORPAY_KEY_SECRET), false, 'Provider secret is never returned');
    assert.equal(env.DB.orders[0].status, 'created');
    assert.equal(calls.length, 1, 'Provider order is created once for a new idempotency key');

    const replay = await handleCreateSaasSubscriptionOrder(jsonRequest({ plan_code: 'pro', billing_cycle: 'monthly' }, key), env, 'org-1', owner);
    assert.equal(replay.status, 200, 'A retry returns the existing provider order');
    assert.equal(calls.length, 1, 'Idempotent create does not make a second provider order');

    const verifyUrl = 'https://api.orderitup.in/api/subscription/verify-payment';
    const invalidSignature = await handleVerifySaasSubscriptionPayment(new Request(verifyUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'order_test123abc', payment_id: 'pay_test123abc', signature: '0'.repeat(64) }),
    }), env, 'org-1', owner);
    assert.equal(invalidSignature.status, 400);
    assert.equal(calls.length, 1, 'Invalid signature is rejected before provider payment lookup');
    assert.equal(env.DB.subscriptions.length, 0, 'Invalid callback cannot activate a subscription');

    const validSignature = await signature(env.RAZORPAY_KEY_SECRET, 'order_test123abc|pay_test123abc');
    const verified = await handleVerifySaasSubscriptionPayment(new Request(verifyUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'order_test123abc', payment_id: 'pay_test123abc', signature: validSignature }),
    }), env, 'org-1', owner);
    assert.equal(verified.status, 200);
    const verifiedData = await verified.json() as any;
    assert.equal(verifiedData.subscription.status, 'active');
    assert.equal(verifiedData.subscription.plan_code, 'pro');
    assert.equal(verifiedData.subscription.amount_minor, 129900);
    assert.equal(env.DB.orders[0].status, 'captured');
    assert.equal(env.DB.events.length, 1, 'Captured payment creates a subscription lifecycle event');
    assert.equal(calls.length, 2, 'Provider state is fetched independently after signature validation');

    const secondReplay = await handleVerifySaasSubscriptionPayment(new Request(verifyUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'order_test123abc', payment_id: 'pay_test123abc', signature: validSignature }),
    }), env, 'org-1', owner);
    assert.equal(secondReplay.status, 200);
    assert.equal((await secondReplay.json() as any).idempotent_replay, true);
    assert.equal(env.DB.events.length, 1, 'Payment replay does not create a second event');

    env.DB.setAccountStatus('suspended');
    const suspendedCreate = await handleCreateSaasSubscriptionOrder(
      jsonRequest({ plan_code: 'pro', billing_cycle: 'monthly' }, 'suspended-checkout-key-0001'), env, 'org-1', owner,
    );
    assert.equal(suspendedCreate.status, 403, 'Suspended organizations cannot create billing orders');
    const suspendedVerify = await handleVerifySaasSubscriptionPayment(new Request(verifyUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'order_test123abc', payment_id: 'pay_test123abc', signature: validSignature }),
    }), env, 'org-1', owner);
    assert.equal(suspendedVerify.status, 403, 'Suspended organizations cannot activate or replay payment verification');
    assert.equal(calls.length, 2, 'Suspended billing requests do not reach Razorpay');
    env.DB.setAccountStatus('active');

    const crossTenant = await handleVerifySaasSubscriptionPayment(new Request(verifyUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'order_test123abc', payment_id: 'pay_test123abc', signature: validSignature }),
    }), env, 'another-org', owner);
    assert.equal(crossTenant.status, 404, 'A different tenant cannot verify or activate another organization payment');

    const webhookOrder = await handleCreateSaasSubscriptionOrder(
      jsonRequest({ plan_code: 'pro', billing_cycle: 'monthly' }, 'webhook-checkout-key-0001'), env, 'org-1', owner,
    );
    assert.equal(webhookOrder.status, 201);
    const webhookBody = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_hook123abc', order_id: 'order_hook123abc', status: 'captured', captured: true, amount: 129900, currency: 'INR' } } },
    });
    const webhookHeaders = {
      'Content-Type': 'application/json',
      'X-Razorpay-Event-Id': 'evt_test_capture_001',
      'X-Razorpay-Signature': await webhookSignature(env.RAZORPAY_WEBHOOK_SECRET, webhookBody),
    };
    const invalidWebhook = await handleRazorpaySubscriptionWebhook(new Request('https://api.orderitup.in/api/webhooks/razorpay', {
      method: 'POST', headers: { ...webhookHeaders, 'X-Razorpay-Signature': '0'.repeat(64) }, body: webhookBody,
    }), env);
    assert.equal(invalidWebhook.status, 400, 'Invalid raw-body webhook signature is rejected');
    assert.equal(env.DB.webhookEvents.length, 0, 'Invalid webhooks are not persisted as trusted events');

    const webhook = await handleRazorpaySubscriptionWebhook(new Request('https://api.orderitup.in/api/webhooks/razorpay', {
      method: 'POST', headers: webhookHeaders, body: webhookBody,
    }), env);
    assert.equal(webhook.status, 200, 'Signed captured event recovers checkout when the browser callback is absent');
    assert.equal(env.DB.orders.find((order: any) => order.provider_order_id === 'order_hook123abc').status, 'captured');
    assert.equal(env.DB.subscriptions[0].status, 'active');
    assert.equal(env.DB.events.length, 2);
    assert.equal(env.DB.webhookEvents[0].status, 'processed');
    assert.equal(calls.length, 4, 'Webhook independently retrieves payment state before activation');

    const duplicateWebhook = await handleRazorpaySubscriptionWebhook(new Request('https://api.orderitup.in/api/webhooks/razorpay', {
      method: 'POST', headers: webhookHeaders, body: webhookBody,
    }), env);
    assert.equal(duplicateWebhook.status, 200);
    assert.equal((await duplicateWebhook.json() as any).idempotent_replay, true);
    assert.equal(env.DB.events.length, 2, 'Duplicate webhook delivery does not repeat subscription activation');
    assert.equal(calls.length, 4, 'Durably processed webhook replays do not re-query Razorpay');

    const raceOrderA = await handleCreateSaasSubscriptionOrder(
      jsonRequest({ plan_code: 'pro', billing_cycle: 'monthly' }, 'concurrent-checkout-key-0001'), env, 'org-1', owner,
    );
    const raceOrderB = await handleCreateSaasSubscriptionOrder(
      jsonRequest({ plan_code: 'pro', billing_cycle: 'monthly' }, 'concurrent-checkout-key-0002'), env, 'org-1', owner,
    );
    assert.equal(raceOrderA.status, 201);
    assert.equal(raceOrderB.status, 201);
    const periodBeforeRace = Date.parse(env.DB.subscriptions[0].current_period_end);
    let releaseRace!: () => void;
    const raceWait = new Promise<void>((resolve) => { releaseRace = resolve; });
    racePaymentBarrier = { arrivals: 0, promise: raceWait, release: releaseRace };
    const verifyRacePayment = async (orderId: string, paymentId: string) => {
      const callbackSignature = await signature(env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);
      return handleVerifySaasSubscriptionPayment(new Request(verifyUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, payment_id: paymentId, signature: callbackSignature }),
      }), env, 'org-1', owner);
    };
    const [raceResultA, raceResultB] = await Promise.all([
      verifyRacePayment('order_raceA123', 'pay_raceA123'),
      verifyRacePayment('order_raceB123', 'pay_raceB123'),
    ]);
    racePaymentBarrier = null;
    assert.equal(raceResultA.status, 200);
    assert.equal(raceResultB.status, 200);
    const periodAfterRace = Date.parse(env.DB.subscriptions[0].current_period_end);
    assert.ok(periodAfterRace >= periodBeforeRace + 60 * 24 * 60 * 60 * 1000 - 1_000,
      `Concurrent captured orders each extend the subscription period exactly once (before=${new Date(periodBeforeRace).toISOString()}, after=${new Date(periodAfterRace).toISOString()})`);
    assert.equal(env.DB.events.length, 4, 'Each distinct captured payment has its own lifecycle event');
    console.log('Cloud SaaS subscription payment tests passed.');
  } finally {
    globalThis.fetch = previousFetch;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
