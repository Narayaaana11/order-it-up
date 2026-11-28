-- D1 Migration 0023: Held Table Orders
-- Waiters can park a table's order and resume it later. The mobile client keeps
-- the cart locally, so the Cloud row stores the hold metadata plus any item
-- snapshot supplied by richer clients.

CREATE TABLE IF NOT EXISTS held_orders (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    table_id TEXT REFERENCES dining_tables(id) ON DELETE SET NULL,
    table_name TEXT,
    customer_id TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    guest_count INTEGER NOT NULL DEFAULT 2,
    order_notes TEXT,
    items_json TEXT,
    created_by_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_held_orders_branch ON held_orders(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_held_orders_org ON held_orders(organization_id, created_at);
