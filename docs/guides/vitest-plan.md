# Vitest 測試計畫

本文件依據更新後的 API 契約文件規劃完整的 Vitest 測試案例。

> **最後更新**: 2025-12-24
> **測試結果**: 19 個測試檔案，149 個測試案例全數通過

---

## 目錄

- [1. 測試架構概述](#1-測試架構概述)
- [2. 測試環境設定](#2-測試環境設定)
- [3. 測試案例規劃](#3-測試案例規劃)
- [4. 實作優先順序](#4-實作優先順序)
- [5. 測試檔案結構](#5-測試檔案結構)
- [6. 覆蓋率說明](#6-覆蓋率說明)

---

## 1. 測試架構概述

### 測試類型

| 類型 | 說明 | 覆蓋目標 |
|------|------|----------|
| **正向測試** | 驗證正常輸入下 API 的預期行為 | 所有 API 端點 |
| **負向測試** | 驗證錯誤輸入時的錯誤處理 | 驗證邏輯、邊界條件 |
| **權限測試** | 驗證角色權限控制 | 需認證的 API |
| **整合測試** | 驗證多個 API 協同運作 | 業務流程 |
| **異常處理測試** | 驗證異常申報與客服處理流程 | Exception 模組 |

### 測試覆蓋目標（已更新）

| 模組 | API 數量 | 已實作測試案例 | 目標測試案例數 |
|------|----------|----------------|----------------|
| 認證模組 (Auth) | 3 | ✅ 25 | 25 |
| 客戶管理 (Customer) | 4 | ✅ 15 | 15 |
| 包裹管理 (Package) | 5 | ✅ 38 | 40 |
| 貨態追蹤 (Tracking) | 3 | ✅ 15 | 25 |
| 地圖路線 (Map) | 3 | ✅ 12 | 18 |
| 計費帳單 (Billing) | 8 | ✅ 12 | 20 |
| 司機操作 (Driver) | 10 | ✅ 20 | 30 |
| 倉儲操作 (Warehouse) | 4 | ✅ 12 | 15 |
| 車輛管理 (Vehicles) | 3 | ✅ 6 | 10 |
| 異常處理 (Exceptions) | 4 | ✅ 8 | 15 |
| 管理員 (Admin) | 5 | ✅ 12 | 15 |
| **合計** | **52** | **149** | **228** |

---

## 2. 測試環境設定

### 前置條件

```bash
# 啟動開發伺服器
npm run dev

# 執行測試
npm test

# 執行特定測試檔案
npm test -- src/__tests__/auth.test.ts
```

### 測試輔助函式（helpers.ts 摘要）

```typescript
// backend/src/__tests__/helpers.ts
export const BASE_URL = "http://localhost:8787";

// 基本 API 請求
export async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>>

// 帶認證的請求
export async function authenticatedRequest<T>(endpoint: string, token: string, options?: RequestInit): Promise<ApiResponse<T>>

// 產生唯一測試資料
export const uniqueEmail = () => `test_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
export const uniquePhone = () => `09${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;

// 建立測試使用者
export async function createTestUser(overrides = {}): Promise<{ token: string; user: any; password: string }>

// 建立測試包裹
export async function createTestPackage(token: string, overrides = {}): Promise<any>

// 取得角色 Token
export async function getDriverToken(): Promise<string>
export async function getWarehouseToken(): Promise<string>
export async function getCustomerServiceToken(): Promise<string>
export async function getAdminToken(): Promise<string>

// 建立員工帳號
export async function createEmployeeUser(adminToken: string, role: string, overrides = {}): Promise<{ token: string; user: any }>
```

---

## 3. 測試案例規劃

### 3.1 認證模組 (Auth)

#### POST /api/auth/register - 客戶註冊

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| AUTH-REG-001 | 使用完整有效資料註冊 | 正向 | 200, 回傳 user 與 token | ✅ |
| AUTH-REG-002 | 缺少 user_name | 負向 | 400 | ✅ |
| AUTH-REG-003 | 缺少 email | 負向 | 400 | ✅ |
| AUTH-REG-004 | 缺少 password | 負向 | 400 | ✅ |
| AUTH-REG-007 | 使用已存在的 email | 負向 | 409 | ✅ |
| AUTH-REG-009 | 驗證 user_type 固定為 "customer" | 安全 | 即使傳入其他值也固定為 customer | ✅ |
| AUTH-REG-010 | 驗證 user_class 固定為 "non_contract_customer" | 安全 | 即使傳入其他值也固定 | ✅ |
| AUTH-REG-011 | 驗證回傳不包含 password_hash | 安全 | user 物件無密碼資訊 | ✅ |

#### POST /api/auth/login - 使用者登入

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| AUTH-LOGIN-001 | 使用 email + 正確密碼登入 | 正向 | 200 | ✅ |
| AUTH-LOGIN-002 | 使用 phone_number + 正確密碼登入 | 正向 | 200 | ✅ |
| AUTH-LOGIN-003 | 缺少 identifier | 負向 | 400 | ✅ |
| AUTH-LOGIN-004 | 缺少 password | 負向 | 400 | ✅ |
| AUTH-LOGIN-005 | 不存在的帳號 | 負向 | 401 | ✅ |
| AUTH-LOGIN-006 | 錯誤的密碼 | 負向 | 401 | ✅ |

#### GET /api/auth/me - 取得當前使用者

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| AUTH-ME-001 | 使用有效 token 取得資訊 | 正向 | 200, 回傳 user | ✅ |
| AUTH-ME-002 | 無 token | 權限 | 401 | ✅ |
| AUTH-ME-003 | 無效 token | 權限 | 401 | ✅ |

---

### 3.2 客戶管理 (Customer)

#### PUT /api/customers/me - 更新客戶資料

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| CUST-UPD-001 | 更新 user_name | 正向 | 200 | ✅ |
| CUST-UPD-002 | 更新 billing_preference | 正向 | 200 | ✅ |
| CUST-UPD-003 | 無 token | 權限 | 401 | ✅ |

#### POST /api/customers/contract-application - 申請合約客戶

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| CUST-APP-001 | 完整資料申請 | 正向 | 200, status = "pending" | ✅ |
| CUST-APP-002 | 缺少必填欄位 | 負向 | 400 | ✅ |
| CUST-APP-005 | 無 token | 權限 | 401 | ✅ |

---

### 3.3 包裹管理 (Package)

#### POST /api/packages - 建立包裹

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| PKG-CREATE-001 | 完整資料建立包裹 | 正向 | 201, 回傳 tracking_number | ✅ |
| PKG-CREATE-002 | 缺少 sender 資訊 | 負向 | 400 | ✅ |
| PKG-CREATE-003 | 缺少 receiver 資訊 | 負向 | 400 | ✅ |
| PKG-CREATE-016 | 驗證 status 初始為 "created" | 正向 | status === "created" | ✅ |
| PKG-CREATE-017 | 無 token | 權限 | 401 | ✅ |

#### POST /api/packages/estimate - 運費試算

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| PKG-EST-001 | 標準包裹試算 | 正向 | 200, 回傳費用明細 | ✅ |
| PKG-EST-002 | 隔夜達較高費用 | 正向 | overnight > standard | ✅ |
| PKG-EST-008 | 無需認證（公開 API） | 正向 | 200, 無 token 可用 | ✅ |

#### GET /api/packages - 查詢包裹列表

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| PKG-LIST-001 | 取得自己的包裹列表 | 正向 | 200, 只回傳自己的 | ✅ |
| PKG-LIST-008 | 無 token | 權限 | 401 | ✅ |

#### GET /api/packages/:packageId/status - 查詢包裹狀態

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| PKG-STATUS-001 | 查詢已建立的包裹狀態 | 正向 | 200, 回傳 package + events | ✅ |
| PKG-STATUS-002 | 包裹不存在 | 負向 | 404 | ✅ |

---

### 3.4 貨態追蹤 (Tracking)

#### GET /api/tracking/:trackingNumber - 公開追蹤

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| TRACK-PUB-001 | 有效追蹤編號查詢 | 正向 | 200, 回傳狀態與事件 | ✅ |
| TRACK-PUB-002 | 無效追蹤編號 | 負向 | 404 | ✅ |
| TRACK-PUB-004 | 不需要認證 | 正向 | 200, 無 token 可用 | ✅ |

#### POST /api/packages/:packageId/events - 建立貨態事件

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| TRACK-EVT-001 | 建立 in_transit 事件 | 正向 | 200 | ✅ |
| TRACK-EVT-002 | 建立 warehouse_in 事件 | 正向 | 200 | ✅ |
| TRACK-EVT-007 | 包裹不存在 | 負向 | 404 | ✅ |

#### GET /api/tracking/search - 進階搜尋

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| TRACK-SEARCH-001 | 依 tracking_number 搜尋 | 正向 | 200 | ✅ |

---

### 3.5 地圖路線 (Map)

#### GET /api/map - 取得地圖

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| MAP-GET-001 | 成功取得地圖資料 | 正向 | 200 | ✅ |
| MAP-GET-002 | nodes 為陣列 | 正向 | Array | ✅ |
| MAP-GET-003 | edges 為陣列 | 正向 | Array | ✅ |
| MAP-GET-004 | node 結構完整 | 正向 | 含 id, name, level, x, y | ✅ |
| MAP-GET-006 | 不需認證 | 正向 | 200, 無 token 可用 | ✅ |

#### GET /api/map/route - 路線成本計算

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| MAP-ROUTE-001 | 計算兩點路線成本 | 正向 | 200, 回傳 path 與 total_cost | ✅ |
| MAP-ROUTE-002 | 缺少 from 參數 | 負向 | 400 | ✅ |
| MAP-ROUTE-003 | 缺少 to 參數 | 負向 | 400 | ✅ |

#### PUT /api/map/edges/:id - 更新邊

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| MAP-EDGE-001 | admin 更新成功 | 正向 | 200 | ✅ |
| MAP-EDGE-002 | 不存在的 edge | 負向 | 404 | ✅ |

---

### 3.6 計費帳單 (Billing)

#### GET /api/billing/bills - 帳單列表

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| BILL-LIST-001 | 客戶查詢自己的帳單 | 正向 | 200 | ✅ |
| BILL-LIST-005 | 無 token | 權限 | 401 | ✅ |

#### POST /api/billing/payments - 付款

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| BILL-PAY-001 | 成功付款 | 正向 | 200 | ✅ |

#### POST /api/admin/billing/settle - 月結結算 (Admin)

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| BILL-SETTLE-001 | Admin 執行結算 | 正向 | 200 | ✅ |

---

### 3.7 司機操作 (Driver)

#### GET /api/driver/tasks - 任務清單

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| DRV-TASK-001 | 取得 assigned 任務 | 正向 | 200, 回傳任務清單 | ✅ |
| DRV-TASK-002 | 取得 handoff 任務 | 正向 | 200 | ✅ |

#### POST /api/driver/tasks/:taskId/accept - 接受任務

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| DRV-ACCEPT-001 | 接受 handoff 任務 | 正向 | 200, success=true | ✅ |

#### POST /api/driver/tasks/:taskId/complete - 完成任務

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| DRV-COMPLETE-001 | 完成取件任務 | 正向 | 200, success=true | ✅ |

#### POST /api/driver/tasks/:taskId/pickup - 取件

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| DRV-PICKUP-001 | 執行取件 | 正向 | 200 | ✅ |

#### POST /api/driver/tasks/:taskId/dropoff - 卸貨

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| DRV-DROPOFF-001 | 執行卸貨 | 正向 | 200 | ✅ |

#### POST /api/driver/packages/:packageId/exception - 異常申報

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| DRV-EXC-001 | 司機申報異常 | 正向 | 200, 回傳 exception_id | ✅ |
| DRV-EXC-002 | 缺少 description | 負向 | 400 | 待實作 |

---

### 3.8 倉儲操作 (Warehouse)

#### GET /api/warehouse/packages - 站內包裹清單

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| WH-LIST-001 | 取得站內包裹 | 正向 | 200, 回傳包裹清單 | ✅ |
| WH-LIST-002 | 無 token | 權限 | 401 | 待實作 |

#### POST /api/warehouse/packages/receive - 點收確認

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| WH-RCV-001 | 點收包裹 | 正向 | 200, processed=1 | ✅ |
| WH-RCV-002 | 空 package_ids | 負向 | 400 | 待實作 |
| WH-RCV-003 | 冪等處理（重複點收） | 正向 | 200, 不重複寫入事件 | ✅ |

#### POST /api/warehouse/packages/:packageId/dispatch-next - 派發下一段

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| WH-DISP-001 | 派發到相鄰節點 | 正向 | 200, 建立任務 | ✅ |
| WH-DISP-002 | 派發到非相鄰節點 | 負向 | 400 | 待實作 |

#### POST /api/warehouse/batch-operation - 批次操作

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| WH-BATCH-001 | 批次入庫 | 正向 | 200 | ✅ |
| WH-BATCH-006 | customer 無權限 | 權限 | 403 | ✅ |

---

### 3.9 車輛管理 (Vehicles)

#### GET /api/vehicles/me - 取得車輛狀態

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| VEH-ME-001 | 自動建立車輛 | 正向 | 200, 回傳 vehicle | ✅ |
| VEH-ME-401 | 無 token | 權限 | 401 | ✅ |

#### POST /api/vehicles/me/move - 移動車輛

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| VEH-MOVE-001 | 移動到相鄰節點 | 正向 | 200, success=true | ✅ |
| VEH-MOVE-409 | fromNodeId 過期 | 負向 | 409 | ✅ |

#### GET /api/vehicles/me/cargo - 車上貨物

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| VEH-CARGO-001 | 取得車上包裹 | 正向 | 200 | ✅ |

---

### 3.10 異常處理 (Exceptions)

#### GET /api/cs/exceptions - 異常池列表

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| CS-EXC-LIST-001 | 客服查詢異常池 | 正向 | 200, 回傳 exceptions | ✅ |
| CS-EXC-LIST-002 | 依 handled 篩選 | 正向 | 200 | 待實作 |

#### POST /api/cs/exceptions/:exceptionId/handle - 處理異常

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| CS-EXC-HANDLE-001 | action=resume | 正向 | 200, handled=1 | ✅ |
| CS-EXC-HANDLE-002 | action=cancel | 正向 | 200, delivery_failed | 待實作 |
| CS-EXC-HANDLE-003 | 缺少 handling_report | 負向 | 400 | 待實作 |

---

### 3.11 管理員 (Admin)

#### POST /api/admin/users - 建立員工帳號

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| ADM-USER-001 | 建立 driver 帳號 | 正向 | 200 | ✅ |
| ADM-USER-002 | 建立 warehouse 帳號 | 正向 | 200 | ✅ |
| ADM-USER-003 | 建立 customer_service 帳號 | 正向 | 200 | ✅ |
| ADM-USER-004 | customer 無權限 | 權限 | 403 | ✅ |

#### PUT /api/admin/contract-applications/:id - 審核申請

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| ADM-APP-001 | 核准申請 | 正向 | 200, 客戶升級 | ✅ |
| ADM-APP-002 | 拒絕申請 | 正向 | 200 | ✅ |
| ADM-APP-003 | 申請不存在 | 負向 | 404 | ✅ |

#### GET /api/admin/system/errors - 系統錯誤列表

| 編號 | 測試案例 | 類型 | 預期結果 | 狀態 |
|------|----------|------|----------|------|
| ADM-ERR-001 | 查詢錯誤列表 | 正向 | 200 | ✅ |

---

## 4. 待補齊的測試案例（Edge Cases）

### 4.1 高優先級

| 模組 | 測試案例 | 說明 |
|------|----------|------|
| Exceptions | CS-EXC-HANDLE-002 | action=cancel 應寫入 delivery_failed 事件 |
| Exceptions | CS-EXC-HANDLE-003 | handling_report 必填驗證 |
| Exceptions | DRV-EXC-BLOCK-001 | 異常成立後阻擋其他貨態事件 (409) |
| Warehouse | WH-DISP-002 | 非相鄰節點應回傳 400 |
| Warehouse | WH-RCV-002 | 空 package_ids 應回傳 400 |

### 4.2 中優先級

| 模組 | 測試案例 | 說明 |
|------|----------|------|
| Driver | DRV-PICKUP-BLOCK | 包裹有 active exception 時禁止取件 |
| Billing | BILL-SETTLE-DUP | 重複結算同月份應適當處理 |
| Vehicles | VEH-MOVE-NONADJ | 移動到非相鄰節點應回傳 400 |

---

## 5. 測試檔案結構

```
backend/src/__tests__/
├── helpers.ts                           # 輔助函式
├── setup.ts                             # 測試環境設定
├── authTestUtils.ts                     # 認證測試工具
├── auth.test.ts                         # 認證模組
├── customer.test.ts                     # 客戶管理
├── customerExists.test.ts               # 客戶存在檢查 [新增]
├── packages.test.ts                     # 包裹管理
├── pricing.test.ts                      # 運費計算
├── tracking.test.ts                     # 貨態追蹤
├── map.test.ts                          # 地圖路線
├── billing.test.ts                      # 計費帳單
├── staff.test.ts                        # 員工操作 - 舊版
├── driverTaskPool.test.ts               # 司機任務池
├── driverTaskEnRoute.test.ts            # 司機途中狀態 [新增]
├── driverArrivePanel.test.ts            # 司機抵達面板
├── driverPickupCustomerStatus.test.ts   # 取件後客戶狀態
├── cargoFlow.test.ts                    # 貨物流程整合
├── vehicles.test.ts                     # 車輛管理
├── warehouse.test.ts                    # 倉儲操作 [新增]
├── csExceptions.test.ts                 # 客服異常處理
├── admin.test.ts                        # 管理員
├── adminErrors.test.ts                  # 管理員錯誤處理 [新增]
└── integration/                         # 整合測試
    └── (reserved for lifecycle tests)
```

---

## 6. 覆蓋率說明

### 目前狀態

- **測試框架**: Vitest + @cloudflare/vitest-pool-workers
- **覆蓋率工具**: @vitest/coverage-istanbul ✅
- **報告位置**: `backend/coverage/index.html`

### 實際覆蓋率（Istanbul 報告 - 2025-12-23 14:35）

| 目錄 | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| **All files** | **74.11%** (1397/1885) | **59.25%** (829/1399) | **85.82%** (115/134) | **76.86%** (1316/1712) |
| src | 87.5% (105/120) | 78.12% (25/32) | 75% (6/8) | 88.03% (103/117) |
| src/endpoints | 71.02% (1081/1522) | 57.15% (699/1223) | 82.75% (72/87) | 73.96% (1023/1383) |
| src/lib | 92.3% (12/13) | 60% (12/20) | 100% (4/4) | 100% (11/11) |
| src/services | 55.17% (16/29) | 20% (2/10) | 75% (3/4) | 55.17% (16/29) |
| src/utils | 91.04% (183/201) | 79.82% (91/114) | 96.77% (30/31) | 94.76% (163/172) |

### 覆蓋率目標

| 指標 | 現況 | 目標 | 差距 | 變化 |
|------|------|------|------|------|
| Statements | 74.11% | 80% | -5.89% | ↑+10.7% |
| Branches | 59.25% | 70% | -10.75% | ↑+8.5% |
| Functions | 85.82% | 90% | -4.18% | ↑+9.0% |
| Lines | 76.86% | 80% | -3.14% | ↑+10.3% |

### 提升覆蓋率建議

1. **services 目錄** (55.17%)：需測試服務層邏輯
2. **Branches 覆蓋** (59.25%)：需增加負向測試案例
3. ~~endpoints 目錄~~ 已提升至 71.02%

### API 覆蓋率估算

| 模組 | API 端點 | 已測試 | 覆蓋率 |
|------|----------|--------|--------|
| Auth | 3 | 3 | 100% |
| Customer | 4 | 4 | 100% |
| Package | 5 | 5 | 100% |
| Tracking | 3 | 3 | 100% |
| Map | 3 | 3 | 100% |
| Billing | 8 | 6 | 75% |
| Driver | 10 | 9 | 90% |
| Warehouse | 4 | 4 | 100% |
| Vehicles | 3 | 3 | 100% |
| Exceptions | 4 | 4 | 100% |
| Admin | 5 | 5 | 100% |
| **總計** | **52** | **49** | **94%** |

---

## 7. 執行命令

```bash
# 執行所有測試
npm test

# 執行測試並產生覆蓋率報告
npm test -- --coverage

# 執行特定檔案
npm test -- src/__tests__/auth.test.ts

# 監看模式
npm test -- --watch

# 只執行標記的測試
npm test -- --grep "AUTH-REG"

# 執行整合測試
npm test -- src/__tests__/integration/
```

### 查看覆蓋率報告

```bash
# 在瀏覽器中開啟 HTML 報告
start backend/coverage/index.html
```
