ALTER TABLE synced_order_items ADD COLUMN product_sku TEXT;

CREATE TABLE IF NOT EXISTS qr_order_pos_deliveries (
  order_id TEXT PRIMARY KEY REFERENCES synced_orders(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  terminal_id TEXT REFERENCES terminals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered')),
  claim_expires_at TEXT,
  local_order_id TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  delivered_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_qr_order_pos_delivery_poll
  ON qr_order_pos_deliveries(organization_id, branch_id, status, claim_expires_at, created_at);
