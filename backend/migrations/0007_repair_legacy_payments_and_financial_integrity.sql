-- D1 Migration 0007: Forward Correction - Repair Legacy Payment Backfill & Reconcile Financial Integrity

-- 1. Remove synthetic legacy payment records created for orders that were not actually marked paid
DELETE FROM customer_payments
WHERE id LIKE 'pay_legacy_%'
  AND verification_method = 'legacy_reconciled'
  AND order_id IN (
    SELECT id FROM synced_orders WHERE payment_status != 'paid' OR payment_status IS NULL
  );

-- 2. Repair any legacy backfilled payments that used the static 'LEGACY_SETTLED' string
-- to prevent unique index collisions on (branch_id, payment_method, external_reference_id)
UPDATE customer_payments
SET external_reference_id = CASE
    WHEN payment_method = 'cash' THEN NULL
    ELSE 'LEGACY_' || order_id
END
WHERE id LIKE 'pay_legacy_%'
  AND external_reference_id = 'LEGACY_SETTLED';
