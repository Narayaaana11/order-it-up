-- D1 Migration 0008: Google authentication and restaurant pilot enquiry capture

ALTER TABLE cloud_users ADD COLUMN google_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cloud_users_google_sub
  ON cloud_users(google_sub)
  WHERE google_sub IS NOT NULL;

CREATE TABLE IF NOT EXISTS pilot_applications (
  id TEXT PRIMARY KEY,
  contact_name TEXT NOT NULL,
  restaurant_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  city TEXT NOT NULL,
  state TEXT,
  business_type TEXT NOT NULL,
  existing_pos TEXT NOT NULL,
  hardware TEXT NOT NULL,
  outlets INTEGER NOT NULL DEFAULT 1,
  message TEXT,
  consent_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'website',
  notification_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pilot_applications_created_at
  ON pilot_applications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pilot_applications_email
  ON pilot_applications(email);
