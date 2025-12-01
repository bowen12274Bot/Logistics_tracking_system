CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  phone_number TEXT,
  address TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'employee')),
  user_class TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 測試帳號（預設密碼同註解）
INSERT OR IGNORE INTO users (id, user_name, phone_number, address, email, password_hash, user_type, user_class) VALUES
  ('user-cust-1', '王小明', '0912345678', '台北市信義區市府路 1 號', 'cust@example.com', '4f21b18a4c743a5da01bb3a4955dea0a0294a0b4f7977b454c7259e37b2e6c19', 'customer', 'contract_customer'), -- 密碼: cust123
  ('user-driver-1', '李司機', '0911222333', '新北市板橋區文化路', 'driver@example.com', '494d022492052a06f8f81949639a1d148c1051fa3d4e4688fbd96efe649cd382', 'employee', 'driver'), -- 密碼: driver123
  ('user-admin-1', '系統管理員', '0911666777', '台中市西屯區台灣大道', 'admin@example.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'employee', 'admin'), -- 密碼: admin123
  ('user-warehouse-1', '倉儲人員', '0911777888', '高雄市前鎮區中山二路', 'warehouse@example.com', '0e842cbe0341154ee33e0ed3bc18282cd69e016a8d56fda05ec92e7ff20a0f31', 'employee', 'warehouse_staff'), -- 密碼: warehouse123
  ('user-cs-1', '客服專員', '0911333555', '桃園市桃園區中正路', 'cs@example.com', 'c3683517539a2452f7890cd9ec8eb330d8465673140d8abc89a82e5a1329d696', 'employee', 'customer_service'); -- 密碼: cs123
