CREATE TABLE IF NOT EXISTS shipments (
  id TEXT PRIMARY KEY,
  sender TEXT,
  receiver TEXT,
  status TEXT,
  created_at TEXT
);
