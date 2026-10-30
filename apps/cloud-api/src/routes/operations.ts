/**
/**
 * Shared Real-Time Restaurant Operations: Orders, Tables, and Kitchen Tickets
 * for Order It Up Cloud Edge Worker.
 */

import { Env } from './pairing';
import {
  getUserMemberships,
  isOrgOwnerOrAdmin,
  isAuthorizedForBranch,
  UserMembership,
} from '../rbac';

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export interface PriceValidationItem {
  id?: string;
  product_id?: string | null;
  product_name?: string | null;
  name?: string | null;
  quantity?: number;
  unit_price?: number;
  tax_amount?: number;
  tax_rate?: number;
  discount_amount?: number;
  modifiers?: Array<{ name: string; price: number; quantity?: number }>;
  special_instructions?: string | null;
  price_override_authorized?: boolean;
}

export interface PriceValidationOptions {
  isTerminalSync?: boolean; // When true: authenticated terminal outbox sync path (/api/pos/events)
  managerAuthorized?: boolean; // Live server-verified manager authorization
}

export async function validateAndPriceItem(
  db: any,
  orgId: string,
  branchId: string,
  rawItem: PriceValidationItem,
  userRole: string,
  options?: PriceValidationOptions
): Promise<{
  valid: boolean;
  error?: string;
  item?: {
    id: string;
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    modifiers_json: string;
    special_instructions: string | null;
  };
}> {
  // 1. Quantity check: positive finite number, <= 1000
  const qty = Number(rawItem.quantity);
  if (!Number.isFinite(qty) || qty <= 0 || qty > 1000) {
    return { valid: false, error: `Invalid item quantity (${rawItem.quantity}): must be a positive number <= 1000` };
  }

  // 2. Modifiers calculation
  let modifiersCostPerUnit = 0;
  const validModifiers: Array<{ name: string; price: number; quantity: number }> = [];
  if (Array.isArray(rawItem.modifiers)) {
    for (const mod of rawItem.modifiers) {
      if (!mod || typeof mod.name !== 'string') continue;
      const modPrice = Number(mod.price || 0);
      const modQty = Number(mod.quantity || 1);
      if (!Number.isFinite(modPrice) || modPrice < 0) {
        return { valid: false, error: `Invalid modifier price for ${mod.name}` };
      }
      if (modPrice > 0 && !options?.isTerminalSync) {
        return {
          valid: false,
          error: `Arbitrary modifier price for "${mod.name}" is not permitted for cloud orders without authoritative catalog modifier configuration. Submit priced items via catalog or sync via authenticated terminal.`
        };
      }
      modifiersCostPerUnit += modPrice * (modQty > 0 ? modQty : 1);
      validModifiers.push({ name: mod.name, price: modPrice, quantity: modQty > 0 ? modQty : 1 });
    }
  }

  let finalUnitPrice = 0;
  let finalProductName = '';
  let finalTaxRate = 0;
  let productId: string | null = null;

  if (rawItem.product_id) {
    // 3. Server-side Catalog verification
    const product = await db.prepare(`
      SELECT p.id, p.organization_id, p.name, p.base_price, p.tax_rate, p.is_active,
             o.price_override, o.is_available
      FROM master_products p
      LEFT JOIN branch_product_overrides o ON (o.product_id = p.id AND o.branch_id = ?)
      WHERE p.id = ?
    `).bind(branchId, rawItem.product_id).first() as any;

    if (product) {
      if (product.organization_id !== orgId) {
        return { valid: false, error: `Product "${rawItem.product_id}" does not belong to this organization` };
      }
      if (product.is_active === 0) {
        return { valid: false, error: `Product "${product.name}" is inactive` };
      }
      if (product.is_available === 0) {
        return { valid: false, error: `Product "${product.name}" is unavailable at this branch` };
      }

      const catalogPrice = (product.price_override !== null && product.price_override !== undefined)
        ? Number(product.price_override)
        : Number(product.base_price);

      // Validate price tampering
      if (rawItem.unit_price !== undefined && rawItem.unit_price !== null) {
        const clientPrice = Number(rawItem.unit_price);
        if (Math.abs(clientPrice - catalogPrice) > 0.05) {
          const isPrivileged = ['owner', 'manager'].includes(userRole) || options?.managerAuthorized === true;
          if (!isPrivileged) {
            return {
              valid: false,
              error: `Unauthorized price modification for "${product.name}": catalog price is ${catalogPrice}, submitted ${clientPrice}. Manager override required.`
            };
          }
          finalUnitPrice = clientPrice;
        } else {
          finalUnitPrice = catalogPrice;
        }
      } else {
        finalUnitPrice = catalogPrice;
      }

      finalProductName = product.name;
      finalTaxRate = Number(product.tax_rate || 0);
      productId = product.id;
    } else {
      // Unlisted item not found in master_products.
      // Security Invariant (Phase 2-A): Ordinary cloud order creation (Web/Mobile) MUST require valid catalog products.
      // Unlisted items are allowed ONLY on the authenticated POS terminal sync outbox path.
      if (!options?.isTerminalSync) {
        return { valid: false, error: `Product "${rawItem.product_id}" was not found in catalog` };
      }

      const suppliedName = (rawItem.product_name || rawItem.name || '').trim();
      if (!suppliedName) {
        return { valid: false, error: `Product "${rawItem.product_id}" was not found in catalog and no name was provided` };
      }
      const suppliedPrice = Number(rawItem.unit_price);
      if (!Number.isFinite(suppliedPrice) || suppliedPrice < 0) {
        return { valid: false, error: `Invalid unit price for unlisted item "${suppliedName}"` };
      }
      finalUnitPrice = suppliedPrice;
      finalProductName = suppliedName;
      finalTaxRate = Number(rawItem.tax_rate || 0);
      productId = rawItem.product_id;
    }
  } else {
    // 4. Custom Open Item (requires cashier, manager, or owner)
    const canCreateCustom = ['owner', 'manager', 'cashier'].includes(userRole) || options?.isTerminalSync === true;
    if (!canCreateCustom) {
      return { valid: false, error: 'Custom open items cannot be created without cashier or manager authorization' };
    }
    finalProductName = (rawItem.product_name || rawItem.name || '').trim();
    if (!finalProductName) {
      return { valid: false, error: 'Product name is required for custom open items' };
    }
    finalUnitPrice = Number(rawItem.unit_price || 0);
    if (!Number.isFinite(finalUnitPrice) || finalUnitPrice < 0) {
      return { valid: false, error: 'Custom item unit price must be a non-negative number' };
    }
    finalTaxRate = 0;
  }

  // 5. Line subtotal: (unitPrice + modifiers) * qty
  const lineUnitPrice = finalUnitPrice + modifiersCostPerUnit;
  const rawSubtotal = Math.round((qty * lineUnitPrice) * 100) / 100;

  // 6. Validate discount permissions and limits
  let discountAmount = Number(rawItem.discount_amount || 0);
  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    return { valid: false, error: `Discount for "${finalProductName}" must be a non-negative number` };
  }
  if (discountAmount > rawSubtotal) {
    return { valid: false, error: `Discount for "${finalProductName}" (${discountAmount}) cannot exceed subtotal (${rawSubtotal})` };
  }
  if (discountAmount > 0) {
    const isManagerOrOwner = ['owner', 'super_admin', 'manager', 'branch_manager'].includes(userRole) || options?.managerAuthorized === true;
    if (!isManagerOrOwner) {
      if (['waiter', 'server'].includes(userRole)) {
        return {
          valid: false,
          error: `Unauthorized discount on "${finalProductName}": Waiters are not permitted to apply line discounts without manager approval.`
        };
      }
      if (userRole === 'cashier') {
        const maxCashierDiscount = Math.round(rawSubtotal * 0.15 * 100) / 100;
        if (discountAmount > maxCashierDiscount || discountAmount > 500) {
          return {
            valid: false,
            error: `Discount on "${finalProductName}" (${discountAmount}) exceeds cashier limit of 15% (${maxCashierDiscount}) or ₹500 cap. Manager approval required.`
          };
        }
      }
    }
  }
  discountAmount = Math.round(discountAmount * 100) / 100;

  const netSubtotal = Math.round((rawSubtotal - discountAmount) * 100) / 100;

  // 7. Calculate tax strictly server-side for ordinary cloud orders
  let calculatedTax = 0;
  if (finalTaxRate > 0) {
    calculatedTax = Math.round((netSubtotal * (finalTaxRate / 100)) * 100) / 100;
  } else if (options?.isTerminalSync && rawItem.tax_amount !== undefined && rawItem.tax_amount !== null) {
    const clientTax = Number(rawItem.tax_amount);
    if (Number.isFinite(clientTax) && clientTax >= 0) {
      calculatedTax = Math.round(clientTax * 100) / 100;
    }
  }

  return {
    valid: true,
    item: {
      id: rawItem.id || crypto.randomUUID(),
      product_id: productId,
      product_name: finalProductName,
      quantity: qty,
      unit_price: finalUnitPrice,
      subtotal: rawSubtotal,
      tax_amount: calculatedTax,
      discount_amount: discountAmount,
      modifiers_json: JSON.stringify(validModifiers),
      special_instructions: rawItem.special_instructions || null,
    }
  };
}

// ── 1. Orders Management ─────────────────────────────────────────────────────

/**
 * Lists orders for an authorized branch with status filters and pagination.
 */
export async function handleListOrders(
  request: Request,
  env: Env,
  claims: any,
  url: URL
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;
  const branchId = url.searchParams.get('branch_id');

  if (!branchId) {
    return Response.json({ error: 'branch_id query parameter is required' }, { status: 400 });
  }

  const memberships = await getUserMemberships(env.DB, orgId, userId);
  const authCheck = await isAuthorizedForBranch(env.DB, orgId, memberships, branchId, [
    'owner',
    'manager',
    'cashier',
    'server',
    'chef',
  ]);

  if (!authCheck.authorized) {
    return Response.json({ error: 'Forbidden: Insufficient privileges for this branch' }, { status: 403 });
  }

  const status = url.searchParams.get('status');
  const kitchenStatus = url.searchParams.get('kitchen_status');
  const paymentStatus = url.searchParams.get('payment_status');
  const tableId = url.searchParams.get('table_id');
  const limitParam = url.searchParams.get('limit') || url.searchParams.get('per_page');
  const limit = Math.min(parseInt(limitParam || '50', 10), 100);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

  let query = `
    SELECT o.*, b.name as branch_name, r.name as restaurant_name
    FROM synced_orders o
    JOIN branches b ON o.branch_id = b.id
    LEFT JOIN restaurants r ON o.restaurant_id = r.id
    WHERE o.organization_id = ? AND o.branch_id = ?
  `;
  const binds: any[] = [orgId, branchId];

  if (status) {
    if (status.includes(',')) {
      const statuses = status.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length > 0) {
        query += ` AND o.status IN (${statuses.map(() => '?').join(',')})`;
        binds.push(...statuses);
      }
    } else {
      query += ` AND o.status = ?`;
      binds.push(status);
    }
  }
  if (kitchenStatus) {
    query += ` AND o.kitchen_status = ?`;
    binds.push(kitchenStatus);
  }
  if (paymentStatus) {
    query += ` AND o.payment_status = ?`;
    binds.push(paymentStatus);
  }
  if (tableId) {
    query += ` AND o.table_id = ?`;
    binds.push(tableId);
  }

  query += ` ORDER BY o.ordered_at DESC LIMIT ? OFFSET ?`;
  binds.push(limit, offset);

  const ordersResult = await env.DB.prepare(query).bind(...binds).all();
  const orders = ordersResult.results || [];

  // Fetch items for retrieved orders
  if (orders.length > 0) {
    const orderIds = orders.map((o: any) => o.id);
    const placeholders = orderIds.map(() => '?').join(',');
    const itemsResult = await env.DB.prepare(`
      SELECT * FROM synced_order_items
      WHERE order_id IN (${placeholders})
      ORDER BY ordered_at ASC
    `).bind(...orderIds).all();

    const itemsByOrder = new Map<string, any[]>();
    for (const item of (itemsResult.results || [])) {
      const oid = (item as any).order_id;
      if (!itemsByOrder.has(oid)) itemsByOrder.set(oid, []);
      itemsByOrder.get(oid)!.push({
        ...item,
        modifiers: safeParseJson((item as any).modifiers_json, []),
      });
    }

    for (const ord of orders) {
      (ord as any).items = itemsByOrder.get((ord as any).id) || [];
    }
  }

  return Response.json({ orders, total: orders.length, limit, offset });
}

/**
 * Retrieves an individual order with full items and kitchen status.
 */
export async function handleGetOrder(
  request: Request,
  env: Env,
  claims: any,
  orderId: string
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;

  const order = await env.DB.prepare(`
    SELECT o.*, b.name as branch_name, r.name as restaurant_name
    FROM synced_orders o
    JOIN branches b ON o.branch_id = b.id
    LEFT JOIN restaurants r ON o.restaurant_id = r.id
    WHERE o.id = ? AND o.organization_id = ?
  `).bind(orderId, orgId).first<any>();

  if (!order) {
    return Response.json({ error: 'Order not found' }, { status: 404 });
  }

  const memberships = await getUserMemberships(env.DB, orgId, userId);
  const authCheck = await isAuthorizedForBranch(env.DB, orgId, memberships, order.branch_id, [
    'owner',
    'manager',
    'cashier',
    'server',
    'waiter',
    'chef',
    'kitchen',
  ]);

  if (!authCheck.authorized) {
    return Response.json({ error: 'Forbidden: Insufficient privileges for this branch' }, { status: 403 });
  }

  const items = await env.DB.prepare(`
    SELECT * FROM synced_order_items WHERE order_id = ? ORDER BY ordered_at ASC
  `).bind(orderId).all();

  const tickets = await env.DB.prepare(`
    SELECT * FROM kitchen_tickets WHERE order_id = ? ORDER BY created_at ASC
  `).bind(orderId).all();

  return Response.json({
    order: {
      ...order,
      items: (items.results || []).map((i: any) => ({
        ...i,
        modifiers: safeParseJson(i.modifiers_json, []),
      })),
      kitchen_tickets: (tickets.results || []).map((t: any) => ({
        ...t,
        items: safeParseJson(t.items_json, []),
      })),
    },
  });
}

/**
 * Verifies that a manager or owner has explicitly approved an override.
 */
export async function verifyManagerApproval(
  db: any,
  orgId: string,
  branchId: string,
  approval: any
): Promise<{ valid: boolean; error?: string; managerName?: string }> {
  if (!approval) {
    return { valid: false, error: 'Manager approval required: manager_approval is missing' };
  }

  const managerUserId = typeof approval === 'string'
    ? approval.trim()
    : (typeof approval?.manager_user_id === 'string' ? approval.manager_user_id.trim() : '');
  if (!managerUserId) {
    return { valid: false, error: 'Manager approval required: manager_user_id must be provided' };
  }

  const memberships = await getUserMemberships(db, orgId, managerUserId);
  const isManager = memberships.some((m) =>
    ['owner', 'super_admin', 'manager', 'branch_manager'].includes(m.role) &&
    (m.branch_id === branchId || !m.branch_id) &&
    m.status === 'active'
  );

  if (!isManager) {
    return { valid: false, error: `User "${managerUserId}" does not hold active manager or owner privileges for this branch` };
  }

  const userRow = (await db.prepare(
    'SELECT name FROM cloud_users WHERE id = ? AND organization_id = ?'
  ).bind(managerUserId, orgId).first()) as { name: string } | null;

  return { valid: true, managerName: userRow?.name || 'Manager' };
}

/**
 * Creates a new order idempotently with line items and automatic kitchen tickets.
 */
export async function handleCreateOrder(
  request: Request,
  env: Env,
  claims: any
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const branchId = typeof body?.branch_id === 'string' ? body.branch_id.trim() : '';
  if (!branchId) {
    return Response.json({ error: 'branch_id is required' }, { status: 400 });
  }

  const memberships = await getUserMemberships(env.DB, orgId, userId);
  const authCheck = await isAuthorizedForBranch(env.DB, orgId, memberships, branchId, [
    'owner',
    'manager',
    'cashier',
    'server',
    'waiter',
  ]);

  if (!authCheck.authorized) {
    return Response.json({ error: 'Forbidden: Insufficient privileges to create orders at this branch' }, { status: 403 });
  }

  // Verify branch exists and resolve its restaurant concept
  const branch = await env.DB.prepare(`
    SELECT id, organization_id, restaurant_id FROM branches WHERE id = ? AND organization_id = ?
  `).bind(branchId, orgId).first<{ id: string; organization_id: string; restaurant_id: string | null }>();

  if (!branch) {
    return Response.json({ error: 'Branch does not exist in this organization' }, { status: 404 });
  }

  const orderId = typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : crypto.randomUUID();

  // Idempotency check: if an order with this ID already exists
  const existingOrder = await env.DB.prepare(`
    SELECT * FROM synced_orders WHERE id = ?
  `).bind(orderId).first<any>();

  if (existingOrder) {
    if (existingOrder.organization_id !== orgId || existingOrder.branch_id !== branchId) {
      return Response.json({ error: 'Order ID collision across different branch or tenant' }, { status: 409 });
    }
    // Idempotent return of existing order
    return Response.json({
      success: true,
      idempotent: true,
      message: 'Order already exists; acknowledged idempotently',
      order: existingOrder,
    }, { status: 200 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) {
    return Response.json({ error: 'At least one order item is required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const orderNumber = typeof body?.order_number === 'string' && body.order_number.trim()
    ? body.order_number.trim()
    : `ORD-${Date.now().toString().slice(-6)}`;
  const orderType = typeof body?.order_type === 'string' ? body.order_type : 'dine_in';
  const tableId = typeof body?.table_id === 'string' && body.table_id.trim() ? body.table_id.trim() : null;
  const tableNumber = typeof body?.table_number === 'string' ? body.table_number.trim() : null;
  const customerName = typeof body?.customer_name === 'string' ? body.customer_name.trim() : null;
  const customerPhone = typeof body?.customer_phone === 'string' ? body.customer_phone.trim() : null;
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : null;
  const paymentMethod = typeof body?.payment_method === 'string' ? body.payment_method : 'cash';

  // Determine user's effective role for permissions
  const userRole = memberships.find((m) => m.branch_id === branchId)?.role
    || memberships.find((m) => m.restaurant_id === branch.restaurant_id)?.role
    || memberships.find((m) => !m.restaurant_id && !m.branch_id)?.role
    || 'waiter';

  // Check manager approval if provided
  let isManagerApproved = ['owner', 'super_admin', 'manager', 'branch_manager'].includes(userRole);
  const approvalData = body?.manager_approval || body?.manager_approval_user_id;
  if (!isManagerApproved && approvalData) {
    const approvalCheck = await verifyManagerApproval(env.DB, orgId, branchId, approvalData);
    if (!approvalCheck.valid) {
      return Response.json({ error: `Manager approval invalid: ${approvalCheck.error}` }, { status: 403 });
    }
    isManagerApproved = true;
  }

  // Calculate financial totals safely using server-side catalog & pricing engine
  let subtotal = 0;
  let taxTotal = 0;
  let discountTotal = 0;

  const processedItems: any[] = [];
  for (const rawItem of rawItems) {
    const valResult = await validateAndPriceItem(env.DB, orgId, branchId, rawItem, userRole, { managerAuthorized: isManagerApproved });
    if (!valResult.valid || !valResult.item) {
      return Response.json({ error: valResult.error || 'Invalid order item' }, { status: 400 });
    }
    const item = valResult.item;
    subtotal = Math.round((subtotal + item.subtotal) * 100) / 100;
    taxTotal = Math.round((taxTotal + item.tax_amount) * 100) / 100;
    discountTotal = Math.round((discountTotal + item.discount_amount) * 100) / 100;
    processedItems.push(item);
  }

  // Order-level discount check
  const orderDiscount = typeof body?.order_discount === 'number' && body.order_discount >= 0
    ? body.order_discount
    : (typeof body?.discount_total === 'number' && body.discount_total > 0 ? body.discount_total : 0);
  const discountReason = typeof body?.discount_reason === 'string' ? body.discount_reason.trim() : '';

  if (orderDiscount > 0) {
    if (!discountReason) {
      return Response.json({ error: 'A valid discount_reason is required when applying an order-level discount' }, { status: 400 });
    }
    if (orderDiscount > subtotal) {
      return Response.json({ error: `Order discount (${orderDiscount}) cannot exceed order subtotal (${subtotal})` }, { status: 400 });
    }

    if (!isManagerApproved) {
      if (['waiter', 'server'].includes(userRole)) {
        return Response.json({
          error: 'Forbidden: Waiters are not permitted to apply order-level discounts without verified manager approval',
        }, { status: 403 });
      }
      if (userRole === 'cashier') {
        const maxCashierDiscount = Math.round(subtotal * 0.15 * 100) / 100;
        if (orderDiscount > maxCashierDiscount || orderDiscount > 500) {
          return Response.json({
            error: `Order discount (${orderDiscount}) exceeds cashier limit of 15% (₹${maxCashierDiscount}) or ₹500 cap. Verified manager approval is required.`,
          }, { status: 403 });
        }
      }
    }
  }

  discountTotal = Math.round((discountTotal + orderDiscount) * 100) / 100;
  const grandTotal = Math.max(0, Math.round((subtotal + taxTotal - discountTotal) * 100) / 100);

  // Validate dining table if specified
  if (tableId) {
    const table = await env.DB.prepare(`
      SELECT id, status FROM dining_tables WHERE id = ? AND branch_id = ? AND organization_id = ?
    `).bind(tableId, branchId, orgId).first<{ id: string; status: string }>();

    if (!table) {
      return Response.json({ error: 'Invalid table_id for this branch' }, { status: 400 });
    }
  }

  const ticketId = crypto.randomUUID();
  const ticketNumber = `KOT-${orderNumber}`;
  const ticketItems = processedItems.map((i) => ({
    product_name: i.product_name,
    quantity: i.quantity,
    modifiers: safeParseJson(i.modifiers_json, []),
    instructions: i.special_instructions,
  }));

  // Atomic batch: Order + items + table occupancy + kitchen ticket
  const batchStatements: any[] = [];

  // 1. Insert order record
  batchStatements.push(
    env.DB.prepare(`
      INSERT INTO synced_orders (
        id, organization_id, restaurant_id, branch_id, terminal_id, order_number, order_type,
        status, kitchen_status, payment_status, subtotal, tax_total, discount_total, grand_total,
        payment_method, table_id, table_number, customer_name, customer_phone,
        created_by_user_id, created_by_name, notes, version, ordered_at, synced_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        'active', 'pending', 'unpaid', ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, 1, ?, ?, ?
      )
    `).bind(
      orderId,
      orgId,
      branch.restaurant_id,
      branchId,
      body.terminal_id || null,
      orderNumber,
      orderType,
      subtotal,
      taxTotal,
      discountTotal,
      grandTotal,
      paymentMethod,
      tableId,
      tableNumber,
      customerName,
      customerPhone,
      userId,
      claims.name || 'Staff',
      notes,
      now,
      now,
      now
    )
  );

  // 2. Insert order items
  for (const item of processedItems) {
    batchStatements.push(
      env.DB.prepare(`
        INSERT INTO synced_order_items (
          id, order_id, branch_id, restaurant_id, product_id, product_name,
          quantity, unit_price, subtotal, tax_amount, discount_amount,
          modifiers_json, special_instructions, kitchen_status, version, ordered_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?, ?)
      `).bind(
        item.id,
        orderId,
        branchId,
        branch.restaurant_id,
        item.product_id,
        item.product_name,
        item.quantity,
        item.unit_price,
        item.subtotal,
        item.tax_amount,
        item.discount_amount,
        item.modifiers_json,
        item.special_instructions,
        now,
        now
      )
    );
  }

  // 3. Mark table occupied if dine-in
  if (tableId) {
    batchStatements.push(
      env.DB.prepare(`
        UPDATE dining_tables
        SET status = 'occupied', current_order_id = ?, updated_at = ?
        WHERE id = ?
      `).bind(orderId, now, tableId)
    );
  }

  // 4. Generate derived kitchen display ticket
  batchStatements.push(
    env.DB.prepare(`
      INSERT INTO kitchen_tickets (
        id, organization_id, restaurant_id, branch_id, order_id, ticket_number,
        station, status, items_json, notes, prep_time_minutes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'main_kitchen', 'pending', ?, ?, 15, ?, ?)
    `).bind(
      ticketId,
      orgId,
      branch.restaurant_id,
      branchId,
      orderId,
      ticketNumber,
      JSON.stringify(ticketItems),
      notes,
      now,
      now
    )
  );

  await env.DB.batch(batchStatements);

  return Response.json(
    {
      success: true,
      order: {
        id: orderId,
        organization_id: orgId,
        restaurant_id: branch.restaurant_id,
        branch_id: branchId,
        order_number: orderNumber,
        status: 'active',
        kitchen_status: 'pending',
        payment_status: 'unpaid',
        subtotal,
        tax_total: taxTotal,
        discount_total: discountTotal,
        grand_total: grandTotal,
        version: 1,
        items: processedItems,
        kitchen_ticket_id: ticketId,
      },
    },
    { status: 201 }
  );
}

/**
 * Adds new items to an active order with concurrency protection.
 */
export async function handleAddOrderItems(
  request: Request,
  env: Env,
  claims: any,
  orderId: string
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;

  const order = await env.DB.prepare(`
    SELECT * FROM synced_orders WHERE id = ? AND organization_id = ?
  `).bind(orderId, orgId).first<any>();

  if (!order) {
    return Response.json({ error: 'Order not found' }, { status: 404 });
  }

  const memberships = await getUserMemberships(env.DB, orgId, userId);
  const authCheck = await isAuthorizedForBranch(env.DB, orgId, memberships, order.branch_id, [
    'owner',
    'manager',
    'cashier',
    'server',
    'waiter',
  ]);

  if (!authCheck.authorized) {
    return Response.json({ error: 'Forbidden: Insufficient privileges for this branch' }, { status: 403 });
  }

  // Only active, unfinalized orders can be amended
  if (order.status !== 'active' || order.payment_status === 'paid') {
    return Response.json({ error: `Cannot add items: Order is ${order.status} and payment is ${order.payment_status}` }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  // Optimistic concurrency check
  if (typeof body.expected_version === 'number' && body.expected_version !== order.version) {
    return Response.json({
      error: `Conflict: Order has been modified concurrently. Expected version ${body.expected_version}, but current version is ${order.version}`,
    }, { status: 409 });
  }

  const newItems = Array.isArray(body.items) ? body.items : [];
  if (newItems.length === 0) {
    return Response.json({ error: 'items array is required' }, { status: 400 });
  }

  const userRole = memberships.find((m) => m.branch_id === order.branch_id)?.role
    || memberships.find((m) => m.restaurant_id === order.restaurant_id)?.role
    || memberships.find((m) => !m.restaurant_id && !m.branch_id)?.role
    || 'waiter';

  const validatedNewItems: any[] = [];
  for (const rawItem of newItems) {
    const valResult = await validateAndPriceItem(env.DB, orgId, order.branch_id, rawItem, userRole);
    if (!valResult.valid || !valResult.item) {
      return Response.json({ error: valResult.error || 'Invalid item in amendment' }, { status: 400 });
    }
    validatedNewItems.push(valResult.item);
  }

  const now = new Date().toISOString();
  let addedSubtotal = 0;
  let addedTax = 0;
  let addedDiscount = 0;

  const insertedItems: any[] = [];
  const batchStatements: any[] = [];

  for (const item of validatedNewItems) {
    addedSubtotal = Math.round((addedSubtotal + item.subtotal) * 100) / 100;
    addedTax = Math.round((addedTax + item.tax_amount) * 100) / 100;
    addedDiscount = Math.round((addedDiscount + item.discount_amount) * 100) / 100;

    batchStatements.push(
      env.DB.prepare(`
        INSERT INTO synced_order_items (
          id, order_id, branch_id, restaurant_id, product_id, product_name,
          quantity, unit_price, subtotal, tax_amount, discount_amount,
          modifiers_json, special_instructions, kitchen_status, version, ordered_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?, ?)
      `).bind(
        item.id,
        orderId,
        order.branch_id,
        order.restaurant_id,
        item.product_id,
        item.product_name,
        item.quantity,
        item.unit_price,
        item.subtotal,
        item.tax_amount,
        item.discount_amount,
        item.modifiers_json,
        item.special_instructions,
        now,
        now
      )
    );

    insertedItems.push({
      id: item.id,
      product_name: item.product_name,
      quantity: item.quantity,
      subtotal: item.subtotal,
    });
  }

  const newSubtotal = Math.round((order.subtotal + addedSubtotal) * 100) / 100;
  const newTaxTotal = Math.round((order.tax_total + addedTax) * 100) / 100;
  const newDiscountTotal = Math.round((order.discount_total + addedDiscount) * 100) / 100;
  const newGrandTotal = Math.max(0, Math.round((newSubtotal + newTaxTotal - newDiscountTotal) * 100) / 100);
  const newVersion = order.version + 1;

  // Conditional update with version check
  batchStatements.push(
    env.DB.prepare(`
      UPDATE synced_orders
      SET subtotal = ?, tax_total = ?, discount_total = ?, grand_total = ?,
          version = (CASE WHEN version = ? THEN version + 1 ELSE json_extract('{', '$.concurrency_conflict') END),
          kitchen_status = 'pending', updated_at = ?
      WHERE id = ?
    `).bind(newSubtotal, newTaxTotal, newDiscountTotal, newGrandTotal, order.version, now, orderId)
  );

  // Create an amendment kitchen ticket for newly added items
  const ticketId = crypto.randomUUID();
  const ticketNumber = `KOT-${order.order_number}-A${newVersion}`;
  batchStatements.push(
    env.DB.prepare(`
      INSERT INTO kitchen_tickets (
        id, organization_id, restaurant_id, branch_id, order_id, ticket_number,
        station, status, items_json, notes, prep_time_minutes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'main_kitchen', 'pending', ?, 'Course Amendment', 10, ?, ?)
    `).bind(
      ticketId,
      orgId,
      order.restaurant_id,
      order.branch_id,
      orderId,
      ticketNumber,
      JSON.stringify(insertedItems),
      now,
      now
    )
  );

  try {
    await env.DB.batch(batchStatements);
  } catch (err: any) {
    if (err?.message?.includes('JSON') || err?.message?.includes('concurrency_conflict')) {
      return Response.json({
        error: `Conflict: Order has been modified concurrently. Expected version ${order.version}`,
      }, { status: 409 });
    }
    throw err;
  }

  return Response.json({
    success: true,
    message: 'Order items appended and amendment ticket dispatched',
    version: newVersion,
    grand_total: newGrandTotal,
    added_items: insertedItems,
  });
}

/**
 * Transitions order lifecycle status (active, completed, cancelled) with cancellation audit.
 */
export async function handleUpdateOrderStatus(
  request: Request,
  env: Env,
  claims: any,
  orderId: string
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;

  const order = await env.DB.prepare(`
    SELECT * FROM synced_orders WHERE id = ? AND organization_id = ?
  `).bind(orderId, orgId).first<any>();

  if (!order) {
    return Response.json({ error: 'Order not found' }, { status: 404 });
  }

  const memberships = await getUserMemberships(env.DB, orgId, userId);
  const authCheck = await isAuthorizedForBranch(env.DB, orgId, memberships, order.branch_id, [
    'owner',
    'manager',
    'cashier',
  ]);

  if (!authCheck.authorized) {
    return Response.json({ error: 'Forbidden: Insufficient privileges to finalize or cancel orders' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const nextStatus = typeof body?.status === 'string' ? body.status.trim() : '';
  const ALLOWED_STATUSES = ['active', 'completed', 'cancelled'];
  if (!ALLOWED_STATUSES.includes(nextStatus)) {
    return Response.json({ error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}` }, { status: 400 });
  }

  // Optimistic concurrency check
  if (typeof body.expected_version === 'number' && body.expected_version !== order.version) {
    return Response.json({
      error: `Conflict: Concurrent update detected. Expected v${body.expected_version}, current v${order.version}`,
    }, { status: 409 });
  }

  const now = new Date().toISOString();
  const newVersion = order.version + 1;

  if (nextStatus === 'cancelled') {
    if (order.status === 'completed') {
      return Response.json({
        error: 'Cannot cancel an already completed order. An auditable refund or reversal process is required.',
      }, { status: 400 });
    }

    // Check if there are settled customer payments
    const paymentCheck = await env.DB.prepare(`
      SELECT COALESCE(SUM(amount), 0) - COALESCE(SUM(refunded_amount), 0) as net_settled
      FROM customer_payments
      WHERE order_id = ? AND status = 'completed'
    `).bind(orderId).first<{ net_settled: number }>();

    if (paymentCheck && paymentCheck.net_settled > 0) {
      return Response.json({
        error: `Cannot cancel an order with settled customer payments (net settled: ${paymentCheck.net_settled}). All customer payments must be refunded or voided first.`,
      }, { status: 400 });
    }

    const reason = typeof body?.cancellation_reason === 'string' && body.cancellation_reason.trim()
      ? body.cancellation_reason.trim()
      : 'Voided by cashier';

    await env.DB.prepare(`
      UPDATE synced_orders
      SET status = 'cancelled', kitchen_status = 'cancelled',
          cancellation_reason = ?, cancelled_by_user_id = ?, cancelled_at = ?,
          version = ?, updated_at = ?
      WHERE id = ?
    `).bind(reason, userId, now, newVersion, now, orderId).run();

    // Release table if order was dine-in
    if (order.table_id) {
      await env.DB.prepare(`
        UPDATE dining_tables SET status = 'available', current_order_id = NULL, updated_at = ?
        WHERE id = ?
      `).bind(now, order.table_id).run();
    }

    // Cancel all open kitchen tickets for this order
    await env.DB.prepare(`
      UPDATE kitchen_tickets SET status = 'cancelled', updated_at = ?
      WHERE order_id = ? AND status IN ('pending', 'preparing')
    `).bind(now, orderId).run();

    return Response.json({
      success: true,
      message: 'Order cancelled and table released',
      version: newVersion,
    });
  }

  if (nextStatus === 'completed') {
    await env.DB.prepare(`
      UPDATE synced_orders
      SET status = 'completed', version = ?, updated_at = ?
      WHERE id = ?
    `).bind(newVersion, now, orderId).run();

    // Release dining table
    if (order.table_id) {
      await env.DB.prepare(`
        UPDATE dining_tables SET status = 'available', current_order_id = NULL, updated_at = ?
        WHERE id = ?
      `).bind(now, order.table_id).run();
    }

    return Response.json({
      success: true,
      message: 'Order marked completed and table released',
      version: newVersion,
    });
  }

  // Fallback update
  await env.DB.prepare(`
    UPDATE synced_orders SET status = ?, version = ?, updated_at = ? WHERE id = ?
  `).bind(nextStatus, newVersion, now, orderId).run();

  return Response.json({ success: true, version: newVersion });
}

/**
 * Deprecated legacy payment endpoint.
 * Direct financial state mutation is strictly disabled to prevent ledger bypass.
 */
export async function handleUpdateOrderPayment(
  request: Request,
  env: Env,
  claims: any,
  orderId: string
): Promise<Response> {
  return Response.json({
    error: 'Deprecated: Direct payment status mutation is disabled. Use POST /api/orders/:id/payments to record an auditable payment transaction.',
    migration: 'POST /api/orders/:id/payments',
  }, { status: 410 });
}

/**
 * Retrieves all customer payment transactions for an order with reconciliation balance.
 */
export async function handleGetOrderPayments(
  request: Request,
  env: Env,
  claims: any,
  orderId: string
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;

  const order = await env.DB.prepare(`
    SELECT * FROM synced_orders WHERE id = ? AND organization_id = ?
  `).bind(orderId, orgId).first<any>();

  if (!order) {
    return Response.json({ error: 'Order not found' }, { status: 404 });
  }

  const memberships = await getUserMemberships(env.DB, orgId, userId);
  const authCheck = await isAuthorizedForBranch(env.DB, orgId, memberships, order.branch_id, [
    'owner',
    'manager',
    'cashier',
    'server',
    'waiter',
    'chef',
    'kitchen',
  ]);

  if (!authCheck.authorized) {
    return Response.json({ error: 'Forbidden: Insufficient privileges to view payments' }, { status: 403 });
  }

  const payments = await env.DB.prepare(`
    SELECT * FROM customer_payments WHERE order_id = ? ORDER BY created_at ASC
  `).bind(orderId).all<any>();

  const paymentList = payments.results || [];
  let grossPaid = 0;
  let totalRefunded = 0;

  for (const p of paymentList) {
    if (!p.parent_payment_id && Number(p.amount) > 0 && ['completed', 'refunded'].includes(p.status)) {
      grossPaid += Number(p.amount || 0);
      totalRefunded += Number(p.refunded_amount || 0);
    }
  }

  const netPaid = Math.round((grossPaid - totalRefunded) * 100) / 100;
  const grandTotal = Number(order.grand_total || 0);
  const outstandingBalance = Math.max(0, Math.round((grandTotal - netPaid) * 100) / 100);

  return Response.json({
    success: true,
    order_id: orderId,
    grand_total: grandTotal,
    total_paid: netPaid,
    total_refunded: totalRefunded,
    outstanding_balance: outstandingBalance,
    payment_status: order.payment_status,
    payments: paymentList,
  });
}

/**
 * Records an auditable customer payment or split tender.
 */
export async function handleRecordCustomerPayment(
  request: Request,
  env: Env,
  claims: any,
  orderId: string
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;

  const order = await env.DB.prepare(`
    SELECT * FROM synced_orders WHERE id = ? AND organization_id = ?
  `).bind(orderId, orgId).first<any>();

  if (!order) {
    return Response.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.status === 'cancelled' || order.payment_status === 'voided') {
    return Response.json({ error: 'Cannot record payment for a cancelled or voided order' }, { status: 400 });
  }

  const memberships = await getUserMemberships(env.DB, orgId, userId);
  const authCheck = await isAuthorizedForBranch(env.DB, orgId, memberships, order.branch_id, [
    'owner',
    'manager',
    'cashier',
  ]);

  if (!authCheck.authorized) {
    return Response.json({ error: 'Forbidden: Only cashiers or managers can record customer payments' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: 'Payment amount must be a positive number' }, { status: 400 });
  }

  const ALLOWED_METHODS = ['cash', 'upi', 'card', 'custom', 'razorpay_pos'];
  const paymentMethod = typeof body?.payment_method === 'string' && ALLOWED_METHODS.includes(body.payment_method)
    ? body.payment_method
    : 'cash';

  const idempotencyKey = (typeof body?.idempotency_key === 'string' && body.idempotency_key.trim())
    ? body.idempotency_key.trim()
    : request.headers.get('Idempotency-Key')?.trim() || null;

  // 1. Check idempotency & conflicting replays
  if (idempotencyKey) {
    const existing = await env.DB.prepare(`
      SELECT * FROM customer_payments WHERE branch_id = ? AND idempotency_key = ?
    `).bind(order.branch_id, idempotencyKey).first<any>();

    if (existing) {
      if (existing.order_id !== orderId || Math.abs(Number(existing.amount) - amount) > 0.001 || existing.payment_method !== paymentMethod) {
        return Response.json({
          error: `Conflict: Idempotency key "${idempotencyKey}" was previously used for a different payment (Order ${existing.order_id}, Method: ${existing.payment_method}, Amount: ${existing.amount})`,
        }, { status: 409 });
      }
      return Response.json({
        success: true,
        idempotent: true,
        message: 'Payment already processed with this idempotency key',
        payment: existing,
      }, { status: 200 });
    }
  }

  // 2. Reject spoofed client-controlled verification methods
  if (body?.verification_method === 'terminal_verified' || body?.verification_method === 'gateway_verified') {
    return Response.json({
      error: `Verification method "${body.verification_method}" cannot be asserted directly by the client without authoritative hardware terminal or payment gateway attestation. If direct hardware integration is not active, record as manual cashier confirmation.`,
    }, { status: 400 });
  }

  const extRef = typeof body?.external_reference_id === 'string' && body.external_reference_id.trim()
    ? body.external_reference_id.trim()
    : (typeof body?.reference_number === 'string' && body.reference_number.trim() ? body.reference_number.trim() : null);

  // Non-cash payments REQUIRE valid, genuine external transaction reference (UTR, terminal auth code)
  const BOGUS_REFS = ['123', 'test', 'null', 'na', 'none', 'dummy', '0000', '1111', 'fake', 'abc', 'xyz'];
  if (paymentMethod !== 'cash') {
    if (!extRef || extRef.length < 4 || BOGUS_REFS.includes(extRef.toLowerCase())) {
      return Response.json({
        error: `Invalid external_reference_id: "${extRef || ''}". A valid, documented transaction reference (UTR, terminal authorization code, or card receipt reference of at least 4 characters) is required for remote ${paymentMethod.toUpperCase()} payments.`,
      }, { status: 400 });
    }

    // Check duplicate transaction reference within this branch
    const existingRef = await env.DB.prepare(`
      SELECT id, order_id FROM customer_payments
      WHERE branch_id = ? AND payment_method = ? AND external_reference_id = ? AND status != 'failed'
    `).bind(order.branch_id, paymentMethod, extRef).first<{ id: string; order_id: string }>();

    if (existingRef) {
      return Response.json({
        error: `Duplicate payment reference: Transaction ${extRef} was already settled on payment ${existingRef.id} (Order ${existingRef.order_id})`,
      }, { status: 409 });
    }
  }

  // Calculate current paid balance (sum of un-refunded amounts on original tenders)
  const allPayments = await env.DB.prepare(`
    SELECT * FROM customer_payments WHERE order_id = ?
  `).bind(orderId).all<any>();

  let currentNetPaid = 0;
  for (const p of allPayments.results || []) {
    if (!p.parent_payment_id && Number(p.amount) > 0 && ['completed', 'refunded'].includes(p.status)) {
      currentNetPaid += (Number(p.amount || 0) - Number(p.refunded_amount || 0));
    }
  }
  currentNetPaid = Math.round(currentNetPaid * 100) / 100;

  const grandTotal = Number(order.grand_total || 0);
  const remainingBalance = Math.round((grandTotal - currentNetPaid) * 100) / 100;

  if (amount > remainingBalance + 0.05) {
    return Response.json({
      error: `Payment amount (${amount}) exceeds outstanding order balance (${remainingBalance})`,
    }, { status: 400 });
  }

  const paymentId = typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : `pay_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const isSplit = currentNetPaid > 0 ? 1 : 0;
  const verificationMethod = paymentMethod === 'cash' ? 'cashier_collected' : 'manual_cashier_confirmed';

  const newTotalPaid = Math.round((currentNetPaid + amount) * 100) / 100;
  const newOutstanding = Math.max(0, Math.round((grandTotal - newTotalPaid) * 100) / 100);
  const newPaymentStatus = newOutstanding <= 0.05 ? 'paid' : 'partially_paid';
  const newVersion = order.version + 1;

  // Atomic batch: payment insert + conditional order update with version check + optional table release
  const paymentBatch: any[] = [];

  paymentBatch.push(
    env.DB.prepare(`
      INSERT INTO customer_payments (
        id, organization_id, restaurant_id, branch_id, order_id, payment_method,
        amount, currency, status, verification_method, external_reference_id, cashier_user_id, cashier_name,
        terminal_id, idempotency_key, is_split, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'INR', 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      paymentId,
      orgId,
      order.restaurant_id,
      order.branch_id,
      orderId,
      paymentMethod,
      amount,
      verificationMethod,
      extRef,
      userId,
      claims.name || 'Cashier',
      body.terminal_id || null,
      idempotencyKey,
      isSplit,
      JSON.stringify(body.metadata || {}),
      now,
      now
    )
  );

  paymentBatch.push(
    env.DB.prepare(`
      UPDATE synced_orders
      SET payment_status = ?, payment_method = ?,
          version = (CASE WHEN version = ? THEN version + 1 ELSE json_extract('{', '$.concurrency_conflict') END),
          updated_at = ?
      WHERE id = ?
    `).bind(newPaymentStatus, paymentMethod, order.version, now, orderId)
  );

  if (newPaymentStatus === 'paid' && order.table_id && order.status === 'completed') {
    paymentBatch.push(
      env.DB.prepare(`
        UPDATE dining_tables SET status = 'available', current_order_id = NULL, updated_at = ?
        WHERE id = ?
      `).bind(now, order.table_id)
    );
  }

  try {
    await env.DB.batch(paymentBatch);
  } catch (err: any) {
    if (err?.message?.includes('JSON') || err?.message?.includes('concurrency_conflict')) {
      return Response.json({
        error: `Conflict: Order was modified concurrently during payment processing. Expected version ${order.version}`,
      }, { status: 409 });
    }
    throw err;
  }

  return Response.json({
    success: true,
    message: 'Customer payment successfully recorded',
    payment: {
      id: paymentId,
      order_id: orderId,
      amount,
      payment_method: paymentMethod,
      verification_method: verificationMethod,
      external_reference_id: extRef,
      cashier_id: userId,
      cashier_name: claims.name || 'Cashier',
      status: 'completed',
      created_at: now,
    },
    total_paid: newTotalPaid,
    outstanding_balance: newOutstanding,
    order_payment_status: newPaymentStatus,
    order_version: newVersion,
  }, { status: 201 });
}

/**
 * Processes an auditable refund against an original customer payment transaction.
 */
export async function handleRefundCustomerPayment(
  request: Request,
  env: Env,
  claims: any,
  orderId: string,
  paymentId: string
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;

  const order = await env.DB.prepare(`
    SELECT * FROM synced_orders WHERE id = ? AND organization_id = ?
  `).bind(orderId, orgId).first<any>();

  if (!order) {
    return Response.json({ error: 'Order not found' }, { status: 404 });
  }

  const memberships = await getUserMemberships(env.DB, orgId, userId);
  const authCheck = await isAuthorizedForBranch(env.DB, orgId, memberships, order.branch_id, [
    'owner',
    'manager',
    'cashier',
  ]);

  if (!authCheck.authorized) {
    return Response.json({ error: 'Forbidden: Insufficient privileges to issue refunds' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const idempotencyKey = (typeof body?.idempotency_key === 'string' && body.idempotency_key.trim())
    ? body.idempotency_key.trim()
    : request.headers.get('Idempotency-Key')?.trim() || null;

  // 1. Replay check: Immediately return existing record if already processed
  if (idempotencyKey) {
    const existingRefund = await env.DB.prepare(`
      SELECT * FROM customer_payments WHERE branch_id = ? AND idempotency_key = ?
    `).bind(order.branch_id, idempotencyKey).first<any>();

    if (existingRefund) {
      const requestedAmt = typeof body?.amount === 'number' && body.amount > 0 ? Number(body.amount) : null;
      if (existingRefund.order_id !== orderId || existingRefund.parent_payment_id !== paymentId || (requestedAmt !== null && Math.abs(Math.abs(Number(existingRefund.amount)) - requestedAmt) > 0.001)) {
        return Response.json({
          error: `Conflict: Idempotency key "${idempotencyKey}" was previously used for a different refund (Order ${existingRefund.order_id}, Target: ${existingRefund.parent_payment_id}, Amount: ${Math.abs(Number(existingRefund.amount))})`,
        }, { status: 409 });
      }
      return Response.json({
        success: true,
        idempotent: true,
        is_idempotent_replay: true,
        message: 'Refund already processed with this idempotency key',
        refund: existingRefund,
        refunded_amount: Math.abs(Number(existingRefund.amount)),
      }, { status: 200 });
    }
  }

  const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim() : '';
  if (!reason) {
    return Response.json({ error: 'A valid reason is required for auditable refunds' }, { status: 400 });
  }

  const originalPayment = await env.DB.prepare(`
    SELECT * FROM customer_payments WHERE id = ? AND order_id = ? AND organization_id = ?
  `).bind(paymentId, orderId, orgId).first<any>();

  if (!originalPayment || (originalPayment.status !== 'completed' && originalPayment.status !== 'refunded')) {
    return Response.json({ error: 'Original payment transaction not found' }, { status: 404 });
  }

  const maxRefundable = Math.round((Number(originalPayment.amount) - Number(originalPayment.refunded_amount || 0)) * 100) / 100;
  const refundAmount = typeof body?.amount === 'number' && body.amount > 0 ? Number(body.amount) : maxRefundable;

  if (refundAmount <= 0 || refundAmount > maxRefundable) {
    return Response.json({
      error: `Refund amount (${refundAmount}) exceeds maximum refundable amount (${maxRefundable}) for this payment`,
    }, { status: 400 });
  }

  const userRole = memberships.find((m) => m.branch_id === order.branch_id)?.role
    || memberships.find((m) => m.restaurant_id === order.restaurant_id)?.role
    || memberships.find((m) => !m.restaurant_id && !m.branch_id)?.role
    || 'cashier';

  const refundType = ['owner', 'manager'].includes(userRole)
    ? 'manual_manager_refund'
    : 'manual_cashier_refund';

  const now = new Date().toISOString();
  const refundId = `ref_${crypto.randomUUID()}`;

  // Calculate new payment status after this refund
  const allPayments = await env.DB.prepare(`
    SELECT * FROM customer_payments WHERE order_id = ?
  `).bind(orderId).all<any>();

  let newNetPaid = 0;
  for (const p of allPayments.results || []) {
    if (!p.parent_payment_id && Number(p.amount) > 0 && ['completed', 'refunded'].includes(p.status)) {
      const pRefunded = p.id === paymentId ? (Number(p.refunded_amount || 0) + refundAmount) : Number(p.refunded_amount || 0);
      newNetPaid += (Number(p.amount || 0) - pRefunded);
    }
  }
  newNetPaid = Math.round(newNetPaid * 100) / 100;

  const grandTotal = Number(order.grand_total || 0);
  let newOrderStatus = 'unpaid';
  if (newNetPaid >= grandTotal - 0.05 && newNetPaid > 0) {
    newOrderStatus = 'paid';
  } else if (newNetPaid > 0) {
    newOrderStatus = 'partially_paid';
  } else if (newNetPaid <= 0) {
    newOrderStatus = 'refunded';
  }

  const newVersion = order.version + 1;
  const refundBatch: any[] = [];

  // 1. Guard against concurrent over-refund of original payment
  refundBatch.push(
    env.DB.prepare(`
      UPDATE customer_payments
      SET refunded_amount = (CASE WHEN (amount - refunded_amount) >= ? THEN refunded_amount + ? ELSE json_extract('{', '$.refund_limit_exceeded') END),
          status = (CASE WHEN (refunded_amount + ?) >= amount THEN 'refunded' ELSE 'completed' END),
          updated_at = ?
      WHERE id = ?
    `).bind(refundAmount, refundAmount, refundAmount, now, paymentId)
  );

  // 2. Insert refund ledger record
  refundBatch.push(
    env.DB.prepare(`
      INSERT INTO customer_payments (
        id, organization_id, restaurant_id, branch_id, order_id, payment_method,
        amount, currency, status, verification_method, external_reference_id, cashier_user_id, cashier_name,
        idempotency_key, parent_payment_id, refund_reason, refund_type, is_split, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'INR', 'refunded', 'cashier_collected', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).bind(
      refundId,
      orgId,
      order.restaurant_id,
      order.branch_id,
      orderId,
      originalPayment.payment_method,
      -refundAmount,
      `REFUND_${paymentId}`,
      userId,
      claims.name || 'Cashier',
      idempotencyKey,
      paymentId,
      reason,
      refundType,
      now,
      now
    )
  );

  // 3. Conditional order payment status and version update
  refundBatch.push(
    env.DB.prepare(`
      UPDATE synced_orders
      SET payment_status = ?,
          version = (CASE WHEN version = ? THEN version + 1 ELSE json_extract('{', '$.concurrency_conflict') END),
          updated_at = ?
      WHERE id = ?
    `).bind(newOrderStatus, order.version, now, orderId)
  );

  try {
    await env.DB.batch(refundBatch);
  } catch (err: any) {
    if (err?.message?.includes('refund_limit_exceeded')) {
      return Response.json({
        error: `Conflict: Concurrent refund exceeded the available refundable balance of payment ${paymentId}`,
      }, { status: 409 });
    }
    if (err?.message?.includes('concurrency_conflict') || err?.message?.includes('JSON')) {
      return Response.json({
        error: `Conflict: Order was modified concurrently during refund processing. Expected version ${order.version}`,
      }, { status: 409 });
    }
    throw err;
  }

  return Response.json({
    success: true,
    message: 'Refund successfully recorded',
    refunded_amount: refundAmount,
    refund: {
      id: refundId,
      parent_payment_id: paymentId,
      amount: refundAmount,
      refunded_amount: refundAmount,
      refund_type: refundType,
      reason,
      created_at: now,
    },
    order_payment_status: newOrderStatus,
    order_version: newVersion,
  });
}

// ── 2. Dining Tables Management ──────────────────────────────────────────────

/**
 * Lists physical tables for an authorized branch with live occupancy status.
 */
export async function handleListTables(
  request: Request,
  env: Env,
  claims: any,
  url: URL
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;
  const branchId = url.searchParams.get('branch_id');

  if (!branchId) {
    return Response.json({ error: 'branch_id query parameter is required' }, { status: 400 });
  }

  const memberships = await getUserMemberships(env.DB, orgId, userId);
  const authCheck = await isAuthorizedForBranch(env.DB, orgId, memberships, branchId, [
    'owner',
    'manager',
    'cashier',
    'server',
    'chef',
  ]);

  if (!authCheck.authorized) {
    return Response.json({ error: 'Forbidden: Insufficient privileges for this branch' }, { status: 403 });
  }

  const tablesResult = await env.DB.prepare(`
    SELECT t.*, o.order_number, o.grand_total as current_order_total, o.kitchen_status as current_order_kitchen_status
    FROM dining_tables t
    LEFT JOIN synced_orders o ON t.current_order_id = o.id
    WHERE t.organization_id = ? AND t.branch_id = ? AND t.is_active = 1
    ORDER BY t.table_number ASC
  `).bind(orgId, branchId).all();

  return Response.json({ tables: tablesResult.results || [] });
}

/**
 * Creates a new physical dining table (Owners & Managers only).
 */
export async function handleCreateTable(
  request: Request,
  env: Env,
  claims: any
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const branchId = typeof body?.branch_id === 'string' ? body.branch_id.trim() : '';
  const tableNumber = typeof body?.table_number === 'string' && body.table_number.trim()
    ? body.table_number.trim()
    : (typeof body?.name === 'string' ? body.name.trim() : '');

  if (!branchId || !tableNumber) {
    return Response.json({ error: 'branch_id and table_number are required' }, { status: 400 });
  }

  const memberships = await getUserMemberships(env.DB, orgId, userId);
  const authCheck = await isAuthorizedForBranch(env.DB, orgId, memberships, branchId, [
    'owner',
    'manager',
  ]);

  if (!authCheck.authorized) {
    return Response.json({ error: 'Forbidden: Only owners and managers can configure dining tables' }, { status: 403 });
  }

  const branch = await env.DB.prepare('SELECT restaurant_id FROM branches WHERE id = ? AND organization_id = ?')
    .bind(branchId, orgId).first<{ restaurant_id: string | null }>();

  if (!branch) {
    return Response.json({ error: 'Branch does not exist in this organization' }, { status: 404 });
  }

  const tableId = body.id || crypto.randomUUID();
  const capacity = typeof body.capacity === 'number' ? body.capacity : 4;
  const floor = typeof body.floor === 'string' ? body.floor.trim() : 'Ground';
  const section = typeof body.section === 'string' ? body.section.trim() : 'Main';
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(`
      INSERT INTO dining_tables (
        id, organization_id, restaurant_id, branch_id, table_number, capacity,
        status, floor, section, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?, 1, ?, ?)
    `).bind(tableId, orgId, branch.restaurant_id, branchId, tableNumber, capacity, floor, section, now, now).run();
  } catch (err: any) {
    if (err?.message && err.message.includes('UNIQUE')) {
      return Response.json({ error: `Table number '${tableNumber}' already exists at this branch` }, { status: 409 });
    }
    throw err;
  }

  return Response.json({
    success: true,
    table: {
      id: tableId,
      branch_id: branchId,
      table_number: tableNumber,
      capacity,
      status: 'available',
      floor,
      section,
    },
  }, { status: 201 });
}

/**
 * Updates dining table status (available, occupied, reserved, cleaning) or associates an order.
 */
export async function handleUpdateTableStatus(
  request: Request,
  env: Env,
  claims: any,
  tableId: string
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;

  const table = await env.DB.prepare(`
    SELECT * FROM dining_tables WHERE id = ? AND organization_id = ?
  `).bind(tableId, orgId).first<any>();

  if (!table) {
    return Response.json({ error: 'Table not found' }, { status: 404 });
  }

  const memberships = await getUserMemberships(env.DB, orgId, userId);
  const authCheck = await isAuthorizedForBranch(env.DB, orgId, memberships, table.branch_id, [
    'owner',
    'manager',
    'cashier',
    'server',
    'waiter',
  ]);

  if (!authCheck.authorized) {
    return Response.json({ error: 'Forbidden: Insufficient privileges for this branch' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const nextStatus = typeof body?.status === 'string' ? body.status.trim() : table.status;
  const currentOrderId = body.current_order_id !== undefined ? body.current_order_id : table.current_order_id;
  const now = new Date().toISOString();

  await env.DB.prepare(`
    UPDATE dining_tables SET status = ?, current_order_id = ?, updated_at = ? WHERE id = ?
  `).bind(nextStatus, currentOrderId || null, now, tableId).run();

  return Response.json({
    success: true,
    table: {
      id: tableId,
      status: nextStatus,
      current_order_id: currentOrderId,
      updated_at: now,
    },
  });
}

// ── 3. Kitchen Display Tickets ───────────────────────────────────────────────

/**
 * Retrieves the active kitchen display ticket queue for an authorized branch/station.
 */
export async function handleListKitchenTickets(
  request: Request,
  env: Env,
  claims: any,
  url: URL
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;
  const branchId = url.searchParams.get('branch_id');

  if (!branchId) {
    return Response.json({ error: 'branch_id query parameter is required' }, { status: 400 });
  }

  const memberships = await getUserMemberships(env.DB, orgId, userId);
  const authCheck = await isAuthorizedForBranch(env.DB, orgId, memberships, branchId, [
    'owner',
    'manager',
    'chef',
    'kitchen',
    'cashier',
    'server',
    'waiter',
  ]);

  if (!authCheck.authorized) {
    return Response.json({ error: 'Forbidden: Insufficient privileges for this branch' }, { status: 403 });
  }

  const station = url.searchParams.get('station');
  const statusFilter = url.searchParams.get('status');

  let query = `
    SELECT k.*, o.order_number, o.order_type, o.table_number, o.customer_name
    FROM kitchen_tickets k
    JOIN synced_orders o ON k.order_id = o.id
    WHERE k.organization_id = ? AND k.branch_id = ?
  `;
  const binds: any[] = [orgId, branchId];

  if (station) {
    query += ` AND k.station = ?`;
    binds.push(station);
  }

  if (statusFilter) {
    if (statusFilter === 'active') {
      query += ` AND k.status IN ('pending', 'preparing')`;
    } else {
      query += ` AND k.status = ?`;
      binds.push(statusFilter);
    }
  } else {
    // Default active queue: exclude completed and cancelled tickets
    query += ` AND k.status IN ('pending', 'preparing', 'ready')`;
  }

  query += ` ORDER BY k.created_at ASC`;

  const result = await env.DB.prepare(query).bind(...binds).all();
  const tickets = (result.results || []).map((t: any) => ({
    ...t,
    items: safeParseJson(t.items_json, []),
  }));

  return Response.json({ tickets });
}

/**
 * Transitions kitchen ticket status (preparing, ready, completed) and synchronizes parent order.
 */
export async function handleUpdateKitchenTicketStatus(
  request: Request,
  env: Env,
  claims: any,
  ticketId: string
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;

  const ticket = await env.DB.prepare(`
    SELECT * FROM kitchen_tickets WHERE id = ? AND organization_id = ?
  `).bind(ticketId, orgId).first<any>();

  if (!ticket) {
    return Response.json({ error: 'Kitchen ticket not found' }, { status: 404 });
  }

  const memberships = await getUserMemberships(env.DB, orgId, userId);
  const authCheck = await isAuthorizedForBranch(env.DB, orgId, memberships, ticket.branch_id, [
    'owner',
    'manager',
    'chef',
    'kitchen',
    'cashier',
  ]);

  if (!authCheck.authorized) {
    return Response.json({ error: 'Forbidden: Insufficient privileges to update kitchen tickets' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const nextStatus = typeof body?.status === 'string' ? body.status.trim() : '';
  const ALLOWED = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
  if (!ALLOWED.includes(nextStatus)) {
    return Response.json({ error: `Invalid ticket status. Must be one of: ${ALLOWED.join(', ')}` }, { status: 400 });
  }

  const now = new Date().toISOString();
  let startedAt = ticket.started_at;
  let readyAt = ticket.ready_at;
  let completedAt = ticket.completed_at;

  if (nextStatus === 'preparing' && !startedAt) startedAt = now;
  if (nextStatus === 'ready' && !readyAt) readyAt = now;
  if (nextStatus === 'completed' && !completedAt) completedAt = now;

  await env.DB.prepare(`
    UPDATE kitchen_tickets
    SET status = ?, started_at = ?, ready_at = ?, completed_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(nextStatus, startedAt, readyAt, completedAt, now, ticketId).run();

  // Synchronize order kitchen_status
  let parentKitchenStatus: string | null = null;
  if (nextStatus === 'preparing') parentKitchenStatus = 'preparing';
  else if (nextStatus === 'ready') parentKitchenStatus = 'ready';
  else if (nextStatus === 'completed') parentKitchenStatus = 'served';

  if (parentKitchenStatus) {
    await env.DB.prepare(`
      UPDATE synced_orders
      SET kitchen_status = ?, updated_at = ?
      WHERE id = ?
    `).bind(parentKitchenStatus, now, ticket.order_id).run();
  }

  return Response.json({
    success: true,
    ticket: {
      id: ticketId,
      status: nextStatus,
      started_at: startedAt,
      ready_at: readyAt,
      completed_at: completedAt,
      updated_at: now,
    },
    parent_order_kitchen_status: parentKitchenStatus,
  });
}
