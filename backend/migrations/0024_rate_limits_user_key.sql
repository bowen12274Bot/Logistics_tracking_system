-- 0024_rate_limits_user_key.sql
-- 更新速率限制表以支援用戶級別追蹤
-- 日期：2025-12-31

-- 新增用戶 ID 和角色欄位（如果表已存在）
-- SQLite 不支援 ALTER TABLE ADD COLUMN IF NOT EXISTS，
-- 所以我們使用 PRAGMA 檢查後再添加

-- 為確保兼容性，我們創建一個新版本的 rate_limits 表
CREATE TABLE IF NOT EXISTS rate_limits_v2 (
  key TEXT PRIMARY KEY,
  user_id TEXT,
  role TEXT,
  count INTEGER DEFAULT 0,
  last_request_at INTEGER DEFAULT 0
);

-- 遷移舊表資料（如果存在）
INSERT OR IGNORE INTO rate_limits_v2 (key, count, last_request_at)
SELECT key, count, last_request_at FROM rate_limits WHERE 1=1;

-- 刪除舊表並重命名新表
DROP TABLE IF EXISTS rate_limits;
ALTER TABLE rate_limits_v2 RENAME TO rate_limits;

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_id ON rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_role ON rate_limits(role);
