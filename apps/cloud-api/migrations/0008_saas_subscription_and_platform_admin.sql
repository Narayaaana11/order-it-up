-- D1 Migration 0008: Canonical SaaS Plan Catalog, Subscription Ledger & Platform Admin Audit
-- Pricing is snapshotted on each subscription so future catalog price changes do not
-- silently alter existing customers. Existing tenants are deliberately not backfilled:
-- their existing access remains unchanged until explicitly migrated by an operator.

ALTER TABLE organizations
  ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'
  CHECK (account_status IN ('active', 'suspended', 'closed'));

CREATE TABLE IF NOT EXISTS saas_plans (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  monthly_price_minor INTEGER NOT NULL CHECK (monthly_price_minor >= 0),
  yearly_price_minor INTEGER NOT NULL CHECK (yearly_price_minor >= 0),
  entitlements_json TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO saas_plans
  (code, name, currency, monthly_price_minor, yearly_price_minor, entitlements_json, sort_order, created_at, updated_at)
VALUES
  ('starter', 'Starter', 'INR', 49900, 499900,
   '{"maxTerminals":1,"multiTerminal":false,"kdsStations":false,"cloudSync":false,"whatsappReceipts":false,"advancedReports":false,"multiOutlet":false,"inventoryTracking":false}',
   1, datetime('now'), datetime('now')),
  ('pro', 'Professional', 'INR', 129900, 1299900,
   '{"maxTerminals":5,"multiTerminal":true,"kdsStations":true,"cloudSync":true,"whatsappReceipts":true,"advancedReports":true,"multiOutlet":false,"inventoryTracking":true}',
   2, datetime('now'), datetime('now')),
  ('enterprise', 'Enterprise', 'INR', 299900, 2999900,
   '{"maxTerminals":50,"multiTerminal":true,"kdsStations":true,"cloudSync":true,"whatsappReceipts":true,"advancedReports":true,"multiOutlet":true,"inventoryTracking":true}',
   3, datetime('now'), datetime('now'));

CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL REFERENCES saas_plans(code),
  status TEXT NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial', 'active', 'past_due', 'grace_period', 'suspended', 'cancelled', 'expired')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  currency TEXT NOT NULL DEFAULT 'INR',
  amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
  trial_ends_at TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK (cancel_at_period_end IN (0, 1)),
  provider TEXT,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status
  ON organization_subscriptions(status, plan_code);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_period_end
  ON organization_subscriptions(current_period_end);

CREATE TABLE IF NOT EXISTS subscription_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id TEXT REFERENCES organization_subscriptions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  external_event_id TEXT,
  event_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_events_external
  ON subscription_events(source, external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS platform_admin_audit_log (
  id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  reason TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_org
  ON platform_admin_audit_log(organization_id, created_at);
