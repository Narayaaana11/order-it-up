CREATE TABLE IF NOT EXISTS qr_order_idempotency (
  idempotency_key_hash TEXT PRIMARY KEY CHECK (length(idempotency_key_hash) = 64),
  table_id TEXT NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
  order_id TEXT NOT NULL UNIQUE REFERENCES synced_orders(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_qr_order_idempotency_table_created
  ON qr_order_idempotency(table_id, created_at);
