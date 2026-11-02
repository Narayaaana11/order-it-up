import { Env } from './pairing';
import { hashString } from '../auth';
import { validateAndPriceItem } from './operations';
import { getUserMemberships, isAuthorizedForBranch } from '../rbac';
import { checkRateLimit, createRateLimitResponse, getClientIp } from '../rate-limit';
import { resolveOrganizationAccess } from '../subscriptions';
import { loadProductAddonGroups, resolvePublicQrModifiers } from './addons';

const TRACKING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ORDER_LINES = 50;
const QR_IP_CREATE_LIMIT = { limit: 6, windowSeconds: 60 };
const QR_TABLE_CREATE_LIMIT = { limit: 20, windowSeconds: 60 };
const QR_TRACK_LIMIT = { limit: 120, windowSeconds: 60 };
const QR_IDEMPOTENCY_REPLAY_LIMIT = { limit: 120, windowSeconds: 60 };

function safeParseModifiers(raw: string | null | undefined): Array<{ id?: string; name: string; price: number; quantity: number }> {
  try {
    const value = JSON.parse(raw || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function newCapability(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function bearerCapability(request: Request): string {
  const value = request.headers.get('Authorization') || '';
  const match = value.match(/^Bearer\s+([a-f0-9]{64})$/i);
  return match?.[1]?.toLowerCase() || '';
}

function normalizeIdempotencyKey(request: Request): string {
  const key = request.headers.get('Idempotency-Key') || '';
  return /^[A-Za-z0-9_-]{16,128}$/.test(key) ? key : '';
}

async function deriveTrackingCapability(tableToken: string, idempotencyKey: string): Promise<string> {
  const hmacKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(tableToken), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(`qr-order-tracking-v1:${idempotencyKey}`)));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function replayIdempotentOrder(
  env: Env,
  table: any,
  tableToken: string,
  idempotencyKey: string,
  requestHash: string,
  idempotencyKeyHash: string,
  conflictStatus = 409,
): Promise<Response | null> {
  const existing = await env.DB.prepare(`
    SELECT q.request_hash, o.id, o.order_number, o.grand_total, o.kitchen_status, o.ordered_at, o.table_number
    FROM qr_order_idempotency q
    JOIN synced_orders o ON o.id = q.order_id AND o.organization_id = q.organization_id AND o.table_id = q.table_id
    WHERE q.idempotency_key_hash = ? AND q.table_id = ? AND q.organization_id = ?
  `).bind(idempotencyKeyHash, table.table_id, table.organization_id).first<any>();
  if (!existing) return null;
  if (existing.request_hash !== requestHash) {
    return Response.json({ error: 'This idempotency key was already used for a different order payload' }, { status: conflictStatus });
  }
  const trackingToken = await deriveTrackingCapability(tableToken, idempotencyKey);
  const trackingHash = await hashString(trackingToken);
  const trackRow = await env.DB.prepare('SELECT token_hash, expires_at FROM qr_order_tracking_tokens WHERE order_id = ?').bind(existing.id).first<{ token_hash: string; expires_at: number }>();
  if (!trackRow || trackRow.token_hash !== trackingHash || trackRow.expires_at <= Date.now()) {
    return Response.json({ error: 'Order retry window has expired; please ask staff for help' }, { status: 410 });
  }
  return Response.json({
    ok: true,
    order: {
      id: existing.id,
      order_number: existing.order_number,
      table_number: existing.table_number,
      total: Number(existing.grand_total),
      status: existing.kitchen_status || 'pending',
      created_at: existing.ordered_at,
      tracking_token: trackingToken,
    },
  }, { status: 200 });
}

async function resolveTableCapability(env: Env, request: Request): Promise<any | null> {
  const token = bearerCapability(request);
  if (!token) return null;
  const tokenHash = await hashString(token);
  return env.DB.prepare(`
    SELECT t.id AS table_id, t.table_number, t.branch_id, t.organization_id, t.restaurant_id,
           t.status AS table_status, t.is_active AS table_is_active,
           b.name AS branch_name, b.status AS branch_status,
           o.name AS organization_name, o.currency, o.account_status
    FROM qr_table_tokens q
    JOIN dining_tables t ON t.id = q.table_id AND t.branch_id = q.branch_id AND t.organization_id = q.organization_id
    JOIN branches b ON b.id = t.branch_id AND b.organization_id = t.organization_id
    JOIN organizations o ON o.id = t.organization_id
    WHERE q.token_hash = ? AND q.revoked_at IS NULL
  `).bind(tokenHash).first<any>();
}

async function checkTableAccess(env: Env, request: Request): Promise<{ table: any | null; error?: Response }> {
  const table = await resolveTableCapability(env, request);
  if (!table || table.table_is_active !== 1 || table.branch_status !== 'active' || table.account_status !== 'active') {
    return { table: null, error: Response.json({ error: 'Menu not found' }, { status: 404 }) };
  }
  const subscription = await resolveOrganizationAccess(env.DB, table.organization_id);
  if (!subscription.allowed) {
    return { table: null, error: Response.json({ error: 'Ordering is temporarily unavailable for this restaurant' }, { status: 503 }) };
  }
  return { table };
}

export async function handleGenerateTableQrCode(
  request: Request,
  env: Env,
  claims: any,
  tableId: string,
): Promise<Response> {
  const table = await env.DB.prepare(`
    SELECT id, organization_id, branch_id, table_number, is_active
    FROM dining_tables WHERE id = ? AND organization_id = ?
  `).bind(tableId, claims.org).first<any>();
  if (!table || table.is_active !== 1) return Response.json({ error: 'Table not found' }, { status: 404 });

  const memberships = await getUserMemberships(env.DB, claims.org, claims.sub);
  const access = await isAuthorizedForBranch(env.DB, claims.org, memberships, table.branch_id, ['owner', 'manager']);
  if (!access.authorized) return Response.json({ error: 'Forbidden: only branch owners and managers can issue table QR codes' }, { status: 403 });

  const token = newCapability();
  const tokenHash = await hashString(token);
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO qr_table_tokens (table_id, organization_id, branch_id, token_hash, created_at, revoked_at)
    VALUES (?, ?, ?, ?, ?, NULL)
    ON CONFLICT(table_id) DO UPDATE SET
      organization_id = excluded.organization_id,
      branch_id = excluded.branch_id,
      token_hash = excluded.token_hash,
      created_at = excluded.created_at,
      revoked_at = NULL
  `).bind(table.id, table.organization_id, table.branch_id, tokenHash, now).run();

  const allowedOrigins = (env.FRONTEND_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  const requestOrigin = request.headers.get('Origin');
  const webOrigin = requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  if (!webOrigin) return Response.json({ error: 'Cloud QR ordering is not configured for a public web origin' }, { status: 503 });

  const qrUrl = new URL('/qr/', webOrigin);
  qrUrl.searchParams.set('tableId', table.id);
  qrUrl.hash = `token=${token}`;
  return Response.json({
    success: true,
    table_id: table.id,
    table_number: table.table_number,
    qr_url: qrUrl.toString(),
    table_token: token,
    rotated_at: now,
  });
}

export async function handleGetPublicQrMenu(env: Env, request: Request, url: URL): Promise<Response> {
  const rate = await checkRateLimit(env.DB, {
    keyPrefix: 'public_qr_menu_ip', identifier: getClientIp(request), limit: 120, windowSeconds: 60,
  });
  if (!rate.allowed) return createRateLimitResponse(rate);

  const tableId = url.searchParams.get('table_id') || '';
  if (!tableId) return Response.json({ error: 'table_id is required' }, { status: 400 });
  const access = await checkTableAccess(env, request);
  if (access.error || access.table.table_id !== tableId) return access.error || Response.json({ error: 'Menu not found' }, { status: 404 });
  const table = access.table;

  const categories = await env.DB.prepare(`
    SELECT id, name, sort_order FROM master_categories
    WHERE organization_id = ? AND is_active = 1 ORDER BY sort_order ASC, name ASC
  `).bind(table.organization_id).all();
  const products = await env.DB.prepare(`
    SELECT p.id, p.category_id, c.name AS category_name, p.name,
           COALESCE(o.price_override, p.base_price) AS price
    FROM master_products p
    LEFT JOIN master_categories c ON c.id = p.category_id AND c.organization_id = p.organization_id
    LEFT JOIN branch_product_overrides o ON o.product_id = p.id AND o.branch_id = ?
    WHERE p.organization_id = ? AND p.is_active = 1 AND COALESCE(o.is_available, 1) = 1
    ORDER BY c.sort_order ASC, c.name ASC, p.name ASC
  `).bind(table.branch_id, table.organization_id).all();
  const productRows: any[] = products.results || [];
  const addonGroupsByProduct = await loadProductAddonGroups(env.DB, table.organization_id, productRows.map((product) => product.id));

  return Response.json({
    ok: true,
    restaurant: { name: table.organization_name, currency: table.currency || 'INR' },
    table: { id: table.table_id, number: table.table_number },
    categories: categories.results || [],
    products: productRows.map((product: any) => ({
      id: product.id,
      category_id: product.category_id,
      category_name: product.category_name,
      name: product.name,
      description: null,
      price: Number(product.price),
      image_url: null,
      is_vegetarian: false,
      addon_groups: addonGroupsByProduct.get(product.id) || [],
    })),
  });
}

export async function handleCreatePublicQrOrder(env: Env, request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > 128 * 1024) {
    return Response.json({ error: 'Order request is too large' }, { status: 413 });
  }
  const replayLimit = await checkRateLimit(env.DB, {
    keyPrefix: 'public_qr_order_replay_ip', identifier: getClientIp(request),
    limit: QR_IDEMPOTENCY_REPLAY_LIMIT.limit, windowSeconds: QR_IDEMPOTENCY_REPLAY_LIMIT.windowSeconds,
  });
  if (!replayLimit.allowed) return createRateLimitResponse(replayLimit);
  const access = await checkTableAccess(env, request);
  if (access.error) return access.error;
  const table = access.table;
  const tableToken = bearerCapability(request);
  const tokenHash = await hashString(tableToken);

  let body: any;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid order payload' }, { status: 400 });
  }
  if (body?.table_id !== table.table_id) return Response.json({ error: 'Table not found' }, { status: 404 });
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_ORDER_LINES) {
    return Response.json({ error: `Order must contain between 1 and ${MAX_ORDER_LINES} items` }, { status: 400 });
  }

  const idempotencyKey = normalizeIdempotencyKey(request);
  if (!idempotencyKey) return Response.json({ error: 'A valid Idempotency-Key header is required' }, { status: 400 });
  const canonicalItems: any[] = [];
  for (const rawItem of body.items) {
    if (typeof rawItem?.product_id !== 'string' || !Number.isSafeInteger(rawItem.quantity) || rawItem.quantity < 1 || rawItem.quantity > 1000) {
      return Response.json({ error: 'Each item requires a catalog product and a whole-number quantity between 1 and 1000' }, { status: 400 });
    }
    if (rawItem.addons !== undefined && (!Array.isArray(rawItem.addons) || rawItem.addons.length > 100 || rawItem.addons.some((id: unknown) => typeof id !== 'string'))) {
      return Response.json({ error: 'Invalid modifier selection' }, { status: 400 });
    }
    const instructions = typeof rawItem.special_instructions === 'string' ? rawItem.special_instructions.trim() : '';
    if (instructions.length > 500) return Response.json({ error: 'Item instructions exceed the 500 character limit' }, { status: 400 });
    canonicalItems.push({
      product_id: rawItem.product_id,
      quantity: rawItem.quantity,
      addons: [...(rawItem.addons || [])].sort(),
      special_instructions: instructions,
    });
  }
  const requestHash = await hashString(JSON.stringify({ table_id: table.table_id, items: canonicalItems }));
  const idempotencyKeyHash = await hashString(`${tokenHash}:${idempotencyKey}`);
  const replay = await replayIdempotentOrder(env, table, tableToken, idempotencyKey, requestHash, idempotencyKeyHash);
  if (replay) return replay;

  const ipLimit = await checkRateLimit(env.DB, {
    keyPrefix: 'public_qr_order_ip', identifier: getClientIp(request),
    limit: QR_IP_CREATE_LIMIT.limit, windowSeconds: QR_IP_CREATE_LIMIT.windowSeconds,
  });
  if (!ipLimit.allowed) return createRateLimitResponse(ipLimit);
  const tableLimit = await checkRateLimit(env.DB, {
    keyPrefix: 'public_qr_order_table', identifier: tokenHash,
    limit: QR_TABLE_CREATE_LIMIT.limit, windowSeconds: QR_TABLE_CREATE_LIMIT.windowSeconds,
  });
  if (!tableLimit.allowed) return createRateLimitResponse(tableLimit);

  const processedItems: any[] = [];
  let subtotal = 0;
  let taxTotal = 0;
  for (const rawItem of body.items) {
    if (typeof rawItem?.product_id !== 'string' || !Number.isSafeInteger(rawItem.quantity) || rawItem.quantity < 1 || rawItem.quantity > 1000) {
      return Response.json({ error: 'Each item requires a catalog product and a whole-number quantity between 1 and 1000' }, { status: 400 });
    }
    const modifierSelection = await resolvePublicQrModifiers(env.DB, table.organization_id, rawItem.product_id, rawItem.addons ?? []);
    if (modifierSelection.error) return Response.json({ error: modifierSelection.error }, { status: 400 });
    const specialInstructions = typeof rawItem.special_instructions === 'string' ? rawItem.special_instructions.trim() : '';
    if (specialInstructions.length > 500) return Response.json({ error: 'Item instructions exceed the 500 character limit' }, { status: 400 });

    const validation = await validateAndPriceItem(env.DB, table.organization_id, table.branch_id, {
      product_id: rawItem.product_id,
      quantity: rawItem.quantity,
      modifiers: modifierSelection.modifiers,
      special_instructions: specialInstructions || null,
    }, 'waiter', { catalogModifiersValidated: true });
    if (!validation.valid || !validation.item) {
      return Response.json({ error: validation.error || 'Invalid catalog item' }, { status: 400 });
    }
    subtotal = Math.round((subtotal + validation.item.subtotal) * 100) / 100;
    taxTotal = Math.round((taxTotal + validation.item.tax_amount) * 100) / 100;
    processedItems.push(validation.item);
  }

  const now = new Date().toISOString();
  const orderId = crypto.randomUUID();
  const orderNumber = `QR-${Date.now().toString(36).toUpperCase()}-${orderId.slice(0, 6).toUpperCase()}`;
  const trackingToken = await deriveTrackingCapability(tableToken, idempotencyKey);
  const trackingTokenHash = await hashString(trackingToken);
  const trackExpiresAt = Date.now() + TRACKING_TTL_MS;
  const ticketId = crypto.randomUUID();
  const ticketItems = processedItems.map((item) => ({
    product_name: item.product_name,
    quantity: item.quantity,
    modifiers: safeParseModifiers(item.modifiers_json),
    instructions: item.special_instructions,
  }));
  const batch: any[] = [
    env.DB.prepare(`
      INSERT INTO synced_orders (
        id, organization_id, restaurant_id, branch_id, terminal_id, order_number, order_type,
        status, kitchen_status, payment_status, subtotal, tax_total, discount_total, grand_total,
        payment_method, table_id, table_number, customer_name, customer_phone,
        created_by_user_id, created_by_name, notes, version, ordered_at, synced_at, updated_at
      ) VALUES (?, ?, ?, ?, NULL, ?, 'dine_in', 'active', 'pending', 'unpaid', ?, ?, 0, ?,
        'cash', ?, ?, NULL, NULL, NULL, 'QR Guest', 'Public QR order awaiting staff acceptance', 1, ?, ?, ?)
    `).bind(orderId, table.organization_id, table.restaurant_id, table.branch_id, orderNumber,
      subtotal, taxTotal, Math.round((subtotal + taxTotal) * 100) / 100, table.table_id,
      String(table.table_number), now, now, now),
    env.DB.prepare(`
      INSERT INTO qr_order_idempotency (idempotency_key_hash, table_id, organization_id, request_hash, order_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(idempotencyKeyHash, table.table_id, table.organization_id, requestHash, orderId, now),
    env.DB.prepare(`
      INSERT INTO qr_order_tracking_tokens (order_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(orderId, trackingTokenHash, trackExpiresAt, now),
    env.DB.prepare(`
      INSERT INTO kitchen_tickets (
        id, organization_id, restaurant_id, branch_id, order_id, ticket_number,
        station, status, items_json, notes, prep_time_minutes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'main_kitchen', 'pending', ?, 'Public QR order awaiting staff acceptance', 15, ?, ?)
    `).bind(ticketId, table.organization_id, table.restaurant_id, table.branch_id, orderId,
      `KOT-${orderNumber}`, JSON.stringify(ticketItems), now, now),
  ];
  for (const item of processedItems) {
    batch.push(env.DB.prepare(`
      INSERT INTO synced_order_items (
        id, order_id, branch_id, restaurant_id, product_id, product_name,
        quantity, unit_price, subtotal, tax_amount, discount_amount,
        modifiers_json, special_instructions, kitchen_status, version, ordered_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'pending', 1, ?, ?)
    `).bind(item.id, orderId, table.branch_id, table.restaurant_id, item.product_id,
      item.product_name, item.quantity, item.unit_price, item.subtotal, item.tax_amount,
      item.modifiers_json, item.special_instructions, now, now));
  }
  try {
    await env.DB.batch(batch);
  } catch (error) {
    const concurrentReplay = await replayIdempotentOrder(env, table, tableToken, idempotencyKey, requestHash, idempotencyKeyHash);
    if (concurrentReplay) return concurrentReplay;
    console.error('[PublicQR] Failed to persist order', error);
    return Response.json({ error: 'Could not submit the order. Please ask staff for help.' }, { status: 503 });
  }

  return Response.json({
    ok: true,
    order: {
      id: orderId,
      order_number: orderNumber,
      table_number: table.table_number,
      total: Math.round((subtotal + taxTotal) * 100) / 100,
      status: 'pending',
      created_at: now,
      tracking_token: trackingToken,
    },
  }, { status: 201 });
}

export async function handleGetPublicQrOrder(env: Env, request: Request, orderId: string): Promise<Response> {
  const rate = await checkRateLimit(env.DB, {
    keyPrefix: 'public_qr_track_ip', identifier: getClientIp(request),
    limit: QR_TRACK_LIMIT.limit, windowSeconds: QR_TRACK_LIMIT.windowSeconds,
  });
  if (!rate.allowed) return createRateLimitResponse(rate);
  const trackingToken = bearerCapability(request);
  if (!trackingToken) return Response.json({ error: 'Order not found' }, { status: 404 });
  const tokenHash = await hashString(trackingToken);
  const order = await env.DB.prepare(`
    SELECT o.id, o.order_number, o.grand_total, o.status, o.kitchen_status,
           o.ordered_at, o.table_number, k.status AS ticket_status
    FROM qr_order_tracking_tokens q
    JOIN synced_orders o ON o.id = q.order_id
    LEFT JOIN kitchen_tickets k ON k.order_id = o.id
    WHERE q.order_id = ? AND q.token_hash = ? AND q.expires_at > ?
  `).bind(orderId, tokenHash, Date.now()).first<any>();
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
  const status = order.ticket_status === 'cancelled'
    ? 'cancelled'
    : order.ticket_status === 'completed' || order.status === 'completed'
      ? 'completed'
      : order.ticket_status || order.kitchen_status || 'pending';
  return Response.json({
    ok: true,
    order: {
      id: order.id,
      order_number: order.order_number,
      status,
      total: Number(order.grand_total),
      created_at: order.ordered_at,
      table_number: order.table_number,
    },
  });
}
