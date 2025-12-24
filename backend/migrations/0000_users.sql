-- Baseline users table (new installs).
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  phone_number TEXT,
  address TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'employee')),
  user_class TEXT NOT NULL,
  billing_preference TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  suspended_at TEXT,
  suspended_reason TEXT,
  deleted_at TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
