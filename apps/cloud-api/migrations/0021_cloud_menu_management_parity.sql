-- D1 Migration 0021: Cloud Menu Management Parity
-- The desktop product/category screens send richer fields than the original
-- Cloud master catalog stored. These columns let the same React screens run
-- against D1 without silently dropping merchant configuration.

ALTER TABLE master_categories ADD COLUMN description TEXT;
ALTER TABLE master_categories ADD COLUMN color TEXT;
ALTER TABLE master_categories ADD COLUMN slug TEXT;

ALTER TABLE master_products ADD COLUMN description TEXT;
ALTER TABLE master_products ADD COLUMN cost_price REAL;
ALTER TABLE master_products ADD COLUMN sale_unit TEXT NOT NULL DEFAULT 'each';
ALTER TABLE master_products ADD COLUMN allow_fractional_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE master_products ADD COLUMN weight_precision INTEGER NOT NULL DEFAULT 3;
ALTER TABLE master_products ADD COLUMN tax_category_id TEXT;
ALTER TABLE master_products ADD COLUMN tax_behavior TEXT NOT NULL DEFAULT 'country_default';
ALTER TABLE master_products ADD COLUMN cb_percent REAL;
ALTER TABLE master_products ADD COLUMN track_inventory INTEGER NOT NULL DEFAULT 0;
ALTER TABLE master_products ADD COLUMN stock_quantity REAL NOT NULL DEFAULT 0;
ALTER TABLE master_products ADD COLUMN low_stock_threshold REAL;
ALTER TABLE master_products ADD COLUMN tags_json TEXT;
ALTER TABLE master_products ADD COLUMN image_url TEXT;

CREATE INDEX IF NOT EXISTS idx_master_products_category ON master_products(organization_id, category_id);
CREATE INDEX IF NOT EXISTS idx_master_products_active ON master_products(organization_id, is_active);
