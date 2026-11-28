-- D1 Migration 0004: Multi-Restaurant Hierarchy, Branch Ownership & Location-Scoped Memberships

-- 1. Restaurants (Brands / Concepts) Table
CREATE TABLE IF NOT EXISTS restaurants (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT,
    concept_type TEXT NOT NULL DEFAULT 'dine_in', -- 'dine_in', 'qsr', 'cafe', 'bar', 'cloud_kitchen'
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_restaurants_org ON restaurants(organization_id);

-- 2. Add restaurant_id to branches table
-- SQLite 3.35+ allows ALTER TABLE ADD COLUMN
ALTER TABLE branches ADD COLUMN restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_branches_restaurant ON branches(restaurant_id);

-- 3. Backfill Default Restaurant Concepts for Existing Organizations (Repeatable/Idempotent)
INSERT INTO restaurants (id, organization_id, name, slug, concept_type, status, created_at, updated_at)
SELECT 
    'rest_' || o.id,
    o.id,
    o.name,
    'main',
    'dine_in',
    'active',
    o.created_at,
    o.updated_at
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM restaurants r WHERE r.organization_id = o.id
);

-- 4. Backfill Existing Branches into Default Restaurant (Repeatable/Idempotent)
UPDATE branches
SET restaurant_id = (
    SELECT r.id FROM restaurants r WHERE r.organization_id = branches.organization_id LIMIT 1
)
WHERE restaurant_id IS NULL;

-- 5. Memberships Table (Normalized Multi-Location Scoped RBAC)
CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES cloud_users(id) ON DELETE CASCADE,
    restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE, -- NULL = Org-level access
    branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,         -- NULL = Restaurant/Org-level access
    role TEXT NOT NULL, -- 'owner', 'manager', 'accountant', 'cashier', 'server', 'chef'
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_role ON memberships(organization_id, role);
CREATE INDEX IF NOT EXISTS idx_memberships_branch ON memberships(branch_id);

-- Enforce Scope-Specific Uniqueness without NULL collisions
-- Case A: Org-level membership (restaurant_id IS NULL AND branch_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_org_user_orglevel 
ON memberships(organization_id, user_id) 
WHERE restaurant_id IS NULL AND branch_id IS NULL;

-- Case B: Restaurant-level membership (restaurant_id IS NOT NULL AND branch_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_org_user_restlevel 
ON memberships(organization_id, user_id, restaurant_id) 
WHERE restaurant_id IS NOT NULL AND branch_id IS NULL;

-- Case C: Branch-level membership (branch_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_org_user_branchlevel 
ON memberships(organization_id, user_id, restaurant_id, branch_id) 
WHERE branch_id IS NOT NULL;

-- 6. Backfill Existing Cloud Users into Memberships (Repeatable/Idempotent)
-- 6a. Organization-level Owners & Accountants
INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
SELECT 
    'm_org_' || u.id,
    u.organization_id,
    u.id,
    NULL,
    NULL,
    u.role,
    u.status,
    u.created_at,
    u.updated_at
FROM cloud_users u
WHERE (u.role = 'owner' OR u.role = 'accountant' OR u.assigned_branch_id IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM memberships m 
    WHERE m.organization_id = u.organization_id 
      AND m.user_id = u.id 
      AND m.restaurant_id IS NULL 
      AND m.branch_id IS NULL
  );

-- 6b. Branch-Assigned Staff Members (Cashiers, Managers assigned to single branch)
INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
SELECT 
    'm_br_' || u.id || '_' || b.id,
    u.organization_id,
    u.id,
    b.restaurant_id,
    b.id,
    u.role,
    u.status,
    u.created_at,
    u.updated_at
FROM cloud_users u
JOIN branches b ON u.assigned_branch_id = b.id
WHERE u.assigned_branch_id IS NOT NULL
  AND u.role NOT IN ('owner', 'accountant')
  AND NOT EXISTS (
    SELECT 1 FROM memberships m 
    WHERE m.organization_id = u.organization_id 
      AND m.user_id = u.id 
      AND m.branch_id = b.id
  );
