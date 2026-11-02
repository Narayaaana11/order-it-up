ALTER TABLE synced_orders ADD COLUMN completed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_synced_orders_branch_completed
  ON synced_orders(branch_id, completed_at);
