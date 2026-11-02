CREATE TABLE IF NOT EXISTS master_addon_groups (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_required INTEGER NOT NULL DEFAULT 0 CHECK (is_required IN (0, 1)),
  allow_multiple_quantities INTEGER NOT NULL DEFAULT 0 CHECK (allow_multiple_quantities IN (0, 1)),
  min_selection INTEGER NOT NULL DEFAULT 0 CHECK (min_selection >= 0),
  max_selection INTEGER NOT NULL DEFAULT 1 CHECK (max_selection >= min_selection),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (id, organization_id)
);

CREATE TABLE IF NOT EXISTS master_addons (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  addon_group_id TEXT NOT NULL REFERENCES master_addon_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (id, organization_id)
);

CREATE TABLE IF NOT EXISTS master_product_addon_groups (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,
  addon_group_id TEXT NOT NULL REFERENCES master_addon_groups(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (product_id, addon_group_id)
);

CREATE INDEX IF NOT EXISTS idx_master_addon_groups_org_active
  ON master_addon_groups(organization_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_master_addons_group_active
  ON master_addons(addon_group_id, organization_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_master_product_addon_groups_product
  ON master_product_addon_groups(organization_id, product_id, sort_order);

CREATE TRIGGER IF NOT EXISTS trg_master_addons_org_insert
BEFORE INSERT ON master_addons
WHEN NOT EXISTS (
  SELECT 1 FROM master_addon_groups g
  WHERE g.id = NEW.addon_group_id AND g.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'modifier group belongs to a different organization');
END;

CREATE TRIGGER IF NOT EXISTS trg_master_addons_org_update
BEFORE UPDATE OF organization_id, addon_group_id ON master_addons
WHEN NOT EXISTS (
  SELECT 1 FROM master_addon_groups g
  WHERE g.id = NEW.addon_group_id AND g.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'modifier group belongs to a different organization');
END;

CREATE TRIGGER IF NOT EXISTS trg_product_addon_groups_scope_insert
BEFORE INSERT ON master_product_addon_groups
WHEN NOT EXISTS (
  SELECT 1 FROM master_products p JOIN master_addon_groups g ON g.id = NEW.addon_group_id
  WHERE p.id = NEW.product_id AND p.organization_id = NEW.organization_id AND g.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'product or modifier group belongs to a different organization');
END;

CREATE TRIGGER IF NOT EXISTS trg_product_addon_groups_scope_update
BEFORE UPDATE OF organization_id, product_id, addon_group_id ON master_product_addon_groups
WHEN NOT EXISTS (
  SELECT 1 FROM master_products p JOIN master_addon_groups g ON g.id = NEW.addon_group_id
  WHERE p.id = NEW.product_id AND p.organization_id = NEW.organization_id AND g.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'product or modifier group belongs to a different organization');
END;
