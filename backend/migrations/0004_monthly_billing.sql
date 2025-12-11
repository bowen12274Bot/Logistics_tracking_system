CREATE TABLE IF NOT EXISTS monthly_billing (
  id TEXT PRIMARY KEY,
  customer_id TEXT,       -- 客戶的user_id
  cycle_start TEXT,       -- 帳期開始日
  cycle_end TEXT,         -- 帳期結束日
  next_generated_at TEXT  -- 下次產生訂單的日期
);

