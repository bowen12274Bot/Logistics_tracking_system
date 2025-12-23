CREATE TABLE IF NOT EXISTS package_exceptions (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES packages(id),
  reason_code TEXT,
  description TEXT,
  reported_by TEXT REFERENCES users(id),
  reported_role TEXT, -- driver / warehouse_staff / customer_service
  reported_at TEXT,
  handled INTEGER DEFAULT 0,
  handled_by TEXT REFERENCES users(id),
  handled_at TEXT,
  handling_report TEXT
);

CREATE INDEX IF NOT EXISTS idx_package_exceptions_handled_reported_at ON package_exceptions(handled, reported_at);
CREATE INDEX IF NOT EXISTS idx_package_exceptions_package_id ON package_exceptions(package_id);

