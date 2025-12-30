-- Demo Data: Golden Path Scenario for Presentation
-- This seed provides:
-- 1. A vehicle assigned to driver_hub_0
-- 2. A "delivered" package with full event history
-- 3. An "in_transit" package with partial events (currently at REG)
-- 4. An "exception" package stuck at warehouse

-- Assign a vehicle to driver HUB_0
INSERT OR IGNORE INTO vehicles (id, driver_user_id, vehicle_code, home_node_id, current_node_id, updated_at)
VALUES ('vehicle-demo-1', 'user-driver-0', 'TRUCK-001', 'HUB_0', 'HUB_0', datetime('now'));

-- Link vehicle to driver
UPDATE users SET address = 'HUB_0' WHERE id = 'user-driver-0';

-- Package 1: Completed delivery (Delivered)
INSERT OR IGNORE INTO packages (
    id, tracking_number, customer_id, status,
    sender_name, sender_phone, sender_address,
    receiver_name, receiver_phone, receiver_address,
    weight, size, delivery_time, payment_type,
    route_path, estimated_delivery, created_at
) VALUES (
    'pkg-demo-delivered', 'TRK-DEMO-001', 'user-cust-1', 'delivered',
    '合約客戶', '0912345678', 'END_HOME_1',
    '收件者A', '0933111222', 'END_HOME_5',
    2.5, '30x20x15 cm', 'standard', 'prepaid',
    '["END_HOME_1","REG_0","HUB_0","REG_1","END_HOME_5"]',
    datetime('now', '-1 day'),
    datetime('now', '-3 days')
);

-- Events for Package 1 (full lifecycle)
INSERT OR IGNORE INTO package_events (id, package_id, delivery_status, delivery_details, location, events_at) VALUES
    ('evt-d1', 'pkg-demo-delivered', 'created', '包裹已建立', 'END_HOME_1', datetime('now', '-3 days')),
    ('evt-d2', 'pkg-demo-delivered', 'picked_up', '司機已取件', 'END_HOME_1', datetime('now', '-3 days', '+2 hours')),
    ('evt-d3', 'pkg-demo-delivered', 'in_transit', '運送中 - 前往轉運站', 'REG_0', datetime('now', '-2 days', '+6 hours')),
    ('evt-d4', 'pkg-demo-delivered', 'warehouse_in', '抵達物流中心', 'HUB_0', datetime('now', '-2 days', '+10 hours')),
    ('evt-d5', 'pkg-demo-delivered', 'warehouse_out', '離開物流中心', 'HUB_0', datetime('now', '-1 day', '+6 hours')),
    ('evt-d6', 'pkg-demo-delivered', 'out_for_delivery', '配送中', 'REG_1', datetime('now', '-1 day', '+10 hours')),
    ('evt-d7', 'pkg-demo-delivered', 'delivered', '已送達，收件人簽收', 'END_HOME_5', datetime('now', '-1 day', '+14 hours'));

-- Package 2: In Transit (currently at REG_0)
INSERT OR IGNORE INTO packages (
    id, tracking_number, customer_id, status,
    sender_name, sender_phone, sender_address,
    receiver_name, receiver_phone, receiver_address,
    weight, size, delivery_time, payment_type,
    route_path, estimated_delivery, created_at
) VALUES (
    'pkg-demo-intransit', 'TRK-DEMO-002', 'user-cust-2', 'in_transit',
    '非合約客戶', '0912999888', 'END_HOME_2',
    '收件者B', '0955666777', 'END_STORE_3',
    1.2, '20x15x10 cm', 'two_day', 'cod',
    '["END_HOME_2","REG_0","HUB_0","REG_1","END_STORE_3"]',
    datetime('now', '+2 days'),
    datetime('now', '-1 day')
);

-- Events for Package 2 (partial - still in transit)
INSERT OR IGNORE INTO package_events (id, package_id, delivery_status, delivery_details, location, events_at) VALUES
    ('evt-t1', 'pkg-demo-intransit', 'created', '包裹已建立', 'END_HOME_2', datetime('now', '-1 day')),
    ('evt-t2', 'pkg-demo-intransit', 'picked_up', '司機已取件', 'END_HOME_2', datetime('now', '-1 day', '+3 hours')),
    ('evt-t3', 'pkg-demo-intransit', 'in_transit', '運送中 - 前往轉運站', 'REG_0', datetime('now', '-12 hours'));

-- Package 3: Exception (stuck at warehouse with an issue)
INSERT OR IGNORE INTO packages (
    id, tracking_number, customer_id, status,
    sender_name, sender_phone, sender_address,
    receiver_name, receiver_phone, receiver_address,
    weight, size, delivery_time, payment_type,
    route_path, estimated_delivery, created_at
) VALUES (
    'pkg-demo-exception', 'TRK-DEMO-003', 'user-cust-1', 'exception',
    '合約客戶', '0912345678', 'END_HOME_1',
    '收件者C', '0977888999', 'END_HOME_7',
    5.0, '40x30x25 cm', 'overnight', 'prepaid',
    '["END_HOME_1","REG_0","HUB_0","REG_2","END_HOME_7"]',
    datetime('now', '+1 day'),
    datetime('now', '-2 days')
);

-- Events for Package 3 (up to exception)
INSERT OR IGNORE INTO package_events (id, package_id, delivery_status, delivery_details, location, events_at) VALUES
    ('evt-e1', 'pkg-demo-exception', 'created', '包裹已建立', 'END_HOME_1', datetime('now', '-2 days')),
    ('evt-e2', 'pkg-demo-exception', 'picked_up', '司機已取件', 'END_HOME_1', datetime('now', '-2 days', '+2 hours')),
    ('evt-e3', 'pkg-demo-exception', 'warehouse_in', '抵達物流中心', 'HUB_0', datetime('now', '-1 day', '+4 hours')),
    ('evt-e4', 'pkg-demo-exception', 'exception', '異常 - 外包裝破損，需確認內容物', 'HUB_0', datetime('now', '-1 day', '+8 hours'));

-- Exception record for Package 3
INSERT OR IGNORE INTO package_exceptions (id, package_id, reported_role, reason_code, description, handled, reported_at) VALUES
    ('exc-demo-1', 'pkg-demo-exception', 'warehouse_staff', 'damaged', '外包裝明顯破損，角落有撕裂痕跡，需聯繫客戶確認是否繼續配送。', 0, datetime('now', '-1 day', '+8 hours'));

-- Create a pending delivery task for the in-transit package
INSERT OR IGNORE INTO delivery_tasks (id, package_id, task_type, from_location, to_location, assigned_driver_id, status, segment_index, created_at) VALUES
    ('task-demo-1', 'pkg-demo-intransit', 'pickup', 'REG_0', 'HUB_0', 'user-driver-0', 'pending', 2, datetime('now', '-12 hours'));
