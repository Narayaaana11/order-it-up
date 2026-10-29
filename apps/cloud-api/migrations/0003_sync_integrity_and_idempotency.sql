-- D1 Migration 0003: Sync Integrity, Event Idempotency & Financial Protection

-- 1. Persistent Event-Level Idempotency Store
CREATE TABLE IF NOT EXISTS sync_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    terminal_id TEXT NOT NULL REFERENCES terminals(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    payload_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processed',
    processed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_events_org_branch ON sync_events(organization_id, branch_id, processed_at);
CREATE INDEX IF NOT EXISTS idx_sync_events_entity ON sync_events(entity_type, entity_id);

-- 2. Add status column to terminals (active / revoked)
ALTER TABLE terminals ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

-- 3. Query Performance & Isolation Indexes
CREATE INDEX IF NOT EXISTS idx_synced_orders_tenant_lookup ON synced_orders(id, organization_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_synced_closures_tenant_lookup ON synced_cash_closures(id, organization_id, branch_id);
