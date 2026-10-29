import { hashString } from '../auth';
import { BatchSyncEvent, BatchSyncRequest, BatchSyncResponse } from '../../../../shared/cloud-types';
import { Env } from './pairing';

export async function handleIngestSyncEvents(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization') || '';
  const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const body = await request.json() as any;

  let terminal: { id: string; organization_id: string; branch_id: string } | null = null;

  if (rawToken) {
    const tokenHash = await hashString(rawToken);
    terminal = await env.DB.prepare(`
      SELECT t.id, t.organization_id, t.branch_id
      FROM terminals t
      WHERE t.terminal_token_hash = ?
    `).bind(tokenHash).first<{ id: string; organization_id: string; branch_id: string }>();
  }

  // Fallback to pos_hash matching
  if (!terminal && body?.pos_hash) {
    const hash = String(body.pos_hash);
    terminal = await env.DB.prepare(`
      SELECT t.id, t.organization_id, t.branch_id
      FROM terminals t
      WHERE t.id = ? OR t.terminal_token_hash = ?
    `).bind(hash, hash).first<{ id: string; organization_id: string; branch_id: string }>();

    // If still not matched, bind to default demo branch to prevent data loss during test/onboarding
    if (!terminal) {
      const defaultBranch = await env.DB.prepare('SELECT id, organization_id FROM branches LIMIT 1')
        .first<{ id: string; organization_id: string }>();
      if (defaultBranch) {
        terminal = {
          id: hash,
          organization_id: defaultBranch.organization_id,
          branch_id: defaultBranch.id
        };
      }
    }
  }

  if (!terminal) {
    return Response.json({ error: 'Unauthorized terminal token or pos_hash' }, { status: 403 });
  }
  const events = body.events || [];
  const processedIds: string[] = [];
  const now = new Date().toISOString();

  // Update terminal heartbeat
  await env.DB.prepare('UPDATE terminals SET last_seen_at = ? WHERE id = ?')
    .bind(now, terminal.id).run();

  for (const event of events) {
    try {
      if (event.type.startsWith('order.')) {
        const payload = event.payload as any;
        if (!payload || !payload.id) continue;

        // Upsert order
        await env.DB.prepare(`
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
        `).bind(
          payload.id,
          terminal.organization_id,
          terminal.branch_id,
          terminal.id,
          payload.order_number || payload.daily_order_number || 'ORD',
          payload.order_type || 'dine_in',
          payload.status || 'completed',
          payload.subtotal || 0,
          payload.tax_total || payload.tax || 0,
          payload.discount_total || payload.discount || 0,
          payload.grand_total || payload.total || 0,
          payload.payment_method || 'cash',
          payload.created_at || now,
          now
        ).run();

        // If items are included, upsert items
        if (Array.isArray(payload.items)) {
          for (const item of payload.items) {
            const itemId = item.id || `${payload.id}_${item.product_id || item.name}_${Math.random()}`;
            await env.DB.prepare(`
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
              item.quantity || 1,
              item.price || item.unit_price || 0,
              item.subtotal || (item.quantity * item.price) || 0,
              item.tax_amount || 0,
              item.discount_amount || 0,
              payload.created_at || now
            ).run();
          }
        }
      } else if (event.type === 'closure.recorded') {
        const closure = event.payload as any;
        if (!closure || !closure.id) continue;

        await env.DB.prepare(`
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
          closure.notes || null,
          closure.closed_by || 'Staff',
          now
        ).run();
      }

      processedIds.push(event.id);
    } catch (err) {
      console.error(`Failed to ingest event ${event.id}:`, err);
    }
  }

  const response: BatchSyncResponse = {
    success: true,
    processed_count: processedIds.length,
    failed_count: events.length - processedIds.length,
    synced_ids: processedIds,
    server_time: now
  };

  return Response.json(response);
}
