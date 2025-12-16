-- 測試帳號/員工配置（需先套用地圖 seed，讓 nodes 存在）
-- 規則：
-- - 每個配送站（REG_*）對應 1 名倉儲員（warehouse_staff），address=該站節點 ID
-- - 每個配送中心（HUB_*）對應 1 名司機（driver），address=該中心節點 ID
-- - 每個配送中心（HUB_*）也對應 1 名倉儲員（warehouse_staff），address=該中心節點 ID
-- - 配送中心 HUB_0 額外有 1 名管理員與 1 名客服（address=HUB_0）
--
-- 密碼皆為 SHA-256(hex) 後存入 password_hash；以下沿用既有預設帳密：
-- - cust@example.com / cust123
-- - noncontract@example.com / custnc123
-- - driver@example.com / driver123
-- - warehouse@example.com / warehouse123
-- - cs@example.com / cs123
-- - admin@example.com / admin123

-- 兩個客戶測試帳號（address 使用地圖節點 ID）
INSERT OR IGNORE INTO users (id, user_name, phone_number, address, email, password_hash, user_type, user_class, billing_preference) VALUES
  ('user-cust-1', '合約客戶', '0912345678', 'END_HOME_1', 'cust@example.com', '4f21b18a4c743a5da01bb3a4955dea0a0294a0b4f7977b454c7259e37b2e6c19', 'customer', 'contract_customer', 'monthly'),
  ('user-cust-2', '非合約客戶', '0912999888', 'END_HOME_2', 'noncontract@example.com', 'f1e8f488e212210b3f1b6835535c8b79b13c8e5e96f754827949e1782717ebb4', 'customer', 'non_contract_customer', NULL);

-- HUB_0 的預設員工（用於測試/文件）
INSERT OR IGNORE INTO users (id, user_name, phone_number, address, email, password_hash, user_type, user_class, billing_preference) VALUES
  ('user-driver-0', '司機', '0911222333', 'HUB_0', 'driver@example.com', '494d022492052a06f8f81949639a1d148c1051fa3d4e4688fbd96efe649cd382', 'employee', 'driver', NULL),
  ('user-warehouse-0', '倉儲人員', '0911777888', 'HUB_0', 'warehouse@example.com', '0e842cbe0341154ee33e0ed3bc18282cd69e016a8d56fda05ec92e7ff20a0f31', 'employee', 'warehouse_staff', NULL),
  ('user-cs-0', '客服專員', '0911333555', 'HUB_0', 'cs@example.com', 'c3683517539a2452f7890cd9ec8eb330d8465673140d8abc89a82e5a1329d696', 'employee', 'customer_service', NULL),
  ('user-admin-0', '系統管理員', '0911666777', 'HUB_0', 'admin@example.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'employee', 'admin', NULL);

-- 其他配送中心：每個 HUB 一名司機
INSERT OR IGNORE INTO users (id, user_name, phone_number, address, email, password_hash, user_type, user_class, billing_preference)
SELECT
  'user-driver-' || lower(n.id),
  '司機 ' || n.id,
  NULL,
  n.id,
  'driver_' || lower(n.id) || '@example.com',
  '494d022492052a06f8f81949639a1d148c1051fa3d4e4688fbd96efe649cd382',
  'employee',
  'driver',
  NULL
FROM nodes n
WHERE n.id LIKE 'HUB_%' AND n.id <> 'HUB_0';

-- 每個配送中心：每個 HUB 一名倉儲員
INSERT OR IGNORE INTO users (id, user_name, phone_number, address, email, password_hash, user_type, user_class, billing_preference)
SELECT
  'user-warehouse-' || lower(n.id),
  '倉儲 ' || n.id,
  NULL,
  n.id,
  'warehouse_' || lower(n.id) || '@example.com',
  '0e842cbe0341154ee33e0ed3bc18282cd69e016a8d56fda05ec92e7ff20a0f31',
  'employee',
  'warehouse_staff',
  NULL
FROM nodes n
WHERE n.id LIKE 'HUB_%' AND n.id <> 'HUB_0';

-- 其他配送站：每個 REG 一名倉儲員
INSERT OR IGNORE INTO users (id, user_name, phone_number, address, email, password_hash, user_type, user_class, billing_preference)
SELECT
  'user-warehouse-' || lower(n.id),
  '倉儲 ' || n.id,
  NULL,
  n.id,
  'warehouse_' || lower(n.id) || '@example.com',
  '0e842cbe0341154ee33e0ed3bc18282cd69e016a8d56fda05ec92e7ff20a0f31',
  'employee',
  'warehouse_staff',
  NULL
FROM nodes n
WHERE n.id LIKE 'REG_%';
