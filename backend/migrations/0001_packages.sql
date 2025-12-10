CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  customer_id TEXT,                 -- 寄件者的user_id
  sender_name TEXT,                 -- 寄件者的名子
  receiver_name TEXT,               -- 收件者的名子
  weight INTEGER,                   -- 包裹重量(kg)
  size TEXT,                        -- 包裹尺寸(cm)，長×寬×高
  delivery_time TEXT,               -- 配送時效，[隔夜,兩日,標準,經濟]
  payment_type TEXT,                -- 支付方式，[現金,信用卡,網路銀行,月結帳單,第三方支付]
  declared_value INTEGER,           -- 申報價值
  final_billing_date TEXT,          -- 最終費用成立時間(寄件者建立當下)
  dangerous_materials BOOLEAN,      -- 是否是危險物品
  fragile_items BOOLEAN,            -- 是否是易碎物品
  international_shipments BOOLEAN,  -- 是否有國際運輸需求
  tracking_number TEXT,             -- 唯一追蹤編號
  contents_description TEXT,        -- 備註事項
  route_path TEXT,                  -- 配送路徑
  description_json TEXT             -- 描述用的json檔
);