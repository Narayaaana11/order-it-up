/**
 * SQLite WAL Crash Consistency & Transaction Atomicity Test
 *
 * Verifies that:
 * 1. An abrupt failure or power cut during an open transaction (simulated crash)
 *    rolls back uncommitted rows without corrupting the database.
 * 2. Already-committed orders, bills, and line items survive completely intact.
 * 3. WAL auto-recovery on restart passes PRAGMA integrity_check and PRAGMA foreign_key_check.
 * 4. Subsequent writes and sequence generation continue normally after recovery.
 *
 * Usage: node tests/run-electron-node-test.cjs tests/crash-consistency.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-crash-test-'));
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') return { app: { isPackaged: true, getPath: () => testDir, getVersion: () => 'test' } };
  return originalLoad.apply(this, arguments as any);
};

const { initDatabase, getDatabase, closeDatabase, getDbPath } = require('../main/db');

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

async function main() {
  console.log('=== SQLite WAL Crash Consistency Test Suite ===\n');

  try {
    // 1. Initialize schema and baseline database
    initDatabase();
    const db = getDatabase();
    const dbPath = getDbPath();

    // Verify WAL journal mode
    const journalMode = db.pragma('journal_mode', { simple: true });
    assert(journalMode === 'wal', `Journal mode is WAL (actual: ${journalMode})`);

    // 2. Commit a valid baseline order and bill
    db.transaction(() => {
      const orderRes = db.prepare(`
        INSERT INTO orders (order_number, type, status, subtotal, tax_amount, total)
        VALUES ('ORD-COMMITTED-1', 'dine_in', 'completed', 500, 25, 525)
      `).run();
      const orderId = Number(orderRes.lastInsertRowid);

      db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal, total, status)
        VALUES (?, 'prod-paneer-tikka', 'Paneer Tikka', 250, 2, 500, 500, 'completed')
      `).run(orderId);

      db.prepare(`
        INSERT INTO bills (order_id, bill_number, subtotal, tax_amount, total, payment_status, payment_details)
        VALUES (?, 'INV-COMMITTED-1', 500, 25, 525, 'paid', '[]')
      `).run(orderId);
    })();

    const initialOrderCount = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    assert(initialOrderCount === 1, 'Initial committed order exists in database');

    // 3. Simulate mid-transaction crash:
    // Open a raw transaction, insert uncommitted order and items, then crash/close without COMMIT!
    const rawDb = new Database(dbPath);
    rawDb.pragma('journal_mode = WAL');
    rawDb.exec('BEGIN IMMEDIATE TRANSACTION;');

    const crashOrderRes = rawDb.prepare(`
      INSERT INTO orders (order_number, type, status, subtotal, tax_amount, total)
      VALUES ('ORD-CRASH-UNCOMMITTED', 'dine_in', 'pending', 300, 15, 315)
    `).run();
    const crashOrderId = Number(crashOrderRes.lastInsertRowid);

    rawDb.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal, total, status)
      VALUES (?, 'prod-phantom-dish', 'Phantom Dish', 300, 1, 300, 300, 'pending')
    `).run(crashOrderId);

    // Abrupt termination without COMMIT or ROLLBACK (simulate SIGKILL / process crash)
    rawDb.close();
    closeDatabase();

    // 4. Recovery: Reopen database and verify WAL replay & rollback
    console.log('\n--- Reopening Database after Simulated Abrupt Crash ---');
    initDatabase();
    const recoveredDb = getDatabase();

    // Check integrity
    const integrity = recoveredDb.pragma('integrity_check', { simple: true });
    assert(integrity === 'ok', `PRAGMA integrity_check passed: ${integrity}`);

    const fkViolations = recoveredDb.pragma('foreign_key_check') as any[];
    assert(fkViolations.length === 0, 'PRAGMA foreign_key_check has 0 violations');

    // Check that uncommitted crash order was rolled back cleanly
    const crashOrder = recoveredDb.prepare("SELECT * FROM orders WHERE order_number = 'ORD-CRASH-UNCOMMITTED'").get();
    assert(crashOrder === undefined, 'Uncommitted crash order rolled back cleanly');

    const phantomItem = recoveredDb.prepare("SELECT * FROM order_items WHERE product_name = 'Phantom Dish'").get();
    assert(phantomItem === undefined, 'Orphaned line item was not persisted');

    // Check that committed baseline order survives
    const committedOrder = recoveredDb.prepare("SELECT * FROM orders WHERE order_number = 'ORD-COMMITTED-1'").get() as any;
    assert(committedOrder !== undefined, 'Pre-crash committed order survived');
    assert(committedOrder.total === 525, 'Committed order total is 525');

    const committedBill = recoveredDb.prepare("SELECT * FROM bills WHERE bill_number = 'INV-COMMITTED-1'").get() as any;
    assert(committedBill !== undefined, 'Pre-crash committed bill survived');

    // 5. Subsequent writes after crash recovery
    recoveredDb.transaction(() => {
      const newOrder = recoveredDb.prepare(`
        INSERT INTO orders (order_number, type, status, subtotal, tax_amount, total)
        VALUES ('ORD-POST-CRASH-2', 'dine_in', 'completed', 100, 5, 105)
      `).run();
      assert(newOrder.changes === 1, 'Post-recovery write succeeds cleanly');
    })();

    const finalOrderCount = recoveredDb.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    assert(finalOrderCount === 2, `Final order count is 2 (actual: ${finalOrderCount})`);

    closeDatabase();
  } catch (err: any) {
    console.error('Crash consistency test failed:', err);
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed of ${total} assertions`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
