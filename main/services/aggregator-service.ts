import { getDatabase, generateOrderNumber, now } from '../db';
import { deductIngredientsForOrderItems, restoreIngredientsForOrderItems } from './inventory-engine';
import { notifyKdsUpdate } from './kds';
import crypto from 'crypto';

export interface NormalizedOrderItem {
  product_id?: string;
  sku?: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  special_instructions?: string;
  addons?: Array<{ id?: string; name: string; price: number }>;
}

export interface NormalizedAggregatorOrder {
  platform: 'swiggy' | 'zomato' | 'direct';
  external_order_id: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  rider_name?: string;
  rider_phone?: string;
  rider_status?: 'unassigned' | 'assigned' | 'arrived' | 'picked_up';
  packaging_charge?: number;
  delivery_charge?: number;
  service_charge?: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  special_instructions?: string;
  prep_time_minutes?: number;
  items: NormalizedOrderItem[];
  raw_payload?: any;
}

/**
 * Normalizes Swiggy Partner webhook payload into standard aggregator structure.
 */
export function normalizeSwiggyOrder(payload: any): NormalizedAggregatorOrder {
  const externalId = String(payload.order_id || payload.orderId || payload.id || `SW-${Date.now()}`);
  const customer = payload.customer || {};
  const bill = payload.bill_details || payload.billDetails || payload.pricing || payload.bill || {};
  const rawItems = Array.isArray(payload.items)
    ? payload.items
    : (Array.isArray(payload.order_items)
      ? payload.order_items
      : (Array.isArray(payload.cart?.items) ? payload.cart.items : []));

  const items: NormalizedOrderItem[] = rawItems.map((it: any) => {
    const qty = Number(it.quantity) || 1;
    const price = Number(it.price || it.unit_price || it.base_price || 0);
    const addons = Array.isArray(it.addons) ? it.addons.map((a: any) => ({
      id: a.id ? String(a.id) : undefined,
      name: String(a.name || a.addon_name || 'Addon'),
      price: Number(a.price || 0),
    })) : [];

    return {
      product_id: it.item_id ? String(it.item_id) : (it.product_id ? String(it.product_id) : undefined),
      sku: it.sku ? String(it.sku) : undefined,
      name: String(it.name || it.item_name || 'Item'),
      quantity: qty,
      unit_price: price,
      total: Number(it.total || (price * qty)),
      special_instructions: it.special_instructions || it.instructions || undefined,
      addons,
    };
  });

  const subtotal = Number(bill.item_total || bill.subtotal || items.reduce((s, i) => s + i.total, 0));
  const packaging = Number(bill.packaging_charge || bill.packing_charges || payload.packaging_charge || 0);
  const delivery = Number(bill.delivery_charge || payload.delivery_charge || 0);
  const taxes = Number(bill.taxes || bill.tax_amount || payload.tax || 0);
  const total = Number(bill.total || bill.net_amount || (subtotal + packaging + taxes));

  const rider = payload.rider || payload.delivery_partner || {};

  return {
    platform: 'swiggy',
    external_order_id: externalId,
    customer_name: customer.name || 'Swiggy Customer',
    customer_phone: customer.phone || customer.mobile || null,
    delivery_address: payload.delivery_address || payload.drop_address || null,
    rider_name: rider.name || null,
    rider_phone: rider.phone || null,
    rider_status: rider.status || (rider.name ? 'assigned' : 'unassigned'),
    packaging_charge: packaging,
    delivery_charge: delivery,
    service_charge: 0,
    subtotal,
    tax_amount: taxes,
    total,
    special_instructions: payload.special_instructions || payload.delivery_notes || undefined,
    prep_time_minutes: Number(payload.prep_time || payload.prep_time_minutes || 20),
    items,
    raw_payload: payload,
  };
}

/**
 * Normalizes Zomato Partner webhook payload into standard aggregator structure.
 */
export function normalizeZomatoOrder(payload: any): NormalizedAggregatorOrder {
  const externalId = String(payload.order_id || payload.orderId || payload.id || `ZM-${Date.now()}`);
  const customer = payload.customer_details || payload.customer || {};
  const delivery = payload.delivery_details || payload.delivery || {};
  const bill = payload.payment || payload.bill_details || {};
  const rawItems = Array.isArray(payload.order_items) ? payload.order_items : (Array.isArray(payload.items) ? payload.items : []);

  const items: NormalizedOrderItem[] = rawItems.map((it: any) => {
    const qty = Number(it.quantity) || 1;
    const price = Number(it.price || it.unit_price || 0);
    const addons = Array.isArray(it.addons) ? it.addons.map((a: any) => ({
      id: a.id ? String(a.id) : undefined,
      name: String(a.name || 'Addon'),
      price: Number(a.price || 0),
    })) : [];

    return {
      product_id: it.id ? String(it.id) : (it.product_id ? String(it.product_id) : undefined),
      sku: it.sku ? String(it.sku) : undefined,
      name: String(it.name || 'Item'),
      quantity: qty,
      unit_price: price,
      total: Number(it.total || (price * qty)),
      special_instructions: it.instructions || undefined,
      addons,
    };
  });

  const subtotal = Number(bill.subtotal || bill.item_total || items.reduce((s, i) => s + i.total, 0));
  const packaging = Number(bill.packaging_charge || bill.packing_charge || 0);
  const deliveryCharge = Number(bill.delivery_charge || 0);
  const taxes = Number(bill.taxes || bill.tax_amount || 0);
  const total = Number(bill.total || bill.grand_total || (subtotal + packaging + taxes));

  const rider = payload.rider_details || payload.delivery_partner || {};

  return {
    platform: 'zomato',
    external_order_id: externalId,
    customer_name: customer.name || 'Zomato Customer',
    customer_phone: customer.phone || customer.contact || null,
    delivery_address: delivery.delivery_address || delivery.address || null,
    rider_name: rider.name || null,
    rider_phone: rider.phone || null,
    rider_status: rider.status || (rider.name ? 'assigned' : 'unassigned'),
    packaging_charge: packaging,
    delivery_charge: deliveryCharge,
    service_charge: 0,
    subtotal,
    tax_amount: taxes,
    total,
    special_instructions: payload.instructions || payload.cooking_instructions || undefined,
    prep_time_minutes: Number(payload.prep_time || payload.preparation_time || 20),
    items,
    raw_payload: payload,
  };
}

/**
 * Validates HMAC-SHA256 signature for webhooks.
 */
export function verifyWebhookSignature(payloadString: string, signature: string | undefined, secret: string | undefined): boolean {
  if (!secret) return true; // If no secret configured, allow bypass for local dev/testing
  if (!signature) return false;

  try {
    const expected = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * Ingests a normalized aggregator delivery order into the local SQLite POS database,
 * triggers recipe raw inventory deduction, and alerts kitchen KDS over WebSocket.
 */
export function ingestAggregatorOrder(order: NormalizedAggregatorOrder): {
  ok: boolean;
  order_id: number;
  order_number: string;
  status: string;
  duplicate?: boolean;
} {
  const db = getDatabase();

  // 1. Check for Duplicate Ingestion (Idempotency)
  const existing = db.prepare(`
    SELECT id, order_number, status
    FROM orders
    WHERE online_platform = ? AND external_order_id = ?
  `).get(order.platform, order.external_order_id) as any;

  if (existing) {
    return {
      ok: true,
      order_id: existing.id,
      order_number: existing.order_number,
      status: existing.status,
      duplicate: true,
    };
  }

  // 2. Query Aggregator Config for Auto-Accept
  const config = db.prepare('SELECT auto_accept, default_prep_time_minutes FROM aggregator_configs WHERE platform = ?')
    .get(order.platform) as any;
  const autoAccept = config ? config.auto_accept === 1 : true;
  const initialStatus = autoAccept ? 'preparing' : 'pending';
  const prepTime = order.prep_time_minutes || (config ? config.default_prep_time_minutes : 20);

  const orderNumber = generateOrderNumber();
  const timestamp = now();

  let createdOrderId = 0;
  const inventoryItemsToDeduct: Array<{ product_id: string; quantity: number }> = [];

  db.transaction(() => {
    // 3. Insert Master Order Record
    const insertOrderStmt = db.prepare(`
      INSERT INTO orders (
        order_number, type, online_platform, external_order_id,
        customer_name, customer_phone, delivery_address,
        rider_name, rider_phone, rider_status, prep_time_minutes,
        special_instructions, packaging_charge, delivery_charge, service_charge,
        subtotal, tax_amount, total, status, aggregator_raw_payload,
        cooking_started_at, created_at, updated_at
      )
      VALUES (?, 'delivery', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertOrderStmt.run(
      orderNumber,
      order.platform,
      order.external_order_id,
      order.customer_name || null,
      order.customer_phone || null,
      order.delivery_address || null,
      order.rider_name || null,
      order.rider_phone || null,
      order.rider_status || 'unassigned',
      prepTime,
      order.special_instructions || null,
      order.packaging_charge || 0,
      order.delivery_charge || 0,
      order.service_charge || 0,
      order.subtotal,
      order.tax_amount,
      order.total,
      initialStatus,
      order.raw_payload ? JSON.stringify(order.raw_payload) : null,
      initialStatus === 'preparing' ? timestamp : null,
      timestamp,
      timestamp
    );

    createdOrderId = Number(result.lastInsertRowid);

    // 4. Insert Order Items (resolving to local products if possible)
    const findProductStmt = db.prepare(`
      SELECT id, name, price, sku
      FROM products
      WHERE (id = ? OR sku = ? OR LOWER(name) = LOWER(?)) AND is_active = 1
      LIMIT 1
    `);

    const insertItemStmt = db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, product_name, product_sku, unit_price,
        quantity, inventory_deducted_quantity, subtotal, tax_amount, tax_breakdown, total,
        special_instructions, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, '{}', ?, ?, ?, ?, ?)
    `);

    const insertAddonStmt = db.prepare(`
      INSERT INTO order_item_addons (order_item_id, addon_id, addon_name, price)
      VALUES (?, ?, ?, ?)
    `);

    for (const item of order.items) {
      const match = findProductStmt.get(
        item.product_id || '',
        item.sku || '',
        item.name.trim()
      ) as any;

      const productId = match ? match.id : (item.product_id || `agg-${crypto.randomBytes(4).toString('hex')}`);
      const productName = match ? match.name : item.name;
      const sku = match ? match.sku : (item.sku || null);
      const unitPrice = item.unit_price;
      const quantity = item.quantity;
      const itemSubtotal = item.total || (unitPrice * quantity);

      const itemRes = insertItemStmt.run(
        createdOrderId,
        productId,
        productName,
        sku,
        unitPrice,
        quantity,
        itemSubtotal,
        itemSubtotal,
        item.special_instructions || null,
        initialStatus,
        timestamp,
        timestamp
      );

      const orderItemId = Number(itemRes.lastInsertRowid);

      if (Array.isArray(item.addons)) {
        for (const addon of item.addons) {
          insertAddonStmt.run(
            orderItemId,
            addon.id || `addon-${crypto.randomBytes(4).toString('hex')}`,
            addon.name,
            addon.price
          );
        }
      }

      if (match) {
        inventoryItemsToDeduct.push({ product_id: match.id, quantity });
      }
    }
  })();

  // 5. Deduct Raw Ingredient Inventory if Auto-Accepted / Preparing
  if (initialStatus === 'preparing' && inventoryItemsToDeduct.length > 0) {
    try {
      deductIngredientsForOrderItems(inventoryItemsToDeduct, `${order.platform.toUpperCase()} #${order.external_order_id}`);
    } catch (invErr) {
      console.error('[Aggregator] Inventory deduction warning:', invErr);
    }
  }

  // 6. Notify Kitchen Display System (KDS) immediately
  notifyKdsUpdate();

  return {
    ok: true,
    order_id: createdOrderId,
    order_number: orderNumber,
    status: initialStatus,
  };
}

/**
 * Updates delivery rider details and arrival status.
 */
export function updateRiderStatus(
  platform: string,
  externalOrderId: string,
  riderStatus: 'unassigned' | 'assigned' | 'arrived' | 'picked_up',
  riderInfo?: { name?: string; phone?: string }
): boolean {
  const db = getDatabase();
  const timestamp = now();

  const res = db.prepare(`
    UPDATE orders
    SET rider_status = ?,
        rider_name = COALESCE(?, rider_name),
        rider_phone = COALESCE(?, rider_phone),
        updated_at = ?
    WHERE online_platform = ? AND external_order_id = ?
  `).run(
    riderStatus,
    riderInfo?.name || null,
    riderInfo?.phone || null,
    timestamp,
    platform,
    externalOrderId
  );

  if (res.changes > 0) {
    notifyKdsUpdate();
    return true;
  }
  return false;
}

/**
 * Cancels an aggregator order and restores deducted raw ingredients.
 */
export function cancelAggregatorOrder(
  platform: string,
  externalOrderId: string,
  cancellationReason?: string
): boolean {
  const db = getDatabase();
  const timestamp = now();

  const order = db.prepare(`
    SELECT id, order_number, status
    FROM orders
    WHERE online_platform = ? AND external_order_id = ?
  `).get(platform, externalOrderId) as any;

  if (!order || order.status === 'cancelled') return false;

  const items = db.prepare(`
    SELECT product_id, quantity
    FROM order_items
    WHERE order_id = ?
  `).all(order.id) as any[];

  db.transaction(() => {
    db.prepare(`
      UPDATE orders
      SET status = 'cancelled',
          cancellation_reason = ?,
          cancelled_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(cancellationReason || `${platform.toUpperCase()} cancelled`, timestamp, timestamp, order.id);

    db.prepare(`
      UPDATE order_items
      SET status = 'cancelled',
          updated_at = ?
      WHERE order_id = ?
    `).run(timestamp, order.id);
  })();

  // Restore raw ingredients
  if (items.length > 0) {
    try {
      restoreIngredientsForOrderItems(items, `${platform.toUpperCase()} #${externalOrderId} (Cancellation)`);
    } catch (err) {
      console.error('[Aggregator] Stock restoration warning:', err);
    }
  }

  notifyKdsUpdate();
  return true;
}
