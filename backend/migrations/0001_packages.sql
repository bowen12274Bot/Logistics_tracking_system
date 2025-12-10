CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  customer_id TEXT,                 -- 寄件者 user_id
  sender_name TEXT,                 -- 寄件者姓名
  receiver_name TEXT,               -- 收件者姓名
  weight INTEGER,                   -- 包裹重量(kg)
  size TEXT,                        -- 包裹尺寸(cm)，長×寬×高
  delivery_time TEXT,               -- 配送時效：[隔夜,兩日,標準,經濟]
  payment_type TEXT,                -- 付款方式：[預付,信用卡,網路付款,月結帳戶,第三方支付]
  declared_value INTEGER,           -- 申報價值
  final_billing_date TEXT,          -- 最終費用結算日期：寄件單建立當下
  special_handling TEXT,            -- 特殊處理 JSON（如 ["dangerous_materials","fragile_items"]）
  tracking_number TEXT,             -- 追蹤編號
  contents_description TEXT,        -- 備註事項
  route_path TEXT,                  -- 配送路線
  description_json TEXT             -- 其他描述 (JSON)
);