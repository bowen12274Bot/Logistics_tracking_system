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
- [7. 異常與任務模組（規劃中） (Exceptions & Tasks)](#7-異常與任務模組規劃中-exceptions--tasks)

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

### 1.1 客戶註冊

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

### 1.2 使用者登入

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

### 1.3 取得當前使用者資訊

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

### 1.4 更新客戶資料

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

### 1.5 申請成為合約客戶

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

### 1.6 駕駛員 - 取得今日工作清單

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

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非 driver 角色 |

---

### 1.7 駕駛員 - 更新配送狀態

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/packages/:packageId/status` |
| **功能** | 駕駛員更新包裹狀態 |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

#### 輸入格式 (Request Body)

```json
{
  "status": "picked_up | out_for_delivery | delivered | exception",
  "signature": "base64_image",
  "notes": "string",
  "cod_amount": 500
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | exception 狀態必須提供 notes |
| 401 | 未認證 |
| 403 | 非 driver 角色 |
| 404 | 包裹不存在 |

---

### 1.8 倉儲人員 - 批次入庫/出庫

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/warehouse/batch-operation` |
| **功能** | 批次處理入庫/出庫/分揀 |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

#### 輸入格式 (Request Body)

```json
{
  "operation": "warehouse_in | warehouse_out | sort",
  "package_ids": ["uuid1", "uuid2", "uuid3"],
  "destination": "TRUCK_001",
  "notes": "string"
}
```

## 2. 審核合約模組 (Review)

### 2.1 審核合約申請

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

### 3.1 建立包裹/寄件

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

### 3.2 運費試算

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

### 3.3 客戶查詢包裹列表

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

### 3.4 查詢單一包裹詳情

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
    "estimated_delivery": "2025-12-13"
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

### 3.5 公開追蹤查詢

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

| status | 說明 |
|--------|------|
| `created` | 包裹已建立 |
| `picked_up` | 起運地收件 |
| `in_transit` | 運輸中 |
| `sorting` | 分揀/轉運中 |
| `warehouse_in` | 入庫 |
| `warehouse_out` | 出庫 |
| `out_for_delivery` | 外送中 |
| `delivered` | 已投遞/簽收 |
| `exception` | 異常（遺失/延誤/損毀） |

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 404 | 追蹤編號不存在 |

---

### 3.6 建立貨態事件（內部 API）

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

### 3.7 進階追蹤查詢（員工用）

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

### 4.1 取得地圖節點與邊

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

### 4.2 路線成本計算

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

### 4.3 更新地圖邊資料

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

### 5.1 查詢帳單列表

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

### 5.2 查詢帳單明細

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

### 5.3 付款

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

### 5.4 查詢付款紀錄

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


## 6. 超級使用者管理模組 (Super User Management)

### 6.1 建立員工帳號

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

### 6.2 處理系統異常

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

## 7. 異常與任務模組（規劃中） (Exceptions & Tasks)

> 本章節為配合 `todoList.md` 新增的「異常池 / 司機任務 / 司機車輛移動 / 倉儲改路徑」需求，先整理規劃中的 API 介面；落地後再補齊完整 request/response schema。

### 7.1 異常池（客服）

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/cs/exceptions` |
| **功能** | 異常池列表（未處理/已處理） |
| **認證** | ✅ 需要 Token |
| **權限** | `customer_service` |

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/cs/exceptions/:exceptionId/handle` |
| **功能** | 將異常標示已處理並填寫處理報告 |
| **認證** | ✅ 需要 Token |
| **權限** | `customer_service` |

### 7.2 異常申報（司機/倉儲）

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/packages/:packageId/exception` |
| **功能** | 司機異常申報：建立異常紀錄並將包裹狀態更新為 `exception`（同時寫入事件） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/warehouse/packages/:packageId/exception` |
| **功能** | 倉儲異常申報：建立異常紀錄並將包裹狀態更新為 `exception`（同時寫入事件） |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

### 7.3 司機任務與車輛移動

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

### 7.4 倉儲改路徑

| 項目 | 說明 |
|------|------|
| **位置** | `PATCH /api/warehouse/packages/:packageId/route` |
| **功能** | 以系統計算路徑為建議，允許倉儲員修改包裹後續配送路徑（更新 `packages.route_path`） |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

---

## 附錄：Package 狀態機

```
created → picked_up → in_transit → sorting → warehouse_in 
    → warehouse_out → out_for_delivery → delivered
                                      ↘ exception
（規劃中：分揀轉運處理/待貨車轉運 等轉運狀態會再擴充）
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
