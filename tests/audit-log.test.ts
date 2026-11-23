import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  recordAudit,
  verifyAuditChain,
  detectAuditAnomalies,
  AUDIT_GENESIS_PREV_HASH,
  computeAuditRowHash,
} from '../main/services/audit';

describe('Tamper-Evident Audit Log Service', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        actor_user_id TEXT,
        actor_role TEXT,
        terminal_id TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        before_json TEXT,
        after_json TEXT,
        reason TEXT,
        approver_user_id TEXT,
        ip TEXT,
        severity TEXT DEFAULT 'info',
        prev_hash TEXT NOT NULL,
        row_hash TEXT NOT NULL
      );

      CREATE TRIGGER IF NOT EXISTS audit_log_prevent_update
      BEFORE UPDATE ON audit_log
      BEGIN
        SELECT RAISE(ABORT, 'audit_log is append-only and cannot be updated');
      END;

      CREATE TRIGGER IF NOT EXISTS audit_log_prevent_delete
      BEFORE DELETE ON audit_log
      BEGIN
        SELECT RAISE(ABORT, 'audit_log is append-only and cannot be deleted');
      END;
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('records audit events and initializes hash chain from genesis', () => {
    const row1 = recordAudit(db, {
      action: 'staff_create',
      entity_type: 'staff',
      entity_id: 'user-1',
      actor_user_id: 'admin',
      actor_role: 'owner',
      severity: 'info',
    });

    expect(row1.id).toBe(1);
    expect(row1.row_hash).toHaveLength(64);

    const stored1 = db.prepare('SELECT * FROM audit_log WHERE id = ?').get(1) as any;
    expect(stored1.prev_hash).toBe(AUDIT_GENESIS_PREV_HASH);
    expect(stored1.action).toBe('staff_create');

    const row2 = recordAudit(db, {
      action: 'order_cancel',
      entity_type: 'order',
      entity_id: 'ord-101',
      actor_user_id: 'mgr',
      actor_role: 'manager',
      severity: 'warning',
    });

    expect(row2.id).toBe(2);
    const stored2 = db.prepare('SELECT * FROM audit_log WHERE id = ?').get(2) as any;
    expect(stored2.prev_hash).toBe(row1.row_hash);
    expect(stored2.action).toBe('order_cancel');
  });

  it('verifies a valid hash chain correctly', () => {
    recordAudit(db, { action: 'order_cancel', entity_type: 'order', entity_id: '1' });
    recordAudit(db, { action: 'refund', entity_type: 'bill', entity_id: '2' });
    recordAudit(db, { action: 'cash_drawer_open', entity_type: 'drawer', entity_id: '3' });

    const verification = verifyAuditChain(db);
    expect(verification.valid).toBe(true);
    expect(verification.total_rows).toBe(3);
    expect(verification.compromised_at_id).toBeNull();
  });

  it('prevents direct SQLite UPDATE operations via triggers', () => {
    recordAudit(db, { action: 'order_cancel', entity_type: 'order', entity_id: '1' });

    expect(() => {
      db.prepare('UPDATE audit_log SET reason = ? WHERE id = 1').run('Tampered reason');
    }).toThrow(/audit_log is append-only/);
  });

  it('prevents direct SQLite DELETE operations via triggers', () => {
    recordAudit(db, { action: 'order_cancel', entity_type: 'order', entity_id: '1' });

    expect(() => {
      db.prepare('DELETE FROM audit_log WHERE id = 1').run();
    }).toThrow(/audit_log is append-only/);
  });

  it('fails closed when audit log recording fails for financial actions', () => {
    // Drop table to simulate disk failure / table corruption
    db.exec('DROP TABLE audit_log');

    expect(() => {
      recordAudit(db, {
        action: 'refund',
        entity_type: 'bill',
        entity_id: 'bill-1',
      });
    }).toThrow();
  });

  it('detects tampering when hash chain row data does not match row_hash', () => {
    recordAudit(db, { action: 'order_cancel', entity_type: 'order', entity_id: '1' });
    recordAudit(db, { action: 'refund', entity_type: 'bill', entity_id: '2' });

    // Temporarily drop trigger to simulate attacker tampering with db file
    db.exec('DROP TRIGGER audit_log_prevent_update');
    db.prepare('UPDATE audit_log SET action = ? WHERE id = 2').run('tampered_action');

    const verification = verifyAuditChain(db);
    expect(verification.valid).toBe(false);
    expect(verification.compromised_at_id).toBe(2);
  });

  it('detects anomaly patterns for suspicious activity', () => {
    // Seed 4 voids by user 'waiter-1' within 10 minutes
    const nowIso = new Date().toISOString();
    for (let i = 1; i <= 4; i++) {
      db.prepare(`
        INSERT INTO audit_log (
          ts, tenant_id, actor_user_id, actor_role, action, entity_type, entity_id, prev_hash, row_hash
        ) VALUES (?, 'default', 'waiter-1', 'server', 'void', 'order_item', ?, 'prev', 'hash')
      `).run(nowIso, `item-${i}`);
    }

    // Seed 6 drawer opens by user 'cashier-1'
    for (let i = 1; i <= 6; i++) {
      db.prepare(`
        INSERT INTO audit_log (
          ts, tenant_id, actor_user_id, actor_role, action, entity_type, entity_id, prev_hash, row_hash
        ) VALUES (?, 'default', 'cashier-1', 'cashier', 'cash_drawer_open', 'drawer', ?, 'prev', 'hash')
      `).run(nowIso, `drawer-${i}`);
    }

    const anomalies = detectAuditAnomalies(db);
    expect(anomalies.length).toBeGreaterThanOrEqual(2);

    const voidAnomaly = anomalies.find((a) => a.type === 'excessive_voids');
    expect(voidAnomaly).toBeDefined();
    expect(voidAnomaly?.user_id).toBe('waiter-1');

    const drawerAnomaly = anomalies.find((a) => a.type === 'frequent_drawer_opens');
    expect(drawerAnomaly).toBeDefined();
    expect(drawerAnomaly?.user_id).toBe('cashier-1');
  });
});
