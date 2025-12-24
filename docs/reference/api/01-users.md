# User Module

> 來源：`docs/reference/api-contract.legacy.md`（由 legacy 拆分）
>
> - 本頁定位：接口參考（endpoint / request/response schema / error codes）
> - 規則/流程：`docs/modules/users.md`、`docs/modules/contracts.md`
> - 若內容與現行實作衝突：以後端實作與 `docs/modules/` 為準

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

> 詳細倉儲作業規則請參考 `docs/modules/operations.md`（操作手冊：`docs/handbook/warehouse-staff.md`；舊入口：`docs/warehouse-staff.md`）

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


