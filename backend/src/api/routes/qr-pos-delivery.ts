import { hashString } from '../auth';
import { Env } from './pairing';
import { resolveOrganizationAccess } from '../subscriptions';
import { loadProductAddonGroups } from './addons';

async function authenticateTerminal(request: Request, env: Env) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token.length > 512) return null;
  const tokenHash = await hashString(token);
  const terminal = await env.DB.prepare(`
    SELECT t.id AS terminal_id, t.organization_id, t.branch_id
      FROM terminals t
      JOIN branches b ON b.id = t.branch_id AND b.organization_id = t.organization_id AND b.status = 'active'
      JOIN organizations o ON o.id = t.organization_id AND o.account_status = 'active'
     WHERE t.terminal_token_hash = ? AND t.status = 'active'
  `).bind(tokenHash).first<{ terminal_id: string; organization_id: string; branch_id: string }>();
  if (!terminal) return null;
  const access = await resolveOrganizationAccess(env.DB, terminal.organization_id);
  if (!access.allowed || access.entitlements.cloudSync !== true) return null;
  return terminal;
}

export async function handleQrPosDelivery(request: Request, env: Env, path: string): Promise<Response> {
  const terminal = await authenticateTerminal(request, env);
  if (!terminal) return Response.json({ error: 'Active cloud terminal required' }, { status: 401 });
  const now = new Date().toISOString();

  if (request.method === 'GET' && path === '/api/pos/catalog') {
    const categoryResult = await env.DB.prepare(`
      SELECT id, name, sort_order, is_active FROM master_categories
       WHERE organization_id = ? ORDER BY sort_order, name LIMIT 1001
    `).bind(terminal.organization_id).all<Record<string, unknown>>();
    const productResult = await env.DB.prepare(`
      SELECT p.id, p.name, p.category_id, p.sku, p.barcode, p.tax_rate, p.version, p.updated_at,
             p.is_active AS master_is_active, COALESCE(o.is_available, 1) AS is_available,
             COALESCE(o.price_override, p.base_price) AS effective_price
        FROM master_products p
        LEFT JOIN branch_product_overrides o ON o.product_id = p.id AND o.branch_id = ?
       WHERE p.organization_id = ?
       ORDER BY p.id LIMIT 5001
    `).bind(terminal.branch_id, terminal.organization_id).all<Record<string, unknown>>();
    const productRows = productResult.results || [];
    if (productRows.length > 5_000 || (categoryResult.results || []).length > 1_000) {
      return Response.json({ error: 'Catalog exceeds the supported terminal sync size' }, { status: 413 });
    }
    const addons = await loadProductAddonGroups(env.DB, terminal.organization_id, productRows.map((product) => String(product.id)));
    return Response.json({
      branch_id: terminal.branch_id,
      categories: categoryResult.results || [],
      products: productRows.map((product) => ({ ...product, addon_groups: addons.get(String(product.id)) || [] })),
      snapshot_at: now,
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (request.method === 'GET' && path === '/api/pos/qr-orders') {
    const parsedLimit = Number(new URL(request.url).searchParams.get('limit') || 25);
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(50, Math.floor(parsedLimit))) : 25;
    const rows = await env.DB.prepare(`
      SELECT d.order_id
        FROM qr_order_pos_deliveries d
       WHERE d.organization_id = ? AND d.branch_id = ? AND d.status = 'pending'
         AND (d.terminal_id IS NULL OR d.terminal_id = ? OR d.claim_expires_at <= ?)
       ORDER BY d.created_at ASC LIMIT ?
    `).bind(terminal.organization_id, terminal.branch_id, terminal.terminal_id, now, limit)
      .all<{ order_id: string }>();
    const orders: Record<string, unknown>[] = [];
    for (const row of rows.results || []) {
      const leaseUntil = new Date(Date.now() + 60_000).toISOString();
      const claimed = await env.DB.prepare(`
        UPDATE qr_order_pos_deliveries
           SET terminal_id = ?, claim_expires_at = ?, last_error_code = NULL
         WHERE order_id = ? AND status = 'pending'
           AND (terminal_id IS NULL OR terminal_id = ? OR claim_expires_at <= ?)
      `).bind(terminal.terminal_id, leaseUntil, row.order_id, terminal.terminal_id, now).run();
      if (!claimed.meta.changes) continue;
      const order = await env.DB.prepare(`
        SELECT id, order_number, order_type, table_number, customer_name, notes,
               subtotal, tax_total, grand_total, ordered_at
          FROM synced_orders WHERE id = ? AND organization_id = ? AND branch_id = ?
      `).bind(row.order_id, terminal.organization_id, terminal.branch_id).first<Record<string, unknown>>();
      if (!order) continue;
      const items = await env.DB.prepare(`
        SELECT id, product_name, product_sku, quantity, unit_price, subtotal, tax_amount,
               modifiers_json, special_instructions
          FROM synced_order_items WHERE order_id = ? AND branch_id = ? ORDER BY ordered_at, id
      `).bind(row.order_id, terminal.branch_id).all<Record<string, unknown>>();
      orders.push({ ...order, items: items.results || [] });
    }
    await env.DB.prepare('UPDATE terminals SET last_seen_at = ? WHERE id = ?').bind(now, terminal.terminal_id).run();
    return Response.json({ orders }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const ackMatch = path.match(/^\/api\/pos\/qr-orders\/([^/]+)\/ack$/);
  if (request.method === 'POST' && ackMatch) {
    let body: { local_order_id?: unknown };
    try {
      const raw = await request.text();
      if (raw.length > 8_192) return Response.json({ error: 'Request too large' }, { status: 413 });
      body = JSON.parse(raw);
    } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
    const localOrderId = typeof body.local_order_id === 'string' ? body.local_order_id.trim() : '';
    if (!localOrderId || localOrderId.length > 100) return Response.json({ error: 'local_order_id is required' }, { status: 400 });
    const orderId = decodeURIComponent(ackMatch[1]);
    const delivery = await env.DB.prepare(`
      SELECT terminal_id, status, local_order_id FROM qr_order_pos_deliveries
       WHERE order_id = ? AND organization_id = ? AND branch_id = ?
    `).bind(orderId, terminal.organization_id, terminal.branch_id)
      .first<{ terminal_id: string | null; status: string; local_order_id: string | null }>();
    if (!delivery) return Response.json({ error: 'QR order not found' }, { status: 404 });
    if (delivery.status === 'delivered') {
      if (delivery.terminal_id === terminal.terminal_id && delivery.local_order_id === localOrderId) return Response.json({ ok: true, replay: true });
      return Response.json({ error: 'QR order was already delivered to another local order' }, { status: 409 });
    }
    if (delivery.terminal_id !== terminal.terminal_id) return Response.json({ error: 'QR order is not claimed by this terminal' }, { status: 409 });
    const result = await env.DB.prepare(`
      UPDATE qr_order_pos_deliveries SET status = 'delivered', local_order_id = ?, delivered_at = ?, claim_expires_at = NULL
       WHERE order_id = ? AND organization_id = ? AND branch_id = ? AND terminal_id = ? AND status = 'pending'
    `).bind(localOrderId, now, orderId, terminal.organization_id, terminal.branch_id, terminal.terminal_id).run();
    if (!result.meta.changes) return Response.json({ error: 'QR order delivery changed; retry the inbox' }, { status: 409 });
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return Response.json({ error: 'Not found' }, { status: 404 });
}
