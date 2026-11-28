-- D1 Migration 0025: Guest Payment Webhook Events
-- Durable deduplication for provider callbacks so a captured payment is
-- settled once even if Razorpay retries the delivery.

CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'razorpay',
    event_type TEXT NOT NULL,
    provider_order_id TEXT,
    provider_payment_id TEXT,
    payload_json TEXT,
    received_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_webhook_provider_event
    ON payment_webhook_events(provider, id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_order
    ON payment_webhook_events(provider_order_id);
