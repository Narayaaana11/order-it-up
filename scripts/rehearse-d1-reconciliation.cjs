#!/usr/bin/env node
/**
 * Local D1 reconciliation rehearsal.
 *
 * Builds a throwaway SQLite database that emulates the audited production
 * baseline (schema through 0007, empty migration ledger, users without the
 * organization membership from 0004), then:
 *
 *   1. proves a naive replay of 0001–0025 fails on duplicate columns;
 *   2. applies the reconciliation strategy: record the proven-applied 0001–0007
 *      in the ledger, then apply 0008–0025;
 *   3. repairs organization-level memberships and verifies the readiness
 *      tables/columns.
 *
 * Nothing here connects to Cloudflare. Production still requires the reviewed
 * backup/restore drill and an explicitly authorized migration run.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'apps', 'cloud-api', 'migrations');
const migrations = fs.readdirSync(migrationsDir)
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort();
const sqlOf = (name) => fs.readFileSync(path.join(migrationsDir, name), 'utf8');

const failures = [];
function check(name, condition, detail = '') {
  if (condition) console.log(`PASS  ${name}`);
  else {
    console.error(`FAIL  ${name}${detail ? ` (${detail})` : ''}`);
    failures.push(name);
  }
}

function createLegacyDatabase(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  // Wrangler's bookkeeping table is created by the CLI, not by the migrations.
  db.exec(`CREATE TABLE IF NOT EXISTS d1_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  for (const migration of migrations.filter((name) => Number(name.slice(0, 4)) <= 7)) {
    db.exec(sqlOf(migration));
  }
  // Audited drift: four users lack the organization-level membership expected
  // from migration 0004, and the remote ledger is empty.
  let org = db.prepare('SELECT id FROM organizations LIMIT 1').get();
  const now = new Date().toISOString();
  if (!org) {
    db.prepare(`INSERT INTO organizations (id, name, currency, country, timezone, created_at, updated_at) VALUES ('legacy-org', 'Legacy Restaurant', 'INR', 'IN', 'Asia/Kolkata', ?, ?)`).run(now, now);
    db.prepare(`INSERT INTO branches (id, organization_id, code, name, is_main_branch, status, created_at, updated_at) VALUES ('legacy-branch', 'legacy-org', 'B1', 'Legacy Main', 1, 'active', ?, ?)`).run(now, now);
    org = { id: 'legacy-org' };
  }
  const branch = db.prepare('SELECT id FROM branches LIMIT 1').get();
  const insertUser = db.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES (?, ?, ?, 'scrypt$N=16384,r=8,p=1$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000', ?, ?, 'active', ?, ?)
  `);
  for (let index = 1; index <= 4; index += 1) {
    insertUser.run(`reconcile-user-${index}`, org.id, `reconcile${index}@legacy.test`, `Legacy User ${index}`, 'owner', now, now);
  }
  return db;
}

function readiness(db) {
  const requiredTables = [
    'organizations', 'branches', 'cloud_users', 'terminals', 'pairing_tokens', 'master_categories',
    'master_products', 'branch_product_overrides', 'synced_orders', 'synced_order_items',
    'synced_cash_closures', 'inventory_transfers', 'rate_limits', 'sync_events', 'restaurants',
    'memberships', 'dining_tables', 'kitchen_tickets', 'customer_payments', 'saas_plans',
    'organization_subscriptions', 'subscription_events', 'platform_admin_audit_log',
    'cloud_token_revocations', 'qr_table_tokens', 'qr_order_tracking_tokens', 'master_addon_groups',
    'master_addons', 'master_product_addon_groups', 'qr_order_idempotency', 'pilot_access_requests',
    'saas_subscription_payment_orders', 'saas_payment_webhook_events', 'qr_order_pos_deliveries',
    'pilot_access_invitations', 'restaurant_vendors', 'expense_categories', 'expenses',
    'reservations', 'ingredients', 'inventory_transactions', 'recipes', 'delivery_jobs',
    'customers', 'held_orders', 'payment_intents', 'payment_webhook_events',
  ];
  const present = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
  const missingTables = requiredTables.filter((name) => !present.has(name));
  check('Every readiness table exists', missingTables.length === 0, missingTables.join(', '));

  const orgColumns = new Set(db.prepare('PRAGMA table_info(organizations)').all().map((row) => row.name));
  check('organizations.account_status exists', orgColumns.has('account_status'));
  const itemColumns = new Set(db.prepare('PRAGMA table_info(synced_order_items)').all().map((row) => row.name));
  check('synced_order_items.product_sku exists', itemColumns.has('product_sku'));
}

function main() {
  const file = path.join(os.tmpdir(), `oiu-reconcile-${process.pid}-${Date.now()}.db`);
  let db;
  try {
    // ── 1. Naive replay must fail on duplicate columns ──────────────────────
    db = createLegacyDatabase(file);
    let naiveFailed = false;
    let naiveError = '';
    try {
      for (const migration of migrations) db.exec(sqlOf(migration));
    } catch (error) {
      naiveFailed = true;
      naiveError = String(error && error.message ? error.message : error);
    }
    check('A naive replay of 0001–0025 fails closed', naiveFailed, 'expected a duplicate-column error');
    if (naiveFailed) console.log(`      reason: ${naiveError.slice(0, 160)}`);
    db.close();
    fs.rmSync(file, { force: true });

    // ── 2. Ledger-baseline reconciliation ───────────────────────────────────
    db = createLegacyDatabase(file);
    const insertLedger = db.prepare('INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)');
    for (const migration of migrations.filter((name) => Number(name.slice(0, 4)) <= 7)) insertLedger.run(migration);
    check('Ledger records the proven 0001–0007 baseline', Number(db.prepare('SELECT COUNT(*) AS count FROM d1_migrations').get().count) === 7);

    const backup = `${file}.backup`;
    fs.copyFileSync(file, backup);
    check('A pre-change backup copy exists', fs.existsSync(backup));

    for (const migration of migrations.filter((name) => Number(name.slice(0, 4)) > 7)) {
      db.exec(sqlOf(migration));
      insertLedger.run(migration);
    }
    check('Migrations 0008–0025 apply cleanly on the reconciled baseline',
      Number(db.prepare('SELECT COUNT(*) AS count FROM d1_migrations').get().count) === migrations.length);

    // ── 3. Repair the audited membership gap ────────────────────────────────
    const orphans = db.prepare(`
      SELECT u.id, u.organization_id, u.role FROM cloud_users u
      WHERE NOT EXISTS (
        SELECT 1 FROM memberships m
        WHERE m.organization_id = u.organization_id AND m.user_id = u.id AND m.status = 'active'
      )
    `).all();
    console.log(`      orphaned users before repair: ${orphans.length}`);
    const insertMembership = db.prepare(`
      INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
      VALUES (?, ?, ?, NULL, NULL, ?, 'active', ?, ?)
    `);
    const now = new Date().toISOString();
    for (const orphan of orphans) {
      insertMembership.run(`reconcile-membership-${orphan.id}`, orphan.organization_id, orphan.id, orphan.role, now, now);
    }
    const remaining = db.prepare(`
      SELECT COUNT(*) AS count FROM cloud_users u
      WHERE NOT EXISTS (
        SELECT 1 FROM memberships m
        WHERE m.organization_id = u.organization_id AND m.user_id = u.id AND m.status = 'active'
      )
    `).get();
    check('Organization-level membership repair covers every user', Number(remaining.count) === 0);

    // ── 4. Readiness ────────────────────────────────────────────────────────
    readiness(db);

    db.close();
    fs.rmSync(file, { force: true });
    fs.rmSync(backup, { force: true });
  } finally {
    try { if (db) db.close(); } catch { /* already closed */ }
  }

  if (failures.length > 0) {
    console.error(`\nReconciliation rehearsal failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nD1 reconciliation rehearsal passed. Production still needs a reviewed backup/restore and authorization.');
  }
}

main();
