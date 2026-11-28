CREATE TABLE IF NOT EXISTS pilot_access_requests (
  id TEXT PRIMARY KEY,
  contact_name TEXT NOT NULL,
  restaurant_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  country TEXT NOT NULL,
  restaurant_type TEXT NOT NULL,
  outlet_count INTEGER NOT NULL CHECK (outlet_count BETWEEN 1 AND 10000),
  current_pos TEXT,
  message TEXT,
  consent_at TEXT NOT NULL,
  submission_key_hash TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewing', 'contacted', 'approved', 'declined', 'closed')),
  admin_notes TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pilot_access_requests_status_created
  ON pilot_access_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pilot_access_requests_email_created
  ON pilot_access_requests(email, created_at DESC);
