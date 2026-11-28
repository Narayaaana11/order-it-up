-- D1 Migration 0006: Auditable Restaurant Customer Payment Ledger & Split Tenders

-- 1. Customer Payments Ledger
CREATE TABLE IF NOT EXISTS customer_payments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL REFERENCES synced_orders(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL, -- 'cash', 'upi', 'card', 'custom', 'razorpay_pos'
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'refunded', 'voided'
    verification_method TEXT NOT NULL DEFAULT 'manual_cashier_confirmed', -- 'cashier_collected', 'manual_cashier_confirmed', 'gateway_verified', 'terminal_verified', 'legacy_reconciled'
    external_reference_id TEXT, -- UTR, bank auth code, POS terminal tx ref
    cashier_user_id TEXT,       -- User who collected/authorized payment
    cashier_name TEXT,
    terminal_id TEXT,          -- Physical terminal or device ID
    idempotency_key TEXT,      -- Client-supplied idempotency key
    is_split INTEGER NOT NULL DEFAULT 0,
    parent_payment_id TEXT REFERENCES customer_payments(id) ON DELETE SET NULL, -- For refunds linking to original tender
    refund_reason TEXT,
    refund_type TEXT,          -- 'manual_cashier_refund', 'manual_manager_refund', 'gateway_refund'
    refunded_amount REAL NOT NULL DEFAULT 0,
    metadata_json TEXT,        -- Breakdown or tender-specific metadata
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Indexing for fast order payment lookups and reconciliation
CREATE INDEX IF NOT EXISTS idx_customer_payments_order ON customer_payments(order_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_payments_branch ON customer_payments(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_customer_payments_org ON customer_payments(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_customer_payments_method ON customer_payments(branch_id, payment_method);

-- Unique idempotency constraint per branch to prevent duplicate charges
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_payments_idempotency 
ON customer_payments(branch_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Prevent reuse of the same external transaction reference across different payments
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_payments_ext_ref 
ON customer_payments(branch_id, payment_method, external_reference_id)
WHERE external_reference_id IS NOT NULL AND status != 'failed';

-- 2. Backfill Existing Paid Synced Orders into Customer Payments Ledger (Idempotent)
INSERT INTO customer_payments (
    id, organization_id, restaurant_id, branch_id, order_id, payment_method,
    amount, currency, status, verification_method, external_reference_id, cashier_user_id, cashier_name,
    terminal_id, idempotency_key, is_split, created_at, updated_at
)
SELECT
    'pay_legacy_' || o.id,
    o.organization_id,
    o.restaurant_id,
    o.branch_id,
    o.id,
    COALESCE(o.payment_method, 'cash'),
    o.grand_total,
    'INR',
    'completed',
    'legacy_reconciled',
    CASE WHEN o.payment_method = 'cash' THEN NULL ELSE 'LEGACY_' || o.id END,
    o.created_by_user_id,
    o.created_by_name,
    o.terminal_id,
    'idemp_legacy_' || o.id,
    0,
    COALESCE(o.updated_at, o.ordered_at),
    COALESCE(o.updated_at, o.ordered_at)
FROM synced_orders o
WHERE o.payment_status = 'paid'
  AND o.grand_total > 0
  AND NOT EXISTS (
    SELECT 1 FROM customer_payments cp WHERE cp.order_id = o.id
  );
