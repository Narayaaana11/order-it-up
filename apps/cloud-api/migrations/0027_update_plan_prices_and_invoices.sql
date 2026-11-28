-- D1 Migration 0027: Update SaaS plan prices to confirmed commercial pricing
-- Starter: ₹499/mo → ₹4,990/yr (2 months free)
-- Pro: ₹1,499/mo → ₹14,990/yr (2 months free)  — was ₹1,299/₹12,999
-- Enterprise: ₹3,999/mo → ₹39,990/yr (2 months free) — was ₹2,999/₹29,999
-- Terminal limits: Starter=1, Pro=3 (was 5), Enterprise=9999 (unlimited, was 50)
--
-- SAFETY: existing subscriptions are NOT repriced (prices are snapshotted at subscription time).
-- Only the catalogue prices change — new checkouts will use the new prices.

UPDATE saas_plans
SET
  monthly_price_minor = 49900,
  yearly_price_minor  = 499000,
  entitlements_json   = '{"maxTerminals":1,"multiTerminal":false,"kdsStations":false,"cloudSync":false,"whatsappReceipts":false,"advancedReports":false,"multiOutlet":false,"inventoryTracking":false}',
  updated_at          = datetime('now')
WHERE code = 'starter';

UPDATE saas_plans
SET
  monthly_price_minor = 149900,
  yearly_price_minor  = 1499000,
  entitlements_json   = '{"maxTerminals":3,"multiTerminal":true,"kdsStations":true,"cloudSync":true,"whatsappReceipts":true,"advancedReports":true,"multiOutlet":false,"inventoryTracking":true}',
  updated_at          = datetime('now')
WHERE code = 'pro';

UPDATE saas_plans
SET
  monthly_price_minor = 399900,
  yearly_price_minor  = 3999000,
  entitlements_json   = '{"maxTerminals":9999,"multiTerminal":true,"kdsStations":true,"cloudSync":true,"whatsappReceipts":true,"advancedReports":true,"multiOutlet":true,"inventoryTracking":true}',
  updated_at          = datetime('now')
WHERE code = 'enterprise';

-- GST invoice tracking table
-- Invoices are generated on first download and cached as rendered HTML.
-- invoice_number uses the format OIU-INV-{YYYY}-{sequential_padded}.
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id                   TEXT PRIMARY KEY,
  organization_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payment_order_id     TEXT NOT NULL REFERENCES saas_subscription_payment_orders(id),
  invoice_number       TEXT NOT NULL UNIQUE,
  invoice_date         TEXT NOT NULL,
  plan_code            TEXT NOT NULL,
  billing_cycle        TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  base_amount_minor    INTEGER NOT NULL CHECK (base_amount_minor >= 0),
  gst_rate_percent     INTEGER NOT NULL DEFAULT 18,
  gst_amount_minor     INTEGER NOT NULL CHECK (gst_amount_minor >= 0),
  total_amount_minor   INTEGER NOT NULL CHECK (total_amount_minor >= 0),
  currency             TEXT NOT NULL DEFAULT 'INR',
  buyer_name           TEXT,
  buyer_gstin          TEXT,
  buyer_state_code     TEXT,
  invoice_html         TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_org
  ON subscription_invoices(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_payment_order
  ON subscription_invoices(payment_order_id);

-- Invoice sequence counter for generating OIU-INV-{YYYY}-{N}
CREATE TABLE IF NOT EXISTS invoice_sequence (
  year    INTEGER PRIMARY KEY,
  last_n  INTEGER NOT NULL DEFAULT 0
);
