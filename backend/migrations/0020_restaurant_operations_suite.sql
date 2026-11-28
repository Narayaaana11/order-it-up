-- D1 Migration 0020: Cloud Restaurant Operations Suite
-- Expenses and vendors, reservations, raw-ingredient inventory with recipes,
-- and delivery dispatch. All operational rows are organization- and branch-scoped
-- so the Worker can enforce tenant isolation at the SQL boundary.

-- 1. Vendor registry (suppliers, service providers)
CREATE TABLE IF NOT EXISTS restaurant_vendors (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    gstin TEXT,
    address TEXT,
    balance REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'archived'
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_vendors_org ON restaurant_vendors(organization_id, status);

-- 2. Expense categories
CREATE TABLE IF NOT EXISTS expense_categories (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (organization_id, name)
);

-- 3. Expense ledger. Rows are voided, never hard-deleted, so the audit trail survives.
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES expense_categories(id) ON DELETE SET NULL,
    vendor_id TEXT REFERENCES restaurant_vendors(id) ON DELETE SET NULL,
    amount REAL NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'upi', 'card', 'bank_transfer'
    description TEXT NOT NULL,
    expense_date TEXT NOT NULL, -- Business date YYYY-MM-DD
    status TEXT NOT NULL DEFAULT 'recorded', -- 'recorded', 'voided'
    voided_reason TEXT,
    recorded_by_user_id TEXT,
    recorded_by_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_branch_date ON expenses(branch_id, expense_date, status);
CREATE INDEX IF NOT EXISTS idx_expenses_org_date ON expenses(organization_id, expense_date);

-- 4. Table reservations
CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    table_id TEXT REFERENCES dining_tables(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    guest_count INTEGER NOT NULL DEFAULT 2 CHECK (guest_count > 0),
    reservation_date TEXT NOT NULL, -- YYYY-MM-DD (branch business date)
    reservation_time TEXT NOT NULL, -- HH:MM (24h)
    reserved_at TEXT NOT NULL, -- ISO instant for ordering and overlap checks
    status TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'
    notes TEXT,
    created_by_user_id TEXT,
    created_by_name TEXT,
    seated_at TEXT,
    cancelled_at TEXT,
    cancellation_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reservations_branch_date ON reservations(branch_id, reservation_date, status);
CREATE INDEX IF NOT EXISTS idx_reservations_table_time ON reservations(table_id, reserved_at);

-- 5. Raw ingredient inventory (branch level)
CREATE TABLE IF NOT EXISTS ingredients (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'kg',
    current_stock REAL NOT NULL DEFAULT 0,
    minimum_stock REAL NOT NULL DEFAULT 0,
    cost_per_unit REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (branch_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ingredients_branch_active ON ingredients(branch_id, is_active);

-- 6. Immutable stock movement audit trail
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'initial', 'adjustment_increase', 'adjustment_decrease', 'adjustment_set', 'waste'
    quantity REAL NOT NULL, -- Signed effect applied to stock
    balance_after REAL NOT NULL,
    reason TEXT,
    reference_id TEXT,
    idempotency_key TEXT,
    created_by_user_id TEXT,
    created_by_name TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_branch ON inventory_transactions(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_ingredient ON inventory_transactions(ingredient_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_transactions_idempotency
    ON inventory_transactions(ingredient_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 7. Recipe bill of materials (master product -> raw ingredient)
CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,
    ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity_required REAL NOT NULL CHECK (quantity_required > 0),
    unit TEXT,
    wastage_percentage REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (product_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_recipes_product ON recipes(product_id);

-- 8. Delivery dispatch jobs (one per delivery order)
CREATE TABLE IF NOT EXISTS delivery_jobs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL REFERENCES synced_orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'assigned', 'picked_up', 'delivered', 'cancelled'
    address TEXT NOT NULL,
    landmark TEXT,
    customer_phone TEXT,
    driver_user_id TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    eta_minutes INTEGER,
    cod_amount REAL NOT NULL DEFAULT 0,
    cod_collected INTEGER NOT NULL DEFAULT 0,
    assigned_at TEXT,
    picked_up_at TEXT,
    delivered_at TEXT,
    cancelled_at TEXT,
    cancellation_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_jobs_branch_status ON delivery_jobs(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_delivery_jobs_driver ON delivery_jobs(driver_user_id, status);
