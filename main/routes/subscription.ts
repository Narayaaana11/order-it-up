import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/security';
import { ROLE_ACCESS } from '../../shared/role-permissions';
import { subscriptionService, SubscriptionPlan, SubscriptionStatus } from '../services/subscription';
import { asyncHandler } from '../middleware/async-handler';
import { getPaymentProvider } from '../services/payment-provider';
import { getDatabase, now, withTxn } from '../db';
import { createHash, randomUUID } from 'node:crypto';

const router = Router();

export const PRICING_PLANS = {
  starter: {
    name: 'Starter Plan',
    monthly: 499,
    yearly: 4999,
  },
  pro: {
    name: 'Professional Plan',
    monthly: 1299,
    yearly: 12999,
  },
  enterprise: {
    name: 'Enterprise Plan',
    monthly: 2999,
    yearly: 29999,
  },
} as const;

function nextSubscriptionPeriodEnd(cycle: 'monthly' | 'yearly'): string {
  const current = subscriptionService.getSubscriptionInfo();
  const currentEnd = current.status === 'active' && current.currentPeriodEnd
    ? Date.parse(current.currentPeriodEnd)
    : Number.NaN;
  const baseTime = Number.isFinite(currentEnd) ? Math.max(Date.now(), currentEnd) : Date.now();
  const durationDays = cycle === 'yearly' ? 365 : 30;
  return new Date(baseTime + durationDays * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * GET /api/subscription
 * Read-only status endpoint for POS terminal users to check plan, expiration, and feature entitlements.
 */
router.get('/', requireRole(...ROLE_ACCESS.allStaff), asyncHandler(async (_req: Request, res: Response) => {
  const info = subscriptionService.getSubscriptionInfo();
  res.json({
    ok: true,
    subscription: info,
    pricing: PRICING_PLANS,
  });
}));

/**
 * POST /api/subscription/create-order
 * Create a trusted payment order via Razorpay / commercial provider
 */
router.post('/create-order', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const { plan, billingCycle } = req.body || {};
  if (!plan || !PRICING_PLANS[plan as SubscriptionPlan]) {
    return res.status(400).json({ ok: false, error: 'Valid plan (starter, pro, enterprise) is required.' });
  }

  if (billingCycle !== undefined && billingCycle !== 'monthly' && billingCycle !== 'yearly') {
    return res.status(400).json({ ok: false, error: 'billingCycle must be monthly or yearly.' });
  }
  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const amount = PRICING_PLANS[plan as SubscriptionPlan][cycle];
  const receipt = `sub_${randomUUID().replace(/-/g, '')}`;

  const provider = getPaymentProvider();
  const order = await provider.createSubscriptionOrder({
    amount,
    currency: 'INR',
    receipt,
    notes: {
      plan,
      billingCycle: cycle,
      source: 'order-it-up-desktop',
    },
  });

  const createdAt = now();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  getDatabase().prepare(`
    INSERT INTO subscription_payment_orders (
      order_id, plan, billing_cycle, amount_minor, currency, provider, status, created_at, expires_at
    ) VALUES (?, ?, ?, ?, 'INR', ?, 'created', ?, ?)
  `).run(order.orderId, plan, cycle, Math.round(amount * 100), order.provider, createdAt, expiresAt);

  res.json({
    ok: true,
    order,
    plan,
    billingCycle: cycle,
  });
}));

/**
 * POST /api/subscription/verify-payment
 * Verify Razorpay payment signature and activate subscription entitlement (replay-safe)
 */
router.post('/verify-payment', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const { orderId, paymentId, signature } = req.body || {};
  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({
      ok: false,
      error: 'orderId, paymentId, and signature are required for payment verification.',
    });
  }

  const db = getDatabase();
  const subscriptionOrder = db.prepare(`
    SELECT order_id, plan, billing_cycle, amount_minor, currency, provider, status, expires_at, payment_id
    FROM subscription_payment_orders WHERE order_id = ?
  `).get(orderId) as {
    order_id: string; plan: SubscriptionPlan; billing_cycle: 'monthly' | 'yearly'; amount_minor: number;
    currency: string; provider: string; status: string; expires_at: string; payment_id: string | null;
  } | undefined;
  if (!subscriptionOrder) {
    return res.status(404).json({ ok: false, error: 'Subscription payment order not found.' });
  }
  if (subscriptionOrder.status !== 'created') {
    if (subscriptionOrder.status === 'captured' && subscriptionOrder.payment_id === paymentId) {
      return res.json({
        ok: true,
        message: `Payment verified and ${subscriptionOrder.plan.toUpperCase()} subscription is active.`,
        subscription: subscriptionService.getSubscriptionInfo(),
      });
    }
    if (subscriptionOrder.status !== 'captured' || subscriptionOrder.payment_id !== null) {
      return res.status(409).json({ ok: false, error: 'Subscription payment order has already been processed.' });
    }
  }
  if (subscriptionOrder.status === 'created' && new Date(subscriptionOrder.expires_at).getTime() <= Date.now()) {
    return res.status(410).json({ ok: false, error: 'Subscription payment order has expired. Please start checkout again.' });
  }

  // Retain compatibility with existing clients while refusing any attempt to
  // change the plan after the server has created the payment order.
  if (req.body?.plan && req.body.plan !== subscriptionOrder.plan) {
    return res.status(400).json({ ok: false, error: 'Payment order plan does not match the selected plan.' });
  }
  if (req.body?.billingCycle && req.body.billingCycle !== subscriptionOrder.billing_cycle) {
    return res.status(400).json({ ok: false, error: 'Payment order billing cycle does not match.' });
  }

  const provider = getPaymentProvider();
  if (provider.providerName !== subscriptionOrder.provider) {
    return res.status(400).json({ ok: false, error: 'Payment provider does not match the provider that created this order.' });
  }
  const result = await provider.verifyPayment({
    orderId,
    paymentId,
    signature,
    expectedAmountMinor: subscriptionOrder.amount_minor,
    expectedCurrency: subscriptionOrder.currency,
  });
  if (
    !result.verified
    || result.status !== 'success'
    || result.captured !== true
    || result.amountMinor !== subscriptionOrder.amount_minor
    || result.currency !== subscriptionOrder.currency
  ) {
    return res.status(400).json({ ok: false, error: result.message || 'Payment verification failed.' });
  }

  // Prevent replay attacks: ensure paymentId or orderId was not previously consumed
  const existingPayment = db.prepare('SELECT 1 FROM payment_transaction_refs WHERE method = ? AND transaction_id = ?')
    .get('razorpay_subscription', paymentId);
  if (existingPayment) {
    return res.status(409).json({ ok: false, error: 'Payment transaction has already been processed and activated.' });
  }

  const existingOrder = db.prepare('SELECT transaction_id FROM payment_transaction_refs WHERE method = ? AND bill_id = ?')
    .get('razorpay_subscription', orderId);
  if (existingOrder && subscriptionOrder.status === 'created') {
    return res.status(409).json({ ok: false, error: 'Subscription order has already been activated with another transaction.' });
  }

  const expiryDate = nextSubscriptionPeriodEnd(subscriptionOrder.billing_cycle);

  // Atomically record transaction and update subscription status
  withTxn(() => {
    const currentOrder = db.prepare(`
      SELECT status, expires_at, payment_id FROM subscription_payment_orders WHERE order_id = ?
    `).get(orderId) as { status: string; expires_at: string; payment_id: string | null } | undefined;
    if (!currentOrder
      || (currentOrder.status !== 'created' && !(currentOrder.status === 'captured' && currentOrder.payment_id === null))
      || (currentOrder.status === 'created' && new Date(currentOrder.expires_at).getTime() <= Date.now())) {
      throw Object.assign(new Error('Subscription payment order has expired or was already processed.'), { statusCode: 409 });
    }
    db.prepare('INSERT INTO payment_transaction_refs (method, transaction_id, bill_id, created_at) VALUES (?, ?, ?, ?)')
      .run('razorpay_subscription', paymentId, orderId, now());

    const orderUpdate = db.prepare(`
      UPDATE subscription_payment_orders
      SET status = 'captured', payment_id = ?, captured_at = ?
      WHERE order_id = ? AND (status = 'created' OR (status = 'captured' AND payment_id IS NULL))
    `).run(paymentId, now(), orderId);
    if (orderUpdate.changes !== 1) {
      throw Object.assign(new Error('Subscription payment order was already processed.'), { statusCode: 409 });
    }

    if (currentOrder.status === 'created') {
      subscriptionService.updateSubscription({
        status: 'active',
        plan: subscriptionOrder.plan,
        currentPeriodEnd: expiryDate,
        licenseKey: `SUB-${orderId}-${paymentId.slice(-6)}`,
      });
    }
  });

  const updated = subscriptionService.getSubscriptionInfo();
  res.json({
    ok: true,
    message: `Payment verified and ${subscriptionOrder.plan.toUpperCase()} subscription activated.`,
    subscription: updated,
  });
}));

/**
 * POST /api/subscription/webhooks/razorpay
 * Official Razorpay webhook handler with HMAC-SHA256 verification and event deduplication
 */
router.post('/webhooks/razorpay', asyncHandler(async (req: Request, res: Response) => {
  const signature = req.get('x-razorpay-signature');
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.OIU_RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
      return res.status(500).json({ error: 'Dedicated RAZORPAY_WEBHOOK_SECRET is not configured in production/staging environment' });
    }
    return res.status(500).json({ error: 'Dedicated RAZORPAY_WEBHOOK_SECRET is required to process webhooks.' });
  }

  if (!signature) {
    return res.status(401).json({ error: 'Missing x-razorpay-signature header' });
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    return res.status(400).json({ error: 'Raw webhook request body is unavailable for signature verification.' });
  }
  const crypto = await import('node:crypto');
  const expectedSig = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  const event = req.body;
  const eventId = event?.id
    || req.get('x-razorpay-event-id')
    || `wh_${createHash('sha256').update(rawBody).digest('hex')}`;
  const eventType = event?.event;

  // Deduplication: prevent duplicate webhook event execution (scoped to razorpay_webhook method)
  const db = getDatabase();
  const processed = db.prepare('SELECT 1 FROM payment_transaction_refs WHERE method = ? AND transaction_id = ?')
    .get('razorpay_webhook', eventId);
  if (processed) {
    return res.status(200).json({ ok: true, status: 'already_processed', eventId });
  }

  const paymentEntity = event?.payload?.payment?.entity;
  const orderEntity = event?.payload?.order?.entity;
  const refundEntity = event?.payload?.refund?.entity;
  const disputeEntity = event?.payload?.dispute?.entity;

  if (eventType === 'payment.captured' || eventType === 'order.paid') {
    const orderId = eventType === 'payment.captured' ? paymentEntity?.order_id : orderEntity?.id;
    const paymentId = eventType === 'payment.captured' ? paymentEntity?.id : null;
    const paidAmount = eventType === 'payment.captured' ? paymentEntity?.amount : orderEntity?.amount_paid;
    const currency = eventType === 'payment.captured' ? paymentEntity?.currency : orderEntity?.currency;
    const captured = eventType === 'payment.captured'
      ? paymentEntity?.status === 'captured' && paymentEntity?.captured === true
      : orderEntity?.status === 'paid';
    const subscriptionOrder = typeof orderId === 'string'
      ? db.prepare(`
          SELECT order_id, plan, billing_cycle, amount_minor, currency, provider, status, payment_id
          FROM subscription_payment_orders WHERE order_id = ?
        `).get(orderId) as {
          order_id: string; plan: SubscriptionPlan; billing_cycle: 'monthly' | 'yearly'; amount_minor: number;
          currency: string; provider: string; status: string; payment_id: string | null;
        } | undefined
      : undefined;
    const validCapture = subscriptionOrder
      && subscriptionOrder.provider === 'razorpay'
      && captured
      && Number(paidAmount) === subscriptionOrder.amount_minor
      && currency === subscriptionOrder.currency;

    if (validCapture && (subscriptionOrder.status === 'created'
      || (subscriptionOrder.status === 'captured' && subscriptionOrder.payment_id === paymentId))) {
      const expiryDate = nextSubscriptionPeriodEnd(subscriptionOrder.billing_cycle);
      withTxn(() => {
        db.prepare('INSERT INTO payment_transaction_refs (method, transaction_id, bill_id, created_at) VALUES (?, ?, ?, ?)')
          .run('razorpay_webhook', eventId, orderId, now());
        if (subscriptionOrder.status === 'created') {
          db.prepare('INSERT INTO payment_transaction_refs (method, transaction_id, bill_id, created_at) VALUES (?, ?, ?, ?)')
            .run('razorpay_subscription', paymentId || `webhook_${eventId}`, orderId, now());
          db.prepare(`
            UPDATE subscription_payment_orders
            SET status = 'captured', payment_id = ?, captured_at = ?
            WHERE order_id = ? AND status = 'created'
          `).run(paymentId, now(), orderId);
          subscriptionService.updateSubscription({
            status: 'active',
            plan: subscriptionOrder.plan,
            currentPeriodEnd: expiryDate,
            licenseKey: paymentId ? `SUB-${orderId}-${paymentId.slice(-6)}` : `SUB-${orderId}-${eventId.slice(-6)}`,
          });
        }
      });
    } else {
      // Signed but unrelated, unpaid, or amount-mismatched provider events are
      // acknowledged without granting entitlements.
      db.prepare('INSERT INTO payment_transaction_refs (method, transaction_id, bill_id, created_at) VALUES (?, ?, ?, ?)')
        .run('razorpay_webhook', eventId, 'ignored_unmatched_subscription_order', now());
    }
  } else if (eventType === 'payment.failed') {
    db.prepare('INSERT INTO payment_transaction_refs (method, transaction_id, bill_id, created_at) VALUES (?, ?, ?, ?)')
      .run('razorpay_webhook_failed', eventId, paymentEntity?.order_id || 'webhook_failed', now());
  } else if (eventType === 'refund.processed' || eventType === 'payment.dispute.created') {
    const affectedPaymentId = eventType === 'refund.processed' ? refundEntity?.payment_id : disputeEntity?.payment_id;
    const paidOrder = affectedPaymentId
      ? db.prepare(`SELECT order_id FROM subscription_payment_orders WHERE payment_id = ? AND status = 'captured'`)
          .get(affectedPaymentId) as { order_id: string } | undefined
      : undefined;
    withTxn(() => {
      db.prepare('INSERT INTO payment_transaction_refs (method, transaction_id, bill_id, created_at) VALUES (?, ?, ?, ?)')
        .run('razorpay_dispute', eventId, paidOrder?.order_id || 'unmatched_payment', now());
      if (paidOrder) subscriptionService.updateSubscription({ status: 'suspended' });
    });
  }

  res.status(200).json({ ok: true, status: 'processed', eventId });
}));

/**
 * POST /api/subscription/activate
 * Activate a commercial license key on this terminal using Asymmetric Public-Key (Ed25519) verification
 */
router.post('/activate', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const { licenseKey } = req.body;
  if (!licenseKey || typeof licenseKey !== 'string' || !licenseKey.trim()) {
    return res.status(400).json({ ok: false, error: 'A valid license key is required.' });
  }

  const trimmed = licenseKey.trim();

  // 1. Verify Asymmetric Ed25519 License Signature
  const { verifyAsymmetricLicense } = await import('../services/license-verifier');
  const result = verifyAsymmetricLicense(trimmed);

  if (!result.valid) {
    // Development / Local Test Fallback (explicit DEV- or TEST- prefix required; not permitted in production)
    if (process.env.NODE_ENV !== 'production' && (trimmed.startsWith('DEV-') || trimmed.startsWith('TEST-'))) {
      let devPlan: SubscriptionPlan = 'pro';
      if (trimmed.toUpperCase().includes('STARTER')) devPlan = 'starter';
      if (trimmed.toUpperCase().includes('ENTERPRISE')) devPlan = 'enterprise';

      const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      subscriptionService.updateSubscription({
        status: 'active',
        plan: devPlan,
        currentPeriodEnd: oneYear,
        licenseKey: trimmed,
      });

      return res.json({
        ok: true,
        message: `Development license activated for Order It Up (${devPlan.toUpperCase()} Plan).`,
        subscription: subscriptionService.getSubscriptionInfo(),
      });
    }

    return res.status(400).json({
      ok: false,
      error: result.error || 'Invalid, expired, or counterfeit commercial license key.',
    });
  }

  const planCode = result.plan!;
  const expiryIso = result.expiresAt!;

  subscriptionService.updateSubscription({
    status: 'active',
    plan: planCode,
    currentPeriodEnd: expiryIso,
    licenseKey: trimmed,
  });

  const updated = subscriptionService.getSubscriptionInfo();
  res.json({
    ok: true,
    message: `License successfully activated for Order It Up (${planCode.toUpperCase()} Plan).`,
    subscription: updated,
  });
}));

export const subscriptionRoutes = router;

