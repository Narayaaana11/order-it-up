-- Persist bearer-token revocations so cloud logout takes effect immediately
-- across all Cloudflare Worker isolates until the token's own expiry.
CREATE TABLE IF NOT EXISTS cloud_token_revocations (
  token_hash TEXT PRIMARY KEY NOT NULL CHECK (length(token_hash) = 64),
  expires_at INTEGER NOT NULL CHECK (expires_at > 0),
  revoked_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cloud_token_revocations_expiry
  ON cloud_token_revocations(expires_at);
