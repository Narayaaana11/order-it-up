import { Router, Request, Response } from 'express';
import { getDatabase, now } from '../db';
import { 
  normalizeSwiggyOrder, 
  normalizeZomatoOrder, 
  ingestAggregatorOrder, 
  updateRiderStatus, 
  cancelAggregatorOrder,
  verifyWebhookSignature 
} from '../services/aggregator-service';
import { deductIngredientsForOrderItems } from '../services/inventory-engine';
import { notifyKdsUpdate } from '../services/kds';
import { asyncHandler } from '../middleware/async-handler';
import { requireRole } from '../middleware/security';
import { ROLE_ACCESS } from '../../shared/role-permissions';

const router = Router();

// ── 1. Webhook Endpoints (Called directly by Swiggy / Zomato) ────────────────

/**
 * POST /api/webhooks/swiggy/order
 * Ingests incoming orders from Swiggy partner webhook.
 */
router.post('/webhooks/swiggy/order', asyncHandler(async (req: Request, res: Response) => {
  const db = getDatabase();
  const config = db.prepare('SELECT webhook_secret, is_enabled FROM aggregator_configs WHERE platform = ?').get('swiggy') as any;

  if (config && config.is_enabled === 0) {
    return res.status(403).json({ error: 'Swiggy integration is currently paused.' });
  }

  // Optional signature verification if secret configured
  const signature = req.get('x-swiggy-signature');
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  if (config?.webhook_secret && !verifyWebhookSignature(rawBody, signature, config.webhook_secret)) {
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  const normalized = normalizeSwiggyOrder(req.body);
  const result = ingestAggregatorOrder(normalized);

  res.status(200).json({
    ok: true,
    status: 'acknowledged',
    swiggy_order_id: normalized.external_order_id,
    order_id: result.order_id,
    order_number: result.order_number,
    kitchen_status: result.status,
    duplicate: result.duplicate || false,
  });
}));

/**
 * POST /api/webhooks/zomato/order
 * Ingests incoming orders from Zomato partner webhook.
 */
router.post('/webhooks/zomato/order', asyncHandler(async (req: Request, res: Response) => {
  const db = getDatabase();
  const config = db.prepare('SELECT webhook_secret, is_enabled FROM aggregator_configs WHERE platform = ?').get('zomato') as any;

  if (config && config.is_enabled === 0) {
    return res.status(403).json({ error: 'Zomato integration is currently paused.' });
  }

  const signature = req.get('x-zomato-signature') || req.get('x-zomato-auth');
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  if (config?.webhook_secret && !verifyWebhookSignature(rawBody, signature, config.webhook_secret)) {
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  const normalized = normalizeZomatoOrder(req.body);
  const result = ingestAggregatorOrder(normalized);

  res.status(200).json({
    ok: true,
    status: 'success',
    zomato_order_id: normalized.external_order_id,
    order_id: result.order_id,
    order_number: result.order_number,
    kitchen_status: result.status,
    duplicate: result.duplicate || false,
  });
}));

/**
 * POST /api/webhooks/:platform/rider
 * Updates delivery partner / rider status from Swiggy or Zomato.
 */
router.post('/webhooks/:platform/rider', asyncHandler(async (req: Request, res: Response) => {
  const { platform } = req.params;
  const { order_id, status, rider } = req.body || {};
  const riderStatus = (status || rider?.status || req.body?.delivery_status || 'assigned') as any;
  const riderInfo = rider || { name: req.body?.rider_name, phone: req.body?.rider_phone };

  if (!order_id) {
    return res.status(400).json({ error: 'order_id is required' });
  }

  const platformStr = Array.isArray(platform) ? platform[0] : (platform || '');
  const updated = updateRiderStatus(platformStr.toLowerCase(), String(order_id), riderStatus, riderInfo);
  if (!updated) {
    return res.status(404).json({ error: 'Order not found for rider update' });
  }

  res.json({ ok: true, status: 'rider_updated', rider_status: riderStatus });
}));

/**
 * POST /api/webhooks/:platform/cancel
 * Handles cancellation push from aggregator.
 */
router.post('/webhooks/:platform/cancel', asyncHandler(async (req: Request, res: Response) => {
  const { platform } = req.params;
  const { order_id, reason } = req.body || {};

  if (!order_id) {
    return res.status(400).json({ error: 'order_id is required' });
  }

  const platformStr = Array.isArray(platform) ? platform[0] : (platform || '');
  const cancelled = cancelAggregatorOrder(platformStr.toLowerCase(), String(order_id), reason);
  res.json({ ok: true, status: 'cancelled', cancelled });
}));

// ── 2. Aggregator Restaurant Kitchen Actions ────────────────────────────────

/**
 * POST /api/aggregators/orders/:id/accept
 * Staff manually accepts an aggregator order if auto_accept was disabled.
 */
router.post('/aggregators/orders/:id/accept', requireRole(...ROLE_ACCESS.allStaff), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { prep_time_minutes } = req.body || {};
  const db = getDatabase();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'pending') {
    return res.status(400).json({ error: `Order is already ${order.status}` });
  }

  const timestamp = now();
  const prepTime = Number(prep_time_minutes) || order.prep_time_minutes || 20;

  db.transaction(() => {
    db.prepare(`
      UPDATE orders
      SET status = 'preparing',
          prep_time_minutes = ?,
          cooking_started_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(prepTime, timestamp, timestamp, id);

    db.prepare(`
      UPDATE order_items
      SET status = 'preparing', updated_at = ?
      WHERE order_id = ?
    `).run(timestamp, id);
  })();

  // Deduct raw ingredients
  const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(id) as any[];
  if (items.length > 0) {
    deductIngredientsForOrderItems(items, `${order.online_platform?.toUpperCase()} #${order.external_order_id}`);
  }

  notifyKdsUpdate();

  res.json({ ok: true, status: 'preparing', prep_time_minutes: prepTime });
}));

/**
 * POST /api/aggregators/orders/:id/ready
 * Staff marks order food as ready for delivery partner pickup.
 */
router.post('/aggregators/orders/:id/ready', requireRole(...ROLE_ACCESS.allStaff), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const timestamp = now();

  db.transaction(() => {
    db.prepare(`
      UPDATE orders
      SET status = 'ready',
          ready_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(timestamp, timestamp, id);

    db.prepare(`
      UPDATE order_items
      SET status = 'ready', updated_at = ?
      WHERE order_id = ?
    `).run(timestamp, id);
  })();

  notifyKdsUpdate();

  res.json({ ok: true, status: 'ready', message: 'Delivery partner notified for pickup.' });
}));

/**
 * POST /api/aggregators/orders/:id/reject
 * Staff rejects an aggregator order with a specified reason.
 */
router.post('/aggregators/orders/:id/reject', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  const db = getDatabase();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const timestamp = now();
  db.transaction(() => {
    db.prepare(`
      UPDATE orders
      SET status = 'cancelled',
          cancellation_reason = ?,
          cancelled_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(reason || 'Kitchen capacity full', timestamp, timestamp, id);

    db.prepare(`
      UPDATE order_items
      SET status = 'cancelled', updated_at = ?
      WHERE order_id = ?
    `).run(timestamp, id);
  })();

  notifyKdsUpdate();

  res.json({ ok: true, status: 'cancelled', reason: reason || 'Kitchen capacity full' });
}));

// ── 3. Aggregator Settings ──────────────────────────────────────────────────

/**
 * GET /api/aggregators/settings
 * Retrieves current aggregator configurations.
 */
router.get('/aggregators/settings', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (_req: Request, res: Response) => {
  const db = getDatabase();
  const configs = db.prepare('SELECT platform, is_enabled, auto_accept, default_prep_time_minutes, updated_at FROM aggregator_configs').all();
  res.json({ ok: true, configs });
}));

/**
 * PUT /api/aggregators/settings
 * Updates aggregator settings (auto accept, prep time, secrets).
 */
router.put('/aggregators/settings', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const { platform, is_enabled, auto_accept, default_prep_time_minutes, webhook_secret } = req.body || {};
  if (!platform || !['swiggy', 'zomato', 'direct'].includes(platform)) {
    return res.status(400).json({ error: 'Valid platform is required (swiggy, zomato)' });
  }

  const db = getDatabase();
  const timestamp = now();

  db.prepare(`
    INSERT INTO aggregator_configs (platform, webhook_secret, is_enabled, auto_accept, default_prep_time_minutes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(platform) DO UPDATE SET
      webhook_secret = COALESCE(excluded.webhook_secret, aggregator_configs.webhook_secret),
      is_enabled = excluded.is_enabled,
      auto_accept = excluded.auto_accept,
      default_prep_time_minutes = excluded.default_prep_time_minutes,
      updated_at = excluded.updated_at
  `).run(
    platform,
    webhook_secret || null,
    is_enabled === false ? 0 : 1,
    auto_accept === false ? 0 : 1,
    Number(default_prep_time_minutes) || 20,
    timestamp
  );

  const updated = db.prepare('SELECT platform, is_enabled, auto_accept, default_prep_time_minutes FROM aggregator_configs WHERE platform = ?')
    .get(platform);

  res.json({ ok: true, config: updated });
}));

// ── 4. Developer & Operator Simulation Harness ──────────────────────────────

/**
 * POST /api/aggregators/test-order
 * Allows the restaurant owner or developer to simulate an incoming Swiggy or Zomato order
 * to verify KDS tickets, printing, and inventory without needing live third-party accounts.
 */
router.post('/aggregators/test-order', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const { platform = 'swiggy', customer_name, customer_phone, items } = req.body || {};
  const db = getDatabase();

  // Find sample active products from database to use if items not specified
  let orderItems: any[] = items;
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    const sampleProducts = db.prepare('SELECT id, name, price, sku FROM products WHERE is_active = 1 LIMIT 2').all() as any[];
    if (sampleProducts.length > 0) {
      orderItems = sampleProducts.map((p) => ({
        product_id: p.id,
        name: p.name,
        unit_price: Number(p.price),
        quantity: 1,
        total: Number(p.price),
      }));
    } else {
      orderItems = [{
        name: 'Special Biryani Combo',
        unit_price: 320,
        quantity: 1,
        total: 320,
      }];
    }
  } else {
    // Resolve products for items that only provide product_id and quantity
    orderItems = orderItems.map((it) => {
      let pName = it.name;
      let pPrice = it.unit_price;
      let pSku = it.sku;
      if (it.product_id && (!pName || pPrice == null)) {
        const prod = db.prepare('SELECT name, price, sku FROM products WHERE id = ?').get(it.product_id) as any;
        if (prod) {
          pName = pName || prod.name;
          pPrice = pPrice != null ? pPrice : Number(prod.price);
          pSku = pSku || prod.sku;
        }
      }
      const qty = Number(it.quantity) || 1;
      const price = Number(pPrice) || 100;
      return {
        product_id: it.product_id,
        name: pName || 'Delivery Item',
        sku: pSku || null,
        quantity: qty,
        unit_price: price,
        total: Number(it.total) || (price * qty),
      };
    });
  }

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const extId = platform === 'zomato' ? `ZM-${randomNum}` : `SW-${randomNum}`;

  const subtotal = orderItems.reduce((acc: number, it: any) => acc + (Number(it.total) || Number(it.unit_price) * Number(it.quantity)), 0);
  const packaging = 25;
  const taxes = Number((subtotal * 0.05).toFixed(2));
  const total = subtotal + packaging + taxes;

  const normalized = {
    platform: platform === 'zomato' ? 'zomato' as const : 'swiggy' as const,
    external_order_id: extId,
    customer_name: customer_name || (platform === 'zomato' ? 'Aakash Sharma' : 'Meera Patel'),
    customer_phone: customer_phone || '+919876543210',
    delivery_address: '42, Indiranagar 100ft Road, Bengaluru',
    rider_name: platform === 'zomato' ? 'Sunil Kumar (Zomato Rider)' : 'Ramesh V (Swiggy Delivery)',
    rider_phone: '+919123456789',
    rider_status: 'assigned' as const,
    packaging_charge: packaging,
    delivery_charge: 0,
    service_charge: 0,
    subtotal,
    tax_amount: taxes,
    total,
    special_instructions: 'Pack separately, cutlery requested',
    prep_time_minutes: 20,
    items: orderItems,
  };

  const result = ingestAggregatorOrder(normalized);

  res.status(201).json({
    ok: true,
    simulated: true,
    platform: normalized.platform,
    external_order_id: extId,
    order_id: result.order_id,
    order_number: result.order_number,
    status: result.status,
    total: normalized.total,
    items_count: orderItems.length,
  });
}));

/**
 * GET /api/aggregators/orders
 * Returns all online delivery orders (Swiggy, Zomato, Direct Delivery)
 * with item hydration, daily stats, and flexible date/platform filters.
 */
router.get('/aggregators/orders', requireRole(...ROLE_ACCESS.allStaff), asyncHandler(async (req: Request, res: Response) => {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  const date = (req.query.date as string) || (req.query.start_date as string) || today;
  const platform = (req.query.platform as string)?.toLowerCase();
  const status = (req.query.status as string)?.toLowerCase();

  let query = `
    SELECT o.id, o.order_number, o.type, o.status, o.subtotal, o.tax_amount, o.discount_amount,
           o.packaging_charge, o.delivery_charge, o.total, o.online_platform, o.external_order_id,
           o.customer_name, o.customer_phone, o.delivery_address, o.rider_name, o.rider_phone,
           o.rider_status, o.prep_time_minutes, o.cooking_started_at, o.ready_at, o.served_at,
           o.completed_at, o.cancelled_at, o.cancellation_reason, o.created_at, o.updated_at
    FROM orders o
    WHERE (o.type = 'online' OR o.online_platform IS NOT NULL)
  `;
  const params: any[] = [];

  if (date) {
    query += ` AND o.created_at LIKE ?`;
    params.push(`${date}%`);
  }

  if (platform && platform !== 'all') {
    query += ` AND LOWER(o.online_platform) = ?`;
    params.push(platform);
  }

  if (status && status !== 'all') {
    query += ` AND o.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY o.created_at DESC LIMIT 200`;

  const orders = db.prepare(query).all(...params) as any[];

  // Hydrate order items
  const orderIds = orders.map((o) => o.id);
  const itemsByOrder = new Map<number, any[]>();

  if (orderIds.length > 0) {
    const placeholders = orderIds.map(() => '?').join(',');
    const items = db.prepare(`
      SELECT id, order_id, product_name, product_sku, quantity, unit_price, total, special_instructions, status
      FROM order_items
      WHERE order_id IN (${placeholders})
      ORDER BY id ASC
    `).all(...orderIds) as any[];

    for (const item of items) {
      const list = itemsByOrder.get(item.order_id) || [];
      list.push(item);
      itemsByOrder.set(item.order_id, list);
    }
  }

  const hydratedOrders = orders.map((o) => ({
    ...o,
    items: itemsByOrder.get(o.id) || [],
  }));

  // Calculate day stats (for the filtered date, irrespective of pagination)
  const statsQuery = `
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(total), 0) as total_revenue,
      SUM(CASE WHEN LOWER(online_platform) = 'zomato' THEN 1 ELSE 0 END) as zomato_orders,
      COALESCE(SUM(CASE WHEN LOWER(online_platform) = 'zomato' THEN total ELSE 0 END), 0) as zomato_revenue,
      SUM(CASE WHEN LOWER(online_platform) = 'swiggy' THEN 1 ELSE 0 END) as swiggy_orders,
      COALESCE(SUM(CASE WHEN LOWER(online_platform) = 'swiggy' THEN total ELSE 0 END), 0) as swiggy_revenue,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
      SUM(CASE WHEN status = 'preparing' THEN 1 ELSE 0 END) as preparing_orders,
      SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready_orders,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders
    FROM orders
    WHERE (type = 'online' OR online_platform IS NOT NULL)
      AND created_at LIKE ?
  `;
  const statsRow = db.prepare(statsQuery).get(`${date}%`) as any;

  const totalOrders = statsRow?.total_orders || 0;
  const totalRev = Number(statsRow?.total_revenue || 0);

  const stats = {
    date,
    total_orders: totalOrders,
    total_revenue: totalRev,
    zomato_orders: statsRow?.zomato_orders || 0,
    zomato_revenue: Number(statsRow?.zomato_revenue || 0),
    swiggy_orders: statsRow?.swiggy_orders || 0,
    swiggy_revenue: Number(statsRow?.swiggy_revenue || 0),
    pending_orders: statsRow?.pending_orders || 0,
    preparing_orders: statsRow?.preparing_orders || 0,
    ready_orders: statsRow?.ready_orders || 0,
    completed_orders: statsRow?.completed_orders || 0,
    avg_ticket_size: totalOrders > 0 ? totalRev / totalOrders : 0,
  };

  res.json({ ok: true, orders: hydratedOrders, stats });
}));

/**
 * POST /api/aggregators/orders/:id/dispatch
 * Staff marks order handed over to delivery partner rider.
 */
router.post('/aggregators/orders/:id/dispatch', requireRole(...ROLE_ACCESS.allStaff), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const timestamp = now();
  db.prepare(`
    UPDATE orders
    SET status = 'completed',
        rider_status = 'dispatched',
        completed_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(timestamp, timestamp, id);

  notifyKdsUpdate();

  res.json({ ok: true, status: 'completed', rider_status: 'dispatched', message: 'Order dispatched with delivery partner.' });
}));

export const aggregatorRoutes = router;
