# Backend Documentation

此目錄包含物流追蹤系統的後端程式碼，使用 Cloudflare Workers + Hono 建構。

---

## 🚀 快速開始 (Quick Start)

### 安裝依賴 (Install Dependencies)

```powershell
npm install
```

### 產生型別定義 (Generate Types)

```powershell
wrangler types
```

### 初始化資料庫 (Initialize Database)

```powershell
# 套用資料庫遷移 (Migrations) 到本地模擬器
npx wrangler d1 migrations apply DB --local
```

### 啟動開發伺服器 (Start Development Server)

```powershell
npm run dev
# 或
wrangler dev
```

啟動後，Swagger UI 文件位於: http://localhost:8787/

---

## 📡 API 列表 (API Endpoints)

所有 API 均以 `/api` 開頭。詳細規格請參考 [API 契約文件](../docs/api-contract.md)。

### 🔐 認證模組 (Auth Module)

| Method | Endpoint | 描述 | 認證 |
|--------|----------|------|------|
| `POST` | `/api/auth/register` | 客戶註冊 | ❌ |
| `POST` | `/api/auth/login` | 使用者登入 | ❌ |
| `GET` | `/api/auth/me` | 取得當前使用者資訊 | ✅ |

---

### 👤 客戶模組 (Customer Module)

| Method | Endpoint | 描述 | 認證 |
|--------|----------|------|------|
| `PUT` | `/api/customers/me` | 更新客戶資料 | ✅ |
| `POST` | `/api/customers/contract-application` | 申請成為合約客戶 | ✅ |

---

### 📦 包裹模組 (Package Module)

| Method | Endpoint | 描述 | 認證 |
|--------|----------|------|------|
| `POST` | `/api/packages` | 建立包裹/寄件 | ✅ |
| `POST` | `/api/packages/estimate` | 運費試算 | ❌ |
| `GET` | `/api/packages` | 查詢包裹列表 | ✅ |
| `GET` | `/api/packages/:id/status` | 查詢包裹狀態與事件歷程 | ✅ |
| `POST` | `/api/packages/:id/events` | 建立貨態事件 | ✅ |

---

### 📍 追蹤模組 (Tracking Module)

| Method | Endpoint | 描述 | 認證 |
|--------|----------|------|------|
| `GET` | `/api/tracking/:trackingNumber` | 公開追蹤查詢 | ❌ |
| `GET` | `/api/tracking/search` | 進階追蹤搜尋（員工用） | ✅ |

---

### 🗺️ 地圖模組 (Map Module)

| Method | Endpoint | 描述 | 認證 |
|--------|----------|------|------|
| `GET` | `/api/map` | 取得地圖節點與邊 | ❌ |
| `GET` | `/api/map/route` | 路線成本計算 | ❌ |
| `PUT` | `/api/map/edges/:id` | 更新地圖邊資料 | ✅ (admin) |

---

### 💰 計費模組 (Billing Module)

| Method | Endpoint | 描述 | 認證 |
|--------|----------|------|------|
| `GET` | `/api/billing/bills` | 查詢帳單列表 | ✅ |
| `GET` | `/api/billing/bills/:billId` | 查詢帳單明細 | ✅ |
| `POST` | `/api/billing/payments` | 付款 | ✅ |
| `GET` | `/api/billing/payments` | 查詢付款紀錄 | ✅ |

---

### 🚗 駕駛員模組 (Driver Module)

| Method | Endpoint | 描述 | 認證 |
|--------|----------|------|------|
| `GET` | `/api/driver/tasks` | 取得今日工作清單 | ✅ (driver) |
| `POST` | `/api/driver/packages/:packageId/status` | 更新配送狀態 | ✅ (driver) |
| `POST` | `/api/driver/tasks/:taskId/accept` | 接受/開始任務（規劃中） | ✅ (driver) |
| `POST` | `/api/driver/tasks/:taskId/complete` | 完成任務並推進貨態（規劃中） | ✅ (driver) |
| `GET` | `/api/driver/vehicle` | 取得司機車輛狀態（home/current/vehicle_code）（規劃中） | ✅ (driver) |
| `POST` | `/api/driver/vehicle/move` | 司機移動到相鄰節點（規劃中） | ✅ (driver) |
| `POST` | `/api/driver/packages/:packageId/exception` | 司機異常申報（規劃中） | ✅ (driver) |

---

### 🏭 倉儲模組 (Warehouse Module)

| Method | Endpoint | 描述 | 認證 |
|--------|----------|------|------|
| `POST` | `/api/warehouse/batch-operation` | 批次入庫/出庫 | ✅ (warehouse_staff) |
| `PATCH` | `/api/warehouse/packages/:packageId/route` | 調整包裹後續配送路徑（規劃中） | ✅ (warehouse_staff) |
| `POST` | `/api/warehouse/packages/:packageId/exception` | 倉儲異常申報（規劃中） | ✅ (warehouse_staff) |

---

### 🎧 客服模組 (Customer Service Module)

| Method | Endpoint | 描述 | 認證 |
|--------|----------|------|------|
| `GET` | `/api/cs/exceptions` | 異常池列表（未處理/已處理）（規劃中） | ✅ (customer_service) |
| `POST` | `/api/cs/exceptions/:exceptionId/handle` | 標示已處理並填寫處理報告（規劃中） | ✅ (customer_service) |

---

### ⚙️ 管理員模組 (Admin Module)

| Method | Endpoint | 描述 | 認證 |
|--------|----------|------|------|
| `POST` | `/api/admin/users` | 建立員工帳號 | ✅ (admin) |
| `GET` | `/api/admin/contract-applications` | 查詢合約申請列表 | ✅ (admin/cs) |
| `PUT` | `/api/admin/contract-applications/:id` | 審核合約申請 | ✅ (admin/cs) |
| `GET` | `/api/admin/system/errors` | 查詢系統錯誤紀錄 | ✅ (admin) |

---

## 🧪 測試 (Testing)

本專案使用 **Vitest** 搭配 `@cloudflare/vitest-pool-workers` 進行單元測試與整合測試。

### 執行測試 (Run Tests)

```powershell
npm test
```

### 測試檔案結構 (Test File Structure)

```
backend/src/
├── index.test.ts           # 主要整合測試
└── __tests__/
    ├── helpers.ts          # 測試輔助函式 (Test Helpers)
    ├── auth.test.ts        # 認證模組測試
    ├── packages.test.ts    # 包裹模組測試
    ├── tracking.test.ts    # 追蹤模組測試
    ├── map.test.ts         # 地圖模組測試
    ├── billing.test.ts     # 計費模組測試
    ├── admin.test.ts       # 管理員模組測試
    ├── customer.test.ts    # 客戶模組測試
    └── staff.test.ts       # 員工模組測試
```

### 測試覆蓋範圍 (Test Coverage)

| 模組 | 狀態 | 說明 |
|------|------|------|
| 認證 API (Auth) | ✅ Passed | Register, Login, Me |
| 包裹 API (Package) | ✅ Passed | Create, List, Status, Events |
| 追蹤 API (Tracking) | ✅ Passed | Public, Search |
| 地圖 API (Map) | ✅ Passed | Fetch, Route, Update Edge |
| 計費 API (Billing) | ✅ Passed | Bills, Payments |
| 管理員 API (Admin) | ✅ Passed | Users, Contracts, Errors |
| 客戶 API (Customer) | ✅ Passed | Update, Contract Application |
| 員工 API (Staff) | ✅ Passed | Driver Tasks, Warehouse Ops |

### 執行特定測試 (Run Specific Tests)

```powershell
# 執行特定檔案
npm test -- src/__tests__/auth.test.ts

# 執行符合模式的測試
npm test -- --grep "AUTH-REG"

# 監看模式 (Watch Mode)
npm test -- --watch
```

---

## 📁 資料庫遷移 (Database Migrations)

遷移檔案位於 `migrations/` 目錄：

| 檔案 | 說明 |
|------|------|
| `0000_users.sql` | 使用者表 (users) |
| `0001_packages.sql` | 包裹表 (packages) |
| `0002_package_events.sql` | 物流事件表 (package_events) |
| `0003_payments.sql` | 付款表 (payments) |
| `0004_monthly_billing.sql` | 月結帳單表 (monthly_billing) |
| `0005_monthly_billing_items.sql` | 帳單明細表 |
| `0006_virtual_map_schema.sql` | 虛擬地圖 Schema (nodes/edges) |
| `0007_virtual_map_seed.sql` | 虛擬地圖 seed data |
| `0008_contract_applications.sql` | 合約申請表 |
| `0009_tokens.sql` | 認證 Token 表 |
| `0010_system_errors.sql` | 系統錯誤表 |
| `0011_seed_test_users.sql` | 測試帳號/員工配置 seed |
| `0012_package_exceptions.sql` | 異常池表 (package_exceptions) |
| `0013_delivery_tasks.sql` | 司機任務表 (delivery_tasks) |
| `0014_vehicles.sql` | 車輛/位置表 (vehicles) |

> 規劃中資料表/欄位：`package_events` 付款資訊欄位擴充。

### 套用遷移 (Apply Migrations)

```powershell
# 本地開發
npx wrangler d1 migrations apply DB --local

# 正式環境
npx wrangler d1 migrations apply DB --remote
```

### 使用 Python 腳本 (Optional)

```powershell
# 使用 micromamba 虛擬環境
micromamba activate SE_class
python apply_migrations.py
```

---

## 📚 相關文件 (Related Documentation)

- [API 契約文件](../docs/api-contract.md) - 完整 API 規格
- [資料庫結構](../docs/database-schema.md) - 表格與欄位定義
- [測試計畫](../docs/guides/vitest-plan.md) - 測試案例規劃
