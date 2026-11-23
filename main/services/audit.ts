import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import { now } from '../db';

export const AUDIT_GENESIS_PREV_HASH = '0'.repeat(64);

export type AuditAction =
  | 'order_cancel'
  | 'item_cancel'
  | 'void'
  | 'discount_apply'
  | 'discount_override'
  | 'price_override'
  | 'refund'
  | 'bill_reprint'
  | 'cash_drawer_open'
  | 'cash_closure_open'
  | 'cash_closure_close'
  | 'payment_method_edit'
  | 'tax_config_edit'
  | 'product_price_change'
  | 'product_stock_change'
  | 'staff_create'
  | 'staff_role_change'
  | 'staff_pin_reset'
  | 'staff_deactivate'
  | 'settings_change'
  | 'login_failure'
  | 'login_lockout'
  | 'data_export'
  | 'data_backup'
  | 'data_restore';

export interface AuditEvent {
  tenant_id?: string;
  actor_user_id?: string | null;
  actor_role?: string | null;
  terminal_id?: string | null;
  action: AuditAction | string;
  entity_type: string;
  entity_id?: string | null;
  before_json?: unknown;
  after_json?: unknown;
  reason?: string | null;
  approver_user_id?: string | null;
  ip?: string | null;
  severity?: 'info' | 'warning' | 'warn' | 'critical';
}

export const FINANCIAL_ACTIONS = new Set<string>([
  'order_cancel',
  'item_cancel',
  'void',
  'discount_apply',
  'discount_override',
  'price_override',
  'refund',
  'cash_closure_open',
  'cash_closure_close',
  'tax_config_edit',
  'payment_method_edit',
]);

export function computeAuditRowHash(
  prevHash: string,
  timestamp: string,
  tenantId: string,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  beforeJson: string,
  afterJson: string
): string {
  const canonical = [
    prevHash,
    timestamp,
    tenantId,
    actorUserId || '',
    action,
    entityType,
    entityId || '',
    beforeJson || '',
    afterJson || '',
  ].join('|');

  return createHash('sha256').update(canonical).digest('hex');
}

export function recordAudit(
  eventOrDb: Database.Database | AuditEvent,
  maybeEventOrDb?: AuditEvent | Database.Database
): { id: number; row_hash: string } {
  let dbInstance: Database.Database;
  let event: AuditEvent;

  if (maybeEventOrDb) {
    if ('action' in (maybeEventOrDb as any)) {
      dbInstance = eventOrDb as Database.Database;
      event = maybeEventOrDb as AuditEvent;
    } else {
      dbInstance = maybeEventOrDb as Database.Database;
      event = eventOrDb as AuditEvent;
    }
  } else {
    event = eventOrDb as AuditEvent;
    // Late-import getDatabase to avoid circular dependency
    const { getDatabase } = require('../db');
    dbInstance = getDatabase();
  }
  const isFinancial = FINANCIAL_ACTIONS.has(event.action);

  try {
    const timestamp = now();
    const tenantId = event.tenant_id || 'default';
    const beforeStr = event.before_json !== undefined && event.before_json !== null
      ? (typeof event.before_json === 'string' ? event.before_json : JSON.stringify(event.before_json))
      : null;
    const afterStr = event.after_json !== undefined && event.after_json !== null
      ? (typeof event.after_json === 'string' ? event.after_json : JSON.stringify(event.after_json))
      : null;

    // Get the latest row_hash to form cryptographic chain
    const lastRow = dbInstance
      .prepare('SELECT row_hash FROM audit_log ORDER BY id DESC LIMIT 1')
      .get() as { row_hash: string } | undefined;

    const prevHash = lastRow?.row_hash || AUDIT_GENESIS_PREV_HASH;
    const rowHash = computeAuditRowHash(
      prevHash,
      timestamp,
      tenantId,
      event.actor_user_id || '',
      event.action,
      event.entity_type,
      event.entity_id || '',
      beforeStr || '',
      afterStr || ''
    );

    const stmt = dbInstance.prepare(`
      INSERT INTO audit_log (
        ts, tenant_id, actor_user_id, actor_role, terminal_id,
        action, entity_type, entity_id, before_json, after_json,
        reason, approver_user_id, ip, severity, prev_hash, row_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      timestamp,
      tenantId,
      event.actor_user_id || null,
      event.actor_role || null,
      event.terminal_id || null,
      event.action,
      event.entity_type,
      event.entity_id || null,
      beforeStr,
      afterStr,
      event.reason || null,
      event.approver_user_id || null,
      event.ip || null,
      event.severity || (isFinancial ? 'warning' : 'info'),
      prevHash,
      rowHash
    );

    return { id: Number(result.lastInsertRowid), row_hash: rowHash };
  } catch (err: any) {
    console.error(`[AUDIT] Error recording audit for action '${event.action}':`, err);
    if (isFinancial) {
      // Fail closed on financial actions: roll back / reject transaction
      throw new Error(`Financial audit recording failed for '${event.action}': ${err.message}`);
    }
    return { id: -1, row_hash: '' };
  }
}

export function verifyAuditChain(dbInstance: Database.Database): {
  valid: boolean;
  totalRows: number;
  tamperedRowId?: number;
  reason?: string;
} {
  const rows = dbInstance.prepare(`
    SELECT id, ts, tenant_id, actor_user_id, action, entity_type, entity_id, before_json, after_json, prev_hash, row_hash
    FROM audit_log
    ORDER BY id ASC
  `).all() as any[];

  let expectedPrevHash = AUDIT_GENESIS_PREV_HASH;

  for (const row of rows) {
    if (row.prev_hash !== expectedPrevHash) {
      return {
        valid: false,
        totalRows: rows.length,
        tamperedRowId: row.id,
        reason: `Previous hash mismatch on row ${row.id}: expected ${expectedPrevHash}, found ${row.prev_hash}`,
      };
    }

    const calculatedHash = computeAuditRowHash(
      row.prev_hash,
      row.ts,
      row.tenant_id,
      row.actor_user_id || '',
      row.action,
      row.entity_type,
      row.entity_id || '',
      row.before_json || '',
      row.after_json || ''
    );

    if (calculatedHash !== row.row_hash) {
      return {
        valid: false,
        totalRows: rows.length,
        tamperedRowId: row.id,
        reason: `Row hash mismatch on row ${row.id}: content has been modified`,
      };
    }

    expectedPrevHash = row.row_hash;
  }

  return { valid: true, totalRows: rows.length };
}

export interface AnomalyReport {
  timestamp: string;
  anomalies: Array<{
    type: string;
    description: string;
    severity: 'warning' | 'critical';
    actor_user_id?: string;
    count?: number;
    details?: any;
  }>;
}

export function detectAuditAnomalies(dbInstance: Database.Database, days = 7): AnomalyReport {
  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const anomalies: AnomalyReport['anomalies'] = [];

  // 1. Staff void / discount rate significantly above store median
  const staffActionCounts = dbInstance.prepare(`
    SELECT actor_user_id,
           SUM(CASE WHEN action IN ('void', 'discount_apply', 'discount_override') THEN 1 ELSE 0 END) as void_discount_count,
           COUNT(*) as total_actions
    FROM audit_log
    WHERE ts >= ? AND actor_user_id IS NOT NULL
    GROUP BY actor_user_id
  `).all(sinceDate) as any[];

  if (staffActionCounts.length > 1) {
    const counts = staffActionCounts.map((s) => s.void_discount_count).sort((a, b) => a - b);
    const median = counts[Math.floor(counts.length / 2)] || 1;
    for (const staff of staffActionCounts) {
      if (staff.void_discount_count > Math.max(4, median * 2.5)) {
        anomalies.push({
          type: 'high_void_discount_frequency',
          description: `User ${staff.actor_user_id} performed ${staff.void_discount_count} voids/discounts (>2.5x store median of ${median})`,
          severity: 'warning',
          actor_user_id: staff.actor_user_id,
          count: staff.void_discount_count,
        });
      }
    }
  }

  // 2. Refunds issued after daily cash closure
  const afterClosureRefunds = dbInstance.prepare(`
    SELECT al.id, al.actor_user_id, al.ts, al.entity_id
    FROM audit_log al
    JOIN cash_closures cc ON cc.business_date = SUBSTR(al.ts, 1, 10)
    WHERE al.action = 'refund' AND al.ts > cc.created_at AND al.ts >= ?
  `).all(sinceDate) as any[];

  for (const ref of afterClosureRefunds) {
    anomalies.push({
      type: 'refund_after_day_close',
      description: `Refund for bill/order ${ref.entity_id} processed at ${ref.ts} after daily cash register closure`,
      severity: 'critical',
      actor_user_id: ref.actor_user_id,
      details: { audit_id: ref.id, entity_id: ref.entity_id },
    });
  }

  // 3. Excessive drawer no-sale opens
  const repeatedDrawerOpens = dbInstance.prepare(`
    SELECT actor_user_id, COUNT(*) as open_count
    FROM audit_log
    WHERE action = 'cash_drawer_open' AND ts >= ?
    GROUP BY actor_user_id, SUBSTR(ts, 1, 10)
    HAVING open_count >= 3
  `).all(sinceDate) as any[];

  for (const d of repeatedDrawerOpens) {
    anomalies.push({
      type: 'excessive_drawer_opens',
      description: `User ${d.actor_user_id} opened cash drawer ${d.open_count} times in a single day without sale correlation`,
      severity: 'warning',
      actor_user_id: d.actor_user_id,
      count: d.open_count,
    });
  }

  // 4. Excessive manual price overrides
  const priceOverrides = dbInstance.prepare(`
    SELECT actor_user_id, COUNT(*) as override_count
    FROM audit_log
    WHERE action = 'price_override' AND ts >= ?
    GROUP BY actor_user_id
    HAVING override_count >= 4
  `).all(sinceDate) as any[];

  for (const po of priceOverrides) {
    anomalies.push({
      type: 'excessive_price_overrides',
      description: `User ${po.actor_user_id} executed ${po.override_count} manual price overrides`,
      severity: 'warning',
      actor_user_id: po.actor_user_id,
      count: po.override_count,
    });
  }

  return { timestamp: now(), anomalies };
}
