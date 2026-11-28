-- D1 Migration 0005: Shared Real-Time Restaurant Operations, Dining Tables & Kitchen Tickets

-- 1. Dining Tables (Physical Branch Floor Plan & Table Management)
CREATE TABLE IF NOT EXISTS dining_tables (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'available', -- 'available', 'occupied', 'reserved', 'cleaning'
    current_order_id TEXT, -- Logical reference to active synced_orders(id)
    floor TEXT,
    section TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(branch_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_dining_tables_branch ON dining_tables(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_dining_tables_org ON dining_tables(organization_id);

-- 2. Kitchen Display Tickets (Station Ticket Queue Derived from Orders)
CREATE TABLE IF NOT EXISTS kitchen_tickets (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL REFERENCES synced_orders(id) ON DELETE CASCADE,
    ticket_number TEXT NOT NULL,
    station TEXT NOT NULL DEFAULT 'main_kitchen',
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'preparing', 'ready', 'completed', 'cancelled'
    items_json TEXT NOT NULL, -- JSON snapshot of ticket items
    notes TEXT,
    prep_time_minutes INTEGER NOT NULL DEFAULT 15,
    started_at TEXT,
    ready_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_branch_status ON kitchen_tickets(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_order ON kitchen_tickets(order_id);

-- 3. Extend synced_orders for Unified Operational State & Scoping
-- SQLite 3.35+ supports ALTER TABLE ADD COLUMN
ALTER TABLE synced_orders ADD COLUMN restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE synced_orders ADD COLUMN table_id TEXT REFERENCES dining_tables(id) ON DELETE SET NULL;
ALTER TABLE synced_orders ADD COLUMN table_number TEXT;
ALTER TABLE synced_orders ADD COLUMN customer_name TEXT;
ALTER TABLE synced_orders ADD COLUMN customer_phone TEXT;
ALTER TABLE synced_orders ADD COLUMN created_by_user_id TEXT;
ALTER TABLE synced_orders ADD COLUMN created_by_name TEXT;
ALTER TABLE synced_orders ADD COLUMN kitchen_status TEXT NOT NULL DEFAULT 'pending'; -- 'pending', 'preparing', 'ready', 'served', 'cancelled'
ALTER TABLE synced_orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'; -- 'unpaid', 'partially_paid', 'paid', 'refunded', 'voided'
ALTER TABLE synced_orders ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE synced_orders ADD COLUMN notes TEXT;
ALTER TABLE synced_orders ADD COLUMN cancellation_reason TEXT;
ALTER TABLE synced_orders ADD COLUMN cancelled_by_user_id TEXT;
ALTER TABLE synced_orders ADD COLUMN cancelled_at TEXT;
ALTER TABLE synced_orders ADD COLUMN updated_at TEXT;

-- 4. Extend synced_order_items for Kitchen Routing & Line Attributes
ALTER TABLE synced_order_items ADD COLUMN restaurant_id TEXT REFERENCES restaurants(id);
ALTER TABLE synced_order_items ADD COLUMN kitchen_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE synced_order_items ADD COLUMN modifiers_json TEXT;
ALTER TABLE synced_order_items ADD COLUMN special_instructions TEXT;
ALTER TABLE synced_order_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE synced_order_items ADD COLUMN updated_at TEXT;

-- 5. Backfill Operational Scoping & Legacy Compatibility (Idempotent)
UPDATE synced_orders
SET restaurant_id = (
    SELECT b.restaurant_id FROM branches b WHERE b.id = synced_orders.branch_id
)
WHERE restaurant_id IS NULL;

UPDATE synced_orders
SET updated_at = COALESCE(synced_at, ordered_at)
WHERE updated_at IS NULL;

UPDATE synced_orders
SET payment_status = 'paid'
WHERE status = 'completed' AND (payment_status = 'unpaid' OR payment_status IS NULL);

UPDATE synced_orders
SET kitchen_status = 'served'
WHERE status = 'completed' AND (kitchen_status = 'pending' OR kitchen_status IS NULL);

UPDATE synced_order_items
SET restaurant_id = (
    SELECT o.restaurant_id FROM synced_orders o WHERE o.id = synced_order_items.order_id
)
WHERE restaurant_id IS NULL;

UPDATE synced_order_items
SET updated_at = ordered_at
WHERE updated_at IS NULL;

-- 6. Performance & Operational Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_synced_orders_branch_status ON synced_orders(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_synced_orders_branch_kitchen ON synced_orders(branch_id, kitchen_status);
CREATE INDEX IF NOT EXISTS idx_synced_orders_restaurant ON synced_orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_synced_orders_table ON synced_orders(table_id);
