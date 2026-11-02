import { hashString } from '../auth';
import { isOrgOwnerOrAdmin, UserMembership } from '../rbac';
import { checkRateLimit, createRateLimitResponse } from '../rate-limit';
import { Env } from './pairing';

interface BillingEnv extends Env {
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
}

interface PaymentOrderRow {
  id: string;
  organization_id: string;
  plan_code: string;
  billing_cycle: 'monthly' | 'yearly';
  amount_minor: number;
  currency: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  status: string;
  expires_at: string;
}

function providerConfigured(env: BillingEnv): boolean {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return false;
  if (env.ENVIRONMENT === 'production') return /^rzp_live_[A-Za-z0-9]+$/.test(env.RAZORPAY_KEY_ID);
  return /^rzp_(test|live)_[A-Za-z0-9]+$/.test(env.RAZORPAY_KEY_ID);
}

async function ensureOrganizationCanManageBilling(env: BillingEnv, orgId: string): Promise<Response | null> {
  const organization = await env.DB.prepare(`
    SELECT account_status FROM organizations WHERE id = ?
  `).bind(orgId).first<{ account_status: string }>();
  if (!organization) return Response.json({ error: 'Organization not found' }, { status: 404 });
  if (organization.account_status !== 'active') {
    return Response.json({ error: 'This organization cannot manage billing while its account is suspended or closed.' }, { status: 403 });
  }
  return null;
}

function paymentUnavailable(): Response {
  return Response.json({
    error: 'SaaS billing is not configured. No payment or plan activation was performed.',
    code: 'SAAS_BILLING_PROVIDER_NOT_CONFIGURED',
  }, { status: 503 });
}

function parseJsonBody(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
}

function d1Changes(result: any): number {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

function providerAuthorization(env: BillingEnv): string {
  return `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`;
}

async function getIdempotentOrder(env: BillingEnv, orgId: string, keyHash: string): Promise<PaymentOrderRow | null> {
  return env.DB.prepare(`
    SELECT id, organization_id, plan_code, billing_cycle, amount_minor, currency,
           provider_order_id, provider_payment_id, status, expires_at
    FROM saas_subscription_payment_orders
    WHERE organization_id = ? AND idempotency_key_hash = ?
  `).bind(orgId, keyHash).first<PaymentOrderRow>();
}

function responseForExistingOrder(row: PaymentOrderRow, keyId: string): Response {
  if (row.status === 'created' && row.provider_order_id) {
    return Response.json({
      ok: true,
      order: {
        id: row.provider_order_id,
        amount: row.amount_minor,
        currency: row.currency,
        status: 'created',
        key_id: keyId,
      },
      plan: row.plan_code,
      billing_cycle: row.billing_cycle,
      expires_at: row.expires_at,
      idempotent_replay: true,
    });
  }
  if (row.status === 'creating') {
    return Response.json({ error: 'A payment order with this request key is still being created. Retry shortly.' }, { status: 409 });
  }
  return Response.json({ error: 'This request key was already used. Start a new checkout with a new key.' }, { status: 409 });
}

export async function handleCreateSaasSubscriptionOrder(
  request: Request,
  env: BillingEnv,
  orgId: string,
  memberships: UserMembership[],
): Promise<Response> {
  if (!isOrgOwnerOrAdmin(memberships)) return Response.json({ error: 'Only organization owners can manage SaaS billing' }, { status: 403 });
  const accountBlock = await ensureOrganizationCanManageBilling(env, orgId);
  if (accountBlock) return accountBlock;
  if (!providerConfigured(env)) return paymentUnavailable();

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 8_000) return Response.json({ error: 'Request is too large' }, { status: 413 });
  let body: Record<string, any> | null;
  try { body = parseJsonBody(await request.json()); }
  catch { body = null; }
  const planCode = typeof body?.plan_code === 'string' ? body.plan_code.trim().toLowerCase() : '';
  const billingCycle = body?.billing_cycle;
  if (!body || !/^[a-z0-9_-]{1,64}$/.test(planCode) || !['monthly', 'yearly'].includes(billingCycle)) {
    return Response.json({ error: 'plan_code and billing_cycle (monthly or yearly) are required' }, { status: 400 });
  }

  const rawKey = request.headers.get('Idempotency-Key')?.trim() || '';
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(rawKey)) {
    return Response.json({ error: 'A valid Idempotency-Key header is required' }, { status: 400 });
  }
  const keyHash = await hashString(`${orgId}:${rawKey}`);
  const prior = await getIdempotentOrder(env, orgId, keyHash);
  if (prior) return responseForExistingOrder(prior, env.RAZORPAY_KEY_ID!);

  const orderRateLimit = await checkRateLimit(env.DB, {
    keyPrefix: 'saas_subscription_order_org',
    identifier: orgId,
    limit: 10,
    windowSeconds: 3600,
  });
  if (!orderRateLimit.allowed) return createRateLimitResponse(orderRateLimit);

  const plan = await env.DB.prepare(`
    SELECT code, currency, monthly_price_minor, yearly_price_minor
    FROM saas_plans WHERE code = ? AND is_active = 1
  `).bind(planCode).first<{ code: string; currency: string; monthly_price_minor: number; yearly_price_minor: number }>();
  if (!plan) return Response.json({ error: 'Plan is unavailable' }, { status: 404 });
  const amountMinor = Number(billingCycle === 'yearly' ? plan.yearly_price_minor : plan.monthly_price_minor);
  const currency = String(plan.currency || '').toUpperCase();
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || currency !== 'INR') {
    return Response.json({ error: 'The selected plan is not configured for Razorpay checkout' }, { status: 503 });
  }

  const id = crypto.randomUUID();
  const receipt = `sub_${id.replace(/-/g, '')}`;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  try {
    await env.DB.prepare(`
      INSERT INTO saas_subscription_payment_orders
        (id, organization_id, plan_code, billing_cycle, amount_minor, currency, provider,
         receipt, idempotency_key_hash, status, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'razorpay', ?, ?, 'creating', ?, ?, ?)
    `).bind(id, orgId, plan.code, billingCycle, amountMinor, currency, receipt, keyHash, expiresAt, now, now).run();
  } catch {
    const raced = await getIdempotentOrder(env, orgId, keyHash);
    if (raced) return responseForExistingOrder(raced, env.RAZORPAY_KEY_ID!);
    return Response.json({ error: 'Could not reserve a payment request. Retry with a new request key.' }, { status: 503 });
  }

  let providerOrder: any;
  try {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: providerAuthorization(env), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountMinor,
        currency,
        receipt,
        notes: { organization_id: orgId, plan_code: plan.code, billing_cycle: billingCycle },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Razorpay order request failed (${response.status})`);
    providerOrder = await response.json();
  } catch (error) {
    await env.DB.prepare(`
      UPDATE saas_subscription_payment_orders SET status = 'failed', updated_at = ?
      WHERE id = ? AND status = 'creating'
    `).bind(new Date().toISOString(), id).run();
    console.error('[SaaSBilling] Razorpay order creation failed', error);
    return Response.json({ error: 'Payment provider could not create an order. No subscription was activated.' }, { status: 502 });
  }

  if (typeof providerOrder?.id !== 'string' || !/^order_[A-Za-z0-9]+$/.test(providerOrder.id) ||
      Number(providerOrder.amount) !== amountMinor || String(providerOrder.currency).toUpperCase() !== currency ||
      providerOrder.receipt !== receipt) {
    await env.DB.prepare(`
      UPDATE saas_subscription_payment_orders SET status = 'failed', updated_at = ?
      WHERE id = ? AND status = 'creating'
    `).bind(new Date().toISOString(), id).run();
    return Response.json({ error: 'Payment provider returned an order that did not match the server request.' }, { status: 502 });
  }

  const updated = await env.DB.prepare(`
    UPDATE saas_subscription_payment_orders
    SET provider_order_id = ?, status = 'created', updated_at = ?
    WHERE id = ? AND status = 'creating'
  `).bind(providerOrder.id, new Date().toISOString(), id).run();
  if (d1Changes(updated) !== 1) {
    return Response.json({ error: 'The payment order could not be safely recorded. Contact support before retrying payment.' }, { status: 503 });
  }

  return Response.json({
    ok: true,
    order: { id: providerOrder.id, amount: amountMinor, currency, status: 'created', key_id: env.RAZORPAY_KEY_ID },
    plan: plan.code,
    billing_cycle: billingCycle,
    expires_at: expiresAt,
  }, { status: 201 });
}

async function razorpaySignatureMatches(secret: string, orderId: string, paymentId: string, signature: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${orderId}|${paymentId}`)));
  const expected = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    difference |= expected.charCodeAt(index) ^ signature.toLowerCase().charCodeAt(index);
  }
  return difference === 0;
}

async function signCheckoutCallback(secret: string, orderId: string, paymentId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${orderId}|${paymentId}`)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function webhookSignatureMatches(secret: string, body: Uint8Array, signature: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, body));
  const supplied = Uint8Array.from(signature.match(/.{2}/g) || [], (pair) => Number.parseInt(pair, 16));
  let difference = expected.length ^ supplied.length;
  for (let index = 0; index < expected.length; index++) difference |= expected[index] ^ (supplied[index] || 0);
  return difference === 0;
}

async function readLimitedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new RangeError('Webhook payload is too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

async function getCurrentSubscription(env: BillingEnv, orgId: string): Promise<any> {
  return env.DB.prepare(`
    SELECT s.id, s.plan_code, s.status, s.billing_cycle, s.currency, s.amount_minor,
           s.current_period_start, s.current_period_end, s.grace_period_end,
           p.name AS plan_name, p.entitlements_json
    FROM organization_subscriptions s LEFT JOIN saas_plans p ON p.code = s.plan_code
    WHERE s.organization_id = ?
  `).bind(orgId).first<any>();
}

export async function handleVerifySaasSubscriptionPayment(
  request: Request,
  env: BillingEnv,
  orgId: string,
  memberships: UserMembership[],
): Promise<Response> {
  if (!isOrgOwnerOrAdmin(memberships)) return Response.json({ error: 'Only organization owners can manage SaaS billing' }, { status: 403 });
  const accountBlock = await ensureOrganizationCanManageBilling(env, orgId);
  if (accountBlock) return accountBlock;
  if (!providerConfigured(env)) return paymentUnavailable();
  let body: Record<string, any> | null;
  try { body = parseJsonBody(await request.json()); }
  catch { body = null; }
  const orderId = typeof body?.order_id === 'string' ? body.order_id : '';
  const paymentId = typeof body?.payment_id === 'string' ? body.payment_id : '';
  const signature = typeof body?.signature === 'string' ? body.signature : '';
  if (!body || !/^order_[A-Za-z0-9]+$/.test(orderId) || !/^pay_[A-Za-z0-9]+$/.test(paymentId) || !signature) {
    return Response.json({ error: 'order_id, payment_id, and signature are required' }, { status: 400 });
  }

  const order = await env.DB.prepare(`
    SELECT id, organization_id, plan_code, billing_cycle, amount_minor, currency,
           provider_order_id, provider_payment_id, status, expires_at
    FROM saas_subscription_payment_orders
    WHERE provider_order_id = ? AND organization_id = ? AND provider = 'razorpay'
  `).bind(orderId, orgId).first<PaymentOrderRow>();
  if (!order) return Response.json({ error: 'Subscription payment order not found' }, { status: 404 });
  if (order.status === 'captured' && order.provider_payment_id === paymentId) {
    return Response.json({ ok: true, idempotent_replay: true, subscription: await getCurrentSubscription(env, orgId) });
  }
  if (order.status !== 'created') return Response.json({ error: 'Subscription payment order is not payable' }, { status: 409 });
  if (Date.parse(order.expires_at) <= Date.now()) {
    await env.DB.prepare(`UPDATE saas_subscription_payment_orders SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'created'`)
      .bind(new Date().toISOString(), order.id).run();
    return Response.json({ error: 'Subscription payment order has expired. Start checkout again.' }, { status: 410 });
  }
  if (!await razorpaySignatureMatches(env.RAZORPAY_KEY_SECRET!, orderId, paymentId, signature)) {
    return Response.json({ error: 'Payment signature is invalid' }, { status: 400 });
  }

  let payment: any;
  try {
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: providerAuthorization(env) },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Razorpay payment lookup failed (${response.status})`);
    payment = await response.json();
  } catch (error) {
    console.error('[SaaSBilling] Razorpay payment verification failed', error);
    return Response.json({ error: 'Payment status could not be verified with the provider. No subscription was activated.' }, { status: 502 });
  }
  if (payment?.id !== paymentId || payment?.order_id !== orderId || payment?.status !== 'captured' || payment?.captured !== true ||
      !Number.isSafeInteger(Number(payment?.amount)) || Number(payment.amount) !== order.amount_minor ||
      String(payment?.currency).toUpperCase() !== order.currency) {
    return Response.json({ error: 'Provider payment is not captured or does not match this order amount and currency.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const durationDays = order.billing_cycle === 'yearly' ? 365 : 30;
  const subscriptionId = crypto.randomUUID();
  const eventId = crypto.randomUUID();

  try {
    const results = await env.DB.batch([
      env.DB.prepare(`
        UPDATE saas_subscription_payment_orders
        SET status = 'captured', provider_payment_id = ?, captured_at = ?, updated_at = ?
        WHERE id = ? AND status = 'created' AND expires_at > ?
      `).bind(paymentId, now, now, order.id, now),
      env.DB.prepare(`
        INSERT INTO organization_subscriptions (
          id, organization_id, plan_code, status, billing_cycle, currency, amount_minor,
          trial_ends_at, current_period_start, current_period_end, grace_period_end,
          cancel_at_period_end, provider, provider_customer_id, provider_subscription_id,
          created_at, updated_at
        )
        SELECT ?, ?, ?, 'active', ?, ?, ?, NULL,
          CASE
            WHEN current.status IN ('active', 'grace_period') AND julianday(current.current_period_end) > julianday(?)
            THEN current.current_period_end
            ELSE ?
          END,
          strftime('%Y-%m-%dT%H:%M:%fZ',
            CASE
              WHEN current.status IN ('active', 'grace_period') AND julianday(current.current_period_end) > julianday(?)
              THEN julianday(current.current_period_end)
              ELSE julianday(?)
            END + ?
          ),
          NULL, 0, 'razorpay', NULL, NULL, ?, ?
        FROM saas_subscription_payment_orders payment_order
        LEFT JOIN organization_subscriptions current ON current.organization_id = payment_order.organization_id
        WHERE payment_order.id = ? AND payment_order.status = 'captured' AND payment_order.provider_payment_id = ?
        ON CONFLICT(organization_id) DO UPDATE SET
          plan_code = excluded.plan_code,
          status = 'active', billing_cycle = excluded.billing_cycle, currency = excluded.currency,
          amount_minor = excluded.amount_minor, trial_ends_at = NULL,
          current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end,
          grace_period_end = NULL, cancel_at_period_end = 0, provider = 'razorpay', updated_at = excluded.updated_at
      `).bind(subscriptionId, orgId, order.plan_code, order.billing_cycle, order.currency, order.amount_minor,
        now, now, now, now, durationDays, now, now, order.id, paymentId),
      env.DB.prepare(`
        INSERT OR IGNORE INTO subscription_events
          (id, organization_id, subscription_id, event_type, source, external_event_id, event_json, created_at)
        SELECT ?, ?, subscription.id, 'subscription_payment_captured', 'razorpay', ?, ?, ?
        FROM organization_subscriptions subscription
        WHERE EXISTS (
          SELECT 1 FROM saas_subscription_payment_orders
          WHERE id = ? AND status = 'captured' AND provider_payment_id = ?
        ) AND subscription.organization_id = ?
      `).bind(eventId, orgId, `payment:${paymentId}`,
        JSON.stringify({ order_id: orderId, payment_id: paymentId, plan_code: order.plan_code,
          billing_cycle: order.billing_cycle, amount_minor: order.amount_minor, currency: order.currency }),
        now, order.id, paymentId, orgId),
    ]);

    if (d1Changes(results?.[0]) !== 1) {
      const latest = await env.DB.prepare(`
        SELECT status, provider_payment_id FROM saas_subscription_payment_orders WHERE id = ?
      `).bind(order.id).first<any>();
      if (latest?.status === 'captured' && latest.provider_payment_id === paymentId) {
        return Response.json({ ok: true, idempotent_replay: true, subscription: await getCurrentSubscription(env, orgId) });
      }
      return Response.json({ error: 'Subscription payment order was already processed or expired' }, { status: 409 });
    }
  } catch (error) {
    console.error('[SaaSBilling] Captured payment could not be applied', error);
    return Response.json({ error: 'Captured payment was verified but the subscription update must be reconciled. Contact support.' }, { status: 503 });
  }

  return Response.json({
    ok: true,
    message: `${order.plan_code.toUpperCase()} subscription activated.`,
    subscription: await getCurrentSubscription(env, orgId),
  });
}

async function verifyTrustedPaymentEvent(env: BillingEnv, organizationId: string, orderId: string, paymentId: string): Promise<Response> {
  const callbackSignature = await signCheckoutCallback(env.RAZORPAY_KEY_SECRET || '', orderId, paymentId);
  return handleVerifySaasSubscriptionPayment(new Request('https://internal.invalid/api/subscription/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, payment_id: paymentId, signature: callbackSignature }),
  }), env, organizationId, [{
    id: 'trusted-razorpay-webhook', user_id: 'trusted-razorpay-webhook',
    organization_id: organizationId, restaurant_id: null, branch_id: null,
    role: 'owner', status: 'active',
  }]);
}

export async function retryStoredRazorpaySubscriptionWebhook(env: BillingEnv, eventRowId: string): Promise<Response> {
  const event = await env.DB.prepare(`
    SELECT id, status, provider_order_id, provider_payment_id
    FROM saas_payment_webhook_events WHERE id = ?
  `).bind(eventRowId).first<any>();
  if (!event) return Response.json({ error: 'Webhook event not found' }, { status: 404 });
  if (event.status === 'processed') return Response.json({ ok: true, idempotent_replay: true });
  if (!['received', 'failed'].includes(event.status) || !event.provider_order_id || !event.provider_payment_id) {
    return Response.json({ error: 'This webhook event does not contain a retryable captured payment' }, { status: 409 });
  }
  const order = await env.DB.prepare(`
    SELECT organization_id FROM saas_subscription_payment_orders
    WHERE provider_order_id = ? AND provider = 'razorpay'
  `).bind(event.provider_order_id).first<{ organization_id: string }>();
  if (!order) return Response.json({ error: 'The linked subscription order is still unavailable' }, { status: 409 });

  const result = await verifyTrustedPaymentEvent(env, order.organization_id, event.provider_order_id, event.provider_payment_id);
  if (!result.ok) {
    await env.DB.prepare(`
      UPDATE saas_payment_webhook_events SET status = 'failed', error_code = 'payment_reconciliation_pending' WHERE id = ?
    `).bind(event.id).run();
    console.error('[SaaSBilling] Admin payment reconciliation retry failed', { eventRowId, status: result.status });
    return Response.json({ error: 'Payment could not be reconciled. Review provider state and retry later.' }, { status: 503 });
  }
  await env.DB.prepare(`
    UPDATE saas_payment_webhook_events SET status = 'processed', error_code = NULL, processed_at = ? WHERE id = ?
  `).bind(new Date().toISOString(), event.id).run();
  return Response.json({ ok: true, processed: true });
}

/**
 * Durable Razorpay server-to-server recovery path. Verify the original request
 * bytes before parsing. Captured-payment processing reuses the callback verifier
 * so both paths independently confirm the payment with Razorpay before activation.
 */
export async function handleRazorpaySubscriptionWebhook(request: Request, env: BillingEnv): Promise<Response> {
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return Response.json({ error: 'Razorpay webhook is not configured' }, { status: 503 });
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > 256 * 1024) return Response.json({ error: 'Webhook payload is too large' }, { status: 413 });
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return Response.json({ error: 'Webhook content type must be application/json' }, { status: 415 });
  }

  let rawBody: Uint8Array;
  try {
    rawBody = await readLimitedBody(request, 256 * 1024);
  } catch (error) {
    return error instanceof RangeError
      ? Response.json({ error: 'Webhook payload is too large' }, { status: 413 })
      : Response.json({ error: 'Could not read webhook payload' }, { status: 400 });
  }
  const signature = request.headers.get('x-razorpay-signature') || '';
  if (!await webhookSignatureMatches(webhookSecret, rawBody, signature)) {
    return Response.json({ error: 'Webhook signature is invalid' }, { status: 400 });
  }
  const providerEventId = request.headers.get('x-razorpay-event-id')?.trim() || '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(providerEventId)) {
    return Response.json({ error: 'A valid Razorpay event ID is required' }, { status: 400 });
  }

  let body: any;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(rawBody)); }
  catch { return Response.json({ error: 'Webhook payload is not valid UTF-8 JSON' }, { status: 400 }); }
  if (!body || typeof body.event !== 'string' || body.event.length > 120) {
    return Response.json({ error: 'Webhook event type is missing or invalid' }, { status: 400 });
  }

  const payloadHash = await hashString(new TextDecoder().decode(rawBody));
  const now = new Date().toISOString();
  const insert = await env.DB.prepare(`
    INSERT OR IGNORE INTO saas_payment_webhook_events
      (id, provider_event_id, event_type, payload_hash, status, received_at)
    VALUES (?, ?, ?, ?, 'received', ?)
  `).bind(crypto.randomUUID(), providerEventId, body.event, payloadHash, now).run();
  const event = await env.DB.prepare(`
    SELECT id, event_type, payload_hash, status FROM saas_payment_webhook_events WHERE provider_event_id = ?
  `).bind(providerEventId).first<any>();
  if (!event) return Response.json({ error: 'Webhook could not be durably recorded' }, { status: 503 });
  if (event.payload_hash !== payloadHash || event.event_type !== body.event) {
    return Response.json({ error: 'Razorpay event ID was reused with a different payload' }, { status: 409 });
  }
  if (event.status === 'processed' || event.status === 'ignored') {
    return Response.json({ ok: true, idempotent_replay: true });
  }

  if (body.event !== 'payment.captured') {
    await env.DB.prepare(`
      UPDATE saas_payment_webhook_events SET status = 'ignored', error_code = NULL, processed_at = ? WHERE id = ?
    `).bind(new Date().toISOString(), event.id).run();
    return Response.json({ ok: true, ignored: true });
  }

  const payment = body.payload?.payment?.entity;
  const orderId = typeof payment?.order_id === 'string' ? payment.order_id : '';
  const paymentId = typeof payment?.id === 'string' ? payment.id : '';
  if (!/^order_[A-Za-z0-9]+$/.test(orderId) || !/^pay_[A-Za-z0-9]+$/.test(paymentId) || payment?.status !== 'captured') {
    await env.DB.prepare(`
      UPDATE saas_payment_webhook_events SET status = 'failed', error_code = 'invalid_payment_payload' WHERE id = ?
    `).bind(event.id).run();
    return Response.json({ error: 'Captured payment payload is incomplete or invalid' }, { status: 400 });
  }

  const order = await env.DB.prepare(`
    SELECT organization_id, amount_minor, currency FROM saas_subscription_payment_orders
    WHERE provider_order_id = ? AND provider = 'razorpay'
  `).bind(orderId).first<any>();
  if (!order) {
    await env.DB.prepare(`
      UPDATE saas_payment_webhook_events
      SET provider_order_id = ?, provider_payment_id = ?, status = 'failed', error_code = 'order_not_found'
      WHERE id = ?
    `).bind(orderId, paymentId, event.id).run();
    return Response.json({ error: 'The payment order is not yet present in the subscription ledger' }, { status: 503 });
  }
  if (Number(payment.amount) !== Number(order.amount_minor) || String(payment.currency).toUpperCase() !== String(order.currency).toUpperCase()) {
    await env.DB.prepare(`
      UPDATE saas_payment_webhook_events
      SET provider_order_id = ?, provider_payment_id = ?, status = 'failed', error_code = 'amount_mismatch'
      WHERE id = ?
    `).bind(orderId, paymentId, event.id).run();
    return Response.json({ error: 'Webhook payment does not match the subscription order amount and currency' }, { status: 400 });
  }

  await env.DB.prepare(`
    UPDATE saas_payment_webhook_events SET provider_order_id = ?, provider_payment_id = ? WHERE id = ?
  `).bind(orderId, paymentId, event.id).run();

  // Reuse the exact provider-side payment check. This is only reached after the webhook HMAC passes.
  const verified = await verifyTrustedPaymentEvent(env, order.organization_id, orderId, paymentId);
  const processedAt = new Date().toISOString();
  if (!verified.ok) {
    await env.DB.prepare(`
      UPDATE saas_payment_webhook_events SET status = 'failed', error_code = 'payment_reconciliation_pending' WHERE id = ?
    `).bind(event.id).run();
    console.error('[SaaSBilling] Captured-payment webhook could not be reconciled', { providerEventId, status: verified.status });
    return Response.json({ error: 'Verified payment requires reconciliation; Razorpay should retry this event.' }, { status: 503 });
  }
  await env.DB.prepare(`
    UPDATE saas_payment_webhook_events SET status = 'processed', error_code = NULL, processed_at = ? WHERE id = ?
  `).bind(processedAt, event.id).run();
  return Response.json({ ok: true, processed: true });
}
