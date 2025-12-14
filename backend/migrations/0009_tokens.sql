-- Migration: Create tokens table for authentication
-- Required by API contract for /api/auth/me endpoint

CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expires_at TEXT
);

CREATE INDEX idx_tokens_user_id ON tokens(user_id);
