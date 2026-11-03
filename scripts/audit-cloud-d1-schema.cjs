#!/usr/bin/env node
/* Read-only comparison of a remote D1 schema with the checked-in migration chain. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const databaseName = process.env.OIU_D1_DATABASE || 'orderitup-d1-prod';
if (!/^[A-Za-z0-9_-]+$/.test(databaseName)) throw new Error('OIU_D1_DATABASE contains invalid characters');
const repoRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(repoRoot, 'apps', 'cloud-api', 'migrations');

function runWrangler(sql) {
  const localWrangler = path.join(
    repoRoot,
    'apps',
    'cloud-api',
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler',
  );
  const hasLocalWrangler = fs.existsSync(localWrangler);
  const executable = hasLocalWrangler ? localWrangler : (process.platform === 'win32' ? 'npx.cmd' : 'npx');
  const normalizedSql = sql.replace(/\s+/g, ' ').trim();
  const commandArgument = process.platform === 'win32' ? `"${normalizedSql.replace(/"/g, '\\"')}"` : normalizedSql;
  const command = ['d1', 'execute', databaseName, '--remote', '--command', commandArgument, '--json'];
  const args = hasLocalWrangler ? command : ['wrangler', ...command];
  const result = spawnSync(executable, args, { cwd: repoRoot, encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `Wrangler exited ${result.status}`).trim());
  try { return JSON.parse(result.stdout); }
  catch { throw new Error(`Could not parse Wrangler JSON output: ${result.stdout.slice(0, 500)}`); }
}

function firstResults(payload) {
  const first = Array.isArray(payload) ? payload[0] : payload;
  if (!first || first.success === false) throw new Error(first?.error || 'D1 query failed');
  return first.results || [];
}

function tableColumns(createSql) {
  const open = createSql.indexOf('(');
  if (open < 0) return new Set();
  let depth = 0;
  let quote = null;
  let start = open + 1;
  const parts = [];
  for (let i = open; i < createSql.length; i += 1) {
    const char = createSql[i];
    if (quote) {
      if (char === quote && createSql[i + 1] === quote) { i += 1; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === '`' || char === "'") { quote = char; continue; }
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) { parts.push(createSql.slice(start, i)); break; }
    } else if (char === ',' && depth === 1) {
      parts.push(createSql.slice(start, i));
      start = i + 1;
    }
  }
  const ignored = /^(CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN)\b/i;
  return new Set(parts.map((part) => part.trim().match(/^["`\[]?([A-Za-z_][A-Za-z0-9_]*)/)?.[1])
    .filter((name) => name && !ignored.test(name)));
}

function migrationAlterConflicts(migrations, remoteTables) {
  const conflicts = [];
  for (const file of migrations) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const pattern = /ALTER\s+TABLE\s+["`]?([A-Za-z_][A-Za-z0-9_]*)["`]?\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([A-Za-z_][A-Za-z0-9_]*)/gi;
    for (const match of sql.matchAll(pattern)) {
      const table = remoteTables.get(match[1]);
      if (table?.columns.has(match[2])) conflicts.push(`${file}: ${match[1]}.${match[2]} already exists`);
    }
  }
  return conflicts;
}

const migrations = fs.readdirSync(migrationsDir).filter((name) => /^\d+_.*\.sql$/.test(name)).sort();
const normalizeMigrationName = (name) => String(name || '').replace(/\.sql$/i, '');
const localDb = new DatabaseSync(':memory:');
localDb.exec('PRAGMA foreign_keys = ON');
for (const migration of migrations) localDb.exec(fs.readFileSync(path.join(migrationsDir, migration), 'utf8'));
const localObjects = localDb.prepare("SELECT type, name, sql FROM sqlite_master WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%'").all();
localDb.close();

// Inspect schema metadata first. A newly-created D1 database has no migration ledger.
// This audit is intentionally read-only: never create the ledger as part of inspection.
const remoteObjects = firstResults(runWrangler("SELECT type, name, sql FROM sqlite_master WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type, name"));
const remoteObjectTables = new Set(remoteObjects.filter((row) => row.type === 'table').map((row) => row.name));
const hasMigrationLedger = remoteObjectTables.has('d1_migrations');
const remoteLedgerRows = hasMigrationLedger
  ? firstResults(runWrangler('SELECT name, applied_at FROM d1_migrations ORDER BY id'))
  : [];
const remoteLedger = remoteLedgerRows.map((row) => row.name);
const backfillQuery = `SELECT
  (SELECT COUNT(*) FROM organizations o WHERE NOT EXISTS (SELECT 1 FROM restaurants r WHERE r.organization_id=o.id)) AS orgs_without_restaurant,
  (SELECT COUNT(*) FROM branches WHERE restaurant_id IS NULL) AS branches_without_restaurant,
  (SELECT COUNT(*) FROM cloud_users u WHERE (u.role IN ('owner','accountant') OR u.assigned_branch_id IS NULL) AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id=u.organization_id AND m.user_id=u.id AND m.restaurant_id IS NULL AND m.branch_id IS NULL)) AS users_missing_org_membership,
  (SELECT COUNT(*) FROM cloud_users u JOIN branches b ON b.id=u.assigned_branch_id WHERE u.assigned_branch_id IS NOT NULL AND u.role NOT IN ('owner','accountant') AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id=u.organization_id AND m.user_id=u.id AND m.branch_id=b.id)) AS users_missing_branch_membership,
  (SELECT COUNT(*) FROM synced_orders WHERE restaurant_id IS NULL OR updated_at IS NULL) AS orders_missing_0005_scoping_or_timestamp,
  (SELECT COUNT(*) FROM synced_orders WHERE status='completed' AND (payment_status='unpaid' OR kitchen_status='pending')) AS completed_orders_still_unpaid_or_unserved,
  (SELECT COUNT(*) FROM synced_order_items WHERE restaurant_id IS NULL OR updated_at IS NULL) AS items_requiring_0005_backfill,
  (SELECT COUNT(*) FROM synced_orders o WHERE o.payment_status='paid' AND o.grand_total>0 AND NOT EXISTS (SELECT 1 FROM customer_payments p WHERE p.order_id=o.id)) AS paid_orders_without_ledger_entry,
  (SELECT COUNT(*) FROM synced_orders o WHERE o.payment_status='paid' AND o.grand_total>0 AND NOT EXISTS (SELECT 1 FROM customer_payments p WHERE p.order_id=o.id) AND EXISTS (SELECT 1 FROM sync_events e WHERE e.entity_type='payment' AND e.entity_id=o.id)) AS paid_without_ledger_with_payment_event,
  (SELECT COUNT(*) FROM synced_orders o WHERE o.payment_status='paid' AND o.grand_total>0 AND NOT EXISTS (SELECT 1 FROM customer_payments p WHERE p.order_id=o.id) AND EXISTS (SELECT 1 FROM sync_events e WHERE e.entity_type='order' AND e.entity_id=o.id)) AS paid_without_ledger_with_order_event,
  (SELECT COUNT(*) FROM synced_orders o WHERE o.payment_status='paid' AND o.grand_total>0 AND NOT EXISTS (SELECT 1 FROM customer_payments p WHERE p.order_id=o.id) AND datetime(o.ordered_at) >= datetime((SELECT applied_at FROM d1_migrations WHERE name='0006_customer_payment_ledger.sql'))) AS paid_without_ledger_ordered_after_0006,
  (SELECT COUNT(*) FROM customer_payments WHERE id LIKE 'pay_legacy_%' AND verification_method='legacy_reconciled' AND order_id IN (SELECT id FROM synced_orders WHERE payment_status!='paid' OR payment_status IS NULL)) AS legacy_ledger_rows_0007_would_delete,
  (SELECT COUNT(*) FROM customer_payments WHERE id LIKE 'pay_legacy_%' AND external_reference_id='LEGACY_SETTLED') AS legacy_ledger_rows_0007_would_repair`;
const backfillDependencies = [
  'organizations', 'restaurants', 'branches', 'cloud_users', 'memberships',
  'synced_orders', 'synced_order_items', 'customer_payments', 'sync_events',
];
const missingBackfillDependencies = backfillDependencies.filter((name) => !remoteObjectTables.has(name));
const remoteBackfillState = missingBackfillDependencies.length === 0
  ? firstResults(runWrangler(backfillQuery))[0]
  : null;
const isEmptyDatabase = [...remoteObjectTables].every((name) => name === '_cf_KV' || name === 'd1_migrations');
const localTables = new Map(localObjects.filter((row) => row.type === 'table').map((row) => [row.name, { sql: row.sql, columns: tableColumns(row.sql || '') }]));
const remoteTables = new Map(remoteObjects.filter((row) => row.type === 'table' && row.name !== '_cf_KV' && row.name !== 'd1_migrations')
  .map((row) => [row.name, { sql: row.sql, columns: tableColumns(row.sql || '') }]));
const localIndexes = new Set(localObjects.filter((row) => row.type === 'index').map((row) => row.name));
const remoteIndexes = new Set(remoteObjects.filter((row) => row.type === 'index').map((row) => row.name));

const missingTables = [...localTables.keys()].filter((name) => !remoteTables.has(name)).sort();
const extraTables = [...remoteTables.keys()].filter((name) => !localTables.has(name)).sort();
const missingColumns = [];
for (const [table, local] of localTables) {
  const remote = remoteTables.get(table);
  if (!remote) continue;
  for (const column of local.columns) if (!remote.columns.has(column)) missingColumns.push(`${table}.${column}`);
}
const extraColumns = [];
for (const [table, remote] of remoteTables) {
  const local = localTables.get(table);
  if (!local) continue;
  for (const column of remote.columns) if (!local.columns.has(column)) extraColumns.push(`${table}.${column}`);
}
const missingIndexes = [...localIndexes].filter((name) => !remoteIndexes.has(name)).sort();
const migrationConflicts = migrationAlterConflicts(migrations, remoteTables);
const normalizedLedger = new Set(remoteLedger.map(normalizeMigrationName));
const missingLedgerEntries = migrations.filter((name) => !normalizedLedger.has(normalizeMigrationName(name)));
const unknownLedgerEntries = remoteLedger.filter((name) => !migrations.some((migration) => normalizeMigrationName(migration) === normalizeMigrationName(name)));

console.log(`# Read-only Cloud D1 schema audit: ${databaseName}`);
console.log(`Checked at: ${new Date().toISOString()}`);
console.log(`Local migrations: ${migrations.length}; ledger entries: ${remoteLedger.length}`);
console.log(`Ledger: ${remoteLedgerRows.length ? remoteLedgerRows.map((row) => `${row.name} @ ${row.applied_at}`).join('; ') : '(empty)'}`);
console.log(`Ledger entries missing locally: ${missingLedgerEntries.length ? missingLedgerEntries.join(', ') : '(none)'}`);
console.log(`Unknown ledger entries: ${unknownLedgerEntries.length ? unknownLedgerEntries.join(', ') : '(none)'}`);
console.log(`Tables missing from remote: ${missingTables.length ? missingTables.join(', ') : '(none)'}`);
console.log(`Remote-only tables: ${extraTables.length ? extraTables.join(', ') : '(none)'}`);
console.log(`Columns missing from remote: ${missingColumns.length ? missingColumns.join(', ') : '(none)'}`);
console.log(`Remote-only columns: ${extraColumns.length ? extraColumns.join(', ') : '(none)'}`);
console.log(`Indexes missing from remote: ${missingIndexes.length ? missingIndexes.join(', ') : '(none)'}`);
console.log(`Duplicate ADD COLUMN hazards if replayed without baseline reconciliation: ${migrationConflicts.length ? migrationConflicts.join('; ') : '(none detected)'}`);
if (remoteBackfillState) {
  console.log(`Checked historical backfill preconditions: ${JSON.stringify(remoteBackfillState)}`);
} else {
  console.log(`Historical backfill checks: SKIPPED — missing required tables: ${missingBackfillDependencies.join(', ')}`);
}
console.log('Only schema metadata and aggregate backfill-precondition counts were read; no row-level records were returned and no remote writes were issued.');
const migrationBackfillGaps = remoteBackfillState
  ? Object.entries(remoteBackfillState).filter(([key, count]) => key !== 'completed_orders_still_unpaid_or_unserved' && Number(count) > 0)
  : [];
const hasDrift = missingLedgerEntries.length > 0 || unknownLedgerEntries.length > 0 || missingTables.length > 0 || extraTables.length > 0 ||
  missingColumns.length > 0 || extraColumns.length > 0 || missingIndexes.length > 0 || migrationConflicts.length > 0 || migrationBackfillGaps.length > 0;
if (isEmptyDatabase && !hasMigrationLedger) {
  console.log('Readiness: EMPTY — isolated database verified; migration planning required');
} else {
  console.log(`Readiness: ${hasDrift ? 'BLOCKED — reconcile schema and data effects before migration' : 'MATCHES checked-in schema and sampled backfill invariants'}`);
  if (hasDrift) process.exitCode = 2;
}
