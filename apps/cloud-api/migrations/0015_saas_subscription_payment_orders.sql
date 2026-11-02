CREATE TABLE IF NOT EXISTS saas_subscription_payment_orders (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL REFERENCES saas_plans(code),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider = 'razorpay'),
  provider_order_id TEXT UNIQUE,
  provider_payment_id TEXT UNIQUE,
  receipt TEXT NOT NULL UNIQUE,
  idempotency_key_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'creating'
    CHECK (status IN ('creating', 'created', 'captured', 'failed', 'expired')),
  expires_at TEXT NOT NULL,
  captured_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, idempotency_key_hash)
);

CREATE INDEX IF NOT EXISTS idx_saas_subscription_payment_org_status
  ON saas_subscription_payment_orders(organization_id, status, created_at DESC);
