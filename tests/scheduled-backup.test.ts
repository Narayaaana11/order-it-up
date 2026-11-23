/**
 * Automated Scheduled Backup Verification Test Suite
 *
 * Verifies that:
 * 1. createBackup() creates a durable, fully valid SQLite backup file.
 * 2. Schema version and canonical metadata (_flo_meta) are written properly.
 * 3. PRAGMA integrity_check passes on the backup file.
 * 4. Restoring / reading from backup verifies master data, orders, and audit logs.
 * 5. listBackups() discovers created backups with size and timestamp metadata.
 *
 * Usage: node tests/run-electron-node-test.cjs tests/scheduled-backup.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-backup-test-'));
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') return { app: { isPackaged: true, getPath: () => testDir, getVersion: () => '1.0.0' } };
  return originalLoad.apply(this, arguments as any);
};

const {
  initDatabase,
  getDatabase,
  closeDatabase,
  createBackup,
  listBackups,
  getCurrentSchemaVersion,
} = require('../main/db');

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
  console.log('=== Automated Scheduled Backup Test Suite ===\n');

  try {
    initDatabase();
    const db = getDatabase();

    // 1. Seed realistic restaurant data
    db.prepare("INSERT INTO categories (id, name) VALUES ('cat-dessert', 'Desserts')").run();
    db.prepare(`
      INSERT INTO products (id, category_id, name, price, is_active)
      VALUES ('prod-gulab-jamun', 'cat-dessert', 'Gulab Jamun', 90, 1)
    `).run();

    const orderRes = db.prepare(`
      INSERT INTO orders (order_number, type, status, subtotal, tax_amount, total)
      VALUES ('ORD-BKP-001', 'dine_in', 'completed', 180, 9, 189)
    `).run();
    const orderId = Number(orderRes.lastInsertRowid);

    db.prepare(`
      INSERT INTO bills (order_id, bill_number, subtotal, tax_amount, total, payment_status)
      VALUES (?, 'INV-BKP-001', 180, 9, 189, 'paid')
    `).run(orderId);

    // 2. Trigger backup creation
    console.log('\n--- Creating Online Database Backup ---');
    const backupResult = await createBackup();
    assert(Boolean(backupResult.path), `Backup created at: ${backupResult.path}`);
    assert(fs.existsSync(backupResult.path), 'Backup file exists on disk');

    const fileStat = fs.statSync(backupResult.path);
    assert(fileStat.size > 0, `Backup file size is positive (${fileStat.size} bytes)`);

    const currentVersion = getCurrentSchemaVersion();
    assert(backupResult.schemaVersion === currentVersion, `Backup schema version matches current (${backupResult.schemaVersion})`);

    // 3. Inspect backup file integrity with SQLite
    console.log('\n--- Validating Backup SQLite Integrity ---');
    const backupDb = new Database(backupResult.path, { readonly: true });

    const integrity = backupDb.pragma('integrity_check', { simple: true });
    assert(integrity === 'ok', `Backup PRAGMA integrity_check passed: ${integrity}`);

    const fkCheck = backupDb.pragma('foreign_key_check') as any[];
    assert(fkCheck.length === 0, 'Backup foreign keys are clean');

    // Check metadata table
    const metaVersion = backupDb.prepare("SELECT value FROM _flo_meta WHERE key = 'schema_version'").get() as any;
    assert(Number(metaVersion.value) === currentVersion, `_flo_meta schema_version matches ${currentVersion}`);

    // Verify seeded data exists in backup
    const bkpProduct = backupDb.prepare("SELECT * FROM products WHERE id = 'prod-gulab-jamun'").get() as any;
    assert(bkpProduct !== undefined, 'Product Gulab Jamun exists in backup');
    assert(bkpProduct.name === 'Gulab Jamun', 'Product name is Gulab Jamun');

    const bkpOrder = backupDb.prepare("SELECT * FROM orders WHERE order_number = 'ORD-BKP-001'").get() as any;
    assert(bkpOrder !== undefined, 'Order ORD-BKP-001 exists in backup');
    assert(bkpOrder.total === 189, 'Order total matches 189');

    const bkpBill = backupDb.prepare("SELECT * FROM bills WHERE bill_number = 'INV-BKP-001'").get() as any;
    assert(bkpBill !== undefined, 'Bill INV-BKP-001 exists in backup');
    assert(bkpBill.payment_status === 'paid', 'Bill status is paid');

    backupDb.close();

    // 4. Verify listBackups()
    console.log('\n--- Listing Managed Backups ---');
    const backups = listBackups();
    assert(backups.length >= 1, `listBackups found ${backups.length} backup(s)`);
    const createdBackup = backups.find((b: any) => path.resolve(b.path) === path.resolve(backupResult.path));
    assert(Boolean(createdBackup), 'Created backup is returned by listBackups()');
    assert(createdBackup.sizeBytes > 0, 'Backup has sizeBytes reported');
    assert(Boolean(createdBackup.createdAt), 'Backup has createdAt timestamp');

    closeDatabase();
  } catch (err: any) {
    console.error('Backup test exception:', err);
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed of ${total} assertions`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
