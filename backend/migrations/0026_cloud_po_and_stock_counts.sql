-- D1 Migration 0026: Cloud Purchase Orders (GRN) and Physical Stock Counts
-- Completes Cloud operational parity with desktop procurement and inventory audits.

CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    vendor_id TEXT REFERENCES restaurant_vendors(id) ON DELETE SET NULL,
    po_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ordered', -- 'draft', 'ordered', 'received', 'cancelled'
    notes TEXT,
    total_amount REAL NOT NULL DEFAULT 0,
    idempotency_key TEXT,
    created_by_user_id TEXT,
    created_by_name TEXT,
    received_at TEXT,
    received_by_user_id TEXT,
    received_by_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch ON purchase_orders(branch_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_idempotency
    ON purchase_orders(branch_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id TEXT PRIMARY KEY,
    purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    ingredient_name TEXT NOT NULL,
    quantity REAL NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL DEFAULT 'kg',
    unit_cost REAL NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    line_total REAL NOT NULL DEFAULT 0,
    received_quantity REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);

CREATE TABLE IF NOT EXISTS stock_counts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    idempotency_key TEXT,
    created_by_user_id TEXT,
    created_by_name TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_counts_branch ON stock_counts(branch_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_counts_idempotency
    ON stock_counts(branch_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS stock_count_items (
    id TEXT PRIMARY KEY,
    stock_count_id TEXT NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
    ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    ingredient_name TEXT NOT NULL,
    system_stock REAL NOT NULL,
    counted_stock REAL NOT NULL CHECK (counted_stock >= 0),
    variance REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_count_items_sc ON stock_count_items(stock_count_id);
