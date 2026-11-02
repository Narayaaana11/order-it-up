import { Router, Request, Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import expressRateLimit from 'express-rate-limit';
import QRCode from 'qrcode';
import { getDatabase, now, getSettingValue, withTxn } from '../db';
import { asyncHandler } from '../middleware/async-handler';
import { calculateItemTax } from '../services/tax';
import { notifyKdsUpdate } from '../services/kds';
import { requireRole } from '../middleware/security';
import { ROLE_ACCESS } from '../../shared/role-permissions';
import { resolveItemAddons } from './orders';

const router = Router();

function hashQrToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

function isValidTableToken(tableId: string, rawToken: unknown): boolean {
  if (typeof rawToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) return false;
  const db = getDatabase();
  const stored = db.prepare(`
    SELECT token_hash FROM qr_table_tokens WHERE table_id = ? AND revoked_at IS NULL
  `).get(tableId) as { token_hash: string } | undefined;
  if (!stored || !/^[a-f0-9]{64}$/i.test(stored.token_hash)) return false;
  return timingSafeEqual(hashQrToken(rawToken), Buffer.from(stored.token_hash, 'hex'));
}

const qrRateLimit = expressRateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this device. Please wait a moment.' },
});

router.use(qrRateLimit);

/**
 * GET /api/qr/menu
 * Public menu endpoint for customer QR self-ordering.
 */
router.get('/menu', asyncHandler(async (req: Request, res: Response) => {
  const db = getDatabase();
  const tableId = req.query.table_id as string | undefined;
  const tableToken = req.get('authorization')?.match(/^Bearer\s+([A-Za-z0-9_-]{43})$/i)?.[1];

  let tableInfo = null;
  if (tableId) {
    if (!isValidTableToken(tableId, tableToken)) return res.status(404).json({ error: 'Menu not found' });
    tableInfo = db.prepare('SELECT id, number, floor, section, status FROM tables WHERE id = ?').get(tableId);
    if (!tableInfo) return res.status(404).json({ error: 'Menu not found' });
  }

  const restaurantName = getSettingValue('business_name') || 'Order It Up Restaurant';
  const currency = getSettingValue('currency') || 'INR';

  const categories = db.prepare(`
    SELECT id, name, description, sort_order, color, icon
    FROM categories
    WHERE is_active = 1 AND deleted_at IS NULL
    ORDER BY sort_order ASC, name ASC
  `).all();

  const products = db.prepare(`
    SELECT p.id, p.category_id, c.name as category_name, p.name, p.description, p.price, p.image_url,
           p.tax_type, p.tax_rate, p.tax_category_id,
           p.sort_order, p.tags
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = 1 AND p.deleted_at IS NULL
    ORDER BY p.sort_order ASC, p.name ASC
  `).all() as any[];

  // Attach addon groups & dietary metadata
  const productAddonsStmt = db.prepare(`
    SELECT ag.id as group_id, ag.name as group_name, ag.is_required, ag.min_selection, ag.max_selection,
           a.id as addon_id, a.name as addon_name, a.price as addon_price
    FROM addon_group_product agp
    JOIN addon_groups ag ON ag.id = agp.addon_group_id AND ag.is_active = 1
    JOIN addons a ON a.addon_group_id = ag.id AND a.is_active = 1
    WHERE agp.product_id = ?
    ORDER BY ag.sort_order ASC, a.sort_order ASC
  `);

  const enrichedProducts = products.map((prod) => {
    const addonRows = productAddonsStmt.all(prod.id) as any[];
    const groupMap = new Map<string, any>();
    for (const row of addonRows) {
      if (!groupMap.has(row.group_id)) {
        groupMap.set(row.group_id, {
          id: row.group_id,
          name: row.group_name,
          is_required: Boolean(row.is_required),
          min_selection: row.min_selection,
          max_selection: row.max_selection,
          addons: [],
        });
      }
      groupMap.get(row.group_id).addons.push({
        id: row.addon_id,
        name: row.addon_name,
        price: row.addon_price,
      });
    }

    const tagsLower = String(prod.tags || '').toLowerCase();
    const isNonVeg = tagsLower.includes('non_veg') || tagsLower.includes('non-veg') || tagsLower.includes('meat') || tagsLower.includes('chicken') || tagsLower.includes('fish') || tagsLower.includes('mutton');
    const isVeg = tagsLower.includes('veg') ? !isNonVeg : !isNonVeg;
    const isBestseller = tagsLower.includes('bestseller') || tagsLower.includes('popular') || tagsLower.includes('signature');
    const isVegan = tagsLower.includes('vegan');
    const isGlutenFree = tagsLower.includes('gluten_free') || tagsLower.includes('gf');

    return {
      ...prod,
      category_name: prod.category_name || prod.category_id || 'Mains',
      is_veg: isVeg,
      is_vegetarian: isVeg,
      is_bestseller: isBestseller,
      is_vegan: isVegan,
      is_gluten_free: isGlutenFree,
      addon_groups: Array.from(groupMap.values()),
    };
  });

  res.json({
    ok: true,
    restaurant: {
      name: restaurantName,
      currency,
    },
    table: tableInfo,
    categories,
    products: enrichedProducts,
  });
}));

/**
 * POST /api/qr/order
 * Places a customer self-order directly into the POS/KDS engine.
 */
router.post('/order', asyncHandler(async (req: Request, res: Response) => {
  const { table_id, customer_name, customer_phone, items, special_instructions } = req.body || {};

  if (!table_id) return res.status(400).json({ error: 'table_id is required' });
  const tableToken = req.get('authorization')?.match(/^Bearer\s+([A-Za-z0-9_-]{43})$/i)?.[1];
  if (!isValidTableToken(String(table_id), tableToken)) return res.status(404).json({ error: 'Table not found' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item' });
  }

  const db = getDatabase();
  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(table_id) as any;
  if (!table) return res.status(404).json({ error: 'Table not found' });

  // Generate unique order number
  const countRow = db.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number };
  const orderNumber = `QR-${String((countRow?.count || 0) + 1).padStart(5, '0')}`;
  const timestamp = now();

  // Validate items and calculate subtotals
  const stmtProduct = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1 AND deleted_at IS NULL');
  let subtotal = 0;
  const processedItems: any[] = [];

  for (const item of items) {
    const prod = stmtProduct.get(item.product_id) as any;
    if (!prod) {
      return res.status(400).json({ error: `Product not found or unavailable: ${item.product_id}` });
    }
    const qty = Number(item.quantity ?? 1);
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > 1000) {
      return res.status(400).json({ error: 'Item quantity must be a whole number between 1 and 1000' });
    }
    let itemPrice = Number(prod.price) || 0;
    const itemAddons: any[] = [];

    try {
      const requestedAddons = item.addons === undefined || item.addons === null
        ? []
        : Array.isArray(item.addons)
          ? item.addons.map((addon: unknown) => typeof addon === 'string' ? { id: addon } : addon)
          : item.addons;
      const resolvedAddons = resolveItemAddons(db, prod.id, requestedAddons as any[]);
      for (const addon of resolvedAddons) {
        itemPrice += (Number(addon.price) || 0) * addon.quantity;
        itemAddons.push(addon);
      }
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid product add-ons' });
    }

    const itemSubtotal = itemPrice * qty;
    subtotal += itemSubtotal;

    processedItems.push({
      product_id: prod.id,
      product_name: prod.name,
      product_sku: prod.sku,
      unit_price: itemPrice,
      quantity: qty,
      subtotal: itemSubtotal,
      total: itemSubtotal,
      tax_category_id: prod.tax_category_id,
      tax_type: prod.tax_type,
      tax_rate: prod.tax_rate,
      addons: itemAddons,
      special_instructions: item.special_instructions || null,
    });
  }

  // Calculate taxes using tenant country pack
  const tenantInfo = {
    country: getSettingValue('country') || 'IN',
    business_type: getSettingValue('business_type') || 'restaurant',
    state_code: getSettingValue('state_code') || '',
    currency: getSettingValue('currency') || 'INR',
    taxes_enabled: getSettingValue('taxes_enabled') !== 'false',
  };

  let totalTax = 0;
  const allTaxBreakdowns: any[] = [];
  for (const item of processedItems) {
    const taxRes = calculateItemTax(tenantInfo, item as any, item.subtotal, null);
    totalTax += taxRes.tax_amount;
    if (taxRes.tax_breakdown) {
      allTaxBreakdowns.push(...taxRes.tax_breakdown);
    }
  }

  const total = subtotal + totalTax;
  const trackingToken = randomBytes(32).toString('base64url');
  const trackingTokenHash = createHash('sha256').update(trackingToken).digest('hex');
  const trackingTokenExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

  let newOrderId: number = 0;

  db.transaction(() => {
    // 1. Insert order
    const orderResult = db.prepare(`
      INSERT INTO orders (
        order_number, table_id, customer_id, type, guest_count,
        special_instructions, status, subtotal, tax_amount, tax_breakdown,
        total, created_at, updated_at
      )
      VALUES (?, ?, NULL, 'dine_in', 1, ?, 'pending', ?, ?, ?, ?, ?, ?)
    `).run(
      orderNumber,
      table_id,
      special_instructions ? `[QR Self-Order] ${special_instructions}` : '[QR Self-Order]',
      subtotal,
      totalTax,
      JSON.stringify(allTaxBreakdowns),
      total,
      timestamp,
      timestamp
    );

    newOrderId = Number(orderResult.lastInsertRowid);

    db.prepare('DELETE FROM qr_order_tracking_tokens WHERE expires_at <= ?').run(Date.now());
    db.prepare(`
      INSERT INTO qr_order_tracking_tokens (order_id, token_hash, expires_at)
      VALUES (?, ?, ?)
    `).run(newOrderId, trackingTokenHash, trackingTokenExpiresAt);

    // 2. Insert order items
    const insertItemStmt = db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, product_name, product_sku, unit_price,
        quantity, inventory_deducted_quantity, subtotal, tax_amount, tax_breakdown, total,
        special_instructions, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, '{}', ?, ?, 'pending', ?, ?)
    `);

    const insertAddonStmt = db.prepare(`
      INSERT INTO order_item_addons (order_item_id, addon_id, addon_name, price, quantity, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const item of processedItems) {
      const itemRow = insertItemStmt.run(
        newOrderId,
        item.product_id,
        item.product_name,
        item.product_sku,
        item.unit_price,
        item.quantity,
        item.subtotal,
        item.total,
        item.special_instructions,
        timestamp,
        timestamp
      );

      const orderItemId = Number(itemRow.lastInsertRowid);
      for (const addon of item.addons) {
        insertAddonStmt.run(orderItemId, addon.id, addon.name, addon.price, addon.quantity, timestamp);
      }
    }

    // A customer request is not yet an active dine-in order. Staff acceptance
    // will mark the table occupied and deduct recipe stock in the order flow.
    // Keeping the table available here also avoids trapping a table when a
    // waiter rejects or the customer abandons a pending request.
    // Raw ingredients are deducted only after a staff member accepts the
    // request by moving it to preparing. Pending customer requests consume nothing.
  })();

  // Refresh connected staff/KDS clients so the request appears in the approval
  // queue without waiting for their next periodic poll.
  notifyKdsUpdate();

  res.status(201).json({
    ok: true,
    order: {
      id: newOrderId,
      order_number: orderNumber,
      table_number: table.number,
      total,
      status: 'pending',
      created_at: timestamp,
      tracking_token: trackingToken,
    },
  });
}));

/**
 * GET /api/qr/order/:id
 * Live status tracking for customer self-orders.
 */
router.get(['/order/:id', '/order/:id/track'], asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const authorization = req.get('authorization') || '';
  const trackingToken = authorization.match(/^Bearer\s+([A-Za-z0-9_-]{43})$/i)?.[1];
  if (!trackingToken) return res.status(404).json({ error: 'Order not found' });
  const trackingTokenHash = createHash('sha256').update(trackingToken).digest('hex');

  const order = db.prepare(`
    SELECT o.id, o.order_number, o.status, o.total, o.subtotal, o.tax_amount,
           o.cooking_started_at, o.ready_at, o.served_at, o.created_at,
           t.number as table_number
    FROM orders o
    JOIN qr_order_tracking_tokens qrt ON qrt.order_id = o.id
    LEFT JOIN tables t ON t.id = o.table_id
    WHERE o.id = ? AND qrt.token_hash = ? AND qrt.expires_at > ?
  `).get(id, trackingTokenHash, Date.now()) as any;

  if (!order) return res.status(404).json({ error: 'Order not found' });

  const items = db.prepare(`
    SELECT oi.id, oi.product_name, oi.quantity, oi.unit_price, oi.total, oi.status, oi.special_instructions
    FROM order_items oi
    WHERE oi.order_id = ?
  `).all(id);

  res.json({ ok: true, order, items });
}));

/**
 * GET /api/qr/tables/:id/code
 * Generates QR Code data URL for table sticker.
 */
router.get('/tables/:id/code', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const table = db.prepare('SELECT id, number FROM tables WHERE id = ?').get(id) as any;
  if (!table) return res.status(404).json({ error: 'Table not found' });

  // The raw capability is returned only in the owner-authenticated QR payload;
  // only its SHA-256 digest is persisted. Reissuing a code revokes the previous one.
  const tableToken = randomBytes(32).toString('base64url');
  const tokenHash = hashQrToken(tableToken).toString('hex');
  db.prepare(`
    INSERT INTO qr_table_tokens (table_id, token_hash, created_at, revoked_at)
    VALUES (?, ?, ?, NULL)
    ON CONFLICT(table_id) DO UPDATE SET
      token_hash = excluded.token_hash,
      created_at = excluded.created_at,
      revoked_at = NULL
  `).run(table.id, tokenHash, now());

  const host = req.get('host') || 'localhost:3001';
  const protocol = req.protocol || 'http';
  // Put the bearer capability in the URL fragment so it is not sent in HTTP
  // requests, access logs, or Referer headers. The web client moves it to an
  // Authorization header after loading the page.
  const qrUrl = `${protocol}://${host}/qr/${encodeURIComponent(table.id)}#token=${encodeURIComponent(tableToken)}`;

  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 360,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  res.json({
    ok: true,
    table_id: table.id,
    table_number: table.number,
    table_token: tableToken,
    qr_url: qrUrl,
    qr_data_url: qrDataUrl,
  });
}));

function ensureServiceCallsTable(db: any) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS customer_service_calls (
        id TEXT PRIMARY KEY,
        table_id TEXT NOT NULL,
        call_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        FOREIGN KEY (table_id) REFERENCES tables(id)
      );
    `);
  } catch {}
}

/**
 * POST /api/qr/call-waiter
 * Customer summons waiter or requests water/cutlery/bill from phone.
 */
router.post('/call-waiter', asyncHandler(async (req: Request, res: Response) => {
  const { table_id, type = 'waiter', notes = '' } = req.body || {};
  if (!table_id) return res.status(400).json({ error: 'table_id is required' });

  const db = getDatabase();
  ensureServiceCallsTable(db);

  const table = db.prepare('SELECT id, number FROM tables WHERE id = ?').get(table_id) as any;
  if (!table) return res.status(404).json({ error: 'Table not found' });

  const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = now();

  db.prepare(`
    INSERT INTO customer_service_calls (id, table_id, call_type, status, notes, created_at)
    VALUES (?, ?, ?, 'active', ?, ?)
  `).run(callId, table_id, type, notes, timestamp);

  try {
    notifyKdsUpdate();
  } catch {}

  res.status(201).json({
    ok: true,
    call_id: callId,
    table_id: table.id,
    table_number: table.number,
    call_type: type,
    message: `Staff alerted for Table ${table.number}.`,
  });
}));

/**
 * GET /api/qr/service-calls
 * Retrieves active service calls for floor staff and POS dashboard.
 */
router.get('/service-calls', asyncHandler(async (req: Request, res: Response) => {
  const db = getDatabase();
  ensureServiceCallsTable(db);

  const tableId = req.query.table_id as string | undefined;
  let calls;
  if (tableId) {
    calls = db.prepare(`
      SELECT c.*, t.number as table_number
      FROM customer_service_calls c
      JOIN tables t ON c.table_id = t.id
      WHERE c.table_id = ? AND c.status = 'active'
      ORDER BY c.created_at DESC
    `).all(tableId);
  } else {
    calls = db.prepare(`
      SELECT c.*, t.number as table_number
      FROM customer_service_calls c
      JOIN tables t ON c.table_id = t.id
      WHERE c.status = 'active'
      ORDER BY c.created_at DESC
    `).all();
  }

  res.json({ ok: true, calls });
}));

export const qrOrderRoutes = router;

