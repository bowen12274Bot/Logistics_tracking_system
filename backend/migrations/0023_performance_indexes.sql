-- 0023_performance_indexes.sql
-- 性能優化索引遷移
-- 目的：優化 P99 > 10ms 的 API 端點查詢性能
-- 日期：2025-12-31

-- ============================================
-- 帳務相關索引
-- ============================================

-- 付款紀錄查詢優化 (GET /api/billing/payments)
-- 當前 P99: 66ms → 目標: ≤10ms
CREATE INDEX IF NOT EXISTS idx_payments_payer_calculated 
  ON payments(payer_user_id, calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_package_id 
  ON payments(package_id);

-- 帳單列表查詢優化 (GET /api/billing/bills)
-- 當前 P99: 64ms → 目標: ≤10ms
CREATE INDEX IF NOT EXISTS idx_monthly_billing_customer_status 
  ON monthly_billing(customer_id, status);

CREATE INDEX IF NOT EXISTS idx_monthly_billing_cycle 
  ON monthly_billing(cycle_start, cycle_end);

CREATE INDEX IF NOT EXISTS idx_monthly_billing_items_billing_id 
  ON monthly_billing_items(monthly_billing_id);

-- ============================================
-- 包裹相關索引
-- ============================================

-- 包裹列表查詢優化 (GET /api/packages)
-- 當前 P99: 21ms → 目標: ≤10ms
CREATE INDEX IF NOT EXISTS idx_packages_customer_created 
  ON packages(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_packages_tracking 
  ON packages(tracking_number);

-- ============================================
-- 任務相關索引 (已有部分索引，補充遺漏)
-- ============================================

-- 司機任務清單優化補充
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_status_created 
  ON delivery_tasks(status, created_at DESC);

-- ============================================
-- 異常相關索引 (已有部分索引，補充遺漏)
-- ============================================

-- 異常列表按 handled 狀態查詢優化
CREATE INDEX IF NOT EXISTS idx_package_exceptions_reported_role 
  ON package_exceptions(reported_role, handled);

-- ============================================
-- 合約相關索引 (已有索引，補充時間排序)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_contract_apps_status_created 
  ON contract_applications(status, created_at DESC);

-- ============================================
-- 系統相關索引
-- ============================================

-- 系統錯誤列表查詢優化 (GET /api/admin/system/errors)
-- 當前 P99: 58ms → 目標: ≤10ms
CREATE INDEX IF NOT EXISTS idx_system_errors_occurred 
  ON system_errors(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_errors_level_occurred 
  ON system_errors(level, occurred_at DESC);

-- ============================================
-- 認證相關索引
-- ============================================

-- Token 查詢優化
CREATE INDEX IF NOT EXISTS idx_tokens_user_id 
  ON tokens(user_id);

-- ============================================
-- 車輛相關索引 (已有唯一索引)
-- ============================================

-- 車上貨物查詢 - 使用 vehicle_cargo 表
CREATE INDEX IF NOT EXISTS idx_vehicle_cargo_vehicle 
  ON vehicle_cargo(vehicle_id);

-- ============================================
-- 地圖相關索引 (補充 target 索引)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_edges_target 
  ON edges(target);
