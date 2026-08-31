CREATE TABLE IF NOT EXISTS appointment_requests (
  id TEXT PRIMARY KEY,
  reference_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  service TEXT NOT NULL,
  vehicle TEXT,
  preferred_date TEXT,
  details TEXT,
  media_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'scheduled', 'closed')),
  notification_status TEXT NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending', 'sent', 'failed', 'not_configured')),
  notification_error TEXT
);

CREATE INDEX IF NOT EXISTS appointment_requests_created_at_idx
  ON appointment_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS appointment_requests_status_idx
  ON appointment_requests (status, created_at DESC);
