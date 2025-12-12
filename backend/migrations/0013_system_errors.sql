-- Migration: Create system_errors table for admin error tracking
-- Required by API contract for /api/admin/system/errors endpoint

CREATE TABLE IF NOT EXISTS system_errors (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error', 'critical')),
  code TEXT,
  message TEXT NOT NULL,
  details TEXT,
  occurred_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  resolved INTEGER DEFAULT 0,
  resolved_by TEXT REFERENCES users(id),
  resolved_at TEXT
);

CREATE INDEX idx_system_errors_level ON system_errors(level);
CREATE INDEX idx_system_errors_resolved ON system_errors(resolved);
