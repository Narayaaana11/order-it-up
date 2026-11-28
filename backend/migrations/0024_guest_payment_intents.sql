-- D1 Migration 0024: Guest Payment Intents
-- Server-created provider payment intents for guest bills. A bill is only marked
-- paid through /api/payments/verify after the provider confirms capture and the
-- amount/currency/order binding matches this row.

CREATE TABLE IF NOT EXISTS payment_intents (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL REFERENCES synced_orders(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'razorpay',
    provider_order_id TEXT NOT NULL,
    provider_payment_id TEXT,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'created', -- 'created', 'verified', 'failed', 'cancelled'
    payment_method TEXT,
    idempotency_key TEXT,
    created_by_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    verified_at TEXT,
    metadata_json TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_provider_order
    ON payment_intents(provider, provider_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_idempotency
    ON payment_intents(branch_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_intents_order ON payment_intents(order_id, status);
