-- D1 Migration 0001: Initial Multi-Branch Schema

-- 1. Organizations & Tenants
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    legal_name TEXT,
    tax_number TEXT,
    currency TEXT NOT NULL DEFAULT 'INR',
    country TEXT NOT NULL DEFAULT 'IN',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 2. Branches / Outlets
CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    is_main_branch INTEGER NOT NULL DEFAULT 0,
    address TEXT,
    phone TEXT,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    settings_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(organization_id, code)
);

-- 3. Cloud Users (Owners, Accountants, Managers)
CREATE TABLE IF NOT EXISTS cloud_users (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    assigned_branch_id TEXT REFERENCES branches(id),
    status TEXT NOT NULL DEFAULT 'active',
    last_login_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 4. Terminals & Pairing
CREATE TABLE IF NOT EXISTS terminals (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    terminal_name TEXT NOT NULL,
    terminal_token_hash TEXT NOT NULL,
    last_seen_at TEXT,
    app_version TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pairing_tokens (
    code TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    terminal_name TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- 5. Master Product Catalog & Overrides
CREATE TABLE IF NOT EXISTS master_categories (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS master_products (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES master_categories(id),
    name TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    base_price REAL NOT NULL,
    tax_rate REAL NOT NULL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS branch_product_overrides (
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,
    price_override REAL,
    is_available INTEGER DEFAULT 1,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(branch_id, product_id)
);

-- 6. Orders & Item Sales
CREATE TABLE IF NOT EXISTS synced_orders (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    terminal_id TEXT,
    order_number TEXT NOT NULL,
    order_type TEXT NOT NULL,
    status TEXT NOT NULL,
    subtotal REAL NOT NULL,
    tax_total REAL NOT NULL,
    discount_total REAL NOT NULL,
    grand_total REAL NOT NULL,
    payment_method TEXT NOT NULL,
    ordered_at TEXT NOT NULL,
    synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS synced_order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES synced_orders(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id),
    product_id TEXT,
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL,
    tax_amount REAL NOT NULL,
    discount_amount REAL NOT NULL,
    ordered_at TEXT NOT NULL
);

-- 7. Cash Closures
CREATE TABLE IF NOT EXISTS synced_cash_closures (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    closure_date TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    closed_at TEXT NOT NULL,
    opening_cash REAL NOT NULL,
    cash_sales REAL NOT NULL,
    card_sales REAL NOT NULL,
    upi_sales REAL NOT NULL,
    other_sales REAL NOT NULL,
    expected_cash REAL NOT NULL,
    actual_cash REAL NOT NULL,
    variance REAL NOT NULL,
    notes TEXT,
    closed_by TEXT NOT NULL,
    synced_at TEXT NOT NULL
);

-- 8. Inter-Branch Stock Transfers
CREATE TABLE IF NOT EXISTS inventory_transfers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_branch_id TEXT NOT NULL REFERENCES branches(id),
    dest_branch_id TEXT NOT NULL REFERENCES branches(id),
    status TEXT NOT NULL DEFAULT 'pending',
    items_json TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    approved_by TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_branches_org ON branches(organization_id);
CREATE INDEX IF NOT EXISTS idx_terminals_branch ON terminals(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_org_branch_date ON synced_orders(organization_id, branch_id, ordered_at);
CREATE INDEX IF NOT EXISTS idx_order_items_branch_product ON synced_order_items(branch_id, product_id, ordered_at);
CREATE INDEX IF NOT EXISTS idx_closures_org_branch ON synced_cash_closures(organization_id, branch_id, closure_date);
