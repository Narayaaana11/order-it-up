import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const Database = require('better-sqlite3');
const migrationDir = path.join(__dirname, '../apps/cloud-api/migrations');

function run() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  const migrations = fs.readdirSync(migrationDir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();

  assert.ok(migrations.includes('0008_saas_subscription_and_platform_admin.sql'));
  assert.ok(migrations.includes('0009_subscription_grace_periods.sql'));

  for (const migration of migrations) {
    const sql = fs.readFileSync(path.join(migrationDir, migration), 'utf8');
    db.exec(sql);
  }

  const planCount = db.prepare('SELECT COUNT(*) AS count FROM saas_plans').get().count;
  assert.equal(planCount, 3, 'Starter, Professional and Enterprise plans are seeded');

  const starter = db.prepare("SELECT monthly_price_minor, yearly_price_minor, entitlements_json FROM saas_plans WHERE code = 'starter'").get();
  assert.equal(starter.monthly_price_minor, 49900);
  assert.equal(starter.yearly_price_minor, 499900);
  assert.equal(JSON.parse(starter.entitlements_json).maxTerminals, 1);

  const orgId = 'migration-test-org';
  db.prepare(`
    INSERT INTO organizations (id, name, legal_name, tax_number, currency, country, timezone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(orgId, 'Migration Test Restaurant', 'Migration Test Restaurant', null, 'INR', 'IN', 'Asia/Kolkata', new Date().toISOString(), new Date().toISOString());

  db.prepare(`
    INSERT INTO organization_subscriptions
      (id, organization_id, plan_code, status, billing_cycle, currency, amount_minor, trial_ends_at, created_at, updated_at)
    VALUES (?, ?, 'starter', 'trial', 'monthly', 'INR', 49900, ?, ?, ?)
  `).run('migration-test-sub', orgId, '2026-11-16T00:00:00.000Z', new Date().toISOString(), new Date().toISOString());

  const columns = db.prepare('PRAGMA table_info(organization_subscriptions)').all().map((row: any) => row.name);
  assert.ok(columns.includes('grace_period_end'), 'Migration 0009 adds persisted grace-period end');
  const status = db.prepare('SELECT status, grace_period_end FROM organization_subscriptions WHERE organization_id = ?').get(orgId);
  assert.equal(status.status, 'trial');
  assert.equal(status.grace_period_end, null);

  const auditTable = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'platform_admin_audit_log'").get();
  assert.ok(auditTable, 'Platform admin audit log exists');

  db.close();
  console.log(`Cloud SaaS migrations passed (${migrations.join(', ')}).`);
}

run();
