import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/security';
import { ROLE_ACCESS } from '../../shared/role-permissions';
import { subscriptionService, SubscriptionPlan, SubscriptionStatus } from '../services/subscription';
import { asyncHandler } from '../middleware/async-handler';
import { getPaymentProvider } from '../services/payment-provider';
import { getDatabase, now, withTxn } from '../db';

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

  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const amount = PRICING_PLANS[plan as SubscriptionPlan][cycle];
  const receipt = `sub_${plan}_${Date.now().toString().slice(-6)}`;

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
  const { orderId, paymentId, signature, plan, billingCycle } = req.body || {};
  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({
      ok: false,
      error: 'orderId, paymentId, and signature are required for payment verification.',
    });
  }

  if (!plan || !PRICING_PLANS[plan as SubscriptionPlan]) {
    return res.status(400).json({ ok: false, error: 'Valid plan (starter, pro, enterprise) is required.' });
  }

  // Cryptographic signature check via provider
  const provider = getPaymentProvider();
  const result = await provider.verifyPayment({ orderId, paymentId, signature });
  if (!result.verified || result.status !== 'success') {
    return res.status(400).json({ ok: false, error: result.message || 'Payment signature verification failed.' });
  }

  // Prevent replay attacks: ensure paymentId was not previously consumed
  const db = getDatabase();
  const existing = db.prepare('SELECT 1 FROM payment_transaction_refs WHERE transaction_id = ?').get(paymentId);
  if (existing) {
    return res.status(409).json({ ok: false, error: 'Payment transaction has already been processed and activated.' });
  }

  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const durationDays = cycle === 'yearly' ? 365 : 30;
  const expiryDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  // Atomically record transaction and update subscription status
  withTxn(() => {
    db.prepare('INSERT INTO payment_transaction_refs (method, transaction_id, bill_id, created_at) VALUES (?, ?, ?, ?)')
      .run('razorpay_subscription', paymentId, orderId, now());

    subscriptionService.updateSubscription({
      status: 'active',
      plan: plan as SubscriptionPlan,
      currentPeriodEnd: expiryDate,
      licenseKey: `SUB-${orderId}-${paymentId.slice(-6)}`,
    });
  });

  const updated = subscriptionService.getSubscriptionInfo();
  res.json({
    ok: true,
    message: `Payment verified and ${plan.toUpperCase()} subscription activated.`,
    subscription: updated,
  });
}));

/**
 * POST /api/subscription/webhooks/razorpay
 * Official Razorpay webhook handler with HMAC-SHA256 verification and event deduplication
 */
router.post('/webhooks/razorpay', asyncHandler(async (req: Request, res: Response) => {
  const signature = req.get('x-razorpay-signature');
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.OIU_RAZORPAY_KEY_SECRET;

  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'Webhook secret is not configured in production' });
    }
  }

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  if (webhookSecret) {
    const crypto = await import('node:crypto');
    const expectedSig = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature || '', 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }
  }

  const event = req.body;
  const eventId = event?.id || `wh_${Date.now()}`;
  const eventType = event?.event;

  // Deduplication: prevent duplicate webhook event execution
  const db = getDatabase();
  const processed = db.prepare('SELECT 1 FROM payment_transaction_refs WHERE transaction_id = ?').get(eventId);
  if (processed) {
    return res.status(200).json({ ok: true, status: 'already_processed', eventId });
  }

  if (eventType === 'payment.captured' || eventType === 'order.paid') {
    const entity = event?.payload?.payment?.entity || event?.payload?.order?.entity;
    const notes = entity?.notes || {};
    const plan = (notes.plan || 'pro') as SubscriptionPlan;
    const durationDays = notes.billingCycle === 'yearly' ? 365 : 30;
    const expiryDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    withTxn(() => {
      db.prepare('INSERT INTO payment_transaction_refs (method, transaction_id, bill_id, created_at) VALUES (?, ?, ?, ?)')
        .run('razorpay_webhook', eventId, entity?.id || 'subscription_webhook', now());

      subscriptionService.updateSubscription({
        status: 'active',
        plan: ['starter', 'pro', 'enterprise'].includes(plan) ? plan : 'pro',
        currentPeriodEnd: expiryDate,
      });
    });
  } else if (eventType === 'payment.failed') {
    db.prepare('INSERT INTO payment_transaction_refs (method, transaction_id, bill_id, created_at) VALUES (?, ?, ?, ?)')
      .run('razorpay_webhook_failed', eventId, 'webhook_failed', now());
  }

  res.status(200).json({ ok: true, status: 'processed', eventId });
}));

/**
 * POST /api/subscription/activate
 * Activate a license key on this terminal (Owner/Manager role required)
 */
router.post('/activate', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const { licenseKey } = req.body;
  if (!licenseKey || typeof licenseKey !== 'string' || !licenseKey.trim()) {
    return res.status(400).json({ ok: false, error: 'A valid license key is required.' });
  }

  const trimmed = licenseKey.trim();
  const parts = trimmed.split('-');

  // Production requires structured, cryptographically validated commercial licenses
  if (process.env.NODE_ENV === 'production') {
    if (parts.length < 4 || parts[0].toUpperCase() !== 'OIU') {
      return res.status(400).json({
        ok: false,
        error: 'Invalid license format. Commercial licenses must be in OIU-<PLAN>-<EXPIRY>-<SIG> format.'
      });
    }

    const planCode = parts[1].toLowerCase() as SubscriptionPlan;
    if (!['starter', 'pro', 'enterprise'].includes(planCode)) {
      return res.status(400).json({ ok: false, error: 'Unknown plan specified in license key.' });
    }

    const crypto = await import('node:crypto');
    const licenseSecret = process.env.OIU_LICENSE_SECRET || process.env.JWT_SECRET;
    if (!licenseSecret) {
      return res.status(500).json({ ok: false, error: 'Server license verification service is misconfigured.' });
    }

    const payload = `${parts[0]}-${parts[1]}-${parts[2]}`;
    const expectedSig = crypto.createHmac('sha256', licenseSecret).update(payload).digest('hex').slice(0, parts[3].length);

    const sigBuf = Buffer.from(parts[3].toLowerCase(), 'utf8');
    const expBuf = Buffer.from(expectedSig.toLowerCase(), 'utf8');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(401).json({ ok: false, error: 'Invalid or counterfeit license key signature.' });
    }

    // Verify expiry timestamp
    const expiryTimestamp = parseInt(parts[2], 16) * 1000;
    if (isNaN(expiryTimestamp) || expiryTimestamp < Date.now()) {
      return res.status(400).json({ ok: false, error: 'This license key has expired.' });
    }

    const expiryIso = new Date(expiryTimestamp).toISOString();
    subscriptionService.updateSubscription({
      status: 'active',
      plan: planCode,
      currentPeriodEnd: expiryIso,
      licenseKey: trimmed,
    });

    const updated = subscriptionService.getSubscriptionInfo();
    return res.json({
      ok: true,
      message: `License successfully activated for Order It Up (${planCode.toUpperCase()} Plan).`,
      subscription: updated,
    });
  }

  // Development / Testing fallback
  let plan: SubscriptionPlan = 'pro';
  if (trimmed.toUpperCase().includes('STARTER')) {
    plan = 'starter';
  } else if (trimmed.toUpperCase().includes('ENTERPRISE')) {
    plan = 'enterprise';
  }

  const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  subscriptionService.updateSubscription({
    status: 'active',
    plan,
    currentPeriodEnd: oneYearFromNow,
    licenseKey: trimmed,
  });

  const updated = subscriptionService.getSubscriptionInfo();
  res.json({
    ok: true,
    message: `License successfully activated for Order It Up (${plan.toUpperCase()} Plan).`,
    subscription: updated,
  });
}));

export const subscriptionRoutes = router;

