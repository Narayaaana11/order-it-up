/** Integration coverage for server-bound subscription checkout and replay safety. */

const Module = require('module');
const originalLoad = Module._load;
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-subscription-payment-test-'));
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') return { app: { isPackaged: true, getPath: () => testDir, getVersion: () => 'test' } };
  return originalLoad.apply(this, arguments as any);
};

const {
  initTestDb, createApp, startServer, seedOwnerUser, api, closeDatabase,
} = require('./helpers/test-setup');
const { registerRoutes } = require('../main/routes/index');

async function main() {
  const db = initTestDb();
  const { authHeader } = seedOwnerUser(db);
  const app = createApp({});
  registerRoutes(app);
  const { baseUrl, server } = await startServer(app);

  try {
    const created = await api(baseUrl, '/api/subscription/create-order', {
      method: 'POST',
      headers: authHeader,
      body: { plan: 'pro', billingCycle: 'yearly' },
    });
    if (created.status !== 200) throw new Error(`Expected order creation 200, got ${created.status}: ${JSON.stringify(created.data)}`);
    const orderId = created.data.order.orderId;
    const orderRow = db.prepare('SELECT plan, billing_cycle, amount_minor, currency, provider, status FROM subscription_payment_orders WHERE order_id = ?').get(orderId) as any;
    if (!orderRow) throw new Error('Server-created payment order was not persisted');
    if (orderRow.plan !== 'pro' || orderRow.billing_cycle !== 'yearly' || orderRow.amount_minor !== 1299900 || orderRow.currency !== 'INR') {
      throw new Error(`Server stored unexpected subscription terms: ${JSON.stringify(orderRow)}`);
    }

    const tampered = await api(baseUrl, '/api/subscription/verify-payment', {
      method: 'POST', headers: authHeader,
      body: { orderId, paymentId: 'pay_tampered_plan', signature: 'valid', plan: 'enterprise', billingCycle: 'yearly' },
    });
    if (tampered.status !== 400) throw new Error(`Client plan tampering should be rejected, got ${tampered.status}`);
    if (db.prepare('SELECT status FROM subscription_payment_orders WHERE order_id = ?').get(orderId)?.status !== 'created') {
      throw new Error('A rejected plan-tampering attempt changed the payment order state');
    }

    const verified = await api(baseUrl, '/api/subscription/verify-payment', {
      method: 'POST', headers: authHeader,
      body: { orderId, paymentId: 'pay_valid_yearly', signature: 'valid', plan: 'pro', billingCycle: 'yearly' },
    });
    if (verified.status !== 200 || verified.data.subscription.plan !== 'pro') {
      throw new Error(`Expected server-bound pro activation, got ${verified.status}: ${JSON.stringify(verified.data)}`);
    }
    const capturedRow = db.prepare('SELECT status, payment_id FROM subscription_payment_orders WHERE order_id = ?').get(orderId) as any;
    if (capturedRow.status !== 'captured' || capturedRow.payment_id !== 'pay_valid_yearly') {
      throw new Error('Successful verification did not atomically capture the stored order');
    }

    const replay = await api(baseUrl, '/api/subscription/verify-payment', {
      method: 'POST', headers: authHeader,
      body: { orderId, paymentId: 'pay_second_attempt', signature: 'valid', plan: 'pro', billingCycle: 'yearly' },
    });
    if (replay.status !== 409) throw new Error(`A different payment replay must be rejected, got ${replay.status}`);

    const expiring = await api(baseUrl, '/api/subscription/create-order', {
      method: 'POST', headers: authHeader,
      body: { plan: 'starter', billingCycle: 'monthly' },
    });
    const expiredOrderId = expiring.data.order.orderId;
    db.prepare('UPDATE subscription_payment_orders SET expires_at = ? WHERE order_id = ?')
      .run(new Date(Date.now() - 1000).toISOString(), expiredOrderId);
    const expired = await api(baseUrl, '/api/subscription/verify-payment', {
      method: 'POST', headers: authHeader,
      body: { orderId: expiredOrderId, paymentId: 'pay_expired', signature: 'valid', plan: 'starter', billingCycle: 'monthly' },
    });
    if (expired.status !== 410) throw new Error(`Expired payment order must be rejected, got ${expired.status}`);

    const webhookSecret = 'subscription-order-webhook-secret-for-tests';
    const previousWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;
    const webhookOrderId = 'order_webhook_enterprise';
    db.prepare(`
      INSERT INTO subscription_payment_orders (
        order_id, plan, billing_cycle, amount_minor, currency, provider, status, created_at, expires_at
      ) VALUES (?, 'enterprise', 'monthly', 299900, 'INR', 'razorpay', 'created', ?, ?)
    `).run(webhookOrderId, new Date().toISOString(), new Date(Date.now() + 30 * 60 * 1000).toISOString());
    const webhookBody = JSON.stringify({
      id: 'evt_subscription_captured_1',
      event: 'payment.captured',
      payload: { payment: { entity: {
        id: 'pay_webhook_enterprise', order_id: webhookOrderId, amount: 299900,
        currency: 'INR', status: 'captured', captured: true,
      } } },
    });
    const webhookSignature = crypto.createHmac('sha256', webhookSecret).update(webhookBody).digest('hex');
    const webhookResponse = await fetch(`${baseUrl}/api/subscription/webhooks/razorpay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': webhookSignature },
      body: webhookBody,
    });
    if (webhookResponse.status !== 200) throw new Error(`Valid captured payment webhook should return 200, got ${webhookResponse.status}: ${await webhookResponse.text()}`);
    const webhookRow = db.prepare('SELECT status, payment_id FROM subscription_payment_orders WHERE order_id = ?').get(webhookOrderId) as any;
    if (webhookRow.status !== 'captured' || webhookRow.payment_id !== 'pay_webhook_enterprise') {
      throw new Error('Captured payment webhook did not bind payment to the server order');
    }
    const activatedPlan = db.prepare("SELECT value FROM settings WHERE key = 'subscription_plan'").get() as { value: string };
    if (activatedPlan.value !== 'enterprise') throw new Error('Captured webhook did not activate its server-bound enterprise plan');

    const webhookReplay = await fetch(`${baseUrl}/api/subscription/webhooks/razorpay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': webhookSignature },
      body: webhookBody,
    });
    if (webhookReplay.status !== 200 || (await webhookReplay.json() as any).status !== 'already_processed') {
      throw new Error('Duplicate payment webhook was not safely deduplicated');
    }

    const mismatchedWebhookOrderId = 'order_webhook_wrong_amount';
    db.prepare(`
      INSERT INTO subscription_payment_orders (
        order_id, plan, billing_cycle, amount_minor, currency, provider, status, created_at, expires_at
      ) VALUES (?, 'starter', 'monthly', 49900, 'INR', 'razorpay', 'created', ?, ?)
    `).run(mismatchedWebhookOrderId, new Date().toISOString(), new Date(Date.now() + 30 * 60 * 1000).toISOString());
    const mismatchedWebhookBody = JSON.stringify({
      id: 'evt_subscription_wrong_amount',
      event: 'payment.captured',
      payload: { payment: { entity: {
        id: 'pay_webhook_wrong_amount', order_id: mismatchedWebhookOrderId, amount: 100,
        currency: 'INR', status: 'captured', captured: true,
      } } },
    });
    const mismatchedWebhookSignature = crypto.createHmac('sha256', webhookSecret).update(mismatchedWebhookBody).digest('hex');
    await fetch(`${baseUrl}/api/subscription/webhooks/razorpay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': mismatchedWebhookSignature },
      body: mismatchedWebhookBody,
    });
    const mismatchedWebhookRow = db.prepare('SELECT status FROM subscription_payment_orders WHERE order_id = ?')
      .get(mismatchedWebhookOrderId) as { status: string };
    if (mismatchedWebhookRow.status !== 'created') throw new Error('Amount-mismatched webhook captured a subscription order');
    const stillEnterprise = db.prepare("SELECT value FROM settings WHERE key = 'subscription_plan'").get() as { value: string };
    if (stillEnterprise.value !== 'enterprise') throw new Error('Amount-mismatched webhook changed subscription entitlements');

    const paidOrderId = 'order_webhook_paid';
    db.prepare(`
      INSERT INTO subscription_payment_orders (
        order_id, plan, billing_cycle, amount_minor, currency, provider, status, created_at, expires_at
      ) VALUES (?, 'starter', 'yearly', 499900, 'INR', 'razorpay', 'created', ?, ?)
    `).run(paidOrderId, new Date().toISOString(), new Date(Date.now() + 30 * 60 * 1000).toISOString());
    const orderPaidBody = JSON.stringify({
      id: 'evt_subscription_order_paid',
      event: 'order.paid',
      payload: { order: { entity: {
        id: paidOrderId, amount: 499900, amount_paid: 499900, currency: 'INR', status: 'paid',
      } } },
    });
    const orderPaidSignature = crypto.createHmac('sha256', webhookSecret).update(orderPaidBody).digest('hex');
    const orderPaidResponse = await fetch(`${baseUrl}/api/subscription/webhooks/razorpay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': orderPaidSignature },
      body: orderPaidBody,
    });
    if (orderPaidResponse.status !== 200) throw new Error(`Valid paid-order webhook should return 200, got ${orderPaidResponse.status}`);
    const paidOrderRow = db.prepare('SELECT status, payment_id FROM subscription_payment_orders WHERE order_id = ?')
      .get(paidOrderId) as any;
    if (paidOrderRow.status !== 'captured' || paidOrderRow.payment_id !== null) {
      throw new Error('order.paid webhook did not record the captured server order without inventing a payment ID');
    }
    const subscriptionEndBeforeCallback = (db.prepare("SELECT value FROM settings WHERE key = 'subscription_period_end'").get() as { value: string }).value;
    const originalPaymentFetch = global.fetch;
    const oldRazorpayKey = process.env.RAZORPAY_KEY_ID;
    const oldRazorpaySecret = process.env.RAZORPAY_KEY_SECRET;
    const callbackPaymentId = 'pay_order_paid_callback';
    const callbackSecret = 'subscription-test-razorpay-secret';
    const callbackSignature = crypto.createHmac('sha256', callbackSecret).update(`${paidOrderId}|${callbackPaymentId}`).digest('hex');
    process.env.RAZORPAY_KEY_ID = 'rzp_test_subscription';
    process.env.RAZORPAY_KEY_SECRET = callbackSecret;
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith('https://api.razorpay.com/')) {
        return new Response(JSON.stringify({
          id: callbackPaymentId, order_id: paidOrderId, amount: 499900, currency: 'INR', status: 'captured', captured: true,
        }), { status: 200 });
      }
      return originalPaymentFetch(input, init);
    }) as typeof fetch;
    const paidOrderCallback = await api(baseUrl, '/api/subscription/verify-payment', {
      method: 'POST', headers: authHeader,
      body: { orderId: paidOrderId, paymentId: callbackPaymentId, signature: callbackSignature, plan: 'starter', billingCycle: 'yearly' },
    });
    global.fetch = originalPaymentFetch;
    if (oldRazorpayKey === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = oldRazorpayKey;
    if (oldRazorpaySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = oldRazorpaySecret;
    if (paidOrderCallback.status !== 200) throw new Error(`Checkout callback after order.paid should be idempotent, got ${paidOrderCallback.status}`);
    const paidOrderBound = db.prepare('SELECT status, payment_id FROM subscription_payment_orders WHERE order_id = ?').get(paidOrderId) as any;
    if (paidOrderBound.status !== 'captured' || paidOrderBound.payment_id !== callbackPaymentId) {
      throw new Error(`Checkout callback did not bind the real payment to the previously paid order: ${JSON.stringify({ paidOrderBound, callbackStatus: paidOrderCallback.status, callbackData: paidOrderCallback.data })}`);
    }
    const subscriptionEndAfterCallback = (db.prepare("SELECT value FROM settings WHERE key = 'subscription_period_end'").get() as { value: string }).value;
    if (subscriptionEndAfterCallback !== subscriptionEndBeforeCallback) {
      throw new Error('Checkout callback extended the subscription a second time after order.paid activation');
    }

    if (previousWebhookSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = previousWebhookSecret;

    console.log('Subscription payment order integration tests passed (server-bound plan, amount, cycle, capture, expiry, replay).');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
