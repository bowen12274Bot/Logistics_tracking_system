# 資料庫 Schema 說明文件

本文件整理目前專案後端資料庫（D1 / SQLite 相容）之最終表結構，來源為 `backend/migrations/` 依序套用後的結果。

---

## 目錄

- [1. 總覽](#1-總覽)
- [2. 表格定義](#2-表格定義)
- [3. ER 圖](#3-er-圖)
- [4. 索引說明](#4-索引說明)
- [5. 版本歷史](#5-版本歷史)

---

## 1. 總覽

| 表格名稱 | 說明 | Migration 檔案 |
|---|---|---|
| `users` | 使用者帳號（客戶/員工） | `backend/migrations/0000_users.sql` |
| `packages` | 包裹主檔 | `backend/migrations/0001_packages.sql` |
| `package_events` | 包裹貨態事件 | `backend/migrations/0002_package_events.sql` |
| `payments` | 單筆付款與費用拆分 | `backend/migrations/0003_payments.sql` |
| `monthly_billing` | 月結帳單主檔 | `backend/migrations/0004_monthly_billing.sql` |
| `monthly_billing_items` | 月結帳單明細（帳單包含哪些包裹） | `backend/migrations/0005_monthly_billing_items.sql` |
| `nodes` | 虛擬地圖節點 | `backend/migrations/0006_virtual_map_schema.sql`, `backend/migrations/0007_virtual_map_seed.sql` |
| `edges` | 虛擬地圖邊（道路/成本） | `backend/migrations/0006_virtual_map_schema.sql`, `backend/migrations/0007_virtual_map_seed.sql` |
| `contract_applications` | 合約客戶申請/審核 | `backend/migrations/0008_contract_applications.sql` |
| `tokens` | 認證 token | `backend/migrations/0009_tokens.sql` |
| `system_errors` | 系統錯誤/異常紀錄 | `backend/migrations/0010_system_errors.sql` |
| `package_exceptions` | 異常池：異常申報與處理 | `backend/migrations/0012_package_exceptions.sql` |
| `delivery_tasks` | 司機任務：取件/配送/轉運 | `backend/migrations/0013_delivery_tasks.sql` |
| `vehicles` | 車輛與位置 | `backend/migrations/0014_vehicles.sql` |

### Seed / 測試資料 migrations

> 以下 migration 主要用於寫入 seed/測試資料（非新增資料表）。

| 檔案 | 說明 |
|---|---|
| `backend/migrations/0007_virtual_map_seed.sql` | 重建 `nodes` / `edges` 並寫入虛擬地圖資料 |
| `backend/migrations/0011_seed_test_users.sql` | 寫入測試帳號與員工工作地（依 `nodes` 內容生成） |

### 規劃中（尚未落地到 migrations）

> 目前暫無。

---

## 2. 表格定義

### 2.1 `users` - 使用者

```sql
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
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

- `address` 欄位定義：
  - `customer`：客戶預設地址/位置（目前以字串保存，可能是座標字串如 `10,20` 或節點 ID）
  - `employee`：員工工作地（地圖節點 ID，例如配送中心 `HUB_0`、配送站 `REG_0`）
- 測試帳號/員工工作地 seed：`backend/migrations/0011_seed_test_users.sql`

---

### 2.2 `packages` - 包裹主檔

```sql
CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  sender_name TEXT,
  sender_phone TEXT,
  sender_address TEXT,
  receiver_name TEXT,
  receiver_phone TEXT,
  receiver_address TEXT,
  weight INTEGER,
  size TEXT,
  delivery_time TEXT,
  payment_type TEXT,
  declared_value INTEGER,
  status TEXT DEFAULT 'created',
  estimated_delivery TEXT,
  final_billing_date TEXT,
  special_handling TEXT,
  tracking_number TEXT,
  contents_description TEXT,
  route_path TEXT,
  description_json TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

---

### 2.3 `package_events` - 包裹事件

```sql
CREATE TABLE IF NOT EXISTS package_events (
  id TEXT PRIMARY KEY,
  package_id TEXT,
  delivery_status TEXT,
  delivery_details TEXT,
  events_at TEXT,
  location TEXT
);
```

---

### 2.4 `payments` - 付款紀錄

```sql
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  total_amount INTEGER,
  service_fee INTEGER,
  distance_fee INTEGER,
  weight_volume_fee INTEGER,
  special_fee INTEGER,
  calculated_at TEXT,
  paid_at TEXT,
  collected_by TEXT,
  package_id TEXT REFERENCES packages(id)
);
```

---

### 2.5 `monthly_billing` - 月結帳單主檔

```sql
CREATE TABLE IF NOT EXISTS monthly_billing (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  cycle_start TEXT,
  cycle_end TEXT,
  next_generated_at TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  total_amount INTEGER DEFAULT 0,
  due_date TEXT,
  paid_at TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

---

### 2.6 `monthly_billing_items` - 月結帳單明細

```sql
CREATE TABLE IF NOT EXISTS monthly_billing_items (
  id TEXT PRIMARY KEY,
  monthly_billing_id TEXT,
  package_id TEXT
);
```

---

### 2.7 `nodes` / `edges` - 虛擬地圖

`backend/migrations/0006_virtual_map_schema.sql` 建立 `nodes`、`edges` 與索引；`backend/migrations/0007_virtual_map_seed.sql` 會重建表並寫入 seed 資料（節點/道路）。

```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  name TEXT,
  level INTEGER,
  subtype TEXT,
  x INTEGER,
  y INTEGER
);

CREATE TABLE edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT,
  target TEXT,
  distance REAL,
  road_multiple INTEGER,
  cost INTEGER,
  FOREIGN KEY(source) REFERENCES nodes(id),
  FOREIGN KEY(target) REFERENCES nodes(id)
);
```

---

### 2.8 `contract_applications` - 合約客戶申請

```sql
CREATE TABLE IF NOT EXISTS contract_applications (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  tax_id TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  billing_address TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  review_notes TEXT,
  credit_limit INTEGER,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

---

### 2.9 `tokens` - 認證 Token

```sql
CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expires_at TEXT
);
```

---

### 2.10 `system_errors` - 系統錯誤

```sql
CREATE TABLE IF NOT EXISTS system_errors (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error', 'critical')),
  code TEXT,
  message TEXT NOT NULL,
  details TEXT,
  occurred_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  resolved INTEGER DEFAULT 0,
  resolved_by TEXT REFERENCES users(id),
  resolved_at TEXT
);
```

---

### 2.11 `package_exceptions` - 異常池

用途：當司機/倉儲在作業中將包裹狀態改為 `exception` 時，建立異常紀錄供客服在異常池處理；客服 MVP 先做到「標示已處理 + 處理報告」。

```sql
CREATE TABLE IF NOT EXISTS package_exceptions (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES packages(id),
  reason_code TEXT,
  description TEXT,
  reported_by TEXT REFERENCES users(id),
  reported_role TEXT, -- driver / warehouse_staff / customer_service
  reported_at TEXT,
  handled INTEGER DEFAULT 0,
  handled_by TEXT REFERENCES users(id),
  handled_at TEXT,
  handling_report TEXT
);
CREATE INDEX idx_package_exceptions_handled_reported_at ON package_exceptions(handled, reported_at);
CREATE INDEX idx_package_exceptions_package_id ON package_exceptions(package_id);
```

---

### 2.12 `delivery_tasks` - 司機任務

用途：將「待取件/待配送/待轉運」抽象成任務，支援單一司機的工作清單與任務狀態（接受/進行中/完成）。

```sql
CREATE TABLE IF NOT EXISTS delivery_tasks (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES packages(id),
  task_type TEXT NOT NULL, -- pickup / deliver / transfer_pickup / transfer_dropoff
  from_location TEXT,
  to_location TEXT,
  assigned_driver_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending / accepted / in_progress / completed / canceled
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX idx_delivery_tasks_assignee_status_created ON delivery_tasks(assigned_driver_id, status, created_at);
```

---

### 2.13 `vehicles` - 車輛/位置

用途：支援司機「貨車起始點=司機工作地點」與「地圖上點選相鄰節點移動」；包裹上車後所在地可記錄為 `vehicle_code`。

```sql
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  driver_user_id TEXT NOT NULL REFERENCES users(id),
  vehicle_code TEXT NOT NULL,
  home_node_id TEXT REFERENCES nodes(id),
  current_node_id TEXT REFERENCES nodes(id),
  updated_at TEXT
);
CREATE UNIQUE INDEX idx_vehicles_driver_user_id ON vehicles(driver_user_id);
```

---

### 2.14 付款資訊（`payments`）

用途：付款紀錄欄位位於 `payments`；`package_events` 專注在貨態/流程事件（需要記錄付款事件時，用事件時間 `events_at` 表示）。

- 是否付款：以 `payments.paid_at` 是否為 `NULL` 判斷（`NULL`=未付款，非 `NULL`=已付款）
- 付款時間：`payments.paid_at`（客戶實際付款時間）
- 收款人：`payments.collected_by`（`system` 或 `users.id`；現金由司機收款時填司機的 `users.id`）

---

## 3. ER 圖

```mermaid
erDiagram
    users ||--o{ packages : "寄件/下單"
    packages ||--o{ package_events : "貨態事件"
    packages ||--o| payments : "付款"
    packages ||--o{ package_exceptions : "異常池"
    users ||--o{ package_exceptions : "申報/處理"
    users ||--o{ delivery_tasks : "司機任務"
    packages ||--o{ delivery_tasks : "任務關聯"
    users ||--o| vehicles : "車輛"
    nodes ||--o{ vehicles : "所在節點"
    users ||--o{ monthly_billing : "月結帳單"
    monthly_billing ||--o{ monthly_billing_items : "帳單明細"
    monthly_billing_items }o--|| packages : "包含"
    users ||--o{ tokens : "登入 token"
    users ||--o{ contract_applications : "合約申請"
    users ||--o{ system_errors : "處理/關聯"
    nodes ||--o{ edges : "道路"
```

---

## 4. 索引說明

| 表格 | 索引 | 欄位 | 說明 |
|---|---|---|---|
| `users` | (UNIQUE) | `email` | Email 唯一 |
| `edges` | `idx_edges_source` | `source` | 加速查詢以某節點為起點的邊 |
| `tokens` | `idx_tokens_user_id` | `user_id` | 加速依使用者查 token |
| `contract_applications` | `idx_contract_applications_customer` | `customer_id` | 加速依客戶查詢申請 |
| `contract_applications` | `idx_contract_applications_status` | `status` | 加速依狀態篩選申請 |
| `system_errors` | `idx_system_errors_level` | `level` | 加速依等級篩選 |
| `system_errors` | `idx_system_errors_resolved` | `resolved` | 加速依是否已處理篩選 |
| `package_exceptions` | `idx_package_exceptions_handled_reported_at` | `handled, reported_at` | 加速客服異常池未處理/已處理列表 |
| `delivery_tasks` | `idx_delivery_tasks_assignee_status_created` | `assigned_driver_id, status, created_at` | 加速司機工作清單查詢 |
| `vehicles` | `idx_vehicles_driver_user_id` | `driver_user_id` | 加速依司機取得車輛狀態 |

---

## 5. 版本歷史

| 版本 | 日期 | 說明 |
|---|---|---|
| 1.0 | 2025-12-12 | 重寫本文件以修正亂碼，並同步最新 migrations |
