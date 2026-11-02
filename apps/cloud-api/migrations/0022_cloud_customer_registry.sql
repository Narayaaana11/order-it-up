-- D1 Migration 0022: Cloud Customer Registry
-- Cloud has historically had no customer directory, so the CRM/customer screen
-- and waiter table seating could not work online. This stores organization-scoped
-- customers while order history remains the source of spend/visit aggregates.

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    phone_digits TEXT,
    country_code TEXT,
    email TEXT,
    notes TEXT,
    dietary_preferences_json TEXT,
    favourite_dishes_json TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_org_phone
    ON customers(organization_id, phone)
    WHERE phone IS NOT NULL AND phone != '';

CREATE INDEX IF NOT EXISTS idx_customers_org_name ON customers(organization_id, name);
CREATE INDEX IF NOT EXISTS idx_customers_org_digits ON customers(organization_id, phone_digits);
