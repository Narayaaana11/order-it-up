-- D1 Migration 0002: Rate Limiting & Hardened Pairing Tokens

-- 1. Shared Persistent Rate Limiting Table (Distributed across Worker instances)
CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    reset_at INTEGER NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);

-- 2. Add attempts and claimed columns to pairing_tokens (if not exists in SQLite)
-- SQLite 3.35+ supports ALTER TABLE ADD COLUMN
ALTER TABLE pairing_tokens ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pairing_tokens ADD COLUMN claimed INTEGER NOT NULL DEFAULT 0;
