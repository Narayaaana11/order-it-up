/**
 * Guest Payment Intents (provider-neutral scaffold)
 *
 * Creates a provider payment intent for an outstanding bill and only records a
 * non-cash payment after the provider confirms capture with a matching amount,
 * currency and order binding. Fails closed with PAYMENT_PROVIDER_NOT_CONFIGURED
 * when merchant credentials are absent.
 */

import { Env } from './pairing';
import { UserMembership, isAuthorizedForBranch } from '../rbac';

const PROVIDER = 'razorpay';
const MANAGE_ROLES = ['owner', 'admin', 'manager', 'cashier'];

function text(value: unknown, maximum = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function round2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function providerConfigured(env: Env): boolean {
  return Boolean(text(env.RAZORPAY_KEY_ID) && text(env.RAZORPAY_KEY_SECRET));
}

async function razorpayRequest(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const auth = btoa(`${text(env.RAZORPAY_KEY_ID)}:${text(env.RAZORPAY_KEY_SECRET)}`);
  return fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function outstandingBalance(env: Env, orderId: string, grandTotal: number): Promise<number> {
  const rows = await env.DB.prepare(`SELECT * FROM customer_payments WHERE order_id = ?`).bind(orderId).all<any>();
  let paid = 0;
  for (const row of rows.results || []) {
    if (!row.parent_payment_id && Number(row.amount) > 0 && ['completed', 'refunded'].includes(row.status)) {
      paid += Number(row.amount || 0) - Number(row.refunded_amount || 0);
    }
  }
  return round2(Math.max(0, grandTotal - paid));
}

async function authorizeOrder(env: Env, orgId: string, memberships: UserMembership[], orderId: string): Promise<{ order?: any; error?: Response }> {
  const order = await env.DB.prepare(`
    SELECT * FROM synced_orders WHERE id = ? AND organization_id = ?
  `).bind(orderId, orgId).first<any>();
  if (!order) return { error: Response.json({ error: 'Order not found' }, { status: 404 }) };
  const auth = await isAuthorizedForBranch(env.DB, orgId, memberships, order.branch_id, MANAGE_ROLES);
  if (!auth.authorized) return { error: Response.json({ error: 'Forbidden: insufficient privileges for this branch' }, { status: 403 }) };
  return { order };
}

export function handlePaymentCapabilities(env: Env): Response {
  const configured = providerConfigured(env);
  return Response.json({
    cash: true,
    card: configured,
    upi: configured,
    provider: configured ? PROVIDER : null,
    configured,
    reason: configured ? null : 'Payment provider credentials are not configured; only cash can be recorded.',
  });
}

export async function handleCreatePaymentIntent(
  request: Request,
  env: Env,
  orgId: string,
  memberships: UserMembership[],
  userId: string,
): Promise<Response> {
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON payload' }, { status: 400 }); }

  const auth = await authorizeOrder(env, orgId, memberships, text(body?.order_id, 100));
  if (auth.error) return auth.error;
  const order = auth.order;
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
  if (order.status === 'cancelled') return Response.json({ error: 'A cancelled order cannot be paid' }, { status: 409 });
  if (order.payment_status === 'paid') return Response.json({ error: 'This order is already paid' }, { status: 409 });

  if (!providerConfigured(env)) {
    return Response.json({
      error: 'The payment provider is not configured for this environment. Record cash or configure provider credentials.',
      code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
    }, { status: 503 });
  }

  const outstanding = await outstandingBalance(env, order.id, Number(order.grand_total || 0));
  if (outstanding <= 0.05) return Response.json({ error: 'This order has no outstanding balance' }, { status: 409 });
  const amount = body?.amount === undefined ? outstanding : round2(Number(body.amount));
  if (!Number.isFinite(amount) || amount <= 0 || amount > outstanding + 0.05) {
    return Response.json({ error: `Amount must be between 0.01 and the outstanding balance (${outstanding})` }, { status: 400 });
  }

  const idempotencyKey = text(body?.idempotency_key, 120)
    || text(request.headers.get('Idempotency-Key'), 120)
    || null;
  if (idempotencyKey) {
    const existing = await env.DB.prepare(`
      SELECT * FROM payment_intents WHERE branch_id = ? AND idempotency_key = ?
    `).bind(order.branch_id, idempotencyKey).first<any>();
    if (existing) {
      if (existing.order_id !== order.id || Math.abs(Number(existing.amount) - amount) > 0.001) {
        return Response.json({ error: 'This idempotency key was used for a different intent' }, { status: 409 });
      }
      return Response.json({
        idempotent: true,
        intent: {
          id: existing.id, provider_order_id: existing.provider_order_id, amount: Number(existing.amount),
          currency: existing.currency, status: existing.status,
        },
        provider: { key_id: text(env.RAZORPAY_KEY_ID) },
      });
    }
  }

  const currency = 'INR';
  const providerResponse = await razorpayRequest(env, '/orders', {
    method: 'POST',
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency,
      receipt: String(order.order_number || order.id).slice(0, 40),
      notes: { order_id: order.id, organization_id: orgId, branch_id: order.branch_id },
    }),
  });
  const providerOrder = await providerResponse.json().catch(() => ({})) as any;
  if (!providerResponse.ok || !providerOrder?.id) {
    return Response.json({
      error: 'The payment provider did not create the intent. No payment was recorded.',
      code: 'PAYMENT_PROVIDER_ERROR',
    }, { status: 502 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO payment_intents (
      id, organization_id, branch_id, order_id, provider, provider_order_id,
      amount, currency, status, idempotency_key, created_by_user_id, created_at, updated_at, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'created', ?, ?, ?, ?, ?)
  `).bind(
    id, orgId, order.branch_id, order.id, PROVIDER, providerOrder.id,
    amount, currency, idempotencyKey, userId, now, now, JSON.stringify({ order_number: order.order_number }),
  ).run();

  return Response.json({
    intent: { id, provider_order_id: providerOrder.id, amount, currency, status: 'created' },
    provider: { key_id: text(env.RAZORPAY_KEY_ID) },
  }, { status: 201 });
}

export async function handleVerifyPaymentIntent(
  request: Request,
  env: Env,
  orgId: string,
  memberships: UserMembership[],
  userId: string,
): Promise<Response> {
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON payload' }, { status: 400 }); }

  const intent = await env.DB.prepare(`
    SELECT * FROM payment_intents WHERE id = ? AND organization_id = ?
  `).bind(text(body?.intent_id, 100), orgId).first<any>();
  if (!intent) return Response.json({ error: 'Payment intent not found' }, { status: 404 });
  const auth = await isAuthorizedForBranch(env.DB, orgId, memberships, intent.branch_id, MANAGE_ROLES);
  if (!auth.authorized) return Response.json({ error: 'Forbidden: insufficient privileges for this branch' }, { status: 403 });

  if (intent.status === 'verified') {
    return Response.json({ success: true, idempotent: true, payment_intent_id: intent.id, provider_payment_id: intent.provider_payment_id });
  }
  if (!providerConfigured(env)) {
    return Response.json({ error: 'The payment provider is not configured', code: 'PAYMENT_PROVIDER_NOT_CONFIGURED' }, { status: 503 });
  }

  const paymentId = text(body?.provider_payment_id || body?.razorpay_payment_id, 100);
  const signature = text(body?.signature || body?.razorpay_signature, 200);
  if (!paymentId || !signature) return Response.json({ error: 'provider_payment_id and signature are required' }, { status: 400 });

  const expected = await hmacSha256(text(env.RAZORPAY_KEY_SECRET), `${intent.provider_order_id}|${paymentId}`);
  if (!constantTimeEqual(expected, signature.toLowerCase())) {
    return Response.json({ error: 'Payment signature verification failed', code: 'PAYMENT_SIGNATURE_INVALID' }, { status: 400 });
  }

  const providerResponse = await razorpayRequest(env, `/payments/${encodeURIComponent(paymentId)}`);
  const payment = await providerResponse.json().catch(() => ({})) as any;
  if (!providerResponse.ok || !payment?.id) {
    return Response.json({ error: 'Could not verify the payment with the provider', code: 'PAYMENT_PROVIDER_ERROR' }, { status: 502 });
  }
  if (payment.order_id !== intent.provider_order_id) {
    return Response.json({ error: 'Provider order mismatch', code: 'PAYMENT_ORDER_MISMATCH' }, { status: 409 });
  }
  if (payment.status !== 'captured') {
    return Response.json({ error: `Payment is ${payment.status || 'not captured'}; it cannot be recorded`, code: 'PAYMENT_NOT_CAPTURED' }, { status: 409 });
  }
  if (Number(payment.amount) !== Math.round(Number(intent.amount) * 100) || String(payment.currency || '').toUpperCase() !== intent.currency) {
    return Response.json({ error: 'Provider amount or currency does not match the intent', code: 'PAYMENT_AMOUNT_MISMATCH' }, { status: 409 });
  }

  const duplicate = await env.DB.prepare(`
    SELECT id, order_id FROM customer_payments WHERE branch_id = ? AND payment_method = ? AND external_reference_id = ? AND status != 'failed'
  `).bind(intent.branch_id, String(payment.method || 'upi'), paymentId).first<any>();
  if (duplicate && duplicate.order_id !== intent.order_id) {
    return Response.json({ error: 'This provider payment is already attached to another order' }, { status: 409 });
  }

  const order = await env.DB.prepare('SELECT * FROM synced_orders WHERE id = ? AND organization_id = ?')
    .bind(intent.order_id, orgId).first<any>();
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

  const currentPaid = Math.max(0, Number(order.grand_total || 0) - await outstandingBalance(env, order.id, Number(order.grand_total || 0)));
  const newPaid = round2(currentPaid + Number(intent.amount));
  const newOutstanding = round2(Math.max(0, Number(order.grand_total || 0) - newPaid));
  const newStatus = newOutstanding <= 0.05 ? 'paid' : 'partially_paid';
  const now = new Date().toISOString();
  const paymentRowId = duplicate?.id || `pay_${crypto.randomUUID()}`;

  const statements: any[] = [];
  if (!duplicate) {
    statements.push(env.DB.prepare(`
      INSERT INTO customer_payments (
        id, organization_id, restaurant_id, branch_id, order_id, payment_method,
        amount, currency, status, verification_method, external_reference_id,
        cashier_user_id, cashier_name, idempotency_key, is_split, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', 'gateway_verified', ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      paymentRowId, orgId, order.restaurant_id, order.branch_id, order.id,
      String(payment.method || 'upi'), Number(intent.amount), intent.currency, paymentId,
      userId, 'Gateway', `intent:${intent.id}`, currentPaid > 0 ? 1 : 0,
      JSON.stringify({ payment_intent_id: intent.id, provider_order_id: intent.provider_order_id }), now, now,
    ));
  }
  statements.push(env.DB.prepare(`
    UPDATE synced_orders SET payment_status = ?, payment_method = ?, version = version + 1, updated_at = ? WHERE id = ?
  `).bind(newStatus, String(payment.method || 'upi'), now, order.id));
  statements.push(env.DB.prepare(`
    UPDATE payment_intents SET status = 'verified', provider_payment_id = ?, payment_method = ?, verified_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(paymentId, String(payment.method || 'upi'), now, now, intent.id));
  await env.DB.batch(statements);

  return Response.json({
    success: true,
    payment_intent_id: intent.id,
    provider_payment_id: paymentId,
    amount: Number(intent.amount),
    order_payment_status: newStatus,
    outstanding_balance: newOutstanding,
  });
}

/**
 * Routes guest payment paths. Returns null when the path is not owned.
 */
export async function handleGuestPaymentsRequest(
  request: Request,
  env: Env,
  path: string,
  method: string,
  claims: any,
  memberships: UserMembership[],
): Promise<Response | null> {
  if (path === '/api/payments/capabilities' && method === 'GET') {
    return handlePaymentCapabilities(env);
  }
  if (path === '/api/payments/verify' && method === 'POST') {
    return handleVerifyPaymentIntent(request, env, claims.org, memberships, claims.sub);
  }
  const intentMatch = path.match(/^\/api\/orders\/([^/]+)\/payment-intent$/);
  if (intentMatch && method === 'POST') {
    let body: any;
    try { body = await request.clone().json(); } catch { body = {}; }
    const normalized = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ ...body, order_id: decodeURIComponent(intentMatch[1]) }),
    });
    return handleCreatePaymentIntent(normalized, env, claims.org, memberships, claims.sub);
  }
  return null;
}
