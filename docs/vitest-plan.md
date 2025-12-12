# Vitest 測試計畫

本文件依據更新後的 API 契約文件規劃完整的 Vitest 測試案例。

---

## 目錄

- [1. 測試架構概述](#1-測試架構概述)
- [2. 測試環境設定](#2-測試環境設定)
- [3. 測試案例規劃](#3-測試案例規劃)
- [4. 實作優先順序](#4-實作優先順序)
- [5. 測試檔案結構](#5-測試檔案結構)

---

## 1. 測試架構概述

### 測試類型

| 類型 | 說明 | 覆蓋目標 |
|------|------|----------|
| **正向測試** | 驗證正常輸入下 API 的預期行為 | 所有 API 端點 |
| **負向測試** | 驗證錯誤輸入時的錯誤處理 | 驗證邏輯、邊界條件 |
| **權限測試** | 驗證角色權限控制 | 需認證的 API |
| **整合測試** | 驗證多個 API 協同運作 | 業務流程 |

### 測試覆蓋目標

| 模組 | API 數量 | 目標測試案例數 |
|------|----------|----------------|
| 認證模組 (Auth) | 3 | 25 |
| 客戶管理 (Customer) | 2 | 12 |
| 包裹管理 (Package) | 4 | 35 |
| 貨態追蹤 (Tracking) | 3 | 25 |
| 地圖路線 (Map) | 3 | 18 |
| 計費帳單 (Billing) | 3 | 15 |
| 員工操作 (Staff) | 4 | 20 |
| 管理員 (Admin) | 3 | 15 |
| **合計** | **25** | **165** |

---

## 2. 測試環境設定

### 前置條件

```bash
# 啟動開發伺服器
npm run dev

# 執行測試
npm test
```

### 測試輔助函式

```typescript
// backend/src/__tests__/helpers.ts
export const BASE_URL = "http://localhost:8787";

interface ApiResponse<T> {
  status: number;
  data: T;
}

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  const data = await response.json() as T;
  return { status: response.status, data };
}

export async function authenticatedRequest<T>(
  endpoint: string,
  token: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

// 產生唯一測試資料
export const uniqueEmail = () => 
  `test_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
export const uniquePhone = () => 
  `09${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;

// 建立測試使用者並回傳 token
export async function createTestUser(overrides = {}) {
  const userData = {
    user_name: "測試用戶",
    email: uniqueEmail(),
    password: "testpass123",
    phone_number: uniquePhone(),
    address: "測試地址",
    ...overrides,
  };
  
  const { data } = await apiRequest<{ token: string; user: any }>(
    "/api/auth/register",
    { method: "POST", body: JSON.stringify(userData) }
  );
  
  return { ...data, password: userData.password };
}
```

---

## 3. 測試案例規劃

### 3.1 認證模組 (Auth)

#### POST /api/auth/register - 客戶註冊

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| AUTH-REG-001 | 使用完整有效資料註冊 | 正向 | 200, 回傳 user 與 token |
| AUTH-REG-002 | 缺少 user_name | 負向 | 400 |
| AUTH-REG-003 | 缺少 email | 負向 | 400 |
| AUTH-REG-004 | 缺少 password | 負向 | 400 |
| AUTH-REG-005 | 缺少 phone_number | 負向 | 400 |
| AUTH-REG-006 | 缺少 address | 負向 | 400 |
| AUTH-REG-007 | 使用已存在的 email | 負向 | 409 |
| AUTH-REG-008 | 使用已存在的 phone_number | 負向 | 409 |
| AUTH-REG-009 | 驗證 user_type 固定為 "customer" | 安全 | 即使傳入其他值也固定為 customer |
| AUTH-REG-010 | 驗證 user_class 固定為 "non_contract_customer" | 安全 | 即使傳入其他值也固定 |
| AUTH-REG-011 | 驗證回傳不包含 password_hash | 安全 | user 物件無密碼資訊 |
| AUTH-REG-012 | email 格式驗證 | 負向 | 400, 無效 email 格式 |
| AUTH-REG-013 | address 格式驗證 | 負向 | 400, 必須符合 (x,y) 格式 |

#### POST /api/auth/login - 使用者登入

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| AUTH-LOGIN-001 | 使用 email + 正確密碼登入 | 正向 | 200 |
| AUTH-LOGIN-002 | 使用 phone_number + 正確密碼登入 | 正向 | 200 |
| AUTH-LOGIN-003 | 缺少 identifier | 負向 | 400 |
| AUTH-LOGIN-004 | 缺少 password | 負向 | 400 |
| AUTH-LOGIN-005 | 不存在的帳號 | 負向 | 401 |
| AUTH-LOGIN-006 | 錯誤的密碼 | 負向 | 401 |
| AUTH-LOGIN-007 | 空的請求 body | 負向 | 400 |
| AUTH-LOGIN-008 | 驗證回傳 token 格式正確 | 正向 | token 為有效 UUID |

#### GET /api/auth/me - 取得當前使用者

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| AUTH-ME-001 | 使用有效 token 取得資訊 | 正向 | 200, 回傳 user |
| AUTH-ME-002 | 無 token | 權限 | 401 |
| AUTH-ME-003 | 無效 token | 權限 | 401 |
| AUTH-ME-004 | 過期 token | 權限 | 401 |

---

### 3.2 客戶管理 (Customer)

#### PUT /api/customers/me - 更新客戶資料

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| CUST-UPD-001 | 更新 user_name | 正向 | 200 |
| CUST-UPD-002 | 更新 phone_number | 正向 | 200 |
| CUST-UPD-003 | 更新 address | 正向 | 200 |
| CUST-UPD-004 | 更新 billing_preference 為 cod | 正向 | 200 |
| CUST-UPD-005 | 非合約客戶設定 monthly 帳單 | 權限 | 403 (繞過前端驗證時) |
| CUST-UPD-006 | 無 token | 權限 | 401 |

#### POST /api/customers/contract-application - 申請合約客戶

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| CUST-APP-001 | 完整資料申請 | 正向 | 200, status = "pending" |
| CUST-APP-002 | 缺少必填欄位 | 負向 | 400 |
| CUST-APP-003 | 已是合約客戶再次申請 | 負向 | 400 |
| CUST-APP-004 | 已有待審核申請 | 負向 | 400 |
| CUST-APP-005 | 無 token | 權限 | 401 |

---

### 3.3 包裹管理 (Package)

#### POST /api/packages - 建立包裹

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| PKG-CREATE-001 | 完整資料建立包裹 | 正向 | 201, 回傳 tracking_number |
| PKG-CREATE-002 | 缺少 sender 資訊 | 負向 | 400 |
| PKG-CREATE-003 | 缺少 receiver 資訊 | 負向 | 400 |
| PKG-CREATE-004 | 缺少 receiver.address | 負向 | 400 |
| PKG-CREATE-005 | 缺少 package_type | 負向 | 400 |
| PKG-CREATE-006 | 無效的 package_type | 負向 | 400 |
| PKG-CREATE-007 | 缺少 content_description (郵政法必填) | 負向 | 400 |
| PKG-CREATE-008 | 缺少 service_level | 負向 | 400 |
| PKG-CREATE-009 | 無效的 service_level | 負向 | 400 |
| PKG-CREATE-010 | 缺少 payment_type | 負向 | 400 |
| PKG-CREATE-011 | 非合約客戶使用 monthly 付款 | 權限 | 403 |
| PKG-CREATE-012 | 驗證 tracking_number 格式 | 正向 | 符合預期格式 |
| PKG-CREATE-013 | 驗證 estimated_cost 計算正確 | 正向 | 符合運費規則 |
| PKG-CREATE-014 | 特殊處理標記 fragile | 正向 | 201, 加入附加費 |
| PKG-CREATE-015 | 特殊處理標記 dangerous | 正向 | 201, 加入附加費 |
| PKG-CREATE-016 | 驗證 status 初始為 "created" | 正向 | status === "created" |
| PKG-CREATE-017 | 無 token | 權限 | 401 |
| PKG-CREATE-018 | weight 可選填（不填也可建立） | 正向 | 201 |
| PKG-CREATE-019 | 非 customer 角色嘗試建立 | 權限 | 403 |
| PKG-CREATE-020 | 驗證 sender/receiver address 格式 | 負向 | 400, 必須符合 (x,y) 格式 |
| PKG-CREATE-021 | 驗證 declared_value 儲存正確 | 正向 | 201, 雖然 UML 未定義但系統需支援 |
| PKG-CREATE-022 | 驗證 content_description 儲存正確 | 正向 | 201, 雖然 UML 未定義但系統需支援 |

#### POST /api/packages/estimate - 運費試算

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| PKG-EST-001 | 標準包裹試算 | 正向 | 200, 回傳費用明細 |
| PKG-EST-002 | 隔夜達較高費用 | 正向 | overnight > standard |
| PKG-EST-003 | 重量影響費用 | 正向 | 較重較貴 |
| PKG-EST-004 | 距離影響費用 | 正向 | 較遠較貴 |
| PKG-EST-005 | fragile 附加費 | 正向 | 有附加費用 |
| PKG-EST-006 | dangerous 附加費 | 正向 | 有附加費用 |
| PKG-EST-007 | 驗證預計送達日期 | 正向 | 符合服務時效 |
| PKG-EST-008 | 無需認證（公開 API） | 正向 | 200, 無 token 可用 |

#### GET /api/packages - 查詢包裹列表

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| PKG-LIST-001 | 取得自己的包裹列表 | 正向 | 200, 只回傳自己的 |
| PKG-LIST-002 | 依 status 篩選 | 正向 | 只回傳符合狀態 |
| PKG-LIST-003 | 依日期範圍篩選 | 正向 | 只回傳範圍內 |
| PKG-LIST-004 | 依追蹤編號搜尋 | 正向 | 回傳符合項目 |
| PKG-LIST-005 | 分頁 limit 參數正常值 | 正向 | 回傳數量正確 |
| PKG-LIST-006 | 分頁 offset 參數 | 正向 | 偏移正確 |
| PKG-LIST-007 | 客戶無法查詢他人包裹 | 權限 | 只回傳自己的 |
| PKG-LIST-008 | 無 token | 權限 | 401 |
| PKG-LIST-009 | limit 超過 100 | 負向 | 405 |
| PKG-LIST-010 | 日期範圍超過 365 天 | 負向 | 405 |

#### GET /api/packages/:id - 查詢單一包裹

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| PKG-GET-001 | 使用 ID 查詢自己的包裹 | 正向 | 200 |
| PKG-GET-002 | 使用 tracking_number 查詢 | 正向 | 200 |
| PKG-GET-003 | 查詢不存在的包裹 | 負向 | 404 |
| PKG-GET-004 | 客戶查詢他人的包裹 | 權限 | 403 |
| PKG-GET-005 | 驗證回傳完整資訊 | 正向 | 包含所有欄位 |
| PKG-GET-006 | 無 token | 權限 | 401 |

---

### 3.4 貨態追蹤 (Tracking)

#### GET /api/tracking/:trackingNumber - 公開追蹤

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| TRACK-PUB-001 | 有效追蹤編號查詢 | 正向 | 200, 回傳狀態與事件 |
| TRACK-PUB-002 | 無效追蹤編號 | 負向 | 404 |
| TRACK-PUB-003 | 驗證事件按時間排序 | 正向 | 時間升序 |
| TRACK-PUB-004 | 不需要認證 | 正向 | 200, 無 token 可用 |
| TRACK-PUB-005 | 驗證 current_status 正確 | 正向 | 符合最新事件 |
| TRACK-PUB-006 | 驗證 events 結構完整 | 正向 | 包含必要欄位 |

#### POST /api/packages/:packageId/events - 建立貨態事件

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| TRACK-EVT-001 | driver 建立 picked_up 事件 | 正向 | 200 |
| TRACK-EVT-002 | warehouse 建立 warehouse_in 事件 | 正向 | 200 |
| TRACK-EVT-003 | customer_service 建立事件 | 正向 | 200 |
| TRACK-EVT-004 | 缺少 status | 負向 | 400 |
| TRACK-EVT-005 | 缺少 location | 負向 | 400 |
| TRACK-EVT-006 | 無效的 status 值 | 負向 | 400 |
| TRACK-EVT-007 | 包裹不存在 | 負向 | 404 |
| TRACK-EVT-008 | customer 無權限建立事件 | 權限 | 403 |
| TRACK-EVT-009 | 無 token | 權限 | 401 |
| TRACK-EVT-010 | 驗證自動產生時間戳記 | 正向 | timestamp 正確 |
| TRACK-EVT-011 | 驗證包裹狀態同步更新 | 正向 | package.status 更新 |
| TRACK-EVT-012 | 驗證 location 合法性 | 負向 | 400, location 必須存在於 Map Node 或 Truck ID |
| TRACK-EVT-013 | 驗證支援所有 API 定義的 status | 正向 | 所有列舉的 status 均可寫入 |

#### GET /api/tracking/search - 進階搜尋

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| TRACK-SEARCH-001 | 依 tracking_number 搜尋 | 正向 | 200 |
| TRACK-SEARCH-002 | 依 customer_id 搜尋 | 正向 | 200 |
| TRACK-SEARCH-003 | 依日期範圍搜尋 | 正向 | 200 |
| TRACK-SEARCH-004 | 依 location_id 搜尋 (節點) | 正向 | 200 |
| TRACK-SEARCH-005 | 依 location_id 搜尋 (車輛) | 正向 | 200 |
| TRACK-SEARCH-006 | exception_only=true | 正向 | 只回傳異常 |
| TRACK-SEARCH-007 | customer 無權使用 | 權限 | 403 |
| TRACK-SEARCH-008 | customer_service 可使用 | 權限 | 200 |

---

### 3.5 地圖路線 (Map)

#### GET /api/map - 取得地圖

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| MAP-GET-001 | 成功取得地圖資料 | 正向 | 200 |
| MAP-GET-002 | nodes 為陣列 | 正向 | Array |
| MAP-GET-003 | edges 為陣列 | 正向 | Array |
| MAP-GET-004 | node 結構完整 | 正向 | 含 id, name, type, level, x, y |
| MAP-GET-005 | edge 結構完整 | 正向 | 含 source, target, distance, cost |
| MAP-GET-006 | 不需認證 | 正向 | 200, 無 token 可用 |

#### GET /api/map/route - 路線成本計算

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| MAP-ROUTE-001 | 計算兩點路線成本 | 正向 | 200, 回傳 path 與 total_cost |
| MAP-ROUTE-002 | 缺少 from 參數 | 負向 | 400 |
| MAP-ROUTE-003 | 缺少 to 參數 | 負向 | 400 |
| MAP-ROUTE-004 | 無效的起點節點 | 負向 | 404 |
| MAP-ROUTE-005 | 無效的終點節點 | 負向 | 404 |
| MAP-ROUTE-006 | 驗證 total_cost 計算正確 | 正向 | 路徑成本加總正確 |

#### PUT /api/map/edges/:id - 更新邊

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| MAP-EDGE-001 | admin 更新成功 | 正向 | 200 |
| MAP-EDGE-002 | 不存在的 edge | 負向 | 404 |
| MAP-EDGE-003 | customer 無權限 | 權限 | 403 |
| MAP-EDGE-004 | driver 無權限 | 權限 | 403 |

---

### 3.6 計費帳單 (Billing)

#### GET /api/billing/bills - 帳單列表

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| BILL-LIST-001 | 客戶查詢自己的帳單 | 正向 | 200 |
| BILL-LIST-002 | 依 status 篩選 | 正向 | 200 |
| BILL-LIST-003 | 依期間篩選 | 正向 | 200 |
| BILL-LIST-004 | 客戶無法查他人帳單 | 權限 | 只回傳自己的 |
| BILL-LIST-005 | 無 token | 權限 | 401 |

#### GET /api/billing/bills/:billId - 帳單明細

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| BILL-GET-001 | 查詢自己的帳單明細 | 正向 | 200 |
| BILL-GET-002 | 帳單不存在 | 負向 | 404 |
| BILL-GET-003 | 查詢他人帳單 | 權限 | 403 |
| BILL-GET-004 | 驗證 items 包含所有貨件 | 正向 | 完整列表 |

#### POST /api/billing/payments - 付款

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| BILL-PAY-001 | 信用卡付款 | 正向 | 200 |
| BILL-PAY-002 | 銀行轉帳付款 | 正向 | 200 |
| BILL-PAY-003 | 缺少 bill_id | 負向 | 400 |
| BILL-PAY-004 | 缺少 payment_method | 負向 | 400 |
| BILL-PAY-005 | 金額不符 | 負向 | 400 |
| BILL-PAY-006 | 帳單已付款 | 負向 | 400 |
| BILL-PAY-007 | 嘗試付他人帳單 | 權限 | 403 |
| BILL-PAY-008 | 無 token | 權限 | 401 |

---

### 3.7 員工操作 (Staff)

#### GET /api/driver/tasks - 駕駛員工作清單

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| DRV-TASK-001 | 取得今日任務 | 正向 | 200 |
| DRV-TASK-002 | 指定日期 | 正向 | 200 |
| DRV-TASK-003 | 篩選 pickup | 正向 | 只回傳取件 |
| DRV-TASK-004 | 篩選 delivery | 正向 | 只回傳配送 |
| DRV-TASK-005 | 驗證路線規劃 | 正向 | 有 optimized_order |
| DRV-TASK-006 | customer 無權限 | 權限 | 403 |

#### POST /api/driver/packages/:packageId/status - 更新配送狀態

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| DRV-STATUS-001 | 更新為 picked_up | 正向 | 200 |
| DRV-STATUS-002 | 更新為 delivered 含簽名 | 正向 | 200 |
| DRV-STATUS-003 | 記錄貨到付款金額 | 正向 | 200 |
| DRV-STATUS-004 | exception 需備註 | 負向 | 400, 缺少 notes |
| DRV-STATUS-005 | customer 無權限 | 權限 | 403 |

#### POST /api/warehouse/batch-operation - 批次入出庫

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| WH-BATCH-001 | 批次入庫 | 正向 | 200 |
| WH-BATCH-002 | 批次出庫 | 正向 | 200 |
| WH-BATCH-003 | 批次分揀 | 正向 | 200 |
| WH-BATCH-004 | 空的 package_ids | 負向 | 400 |
| WH-BATCH-005 | 部分包裹不存在 | 負向 | 400/部分成功 |
| WH-BATCH-006 | customer 無權限 | 權限 | 403 |
| WH-BATCH-007 | driver 無權限 | 權限 | 403 |

---

### 3.8 管理員 (Admin)

#### POST /api/admin/users - 建立員工帳號

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| ADM-USER-001 | 建立 driver 帳號 | 正向 | 200 |
| ADM-USER-002 | 建立 warehouse 帳號 | 正向 | 200 |
| ADM-USER-003 | 建立 customer_service 帳號 | 正向 | 200 |
| ADM-USER-004 | customer 無權限 | 權限 | 403 |
| ADM-USER-005 | driver 無權限 | 權限 | 403 |
| ADM-USER-006 | 缺少必填欄位 | 負向 | 400 |

#### PUT /api/admin/contract-applications/:id - 審核申請

| 編號 | 測試案例 | 類型 | 預期結果 |
|------|----------|------|----------|
| ADM-APP-001 | 核准申請 | 正向 | 200, 客戶升級 |
| ADM-APP-002 | 拒絕申請 | 正向 | 200 |
| ADM-APP-003 | 申請不存在 | 負向 | 404 |
| ADM-APP-004 | customer 無權限 | 權限 | 403 |
| ADM-APP-005 | customer_service 可審核 | 權限 | 200 |

---

## 4. 實作優先順序

### 第一優先級（核心業務）

1. **認證模組 (Auth)** - 所有功能基礎
2. **包裹管理 (Package)** - 建立包裹、運費試算
3. **貨態追蹤 (Tracking)** - 公開查詢、事件建立

### 第二優先級（輔助功能）

4. **地圖路線 (Map)** - 路線計算
5. **員工操作 (Staff)** - 駕駛員、倉儲操作
6. **客戶管理 (Customer)** - 合約申請

### 第三優先級（進階功能）

7. **計費帳單 (Billing)**
8. **管理員 (Admin)**

---

## 5. 測試檔案結構

```
backend/src/__tests__/
├── helpers.ts              # 輔助函式
├── auth.test.ts            # 認證模組 (25 cases)
├── customer.test.ts        # 客戶管理 (12 cases)
├── packages.test.ts        # 包裹管理 (35 cases)
├── tracking.test.ts        # 貨態追蹤 (25 cases)
├── map.test.ts             # 地圖路線 (18 cases)
├── billing.test.ts         # 計費帳單 (15 cases)
├── staff.test.ts           # 員工操作 (20 cases)
├── admin.test.ts           # 管理員 (15 cases)
└── integration/
    ├── package-lifecycle.test.ts  # 包裹完整生命週期
    └── billing-flow.test.ts       # 計費流程整合
```

---

## 6. 執行命令

```bash
# 執行所有測試
npm test

# 執行特定檔案
npm test -- src/__tests__/auth.test.ts

# 執行帶覆蓋率
npm test -- --coverage

# 監看模式
npm test -- --watch

# 只執行標記的測試
npm test -- --grep "AUTH-REG"
```
