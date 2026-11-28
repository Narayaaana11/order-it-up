-- Public customer QR capabilities are kept separate from staff JWTs and terminal credentials.
CREATE TABLE IF NOT EXISTS qr_table_tokens (
  table_id TEXT PRIMARY KEY REFERENCES dining_tables(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_qr_table_tokens_scope
  ON qr_table_tokens(organization_id, branch_id, revoked_at);

CREATE TABLE IF NOT EXISTS qr_order_tracking_tokens (
  order_id TEXT PRIMARY KEY REFERENCES synced_orders(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_qr_order_tracking_tokens_expiry
  ON qr_order_tracking_tokens(expires_at);
