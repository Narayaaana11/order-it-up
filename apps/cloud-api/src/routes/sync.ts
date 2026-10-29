import { hashString } from '../auth';
import { BatchSyncEvent, BatchSyncResponse } from '../../../../shared/cloud-types';
import { Env } from './pairing';
import { checkRateLimit, createRateLimitResponse, DEFAULT_RATE_LIMITS, getEffectiveLimit } from '../rate-limit';

export const MAX_SYNC_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2MB
export const MAX_EVENTS_PER_BATCH = 250;
export const MAX_MONETARY_VALUE = 100_000_000; // 100 million maximum to prevent overflow
export const MAX_ITEM_QUANTITY = 10_000;
export const MAX_ITEMS_PER_ORDER = 250;

/**
 * Rounds a monetary or quantity value to 2 decimal places.
 */
function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Validates that a numeric value is finite, not NaN, and non-negative.
 */
function isNonNegativeFinite(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && !Number.isNaN(val) && val >= 0;
}

/**
 * Validates that a numeric value is finite, not NaN, and strictly positive.
 */
function isPositiveFinite(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && !Number.isNaN(val) && val > 0;
}

/**
 * Validates that a timestamp is a valid ISO string, not in the distant future, and not before 2020.
 */
function isValidBusinessTimestamp(val: unknown): boolean {
  if (typeof val !== 'string' || !val.trim()) return false;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return false;
  // Maximum 24 hours in the future to account for reasonable timezone/clock skew
  const maxFuture = Date.now() + 86_400_000;
  if (d.getTime() > maxFuture) return false;
  if (d.getUTCFullYear() < 2020) return false;
  return true;
}

/**
 * Validates financial and structural rules for an incoming order payload.
 */
function validateOrderFinancials(payload: any): { valid: boolean; error?: string } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Order payload must be an object' };
  }

  if (typeof payload.id !== 'string' || !payload.id.trim() || payload.id.length > 128) {
    return { valid: false, error: 'Order id is missing, invalid, or exceeds 128 characters' };
  }

  const subtotal = payload.subtotal !== undefined ? payload.subtotal : 0;
  const taxTotal = payload.tax_total !== undefined ? payload.tax_total : (payload.tax !== undefined ? payload.tax : 0);
  const discountTotal = payload.discount_total !== undefined ? payload.discount_total : (payload.discount !== undefined ? payload.discount : 0);
  const grandTotal = payload.grand_total !== undefined ? payload.grand_total : (payload.total !== undefined ? payload.total : 0);

  if (!isNonNegativeFinite(subtotal)) {
    return { valid: false, error: `Invalid order subtotal: must be a non-negative finite number (got ${subtotal})` };
  }
  if (!isNonNegativeFinite(taxTotal)) {
    return { valid: false, error: `Invalid order tax_total: must be a non-negative finite number (got ${taxTotal})` };
  }
  if (!isNonNegativeFinite(discountTotal)) {
    return { valid: false, error: `Invalid order discount_total: must be a non-negative finite number (got ${discountTotal})` };
  }
  if (!isNonNegativeFinite(grandTotal)) {
    return { valid: false, error: `Invalid order grand_total: must be a non-negative finite number (got ${grandTotal})` };
  }

  if (grandTotal > MAX_MONETARY_VALUE || subtotal > MAX_MONETARY_VALUE) {
    return { valid: false, error: `Order total exceeds maximum allowable limit of ${MAX_MONETARY_VALUE}` };
  }

  // Financial consistency check: grand_total == subtotal - discount_total + tax_total (+/- 0.10 tolerance)
  const expectedGrand = round2(subtotal - discountTotal + taxTotal);
  if (Math.abs(grandTotal - expectedGrand) > 0.10) {
    return {
      valid: false,
      error: `Financial calculation mismatch: grand_total (${grandTotal}) does not match subtotal (${subtotal}) - discount (${discountTotal}) + tax (${taxTotal}) = ${expectedGrand}`,
    };
  }

  // Validate items if provided
  if (Array.isArray(payload.items)) {
    if (payload.items.length > MAX_ITEMS_PER_ORDER) {
      return { valid: false, error: `Order items count (${payload.items.length}) exceeds maximum limit of ${MAX_ITEMS_PER_ORDER}` };
    }

    let calculatedItemsSum = 0;
    for (let idx = 0; idx < payload.items.length; idx++) {
      const item = payload.items[idx];
      if (!item || typeof item !== 'object') {
        return { valid: false, error: `Order item at index ${idx} must be an object` };
      }

      const qty = item.quantity !== undefined ? item.quantity : 1;
      const unitPrice = item.price !== undefined ? item.price : (item.unit_price !== undefined ? item.unit_price : 0);
      const itemSubtotal = item.subtotal !== undefined ? item.subtotal : (qty * unitPrice);

      if (!isPositiveFinite(qty) || qty > MAX_ITEM_QUANTITY) {
        return { valid: false, error: `Item ${idx} quantity (${qty}) must be a positive finite number <= ${MAX_ITEM_QUANTITY}` };
      }
      if (!isNonNegativeFinite(unitPrice) || unitPrice > MAX_MONETARY_VALUE) {
        return { valid: false, error: `Item ${idx} unit price (${unitPrice}) must be non-negative and <= ${MAX_MONETARY_VALUE}` };
      }
      if (!isNonNegativeFinite(itemSubtotal) || itemSubtotal > MAX_MONETARY_VALUE) {
        return { valid: false, error: `Item ${idx} subtotal (${itemSubtotal}) must be non-negative and <= ${MAX_MONETARY_VALUE}` };
      }

      const expectedItemSubtotal = round2(qty * unitPrice);
      if (Math.abs(itemSubtotal - expectedItemSubtotal) > 0.10) {
        return {
          valid: false,
          error: `Item ${idx} subtotal mismatch: item subtotal (${itemSubtotal}) does not equal quantity (${qty}) * unit_price (${unitPrice}) = ${expectedItemSubtotal}`,
        };
      }

      calculatedItemsSum += itemSubtotal;
    }

    // If order has items and subtotal > 0, items sum must balance to order subtotal (+/- 0.20 tolerance)
    if (payload.items.length > 0 && subtotal > 0 && Math.abs(subtotal - calculatedItemsSum) > 0.20) {
      return {
        valid: false,
        error: `Order subtotal (${subtotal}) does not match sum of item subtotals (${round2(calculatedItemsSum)})`,
      };
    }
  }

  // Timestamp check
  const orderedAt = payload.ordered_at || payload.created_at;
  if (orderedAt && !isValidBusinessTimestamp(orderedAt)) {
    return { valid: false, error: `Invalid ordered_at timestamp: must be valid ISO timestamp between 2020 and present (${orderedAt})` };
  }

  return { valid: true };
}

/**
 * Validates financial and structural rules for an incoming cash closure payload.
 */
function validateClosureFinancials(closure: any): { valid: boolean; error?: string } {
  if (!closure || typeof closure !== 'object') {
    return { valid: false, error: 'Closure payload must be an object' };
  }

  if (typeof closure.id !== 'string' || !closure.id.trim() || closure.id.length > 128) {
    return { valid: false, error: 'Closure id is missing, invalid, or exceeds 128 characters' };
  }

  const openingCash = closure.opening_cash !== undefined ? closure.opening_cash : 0;
  const cashSales = closure.cash_sales !== undefined ? closure.cash_sales : 0;
  const cardSales = closure.card_sales !== undefined ? closure.card_sales : 0;
  const upiSales = closure.upi_sales !== undefined ? closure.upi_sales : 0;
  const otherSales = closure.other_sales !== undefined ? closure.other_sales : 0;
  const expectedCash = closure.expected_cash !== undefined ? closure.expected_cash : (openingCash + cashSales);
  const actualCash = closure.actual_cash !== undefined ? closure.actual_cash : 0;
  const variance = closure.variance !== undefined ? closure.variance : (actualCash - expectedCash);

  if (!isNonNegativeFinite(openingCash)) return { valid: false, error: 'Invalid opening_cash' };
  if (!isNonNegativeFinite(cashSales)) return { valid: false, error: 'Invalid cash_sales' };
  if (!isNonNegativeFinite(cardSales)) return { valid: false, error: 'Invalid card_sales' };
  if (!isNonNegativeFinite(upiSales)) return { valid: false, error: 'Invalid upi_sales' };
  if (!isNonNegativeFinite(otherSales)) return { valid: false, error: 'Invalid other_sales' };
  if (!isNonNegativeFinite(expectedCash)) return { valid: false, error: 'Invalid expected_cash' };
  if (!isNonNegativeFinite(actualCash)) return { valid: false, error: 'Invalid actual_cash' };

  // Variance can be negative (shortage) or positive (overage), but must be finite
  if (typeof variance !== 'number' || !Number.isFinite(variance) || Number.isNaN(variance)) {
    return { valid: false, error: 'Variance must be a finite number' };
  }

  // Math check: expected_cash == opening_cash + cash_sales (+/- 0.10 tolerance)
  const calculatedExpected = round2(openingCash + cashSales);
  if (Math.abs(expectedCash - calculatedExpected) > 0.10) {
    return {
      valid: false,
      error: `Expected cash mismatch: expected_cash (${expectedCash}) does not match opening_cash (${openingCash}) + cash_sales (${cashSales}) = ${calculatedExpected}`,
    };
  }

  // Math check: variance == actual_cash - expected_cash (+/- 0.10 tolerance)
  const calculatedVariance = round2(actualCash - expectedCash);
  if (Math.abs(variance - calculatedVariance) > 0.10) {
    return {
      valid: false,
      error: `Cash variance mismatch: variance (${variance}) does not match actual_cash (${actualCash}) - expected_cash (${expectedCash}) = ${calculatedVariance}`,
    };
  }

  return { valid: true };
}

/**
 * Executes a list of statements atomically. Uses D1 batch() if available,
 * or executes each statement in sequence.
 */
async function executeBatch(db: any, statements: any[]): Promise<void> {
  if (typeof db.batch === 'function') {
    await db.batch(statements);
  } else {
    for (const stmt of statements) {
      await stmt.run();
    }
  }
}

/**
 * Main ingestion handler for POS batches.
 */
export async function handleIngestSyncEvents(request: Request, env: Env): Promise<Response> {
  // 1. Enforce payload size limit (max 2MB)
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_SYNC_PAYLOAD_BYTES) {
    return Response.json({ error: 'Payload exceeds 2MB limit' }, { status: 413 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON sync payload' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || !Array.isArray(body.events)) {
    return Response.json({ error: 'events array is required' }, { status: 400 });
  }

  // 2. Validate event batch size limit
  if (body.events.length > MAX_EVENTS_PER_BATCH) {
    return Response.json({
      error: `Batch event count (${body.events.length}) exceeds maximum limit of ${MAX_EVENTS_PER_BATCH}`,
    }, { status: 413 });
  }

  // 3. Authenticate POS Terminal exclusively via cryptographic token
  const authHeader = request.headers.get('Authorization') || '';
  const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  let tokenHash: string | null = null;
  if (rawToken) {
    tokenHash = await hashString(rawToken);
  } else if (body?.pos_hash && typeof body.pos_hash === 'string' && body.pos_hash.trim()) {
    // When pos_hash is transmitted as the terminal device secret, hash it
    tokenHash = await hashString(body.pos_hash.trim());
  }

  if (!tokenHash) {
    return Response.json({ error: 'Unauthorized: valid terminal device token required' }, { status: 401 });
  }

  const terminal = await env.DB.prepare(`
    SELECT
      t.id,
      t.organization_id,
      t.branch_id,
      COALESCE(t.status, 'active') as terminal_status,
      COALESCE(b.status, 'active') as branch_status
    FROM terminals t
    JOIN branches b ON t.branch_id = b.id AND t.organization_id = b.organization_id
    WHERE t.terminal_token_hash = ?
  `).bind(tokenHash).first<{
    id: string;
    organization_id: string;
    branch_id: string;
    terminal_status: string;
    branch_status: string;
  }>();

  if (!terminal) {
    return Response.json({ error: 'Unauthorized: valid terminal device token required' }, { status: 401 });
  }

  // Reject revoked or disabled terminal device credentials
  if (terminal.terminal_status !== 'active') {
    return Response.json({ error: 'Forbidden: terminal device has been revoked or disabled' }, { status: 403 });
  }

  // Reject terminals whose parent branch has been deactivated
  if (terminal.branch_status !== 'active') {
    return Response.json({ error: 'Forbidden: terminal branch is inactive' }, { status: 403 });
  }

  // 4. Rate Limit Event Sync by Terminal (allows offline burst catch-up up to 120 req/min)
  const syncLimit = await checkRateLimit(env.DB, {
    keyPrefix: 'pos_sync_terminal',
    identifier: terminal.id,
    limit: getEffectiveLimit(env.RATE_LIMIT_SYNC_EVENTS_TERMINAL, DEFAULT_RATE_LIMITS.SYNC_EVENTS_TERMINAL.limit),
    windowSeconds: DEFAULT_RATE_LIMITS.SYNC_EVENTS_TERMINAL.windowSeconds,
  });
  if (!syncLimit.allowed) {
    return createRateLimitResponse(syncLimit);
  }

  const events: BatchSyncEvent[] = body.events;
  const processedIds: string[] = [];
  const now = new Date().toISOString();

  // 5. Update terminal heartbeat
  await env.DB.prepare('UPDATE terminals SET last_seen_at = ? WHERE id = ?')
    .bind(now, terminal.id).run();

  // 6. Process events atomically with idempotency and financial validation
  for (const event of events) {
    try {
      if (!event || typeof event !== 'object' || typeof event.id !== 'string' || !event.id.trim() || typeof event.type !== 'string') {
        continue;
      }

      // 6a. Compute deterministic payload hash for idempotency and conflict detection
      const canonicalPayloadStr = JSON.stringify(event.payload || {});
      const payloadHash = await hashString(canonicalPayloadStr);

      // 6b. Check existing event in sync_events table
      const existingEvent = await env.DB.prepare(`
        SELECT organization_id, branch_id, payload_hash, status
        FROM sync_events
        WHERE id = ?
      `).bind(event.id).first<{
        organization_id: string;
        branch_id: string;
        payload_hash: string;
        status: string;
      }>();

      if (existingEvent) {
        // Cross-tenant event collision denial
        if (existingEvent.organization_id !== terminal.organization_id) {
          console.warn(`[SyncSecurity] Cross-tenant event collision attempt for event ${event.id}`);
          continue;
        }

        // Exact match -> Legitimate idempotent retry after timeout / disconnect
        if (existingEvent.payload_hash === payloadHash) {
          processedIds.push(event.id);
          continue;
        }

        // Mismatched hash -> Event ID conflict (same ID reused with conflicting payload)
        console.warn(`[SyncSecurity] Event ID conflict: event ${event.id} was previously ingested with a different payload`);
        continue;
      }

      // 6c. Process Order Events
      if (event.type.startsWith('order.')) {
        const payload = event.payload as any;
        const validation = validateOrderFinancials(payload);
        if (!validation.valid) {
          console.warn(`[SyncValidation] Order event ${event.id} rejected: ${validation.error}`);
          continue;
        }

        // Cross-tenant order overwrite prevention:
        // If order already exists in database, verify it belongs strictly to this tenant and branch
        const existingOrder = await env.DB.prepare(`
          SELECT organization_id, branch_id FROM synced_orders WHERE id = ?
        `).bind(payload.id).first<{ organization_id: string; branch_id: string }>();

        if (existingOrder) {
          if (existingOrder.organization_id !== terminal.organization_id || existingOrder.branch_id !== terminal.branch_id) {
            console.warn(`[SyncSecurity] Unauthorized cross-tenant order update attempt on order ${payload.id}`);
            continue;
          }
        }

        const subtotal = payload.subtotal || 0;
        const taxTotal = payload.tax_total !== undefined ? payload.tax_total : (payload.tax || 0);
        const discountTotal = payload.discount_total !== undefined ? payload.discount_total : (payload.discount || 0);
        const grandTotal = payload.grand_total !== undefined ? payload.grand_total : (payload.total || 0);
        const orderedAt = payload.ordered_at || payload.created_at || now;

        const eventStatements: any[] = [];

        // 1. Durably record event idempotency record
        eventStatements.push(env.DB.prepare(`
          INSERT INTO sync_events (
            id, organization_id, branch_id, terminal_id, event_type,
            entity_type, entity_id, payload_hash, status, processed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          event.id,
          terminal.organization_id,
          terminal.branch_id,
          terminal.id,
          event.type,
          'order',
          payload.id,
          payloadHash,
          'processed',
          now
        ));

        // 2. Upsert order with strict tenant condition
        eventStatements.push(env.DB.prepare(`
          INSERT INTO synced_orders (
            id, organization_id, branch_id, terminal_id, order_number, order_type,
            status, subtotal, tax_total, discount_total, grand_total, payment_method,
            ordered_at, synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            subtotal = excluded.subtotal,
            tax_total = excluded.tax_total,
            discount_total = excluded.discount_total,
            grand_total = excluded.grand_total,
            payment_method = excluded.payment_method,
            synced_at = excluded.synced_at
          WHERE synced_orders.organization_id = excluded.organization_id
            AND synced_orders.branch_id = excluded.branch_id
        `).bind(
          payload.id,
          terminal.organization_id,
          terminal.branch_id,
          terminal.id,
          payload.order_number || payload.daily_order_number || 'ORD',
          payload.order_type || 'dine_in',
          payload.status || 'completed',
          subtotal,
          taxTotal,
          discountTotal,
          grandTotal,
          payload.payment_method || 'cash',
          orderedAt,
          now
        ));

        // 3. Upsert order items
        if (Array.isArray(payload.items)) {
          for (const item of payload.items) {
            const itemId = item.id || `${payload.id}_${item.product_id || item.name || 'item'}_${item.quantity}`;
            const itemQty = item.quantity || 1;
            const itemPrice = item.price !== undefined ? item.price : (item.unit_price || 0);
            const itemSub = item.subtotal !== undefined ? item.subtotal : (itemQty * itemPrice);

            eventStatements.push(env.DB.prepare(`
              INSERT INTO synced_order_items (
                id, order_id, branch_id, product_id, product_name,
                quantity, unit_price, subtotal, tax_amount, discount_amount, ordered_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                quantity = excluded.quantity,
                subtotal = excluded.subtotal
            `).bind(
              itemId,
              payload.id,
              terminal.branch_id,
              item.product_id || null,
              item.name || item.product_name || 'Item',
              itemQty,
              itemPrice,
              itemSub,
              item.tax_amount || 0,
              item.discount_amount || 0,
              orderedAt
            ));
          }
        }

        // Execute all writes for this event atomically
        await executeBatch(env.DB, eventStatements);
        processedIds.push(event.id);

      } else if (event.type === 'closure.recorded') {
        const closure = event.payload as any;
        const validation = validateClosureFinancials(closure);
        if (!validation.valid) {
          console.warn(`[SyncValidation] Closure event ${event.id} rejected: ${validation.error}`);
          continue;
        }

        // Cross-tenant closure overwrite prevention
        const existingClosure = await env.DB.prepare(`
          SELECT organization_id, branch_id FROM synced_cash_closures WHERE id = ?
        `).bind(closure.id).first<{ organization_id: string; branch_id: string }>();

        if (existingClosure) {
          if (existingClosure.organization_id !== terminal.organization_id || existingClosure.branch_id !== terminal.branch_id) {
            console.warn(`[SyncSecurity] Unauthorized cross-tenant closure update attempt on closure ${closure.id}`);
            continue;
          }
        }

        const closureStatements: any[] = [];

        // 1. Event idempotency record
        closureStatements.push(env.DB.prepare(`
          INSERT INTO sync_events (
            id, organization_id, branch_id, terminal_id, event_type,
            entity_type, entity_id, payload_hash, status, processed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          event.id,
          terminal.organization_id,
          terminal.branch_id,
          terminal.id,
          event.type,
          'closure',
          closure.id,
          payloadHash,
          'processed',
          now
        ));

        // 2. Upsert closure with tenant isolation
        closureStatements.push(env.DB.prepare(`
          INSERT INTO synced_cash_closures (
            id, organization_id, branch_id, closure_date, opened_at, closed_at,
            opening_cash, cash_sales, card_sales, upi_sales, other_sales,
            expected_cash, actual_cash, variance, notes, closed_by, synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            actual_cash = excluded.actual_cash,
            variance = excluded.variance,
            notes = excluded.notes,
            synced_at = excluded.synced_at
          WHERE synced_cash_closures.organization_id = excluded.organization_id
            AND synced_cash_closures.branch_id = excluded.branch_id
        `).bind(
          closure.id,
          terminal.organization_id,
          terminal.branch_id,
          closure.closure_date || now.split('T')[0],
          closure.opened_at || now,
          closure.closed_at || now,
          closure.opening_cash || 0,
          closure.cash_sales || 0,
          closure.card_sales || 0,
          closure.upi_sales || 0,
          closure.other_sales || 0,
          closure.expected_cash || 0,
          closure.actual_cash || 0,
          closure.variance || 0,
          closure.notes ? String(closure.notes).slice(0, 500) : null,
          closure.closed_by ? String(closure.closed_by).slice(0, 100) : 'Staff',
          now
        ));

        await executeBatch(env.DB, closureStatements);
        processedIds.push(event.id);

      } else {
        // Other legitimate event types (e.g. inventory.updated): record idempotently
        await env.DB.prepare(`
          INSERT INTO sync_events (
            id, organization_id, branch_id, terminal_id, event_type,
            entity_type, entity_id, payload_hash, status, processed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processed', ?)
        `).bind(
          event.id,
          terminal.organization_id,
          terminal.branch_id,
          terminal.id,
          event.type,
          event.entity_type || 'generic',
          event.entity_id || event.id,
          payloadHash,
          now
        ).run();

        processedIds.push(event.id);
      }
    } catch (err) {
      console.error(`Failed to ingest event ${event?.id}:`, err);
    }
  }

  const response: BatchSyncResponse = {
    success: processedIds.length > 0 || events.length === 0,
    processed_count: processedIds.length,
    failed_count: events.length - processedIds.length,
    synced_ids: processedIds,
    server_time: now,
  };

  return Response.json(response);
}
