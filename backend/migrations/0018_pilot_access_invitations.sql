-- One-time, short-lived setup links for platform-approved pilot applicants.
-- Bearer tokens are never stored in D1; only SHA-256 hashes are retained.
CREATE TABLE IF NOT EXISTS pilot_access_invitations (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES pilot_access_requests(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  redeemed_at TEXT,
  redemption_claim_id TEXT UNIQUE,
  revoked_at TEXT,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pilot_access_invitations_request
  ON pilot_access_invitations(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pilot_access_invitations_expiry
  ON pilot_access_invitations(expires_at, redeemed_at, revoked_at);
