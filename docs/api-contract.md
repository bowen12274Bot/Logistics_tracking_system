# 後端 API 接口契約文件

本文件依據 UML 類別圖、TermProject114 需求文件與 todoList.md 整理後端所有 API 接口規格。

---

## 目錄

- [1. 使用者管理模組 (User Module)](#1-使用者管理模組-user-module)
- [2. 審核合約模組 (Review)](#2-審核合約模組-review)
- [3. 包裹管理模組 (Package Module)](#3-包裹管理模組-package-module)
- [4. 地圖與路線模組 (Map & Routing)](#4-地圖與路線模組-map--routing)
- [5. 金流模組 (Payment Module)](#5-金流模組-payment-module)
- [6. 超級使用者管理模組 (Super User Management)](#6-超級使用者管理模組-super-user-management)
- [7. 異常與任務模組 (Exceptions & Tasks)](#7-異常與任務模組-exceptions--tasks)
- [8. 待補齊 API (TODO)](#8-待補齊-api-todo)

---

## 通用說明

### 認證機制

所有需要認證的 API 需在 Header 中帶入 Token：

```
Authorization: Bearer <token>
```

### 通用錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 請求格式錯誤、必填欄位缺失、參數驗證失敗 |
| 401 | 未認證（Token 缺失或無效） |
| 403 | 權限不足（已認證但無權執行此操作） |
| 404 | 資源不存在 |
| 405 | 參數超出合法範圍（如 limit 過大） |
| 409 | 資源衝突（如 Email 已存在） |
| 500 | 伺服器錯誤 |

### 使用者角色

| 角色 | user_type | user_class | 說明 |
|------|-----------|------------|------|
| 客戶（非合約） | `customer` | `non_contract_customer` | 一般寄件/收件客戶 |
| 客戶（合約/月結） | `customer` | `contract_customer` | 月結客戶 |
| 客服人員 | `employee` | `customer_service` | 處理異常池、協助查詢/更正貨態、回應合約申請 |
| 倉儲人員 | `employee` | `warehouse_staff` | 入站/分揀/轉運作業、改路徑、異常申報 |
| 駕駛員 | `employee` | `driver` | 取件/配送、貨態更新、到付收款、異常申報 |
| 管理員 | `employee` | `admin` | 系統管理、帳號管理 |

### 角色類型 (user_class)

| 類型 | 說明 |
|------|------|
| `non_contract_customer` | 非合約客戶 |
| `contract_customer` | 合約客戶 |
| `customer_service` | 客服人員 |
| `warehouse_staff` | 倉儲人員 |
| `driver` | 駕駛員 |
| `admin` | 管理員 |
---

## 1. 使用者管理模組 (User Module)

### 1.1 客戶註冊 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/auth/register` |
| **功能** | 註冊新客戶帳號（僅限客戶自行註冊） |
| **認證** | 不需要 |

#### 輸入格式 (Request Body)

```json
{
  "user_name": "string",
  "email": "string",
  "password": "string",
  "phone_number": "string",
  "address": "string"
}
```

#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `user_name` | string | ✅ | 客戶姓名 |
| `email` | string | ✅ | Email（唯一，用於登入） |
| `password` | string | ✅ | 密碼 |
| `phone_number` | string | ✅ | 電話號碼（可用於登入） |
| `address` | string | ✅ | 地址（作為預設寄/收件地址），輸入地圖座標上的絕對位置(x,y) |

> ⚠️ **安全限制**：後端強制 `user_type = customer`、`user_class = non_contract_customer`。即使請求中包含這些欄位也會被忽略。

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "user_name": "string",
    "phone_number": "string",
    "address": "string",
    "email": "string",
    "user_type": "customer",
    "user_class": "non_contract_customer"
  },
  "token": "uuid"
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 必填欄位缺失 |
| 409 | Email 或電話號碼已被使用 |

---

### 1.2 使用者登入 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/auth/login` |
| **功能** | 使用者登入取得 token |
| **認證** | 不需要 |

#### 輸入格式 (Request Body)

```json
{
  "identifier": "string",
  "password": "string"
}
```

#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `identifier` | string | ✅ | Email 或電話號碼 |
| `password` | string | ✅ | 密碼 |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "user_name": "string",
    "phone_number": "string",
    "address": "string",
    "email": "string",
    "user_type": "string",
    "user_class": "string"
  },
  "token": "uuid"
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 必填欄位缺失 |
| 401 | 帳號或密碼錯誤 |

---

### 1.3 取得當前使用者資訊 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/auth/me` |
| **功能** | 取得當前登入使用者資訊 |
| **認證** | ✅ 需要 Token |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "user_name": "string",
    "phone_number": "string",
    "address": "string",
    "email": "string",
    "user_type": "string",
    "user_class": "string",
    "billing_preference": "string"
  }
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | Token 缺失或無效 |

---

### 1.4 更新客戶資料 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `PUT /api/customers/me` |
| **功能** | 客戶更新自己的資料 |
| **認證** | ✅ 需要 Token |
| **權限** | 所有已登入使用者 |

#### 輸入格式 (Request Body)

```json
{
  "user_name": "string",
  "phone_number": "string",
  "address": "string",
  "billing_preference": "cash | credit_card | bank_transfer | monthly | third_party_payment |"
}
```

#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `user_name` | string | ❌ | 姓名 |
| `phone_number` | string | ❌ | 電話號碼 |
| `address` | string | ❌ | 預設地址 |
| `billing_preference` | string | ❌ | 帳單偏好：`cash`(現金支付)、`credit_card`(信用卡)、`bank_transfer`(網路銀行)、`monthly`(月結帳單) 僅限合約客戶、`third_party_payment`(第三方支付) |

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非合約客戶嘗試設定 `billing_preference = monthly` |

---

### 1.5 申請成為合約客戶 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/customers/contract-application` |
| **功能** | 非合約客戶申請成為合約客戶（月結帳戶） |
| **認證** | ✅ 需要 Token |
| **權限** | `customer` 且 `user_class = non_contract_customer` |

#### 輸入格式 (Request Body)

```json
{
  "company_name": "string",
  "tax_id": "string",
  "contact_person": "string",
  "contact_phone": "string",
  "billing_address": "string",
  "notes": "string"
}
```
#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `company_name` | string | ✅ | 公司名稱 |
| `tax_id` | string | ✅ | 統一編號 |
| `contact_person` | string | ✅ | 聯絡人姓名 |
| `contact_phone` | string | ✅ | 聯絡電話 |
| `billing_address` | string | ✅ | 地址，輸入地圖座標上的絕對位置(x,y) |
| `notes` | string | ❌ | 備註，如合作內容、特殊需求等 |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "application_id": "uuid",
  "status": "pending",
  "message": "申請已送出，等待審核"
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 已是合約客戶、已有待審核申請、或非客戶角色 |

---

### 1.6 駕駛員 - 取得今日工作清單 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/driver/tasks` |
| **功能** | 取得駕駛員今日需取件/配送的包裹清單 |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `date` | string | ❌ | 日期（預設今天） |
| `type` | string | ❌ | `pickup`(取件)、`delivery`(配送)、`all` |
| `scope` | string | ❌ | `assigned`(指派給自己的任務)、`handoff`(可接手的任務，以目前車輛位置為條件)；預設 `assigned` |

#### scope 說明

- `scope=assigned`：回傳指派給當前司機的任務段
- `scope=handoff`：回傳可被當前司機接手的任務段，條件為：
  - `from_location` 為 `HUB_*` 或 `REG_*`（物流站）
  - 任務狀態為 `pending` 或 `accepted`
  - `from_location` 等於司機目前車輛所在節點 (`vehicles.current_node_id`)

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非 driver 角色 |

---

### 1.7 駕駛員 - 更新配送狀態 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/packages/:packageId/status` |
| **功能** | 駕駛員更新包裹狀態 |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

#### 輸入格式 (Request Body)

```json
{
  "status": "picked_up | out_for_delivery | delivered",
  "signature": "base64_image",
  "notes": "string",
  "cod_amount": 500
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 不支援 exception，請改用異常申報 API |
| 401 | 未認證 |
| 403 | 非 driver 角色 |
| 404 | 包裹不存在 |

---

### 1.8 倉儲人員 - 批次入庫/出庫 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/warehouse/batch-operation` |
| **功能** | 批次處理入庫/出庫/分揀 |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

#### 輸入格式 (Request Body)

```json
{
  "operation": "warehouse_in | warehouse_out | sorting",
  "package_ids": ["uuid1", "uuid2", "uuid3"],
  "destination": "TRUCK_001",
  "notes": "string"
}
```

> 詳細倉儲作業規範請參考 [warehouse-staff.md](file:///c:/Users/tange/OneDrive/Desktop/all%20project/py_for_SE_class/term_project/Logistics_tracking_system/docs/warehouse-staff.md)

---

### 1.9 倉儲人員 - 站內包裹清單 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/warehouse/packages` |
| **功能** | 取得本站所有站內包裹清單 |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

#### 功能說明

- 後端以 `users.address` 作為本站，回傳「站內包裹」（最新事件 location = 本站且處於站內階段）。
- 不需前端傳遞 location 參數，強制綁定登入員工的工作站點。

---

### 1.10 倉儲人員 - 點收確認 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/warehouse/packages/receive` |
| **功能** | 對一筆或多筆包裹執行點收作業 |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

#### 輸入格式 (Request Body)

```json
{
  "package_ids": ["uuid1", "uuid2"]
}
```

#### 行為說明

- 每個包裹依序寫入 `warehouse_received` + `sorting` 兩筆事件。
- 已點收的包裹會冪等處理（不重複寫入）。

---

### 1.11 倉儲人員 - 派發下一段 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/warehouse/packages/:packageId/dispatch-next` |
| **功能** | 派發包裹到下一個相鄰節點（建立新的分段任務） |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

#### 輸入格式 (Request Body)

```json
{
  "toNodeId": "REG_3"
}
```

#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `toNodeId` | string | ✅ | 下一個目的地節點 ID，必須與本站相鄰（`edges` 存在） |

> ⚠️ **站點綁定**：`fromNodeId` 固定為 `users.address`（倉儲員工作站點），後端不接受前端傳入。

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "task": {
    "id": "uuid",
    "package_id": "uuid",
    "from_location": "REG_1",
    "to_location": "REG_3",
    "segment_index": 2,
    "status": "pending"
  }
}
```

#### 行為說明

- 建立 `delivery_tasks` 新 segment：`from_location` = 本站、`to_location` = 相鄰節點
- 同時寫入 `package_events`：`delivery_status='route_decided'`

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | toNodeId 缺失、非相鄰節點 |
| 401 | 未認證 |
| 403 | 非 warehouse_staff 角色 |
| 404 | 包裹不存在 |
| 409 | 包裹不在本站、或已有進行中的任務段 |


## 2. 審核合約模組 (Review)

### 2.1 審核合約申請 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `PUT /api/admin/contract-applications/:id` |
| **功能** | 審核客戶的合約申請 |
| **認證** | ✅ 需要 Token |
| **權限** | `customer_service`、`admin` |

#### 輸入格式 (Request Body)

```json
{
  "status": "approved | rejected",
  "notes": "string",
  "credit_limit": 50000
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 無效的 status 值 |
| 401 | 未認證 |
| 403 | 非 customer_service 或 admin |
| 404 | 申請不存在 |

---

## 3. 包裹管理模組 (Package Module)

### 3.1 建立包裹/寄件 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/packages` |
| **功能** | 建立新包裹寄件單 |
| **認證** | ✅ 需要 Token |
| **權限** | `customer` |

#### 輸入格式 (Request Body)

```json
{
  "sender": {
    "name": "string",
    "phone": "string",
    "address": "string"
  },
  "receiver": {
    "name": "string",
    "phone": "string",
    "address": "string"
  },
  "weight": 1.5,
  "dimensions": {
    "length": 30,
    "width": 20,
    "height": 10
  },
  "declared_value": 1000,
  "content_description": "書籍",
  "service_level": "overnight | two_day | standard | economy",
  "special_handling": ["fragile", "dangerous", "international"],
  "payment_type": "cash | credit_card | bank_transfer | monthly_billing | third_party_payment"
}
```

#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `sender` | object | ✅ | 寄件人資訊（姓名、電話、地址） |
| `receiver` | object | ✅ | 收件人資訊（姓名、電話、地址） |
| `weight` | number | ❌ | 重量（公斤），若沒填由系統產生 |
| `dimensions` | object | ❌ | 尺寸（長/寬/高，公分），若沒填由系統產生 |
| `declared_value` | number | ❌ | 申報價值（元），若沒填由系統產生 |
| `content_description` | string | ✅ | 內容物描述（依郵政法規必填） |
| `service_level` | string | ✅ | 配送時效：`overnight`(隔夜)、`two_day`(兩日)、`standard`(標準)、`economy`(經濟) |
| `special_handling` | array | ❌ | 特殊處理標記：`fragile`(易碎)、`dangerous`(危險品)、`international`(國際) |
| `payment_type` | string | ✅ | 付款方式：`cash`(現金支付)、`credit_card`(信用卡)、`bank_transfer`(網路銀行)、`monthly`(月結帳單) 僅限合約客戶、`third_party_payment`(第三方支付) |

#### 輸出格式 (Success Response - 201)

```json
{
  "success": true,
  "package": {
    "id": "uuid",
    "tracking_number": "TRK20251210001",
    "package_type": "small_box",
    "status": "created",
    "sender": { ... },
    "receiver": { ... },
    "estimated_cost": 150,
    "created_at": "2025-12-10T00:30:00Z"
  }
}
```
`tracking_number` 和 `package_type` 在建立包裹後產生。`created_at` 是建立訂單當下時間。

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 必填欄位缺失、無效的 package_type/service_level |
| 401 | 未認證 |
| 403 | 非合約客戶嘗試使用 `payment_type = monthly`、或非 customer 角色 |

---

### 3.2 運費試算 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/packages/estimate` |
| **功能** | 在建立包裹前先試算運費 |
| **認證** | ❌ 不需要（公開 API） |

#### 輸入格式 (Request Body)

```json
{
  "sender_address": "string",
  "receiver_address": "string",
  "weight": 1.5,
  "dimensions": {
    "length": 30,
    "width": 20,
    "height": 10
  },
  "service_level": "overnight | two_day | standard | economy",
  "special_handling": ["fragile"]
}
```

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "estimate": {
    "base_cost": 100,
    "distance_cost": 30,
    "weight_surcharge": 10,
    "special_handling_surcharge": 10,
    "total_cost": 150,
    "estimated_delivery_date": "2025-12-12"
  }
}
```

---

### 3.3 客戶查詢包裹列表 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/packages` |
| **功能** | 查詢客戶自己的包裹列表 |
| **認證** | ✅ 需要 Token |
| **權限** | `customer` 只能查自己的包裹；員工依權限查詢 |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 限制 | 說明 |
|------|------|------|------|------|
| `status` | string | ❌ | - | 依狀態篩選 |
| `date_from` | string | ❌ | - | 運送日期範圍起始（ISO 8601） |
| `date_to` | string | ❌ | - | 運送日期範圍結束 |
| `tracking_number` | string | ❌ | - | 依追蹤編號搜尋 |
| `limit` | integer | ❌ | 1-100 | 回傳筆數（預設 20，最大 100） |
| `offset` | integer | ❌ | ≥0 | 分頁偏移量 |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "packages": [ ... ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 405 | `limit` 超過 100 或 `date_from`/`date_to` 範圍超過 365 天 |

---

### 3.4 查詢單一包裹詳情 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/packages/:id` |
| **功能** | 查詢單一包裹的完整資訊 |
| **認證** | ✅ 需要 Token |
| **權限** | 客戶只能查自己的包裹 |

#### 輸入格式

**Path Parameters:**
- `id` (string): 包裹 ID 或追蹤編號

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "package": {
    "id": "uuid",
    "tracking_number": "TRK20251210001",
    "status": "in_transit",
    "sender": { "name": "張三", "phone": "0912345678", "address": "台北市..." },
    "receiver": { "name": "李四", "phone": "0987654321", "address": "高雄市..." },
    "package_type": "medium_box",
    "weight": 2.5,
    "content_description": "書籍",
    "service_level": "standard",
    "payment_type": "prepaid",
    "payment_status": "paid",
    "cost": 180,
    "created_at": "2025-12-10T00:30:00Z",
    "estimated_delivery": "2025-12-13",
    "active_exception": null
  }
}
```

#### active_exception 欄位（異常狀態時）

當 `status === 'exception'` 時，會額外回傳最新一筆未結案的異常資訊：

```json
{
  "active_exception": {
    "id": "uuid",
    "reason_code": "damaged",
    "description": "包裹外箱破損",
    "reported_role": "driver",
    "reported_at": "2025-12-10T10:30:00Z",
    "location": "TRUCK_001"
  }
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 嘗試查詢他人的包裹 |
| 404 | 包裹不存在 |

---

### 3.5 公開追蹤查詢 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/tracking/:trackingNumber` |
| **功能** | 依追蹤編號查詢包裹狀態（公開，不需登入） |
| **認證** | ❌ 不需要 |

#### 輸入格式

**Path Parameters:**
- `trackingNumber` (string): 追蹤編號（如 TRK20251210001）

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "tracking_number": "TRK20251210001",
  "current_status": "in_transit",
  "current_location": "台中轉運中心",
  "estimated_delivery": "2025-12-13",
  "events": [
    {
      "status": "created",
      "description": "包裹已建立",
      "location": null,
      "timestamp": "2025-12-10T00:30:00Z"
    }
  ]
}
```

#### 事件狀態類型

本系統同時有兩種「狀態」概念：

1. **客戶顯示階段（Stage）**：用於 `packages.status` / API 的 `current_status`，屬於穩定、可用來查詢/篩選的「大階段」。
2. **事件狀態（Event）**：用於 `package_events.delivery_status`，代表真實營運互動/流程事件，可更細緻；系統會把 Event 映射成 Stage 快取。

**Stage（`packages.status` / `current_status`）**

| stage | 說明 |
|------|------|
| `created` | 已建立託運單（等待取件/等待司機） |
| `picked_up` | 已取件上車 |
| `in_transit` | 運輸中（含前往取件/前往站點/站點間運輸） |
| `sorting` | 分揀/轉運處理中 |
| `warehouse_in` | 已入庫/到站 |
| `warehouse_out` | 已出庫/離站 |
| `out_for_delivery` | 末端外送中 |
| `delivered` | 已投遞/簽收 |
| `exception` | 異常（遺失/延誤/損毀） |

**Event（`package_events.delivery_status`）**

> 客戶前端路徑圖的「線段在途」顯示，依賴 `delivery_status='in_transit'` 且 `delivery_details` 可解析目的地（例如：`前往 HUB_0` / `下一站 REG_1`）。

| event | 說明 | 映射到 stage |
|------|------|-------------|
| `created` | 託運單已建立 | `created` |
| `in_transit` | 在途（貨車上/前往下一節點） | `in_transit` |
| `picked_up` | 司機取件上車 | `picked_up` |
| `warehouse_in` | 到站/入庫（司機卸貨完成） | `warehouse_in` |
| `warehouse_received` | 倉儲員確認接收（可選事件） | `warehouse_in` |
| `sorting` | 分揀/轉運處理中 | `sorting` |
| `route_decided` | 倉儲決定下一配送節點/路徑（可選事件） | `sorting` |
| `warehouse_out` | 出庫/離站交接給司機 | `warehouse_out` |
| `out_for_delivery` | 末端外送中（明確標示最後一哩） | `out_for_delivery` |
| `delivered` | 已投遞/簽收完成 | `delivered` |
| `exception` | 異常事件 | `exception` |
| `exception_resolved` | 異常已處理/解除（依 location 推導恢復階段） | `warehouse_in` / `in_transit` |
| `enroute_pickup` | 司機前往取件點（可選通知事件） | `in_transit` |
| `arrived_pickup` | 司機抵達取件點（可選事件） | `in_transit` |
| `payment_collected_prepaid` | 現金預付收款完成（可選事件） | `in_transit` |
| `enroute_delivery` | 司機前往目的地（可選通知事件） | `out_for_delivery` |
| `arrived_delivery` | 司機抵達目的地（可選事件） | `out_for_delivery` |
| `payment_collected_cod` | 現金到付收款完成（可選事件） | `out_for_delivery` |

#### 客戶追蹤圖渲染規則（點/線判定）

> 本節描述「客戶包裹追蹤圖」如何由 `packages.route_path` + `package_events` 推導出節點進度與線段在途狀態（對齊目前前端實作邏輯）。

**輸入資料**
- 節點序列：`packages.route_path`（節點 ID 陣列或以逗號分隔的字串），代表「貨車出發後」的配送路徑（例如：`END_* → REG_* → ... → END_*`）。
- 事件序列：`GET /api/packages/:id/status` 回傳的 `events[]`（依 `events_at ASC` 排序）。

**點（Node）到達判定**
- 若某筆事件的 `location` 是路徑中的節點 ID（`route_path` 內），視為「到達該節點」。
- 同一節點可能被多次經過：到達時間以該節點的 **最早** `events_at` 為準（避免後續 pass-by 覆蓋節點時間軸）。

**取件前（出發地）時間軸**
- 若路徑第一個節點（通常是寄件人 `END_*`）在「取件前事件」出現，會用它當作「貨車出發/起點時間」之一的來源。
- 取件前事件判定（相容值）：`delivery_status` 為 `created`/`task_created`/`queued`/`pending_pickup`/`waiting_pickup`，或 `delivery_details` 含類似「託運單已建立/等待司機取件」等字樣。

**線（Segment）在途判定**
- 線段在途只認 `delivery_status='in_transit'` 的事件。
- 該事件需同時滿足：
  - `location` 是 `TRUCK_*`（用於顯示「在路上」的貨車標示）
  - `delivery_details` 可解析出目的地節點 ID（例如：`前往 HUB_0` 或 `下一站 REG_1`）
- 解析到的目的地節點如果在路徑節點序列中，會把該 `TRUCK_*` 綁到「目的地前一段線段」上，作為在途顯示依據。

**異常（Exception）顯示**
- 若事件的 `delivery_status` 為 `exception`（相容值：`abnormal`/`error`/`failed`），前端會將：
  - `location` 若是節點 ID → 標記該節點（點）為異常。
  - `location` 若是 `TRUCK_*` 且 `delivery_details` 可解析目的地 → 標記對應線段（線）為異常。

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 404 | 追蹤編號不存在 |

---

### 3.6 建立貨態事件（內部 API） `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/packages/:packageId/events` |
| **功能** | 新增包裹追蹤事件（供員工/系統使用） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver`、`warehouse_staff`、`customer_service`、`admin` |

#### 輸入格式

**Path Parameters:**
- `packageId` (string): 包裹 ID

**Request Body:**
```json
{
  "status": "in_transit",
  "description": "已裝載至貨車",
  "location": "TRUCK_001",
  "notes": "string"
}
```

#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `status` | string | ✅ | 事件狀態（見上方狀態列表） |
| `description` | string | ❌ | 事件詳細描述 |
| `location` | string | ✅ | 包裹當前位置：在地面時為節點 ID（如 `HUB_TAIPEI`）；在車上時為車輛 ID（如 `TRUCK_001`） |
| `notes` | string | ❌ | 備註 |

> 💡 **location 欄位邏輯說明**：
> - 包裹在**倉庫/配送站/超商**等節點時：`location` = 節點 ID（如 `HUB_TAIPEI`、`REG_TAOYUAN`）
> - 包裹在**貨車上運輸中**時：`location` = 車輛 ID（如 `TRUCK_001`）
> - 系統可依據 location 的前綴（`HUB_`、`REG_`、`TRUCK_` 等）判斷位置類型

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "event_id": "uuid",
  "package_status": "in_transit",
  "message": "事件記錄成功"
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 必填欄位缺失、無效的 status 值 |
| 401 | 未認證 |
| 403 | 無權限（customer 無法建立事件） |
| 404 | 包裹不存在 |

---

### 3.7 進階追蹤查詢（員工用） `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/tracking/search` |
| **功能** | 多條件搜尋包裹（員工用） |
| **認證** | ✅ 需要 Token |
| **權限** | `customer_service`、`warehouse_staff`、`admin` |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `tracking_number` | string | ❌ | 追蹤編號 |
| `customer_id` | string | ❌ | 客戶帳號/ID |
| `date_from` | string | ❌ | 運送日期起始 |
| `date_to` | string | ❌ | 運送日期結束 |
| `location_id` | string | ❌ | 位置 ID（節點 ID 或車輛 ID，如 `HUB_TAIPEI` 或 `TRUCK_001`） |
| `status` | string | ❌ | 當前狀態 |
| `exception_only` | boolean | ❌ | 只顯示異常包裹 |

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | customer 或 driver 無權使用 |

---

## 4. 地圖與路線模組 (Map & Routing)

### 4.1 取得地圖節點與邊 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/map` |
| **功能** | 取得虛擬地圖的所有節點與連線 |
| **認證** | ❌ 不需要 |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "nodes": [
    {
      "id": "HUB_TAIPEI",
      "name": "台北轉運中心",
      "type": "hub",
      "level": 1,
      "subtype": null,
      "x": 100,
      "y": 200
    }
  ],
  "edges": [
    {
      "id": 1,
      "source": "HUB_TAIPEI",
      "target": "REG_TAOYUAN",
      "distance": 40.5,
      "cost": 100
    }
  ]
}
```

#### 節點類型

| type  | level | 說明                         |
|-------|-------|------------------------------|
| `HUB` | 1     | 轉運中心（第一層樞紐節點）   |
| `REG` | 2     | 區域節點（第二層區域中心）   |
| `END` | 3     | 終端節點（住家／超商） |


---

### 4.2 路線成本計算 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/map/route` |
| **功能** | 計算兩點之間的路線成本 |
| **認證** | ❌ 不需要 |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `from` | string | ✅ | 起點節點 ID |
| `to` | string | ✅ | 終點節點 ID |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "route": {
    "from": "HUB_TAIPEI",
    "to": "REG_KAOHSIUNG",
    "path": ["HUB_TAIPEI", "HUB_TAICHUNG", "REG_KAOHSIUNG"],
    "total_cost": 450
  }
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 缺少 from 或 to 參數 |
| 404 | 起點或終點節點不存在 |

---

### 4.3 更新地圖邊資料 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `PUT /api/map/edges/:id` |
| **功能** | 更新路段的成本 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Request Body)

```json
{
  "cost": 150
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非 admin 無權限 |
| 404 | Edge 不存在 |

---

## 5. 金流模組 (Payment Module)

> 此模組主要服務合約客戶（月結），非合約客戶使用預付或貨到付款。

### 5.1 查詢帳單列表 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/billing/bills` |
| **功能** | 查詢客戶的帳單列表（主要為月結帳單） |
| **認證** | ✅ 需要 Token |
| **權限** | `customer`（只能查自己的）、`customer_service`、`admin` |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `status` | string | ❌ | `pending`(待付款)、`paid`(已付款)、`overdue`(逾期) |
| `period_from` | string | ❌ | 計費期間起始 |
| `period_to` | string | ❌ | 計費期間結束 |
| `customer_id` | string | ❌ | 客戶 ID（僅員工可用） |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "bills": [
    {
      "id": "uuid",
      "customer_id": "uuid",
      "customer_name": "某公司",
      "period": "2025-11",
      "total_amount": 15000,
      "package_count": 45,
      "status": "pending",
      "due_date": "2025-12-15",
      "created_at": "2025-12-01T00:00:00Z"
    }
  ]
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | customer 嘗試使用 customer_id 查詢他人帳單 |

---

### 5.2 查詢帳單明細 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/billing/bills/:billId` |
| **功能** | 查詢單一帳單的詳細內容（包含所有貨件） |
| **認證** | ✅ 需要 Token |
| **權限** | 客戶只能查自己的帳單 |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "bill": {
    "id": "uuid",
    "period": "2025-11",
    "customer": { "id": "uuid", "name": "某公司" },
    "total_amount": 15000,
    "status": "pending",
    "items": [
      {
        "package_id": "uuid",
        "tracking_number": "TRK...",
        "service_level": "standard",
        "cost": 150,
        "shipped_at": "2025-11-05"
      }
    ],
    "due_date": "2025-12-15"
  }
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 嘗試查詢他人帳單 |
| 404 | 帳單不存在 |

---

### 5.3 付款 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/billing/payments` |
| **功能** | 為帳單付款 |
| **認證** | ✅ 需要 Token |
| **權限** | 客戶只能付自己的帳單 |

#### 輸入格式 (Request Body)

```json
{
  "bill_id": "uuid",
  "payment_method": "credit_card | bank_transfer",
  "amount": 15000
}
```

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "payment_id": "uuid",
  "status": "completed",
  "message": "付款成功"
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 金額不符、帳單已付款 |
| 401 | 未認證 |
| 403 | 嘗試付他人帳單 |
| 404 | 帳單不存在 |

---

### 5.4 查詢付款紀錄 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/billing/payments` |
| **功能** | 查詢付款紀錄 |
| **認證** | ✅ 需要 Token |
| **權限** | 客戶只能查自己的 |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `bill_id` | string | ❌ | 依帳單篩選 |
| `date_from` | string | ❌ | 付款日期起始 |
| `date_to` | string | ❌ | 付款日期結束 |

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 嘗試查詢他人付款紀錄 |

---

### 5.5 月循環結算 (Admin) `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/admin/billing/settle` |
| **功能** | 執行月底結算，設定帳單繳費期限 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Request Body)

```json
{
  "cycle_year_month": "2025-12"
}
```

#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `cycle_year_month` | string | ✅ | 要結算的月份，格式 `YYYY-MM` |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "result": "已結算 2025-12 帳單，設定繳費期限為 2026-01-15"
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 日期格式錯誤 |
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 500 | 結算失敗 |

---

### 5.6 手動調整帳單 (Admin) `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `PATCH /api/admin/billing/bills/:billId` |
| **功能** | 管理員手動調整帳單金額、狀態或繳費期限 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Request Body)

```json
{
  "total_amount": 12000,
  "status": "paid",
  "due_date": "2025-01-15"
}
```

#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `total_amount` | number | ❌ | 調整後的帳單金額 |
| `status` | string | ❌ | `pending`、`paid`、`overdue` |
| `due_date` | string | ❌ | 繳費期限（ISO 日期） |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "message": "帳單已更新"
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 404 | 帳單不存在 |

---

### 5.7 手動新增帳單項目 (Admin) `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/admin/billing/bills/:billId/items` |
| **功能** | 管理員手動將包裹加入帳單 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Request Body)

```json
{
  "package_id": "uuid"
}
```

#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `package_id` | string | ✅ | 要加入帳單的包裹 ID |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "item_id": "uuid",
  "amount_added": 150
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | package_id 缺失 |
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 404 | 帳單不存在 |

---

### 5.8 手動移除帳單項目 (Admin) `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `DELETE /api/admin/billing/bills/:billId/items/:itemId` |
| **功能** | 管理員手動從帳單移除包裹項目（並扣減金額） |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "amount_deducted": 150
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 404 | 帳單或項目不存在 |

---

## 6. 超級使用者管理模組 (Super User Management)

### 6.1 建立員工帳號 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/admin/users` |
| **功能** | 管理員建立員工帳號 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Request Body)

```json
{
  "user_name": "string",
  "email": "string",
  "password": "string",
  "phone_number": "string",
  "address": "HUB_0 | REG_0 (optional)",
  "user_class": "customer_service | warehouse_staff | driver | admin"
}
```

> 備註：員工的 `address` 代表「工作地」（地圖節點 ID），例如配送中心 `HUB_0`、配送站 `REG_0`。

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 必填欄位缺失 |
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 409 | Email 已存在 |

---

### 6.2 處理系統異常 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/admin/system/errors` |
| **功能** | 管理員查詢系統異常／錯誤紀錄列表，用於偵錯與後續處理 |
| **認證** | 需要 Token |
| **權限** | `admin` |

#### 輸入欄位 (Query Parameters)

| 參數        | 類型    | 必填 | 說明                                  |
|-------------|---------|------|---------------------------------------|
| `level`     | string  | 否   | 錯誤等級：`info` / `warning` / `error` / `critical` |
| `date_from` | string  | 否   | 開始時間（ISO 8601）                 |
| `date_to`   | string  | 否   | 結束時間（ISO 8601）                 |
| `resolved`  | boolean | 否   | 是否已處理：`true` / `false`        |
| `limit`     | integer | 否   | 每頁筆數 1–100，預設 20              |
| `offset`    | integer | 否   | 位移量，用於分頁                      |

#### 輸出欄位 (Success Response - 200)

```json
{
  "success": true,
  "errors": [
    {
      "id": "uuid",
      "level": "error",
      "code": "INTERNAL_ERROR",
      "message": "string",
      "details": "string",
      "occurred_at": "2025-12-10T00:30:00Z",
      "resolved": false
    }
  ],
  "total": 10,
  "limit": 20,
  "offset": 0
}
```

## 7. 異常與任務模組 (Exceptions & Tasks) `[大部分已實作]`

> 本章節為配合 `todoList.md` 新增的「異常池 / 司機任務 / 司機車輛移動 / 倉儲改路徑」需求。大部分 API 已實作完成。
>
> **相關詳細規範文件**：
> - [exception-handling.md](file:///c:/Users/tange/OneDrive/Desktop/all%20project/py_for_SE_class/term_project/Logistics_tracking_system/docs/exception-handling.md)：異常申報、封鎖規則、reason_code 定義
> - [customer-service.md](file:///c:/Users/tange/OneDrive/Desktop/all%20project/py_for_SE_class/term_project/Logistics_tracking_system/docs/customer-service.md)：客服異常處理流程、客戶端狀態顯示規範


### 7.1 異常池（客服） `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/cs/exceptions` |
| **功能** | 異常池列表（未處理/已處理） |
| **認證** | ✅ 需要 Token |
| **權限** | `customer_service` |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `handled` | boolean | ❌ | 是否已處理；不帶時預設只列未處理（handled=0） |
| `limit` | number | ❌ | 預設 50，最大 200 |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "exceptions": [
    {
      "id": "uuid",
      "package_id": "uuid",
      "tracking_number": "TRK-xxxx",
      "package_status": "exception",
      "reason_code": "string|null",
      "description": "string",
      "reported_by": "user_id",
      "reported_role": "driver|warehouse_staff|customer_service",
      "reported_at": "2025-12-10T00:30:00Z",
      "handled": 0,
      "handled_by": null,
      "handled_at": null,
      "handling_report": null
    }
  ]
}
```

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/cs/exceptions/:exceptionId/handle` |
| **功能** | 將異常標示已處理並填寫處理報告 |
| **認證** | ✅ 需要 Token |
| **權限** | `customer_service` |

#### 輸入格式

**Path Parameters:**
- `exceptionId` (string): 異常紀錄 ID（`package_exceptions.id`）

**Request Body:**
```json
{
  "action": "resume | cancel",
  "handling_report": "string",
  "location": "HUB_0 | REG_1 | TRUCK_0 | END_HOME_1"
}
```

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `action` | string | ✅ | `resume`=解除異常並恢復配送流程（後續由倉儲重新派送任務）；`cancel`=取消委託（同時取消所有 active 任務段） |
| `handling_report` | string | ✅ | 處理報告 |
| `location` | string | ❌ | 用於事件定位與客戶追蹤圖顯示（建議填 HUB/REG 表示回到站點） |

#### 行為說明
- 會將 `package_exceptions.handled` 設為 1 並寫入 `handling_report`。
- 會新增一筆 `package_events`：`delivery_status='exception_resolved'`。
- 若 `action='cancel'`：會把該包裹所有 active 任務段（`pending/accepted/in_progress`）標記為 `canceled`，讓司機/倉儲清單立即消失。

### 7.2 異常申報（司機/倉儲） `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/packages/:packageId/exception` |
| **功能** | 司機異常申報：建立異常紀錄並將包裹狀態更新為 `exception`（同時寫入事件） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

#### 輸入格式 (Request Body)
```json
{
  "reason_code": "string",
  "description": "string",
  "location": "TRUCK_0 | END_HOME_1 | REG_1 | HUB_0"
}
```

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `description` | string | ✅ | 異常描述（會寫入異常池與事件） |
| `reason_code` | string | ❌ | 異常代碼（建議由系統/客服補填；司機可不填） |
| `location` | string | ❌ | 異常發生位置：節點 ID（點異常）或 `TRUCK_*`（線異常） |

#### reason_code 建議值（輕量規範）

> `reason_code` 主要用於統計與客服分類；不應增加司機申報負擔。建議由 UI 以「選單」呈現，或允許司機略過，後續由客服補填/修正。

| reason_code | 說明 |
|------------|------|
| `damaged` | 包裹破損 |
| `lost` | 遺失 |
| `delayed` | 延誤 |
| `address_issue` | 地址/收件資料問題 |
| `payment_dispute` | 付款爭議（到付/預付） |
| `refused` | 收件人拒收 |
| `misroute` | 配送路徑/節點錯誤 |
| `vehicle_issue` | 車輛/設備問題 |
| `other` | 其他（搭配 description 詳細說明） |

**格式建議**
- 使用小寫 snake_case（例如 `address_issue`）。
- 若未知/不適用：不填即可，改以 `description` 描述。

#### 行為說明（重要）
- 異常必須同時建立：
  - `package_exceptions` 一筆（異常池）
  - `package_events` 一筆：`delivery_status='exception'`
- 異常申報後，系統會把該包裹的 active 任務段（`pending/accepted/in_progress`）取消，讓任務從司機/倉儲清單消失。

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/warehouse/packages/:packageId/exception` |
| **功能** | 倉儲異常申報：建立異常紀錄並將包裹狀態更新為 `exception`（同時寫入事件） |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

#### 異常事件規範（客戶追蹤圖相容）
- `delivery_status='exception'`：
  - `delivery_details` 必須有可讀描述（對應 `description`）。
  - `location` 建議必填：
    - 節點 ID（`END_*/REG_*/HUB_*`）→ 前端標記「點」異常
    - `TRUCK_*` + `delivery_details` 含目的地（`前往 XXX`/`下一站 XXX`）→ 前端標記「線」異常
- `delivery_status='exception_resolved'`：
  - 僅應由客服處理端點產生（`POST /api/cs/exceptions/:exceptionId/handle`），避免「解除事件」與異常池狀態不一致。

### 7.3 司機任務與車輛移動 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/tasks/:taskId/accept` |
| **功能** | 司機接受/開始任務（任務狀態推進） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/tasks/:taskId/complete` |
| **功能** | 司機完成任務：推進包裹貨態、到付可回報實收，包裹上車時所在地可更新為貨車編號 |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/driver/vehicle` |
| **功能** | 取得司機車輛狀態（home/current/vehicle_code） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/vehicle/move` |
| **功能** | 司機在地圖上移動到相鄰節點（後端檢查 `edges` 相鄰） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

### 7.4 倉儲改路徑 `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `PATCH /api/warehouse/packages/:packageId/route` |
| **功能** | 以系統計算路徑為建議，允許倉儲員修改包裹後續配送路徑（更新 `packages.route_path`） |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

---

## 附錄：客戶顯示 Stage 狀態機

```
Stage 為「客戶顯示用的大階段」，可能在配送站/轉運中心之間重複循環（多段轉運）。

created → picked_up → in_transit → warehouse_in → sorting → warehouse_out → in_transit → … → delivered

末端配送（最後一哩）：
warehouse_out → out_for_delivery → delivered

異常（可從任意 stage 發生）：
ANY → exception
exception --(客服處理 exception_resolved, action=resume)--> warehouse_in / in_transit
exception --(客服處理 action=cancel)-->（取消委託；不再派發任務段）
```

---

## 版本歷史

| 版本 | 日期 | 說明 |
|------|------|------|
| 1.0 | 2025-12-10 | 初版 |
| 2.0 | 2025-12-10 | 依需求文件完整重寫 |
| 2.1 | 2025-12-10 | 修正：1) 所有 API 增加 403 錯誤處理 2) weight 改為選填 3) content_description 改為必填 4) limit 增加範圍限制 5) 簡化路線 API 6) 計費模組增加月結客戶說明 |
| 3.0 | 2025-12-10 | 依照類別圖的模組重寫，將系統區重新分為6個模組。修改部分說明使其更符合目前的專案狀況。|
| 3.1 | 2025-12-13 | 文件整理：更新 README、新增開發指南與測試指南 |
| 3.2 | 2025-12-22 | 新增 API 實作狀態標記，並補足缺失 API 定義 |
| 3.3 | 2025-12-23 | 完整定義管理員後台 API（第 8 章）：KPI 統計、使用者管理、DB Explorer、統計報表、運費規則管理 |

---

## 8. 管理員後台 API (Admin)

> 本章節定義管理員後台相關 API，對應 `todoList.md` 中的 A1-A5 項目。

---

### 8.1 取得系統 KPI 統計 `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/admin/stats` |
| **功能** | 取得系統關鍵指標（今日包裹數、異常數、營收等） |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `date` | string | ❌ | 指定統計日期（預設今天，格式 `YYYY-MM-DD`） |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "stats": {
    "date": "2025-12-23",
    "packages": {
      "created_today": 45,
      "pending_delivery": 120,
      "delivered_today": 38,
      "exception_count": 5
    },
    "users": {
      "total_customers": 350,
      "total_employees": 25,
      "contract_customers": 12
    },
    "billing": {
      "revenue_today": 25600,
      "unpaid_bills": 8,
      "unpaid_amount": 180000
    },
    "exceptions": {
      "unhandled_count": 5,
      "handled_today": 3
    }
  }
}
```

#### 輸出欄位說明

| 欄位 | 說明 |
|------|------|
| `packages.created_today` | 今日建立的包裹數量 |
| `packages.pending_delivery` | 待配送的包裹數量（狀態非 `delivered`/`canceled`） |
| `packages.delivered_today` | 今日完成配送的包裹數量 |
| `packages.exception_count` | 目前異常中的包裹數量 |
| `users.total_customers` | 客戶總數 |
| `users.total_employees` | 員工總數 |
| `users.contract_customers` | 合約客戶數量 |
| `billing.revenue_today` | 今日營收（已付款金額） |
| `billing.unpaid_bills` | 未付款帳單數量 |
| `billing.unpaid_amount` | 未付款總金額 |
| `exceptions.unhandled_count` | 異常池中未處理的異常數量 |
| `exceptions.handled_today` | 今日已處理的異常數量 |

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非 admin 角色 |

---

### 8.2 使用者列表 `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/admin/users` |
| **功能** | 查詢所有使用者（支援篩選與分頁） |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `user_type` | string | ❌ | `customer` / `employee` |
| `user_class` | string | ❌ | 依角色篩選（如 `driver`、`contract_customer`） |
| `status` | string | ❌ | `active` / `suspended`（預設全部） |
| `search` | string | ❌ | 搜尋姓名/Email/電話（模糊比對） |
| `limit` | number | ❌ | 預設 20，最大 100 |
| `offset` | number | ❌ | 分頁偏移 |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "users": [
    {
      "id": "uuid",
      "user_name": "王小明",
      "email": "wang@example.com",
      "phone_number": "0912345678",
      "user_type": "customer",
      "user_class": "contract_customer",
      "status": "active",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 350,
  "limit": 20,
  "offset": 0
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 405 | limit 超過 100 |

---

### 8.3 使用者詳情 `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/admin/users/:id` |
| **功能** | 取得單一使用者完整資訊（含統計數據） |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "user_name": "王小明",
    "email": "wang@example.com",
    "phone_number": "0912345678",
    "address": "10,20",
    "user_type": "customer",
    "user_class": "contract_customer",
    "billing_preference": "monthly",
    "status": "active",
    "created_at": "2025-01-15T10:30:00Z",
    "suspended_at": null,
    "suspended_reason": null,
    "statistics": {
      "total_packages": 45,
      "total_spent": 68000
    }
  }
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 404 | 使用者不存在 |

---

### 8.4 更新使用者資料 `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `PUT /api/admin/users/:id` |
| **功能** | 管理員更新使用者資料（姓名、電話、工作地等） |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Request Body)

```json
{
  "user_name": "string (optional)",
  "phone_number": "string (optional)",
  "address": "string (optional)",
  "user_class": "string (optional, 僅限員工)"
}
```

#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `user_name` | string | ❌ | 使用者姓名 |
| `phone_number` | string | ❌ | 電話號碼 |
| `address` | string | ❌ | 客戶：預設地址；員工：工作地點（節點 ID） |
| `user_class` | string | ❌ | 員工角色變更（僅限 `user_type=employee`） |

> ⚠️ **安全限制**：`email` 與 `password_hash` 不可透過此 API 修改。密碼請使用「重設密碼」API。

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "user_name": "新姓名",
    "phone_number": "0987654321",
    "address": "HUB_0",
    "user_class": "driver",
    ...
  }
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 欄位格式錯誤、嘗試變更客戶的 user_class |
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 404 | 使用者不存在 |

---

### 8.5 指派車輛給司機 `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/admin/users/:id/assign-vehicle` |
| **功能** | 為司機建立或更新車輛資訊 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Request Body)

```json
{
  "vehicle_code": "TRUCK_001",
  "home_node_id": "HUB_0"
}
```

#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `vehicle_code` | string | ✅ | 車輛編號（唯一識別碼） |
| `home_node_id` | string | ❌ | 車輛起始節點（預設使用司機的 `address`） |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "vehicle": {
    "id": "uuid",
    "driver_user_id": "uuid",
    "vehicle_code": "TRUCK_001",
    "home_node_id": "HUB_0",
    "current_node_id": "HUB_0"
  }
}
```

#### 行為說明

- 若司機尚無車輛，建立新的 `vehicles` 紀錄
- 若司機已有車輛，更新 `vehicle_code` 與 `home_node_id`
- `current_node_id` 會重設為 `home_node_id`

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 欄位缺失、`home_node_id` 不是有效節點 |
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 404 | 使用者不存在 |
| 409 | 目標使用者不是司機（`user_class != driver`）、車輛編號已被其他司機使用 |

---

### 8.6 查詢員工工作統計 `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/admin/users/:id/work-stats` |
| **功能** | 取得員工的工作統計數據（任務完成數、異常申報數等） |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `date_from` | string | ❌ | 統計開始日期（預設本月 1 日） |
| `date_to` | string | ❌ | 統計結束日期（預設今天） |

#### 輸出格式 (Success Response - 200)

**司機統計**

```json
{
  "success": true,
  "user_id": "uuid",
  "user_class": "driver",
  "period": {
    "date_from": "2025-12-01",
    "date_to": "2025-12-23"
  },
  "stats": {
    "tasks_completed": 156,
    "tasks_canceled": 3,
    "packages_picked_up": 89,
    "packages_delivered": 67,
    "exceptions_reported": 2,
    "cod_collected": 45600
  }
}
```

**倉儲人員統計**

```json
{
  "success": true,
  "user_id": "uuid",
  "user_class": "warehouse_staff",
  "period": {
    "date_from": "2025-12-01",
    "date_to": "2025-12-23"
  },
  "stats": {
    "packages_received": 320,
    "packages_dispatched": 298,
    "exceptions_reported": 5
  }
}
```

**客服人員統計**

```json
{
  "success": true,
  "user_id": "uuid",
  "user_class": "customer_service",
  "period": {
    "date_from": "2025-12-01",
    "date_to": "2025-12-23"
  },
  "stats": {
    "exceptions_handled": 45,
    "contracts_reviewed": 12
  }
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 日期格式錯誤 |
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 404 | 使用者不存在 |
| 409 | 目標使用者不是員工（`user_type != employee`） |

---

### 8.7 停用帳號 `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/admin/users/:id/suspend` |
| **功能** | 停用使用者帳號（停用後該使用者無法登入） |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Request Body)

```json
{
  "reason": "string (optional)"
}
```

#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `reason` | string | ❌ | 停用原因（會記錄在資料庫中） |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "message": "帳號已停用"
}
```

#### 行為說明

- 將 `users.status` 設為 `suspended`
- 記錄 `suspended_at` 時間與 `suspended_reason`
- 該使用者的所有有效 token 會被清除（強制登出）

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非 admin 角色、或嘗試停用自己 |
| 404 | 使用者不存在 |
| 409 | 帳號已處於停用狀態 |

---

### 8.8 啟用帳號 `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/admin/users/:id/activate` |
| **功能** | 重新啟用被停用的帳號 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "message": "帳號已啟用"
}
```

#### 行為說明

- 將 `users.status` 設為 `active`
- 清除 `suspended_at` 與 `suspended_reason`

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 404 | 使用者不存在 |
| 409 | 帳號已處於啟用狀態 |

---

### 8.9 刪除帳號 (Soft Delete) `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `DELETE /api/admin/users/:id` |
| **功能** | 軟刪除使用者帳號（標記為已刪除，資料保留） |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "message": "帳號已刪除"
}
```

#### 行為說明

- 將 `users.status` 設為 `deleted`
- 記錄 `deleted_at` 時間
- 已刪除的使用者不會出現在列表中（除非明確篩選 `status=deleted`）
- 該使用者的所有有效 token 會被清除

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非 admin 角色、或嘗試刪除自己 |
| 404 | 使用者不存在 |

---

### 8.10 重設密碼 `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/admin/users/:id/reset-password` |
| **功能** | 管理員為使用者重設密碼 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Request Body)

```json
{
  "new_password": "string"
}
```

#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `new_password` | string | ✅ | 新密碼（最少 6 個字元） |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "message": "密碼已重設"
}
```

#### 行為說明

- 更新 `users.password_hash`
- 該使用者的所有有效 token 會被清除（強制重新登入）

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 密碼長度不足 |
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 404 | 使用者不存在 |

---

### 8.11 資料表列表 (DB Explorer) `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/admin/db/tables` |
| **功能** | 取得資料庫所有資料表名稱與結構資訊 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "tables": [
    {
      "name": "users",
      "columns": [
        { "name": "id", "type": "TEXT", "pk": true, "notnull": true },
        { "name": "user_name", "type": "TEXT", "pk": false, "notnull": true },
        { "name": "email", "type": "TEXT", "pk": false, "notnull": true },
        { "name": "password_hash", "type": "TEXT", "pk": false, "notnull": true }
      ],
      "row_count": 350
    },
    {
      "name": "packages",
      "columns": [ ... ],
      "row_count": 1200
    }
  ]
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非 admin 角色 |

---

### 8.12 查詢資料表內容 (DB Explorer) `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/admin/db/tables/:tableName` |
| **功能** | 查詢指定資料表的紀錄（支援分頁與排序） |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `limit` | number | ❌ | 預設 50，最大 200 |
| `offset` | number | ❌ | 分頁偏移 |
| `order_by` | string | ❌ | 排序欄位（預設主鍵） |
| `order` | string | ❌ | `asc` / `desc`（預設 `asc`） |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "table": "users",
  "columns": [
    { "name": "id", "type": "TEXT" },
    { "name": "user_name", "type": "TEXT" }
  ],
  "rows": [
    { "id": "uuid-1", "user_name": "張三", "email": "zhang@example.com", ... },
    { "id": "uuid-2", "user_name": "李四", "email": "li@example.com", ... }
  ],
  "total": 350,
  "limit": 50,
  "offset": 0
}
```

> ⚠️ **安全注意**：敏感欄位（如 `password_hash`）會以 `***` 遮罩顯示。

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 404 | 資料表不存在 |
| 405 | limit 超過 200 |

---

### 8.13 修改資料表紀錄 (DB Explorer) `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `PUT /api/admin/db/tables/:tableName/:id` |
| **功能** | 更新指定紀錄的欄位值 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Request Body)

```json
{
  "user_name": "新姓名",
  "address": "新地址"
}
```

> 傳入要更新的欄位與值，僅支援更新「可修改欄位」。

#### 不可修改欄位

以下欄位不允許透過此 API 修改：
- `id`（主鍵）
- `created_at`（建立時間）
- `password_hash`（密碼，需使用專用 API）

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "message": "紀錄已更新",
  "updated_row": {
    "id": "uuid",
    "user_name": "新姓名",
    "address": "新地址",
    ...
  }
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 不允許修改的欄位、欄位不存在 |
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 404 | 資料表或紀錄不存在 |

---

### 8.14 每日包裹統計報表 `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/admin/reports/daily` |
| **功能** | 取得指定日期範圍內的每日包裹統計 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `date_from` | string | ✅ | 開始日期（格式 `YYYY-MM-DD`） |
| `date_to` | string | ✅ | 結束日期（格式 `YYYY-MM-DD`） |

> ⚠️ 日期範圍不得超過 365 天。

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "report": {
    "date_from": "2025-12-01",
    "date_to": "2025-12-23",
    "daily_data": [
      {
        "date": "2025-12-01",
        "packages_created": 45,
        "packages_delivered": 38,
        "packages_exception": 2,
        "revenue": 25600
      },
      {
        "date": "2025-12-02",
        "packages_created": 52,
        "packages_delivered": 41,
        "packages_exception": 1,
        "revenue": 28400
      }
    ],
    "summary": {
      "total_packages_created": 980,
      "total_packages_delivered": 850,
      "total_revenue": 580000,
      "avg_daily_packages": 42.6
    }
  }
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 日期格式錯誤 |
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 405 | 日期範圍超過 365 天 |

---

### 8.15 服務類型分佈報表 `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/admin/reports/service-breakdown` |
| **功能** | 取得各服務類型的包裹數量與營收分佈 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `date_from` | string | ❌ | 開始日期（預設本月 1 日） |
| `date_to` | string | ❌ | 結束日期（預設今天） |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "report": {
    "date_from": "2025-12-01",
    "date_to": "2025-12-23",
    "by_service_level": [
      { "service_level": "overnight", "count": 120, "revenue": 48000, "percentage": 12.2 },
      { "service_level": "two_day", "count": 280, "revenue": 84000, "percentage": 28.6 },
      { "service_level": "standard", "count": 450, "revenue": 90000, "percentage": 45.9 },
      { "service_level": "economy", "count": 130, "revenue": 19500, "percentage": 13.3 }
    ],
    "by_payment_type": [
      { "payment_type": "credit_card", "count": 400, "revenue": 120000 },
      { "payment_type": "cash", "count": 280, "revenue": 70000 },
      { "payment_type": "monthly", "count": 300, "revenue": 51500 }
    ],
    "by_special_handling": [
      { "special_handling": "fragile", "count": 85 },
      { "special_handling": "dangerous", "count": 12 },
      { "special_handling": "international", "count": 45 }
    ]
  }
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非 admin 角色 |

---

### 8.16 運費規則列表 `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/admin/service-rules` |
| **功能** | 取得所有運費規則（依優先順序排序） |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `is_active` | boolean | ❌ | 篩選啟用/停用規則（不帶則全部） |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "rules": [
    {
      "id": "uuid",
      "name": "標準配送基本費",
      "description": "標準配送服務的基本運費",
      "service_level": "standard",
      "min_weight": null,
      "max_weight": 5,
      "min_distance": null,
      "max_distance": null,
      "special_handling": null,
      "base_price": 80,
      "weight_rate": 10,
      "distance_rate": 2,
      "priority": 10,
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非 admin 角色 |

---

### 8.17 新增運費規則 `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/admin/service-rules` |
| **功能** | 建立新的運費規則 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Request Body)

```json
{
  "name": "string",
  "description": "string (optional)",
  "service_level": "overnight | two_day | standard | economy (optional)",
  "min_weight": 0,
  "max_weight": 5,
  "min_distance": null,
  "max_distance": null,
  "special_handling": "fragile | dangerous | international (optional)",
  "base_price": 80,
  "weight_rate": 10,
  "distance_rate": 2,
  "priority": 10,
  "is_active": true
}
```

#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `name` | string | ✅ | 規則名稱 |
| `description` | string | ❌ | 規則說明 |
| `service_level` | string | ❌ | 適用的服務等級，`null` 表示所有等級 |
| `min_weight` | number | ❌ | 最小重量（kg），`null` 表示無下限 |
| `max_weight` | number | ❌ | 最大重量（kg），`null` 表示無上限 |
| `min_distance` | number | ❌ | 最小距離（km），`null` 表示無下限 |
| `max_distance` | number | ❌ | 最大距離（km），`null` 表示無上限 |
| `special_handling` | string | ❌ | 特殊處理標記，`null` 表示無特殊要求 |
| `base_price` | number | ✅ | 基本價格（元） |
| `weight_rate` | number | ❌ | 每公斤加價（元），預設 0 |
| `distance_rate` | number | ❌ | 每公里加價（元），預設 0 |
| `priority` | number | ❌ | 優先順序（越大優先），預設 0 |
| `is_active` | boolean | ❌ | 是否啟用，預設 true |

#### 規則匹配邏輯

運費計算時，系統會依以下條件篩選適用規則：
1. `service_level` 為 `null` 或與包裹相符
2. 包裹重量在 `[min_weight, max_weight]` 範圍內
3. 配送距離在 `[min_distance, max_distance]` 範圍內
4. `special_handling` 為 `null` 或與包裹相符
5. `is_active = true`

符合條件的規則中，取 `priority` 最高者套用。

#### 輸出格式 (Success Response - 201)

```json
{
  "success": true,
  "rule": {
    "id": "uuid",
    "name": "標準配送基本費",
    ...
  }
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 必填欄位缺失、欄位格式錯誤 |
| 401 | 未認證 |
| 403 | 非 admin 角色 |

---

### 8.18 修改運費規則 `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `PUT /api/admin/service-rules/:id` |
| **功能** | 更新運費規則 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Request Body)

與「新增運費規則」相同，但所有欄位皆為選填（僅傳入要更新的欄位）。

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "rule": { ... }
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 欄位格式錯誤 |
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 404 | 規則不存在 |

---

### 8.19 刪除運費規則 `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `DELETE /api/admin/service-rules/:id` |
| **功能** | 刪除運費規則 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "message": "規則已刪除"
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 404 | 規則不存在 |
