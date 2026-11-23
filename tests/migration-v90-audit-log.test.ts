/**
 * Migration v90 coverage: Tamper-Evident Audit Log & Triggers.
 */
const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');

let activeTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flo-migration-v90-'));

Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') return { app: { isPackaged: true, getPath: () => activeTestDir, getVersion: () => 'test' } };
  return originalLoad.apply(this, arguments as any);
};

const { initDatabase, getDatabase, getCurrentSchemaVersion, closeDatabase } = require('../main/db');
const {
  recordAudit,
  verifyAuditChain,
  detectAuditAnomalies,
  AUDIT_GENESIS_PREV_HASH,
} = require('../main/services/audit');

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

async function run() {
  console.log('=== Migration v90 & Audit Log Test Suite ===\n');

  try {
    initDatabase();
    const db = getDatabase();

    // 1. Schema version check
    const currentVersion = getCurrentSchemaVersion();
    assert(currentVersion >= 90, `Current schema version is >= 90 (actual: ${currentVersion})`);

    // 2. Table existence and columns
    const columns = db.prepare('PRAGMA table_info(audit_log)').all() as any[];
    const colNames = columns.map((c) => c.name);
    assert(colNames.includes('id'), 'audit_log has id column');
    assert(colNames.includes('ts'), 'audit_log has ts column');
    assert(colNames.includes('tenant_id'), 'audit_log has tenant_id column');
    assert(colNames.includes('actor_user_id'), 'audit_log has actor_user_id column');
    assert(colNames.includes('action'), 'audit_log has action column');
    assert(colNames.includes('entity_type'), 'audit_log has entity_type column');
    assert(colNames.includes('prev_hash'), 'audit_log has prev_hash column');
    assert(colNames.includes('row_hash'), 'audit_log has row_hash column');

    // 3. Append-only triggers
    let updatePrevented = false;
    let deletePrevented = false;

    const row1 = recordAudit(db, {
      action: 'order_cancel',
      entity_type: 'order',
      entity_id: 'ord-1',
      actor_user_id: 'staff-1',
      actor_role: 'manager',
      severity: 'warning',
      reason: 'Customer requested',
    });
    assert(row1.id > 0 && row1.row_hash.length === 64, 'Recorded first audit event with SHA-256 hash');

    try {
      db.prepare('UPDATE audit_log SET reason = ? WHERE id = ?').run('tampered', row1.id);
    } catch (e: any) {
      if (/audit_log is append-only/.test(e.message)) {
        updatePrevented = true;
      }
    }
    assert(updatePrevented, 'Trigger audit_log_prevent_update successfully aborted UPDATE');

    try {
      db.prepare('DELETE FROM audit_log WHERE id = ?').run(row1.id);
    } catch (e: any) {
      if (/audit_log is append-only/.test(e.message)) {
        deletePrevented = true;
      }
    }
    assert(deletePrevented, 'Trigger audit_log_prevent_delete successfully aborted DELETE');

    // 4. Hash Chaining Verification
    const row2 = recordAudit(db, {
      action: 'refund',
      entity_type: 'bill',
      entity_id: 'bill-1',
      actor_user_id: 'staff-1',
      severity: 'critical',
    });

    const storedRow2 = db.prepare('SELECT * FROM audit_log WHERE id = ?').get(row2.id) as any;
    assert(storedRow2.prev_hash === row1.row_hash, 'Second row prev_hash points to first row row_hash');

    const chainValid = verifyAuditChain(db);
    assert(chainValid.valid === true, 'verifyAuditChain reports valid chain on authentic records');
    assert(chainValid.tamperedRowId === undefined, 'No compromise detected in authentic chain');

    // 5. Anomaly Detection
    const nowIso = new Date().toISOString();
    for (let i = 0; i < 5; i++) {
      recordAudit(db, {
        action: 'cash_drawer_open',
        entity_type: 'drawer',
        entity_id: `drw-${i}`,
        actor_user_id: 'cashier-rogue',
        actor_role: 'cashier',
      });
    }

    const report = detectAuditAnomalies(db);
    const drawerAnomaly = report.anomalies.find((a: any) => a.type === 'excessive_drawer_opens' && a.actor_user_id === 'cashier-rogue');
    assert(drawerAnomaly !== undefined, 'detectAuditAnomalies identified rogue drawer open pattern');

    closeDatabase();
  } catch (err: any) {
    console.error('Test run failed with error:', err);
    assert(false, `Unexpected exception: ${err.message}`);
  } finally {
    try {
      fs.rmSync(activeTestDir, { recursive: true, force: true });
    } catch {}
  }

  console.log(`\nResults: ${passed}/${total} passed (${failed} failed).`);
  if (failed > 0) process.exit(1);
}

run();
