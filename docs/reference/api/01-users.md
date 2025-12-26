# User Module

> 來源：`docs/legacy/api-contract.legacy.md`（由 legacy 拆分）
>
> - 本頁定位：接口參考（endpoint / request/response schema / error codes）
> - 規則/流程（權威）：`docs/modules/users.md`、`docs/modules/contracts.md`
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
| `address` | string | ✅ | 預設地址（地圖節點 ID，例如 `END_HOME_0` / `END_STORE_0`） |

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
  "billing_preference": "cash | credit_card | bank_transfer | monthly | third_party_payment"
}
```

#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `user_name` | string | ❌ | 姓名 |
| `phone_number` | string | ❌ | 電話號碼 |
| `address` | string | ❌ | 預設地址 |
| `billing_preference` | string | ❌ | 帳單偏好：`cash`(現金支付)、`credit_card`(信用卡)、`bank_transfer`(網路銀行)、`monthly`(月結帳單) 僅限合約客戶、`third_party_payment`(第三方支付) |

Notes:

- `billing_preference` 是「預設偏好」，會在建立包裹時用來預設 `packages.payment_method`；實際付款仍需在付款清單再次確認（見 `docs/modules/payments.md`）。
- 注意命名差異：偏好用 `monthly`；實際付款方式用 `monthly_billing`（非合約客戶不可選）。

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
| `billing_address` | string | ✅ | 發票/帳單地址（地圖節點 ID，例如 `END_HOME_0` / `END_STORE_0`） |
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

### 1.5.1 查詢合約申請狀態 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/customers/contract-application/status` |
| **功能** | 查詢指定客戶是否已有合約申請，以及最新申請的狀態（前端用於判斷是否顯示申請表單） |
| **認證** | （依現行實作）不需要；客戶端通常仍會帶 Token |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `customer_id` | string | ✅ | 客戶 ID |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "has_application": true,
  "application_id": "uuid",
  "status": "pending | approved | rejected"
}
```

---

### 1.6 駕駛員 - 取得任務清單（V2）`[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/driver/tasks` |
| **功能** | 取得司機「已指派任務」或「所在節點可交接任務」清單（以 `delivery_tasks` 為主） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `scope` | string | ❌ | `assigned`（預設）：只看指派給我的任務；`handoff`：看所在 `HUB_* / REG_*` 節點可交接任務 |
| `status` | string | ❌ | `pending | accepted | in_progress | completed | canceled` |
| `limit` | number | ❌ | 1–200（預設 50） |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "scope": "assigned",
  "tasks": [
    {
      "id": "uuid",
      "package_id": "uuid",
      "task_type": "pickup | deliver",
      "from_location": "REG_1",
      "to_location": "HUB_0",
      "status": "pending",
      "segment_index": 0,
      "tracking_number": "TRK-xxxx-xxxxxxxx",
      "sender_address": "END_HOME_0",
      "receiver_address": "END_STORE_3",
      "payment_type": "prepaid | cod",
      "payment_amount": 120,
      "paid_at": null,
      "estimated_delivery": "2025-12-13T00:00:00Z"
    }
  ]
}
```

> 當 `scope=handoff` 時，回應會額外包含 `node_id`（司機車輛目前所在節點）。

---

### 1.6.1 駕駛員 - 接手交接任務（handoff）`[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/tasks/:taskId/accept` |
| **功能** | 在 `HUB_* / REG_*` 節點接手一筆可交接任務（更新 `delivery_tasks.assigned_driver_id`） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

> 後端會強制檢查：司機車輛 `current_node_id` 必須等於任務 `from_location`，且包裹不可為 terminal / active exception。

---

### 1.6.2 駕駛員 - 標記在途中（in_transit）`[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/tasks/:taskId/enroute` |
| **功能** | 插入 `package_events.in_transit`（`location` 會寫入車輛代碼 `vehicle_code`） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

---

### 1.6.3 駕駛員 - 標記到達節點（arrived_*）`[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/tasks/:taskId/arrive` |
| **功能** | 依任務類型插入 `arrived_pickup` 或 `arrived_delivery`（若同節點已存在則冪等） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

---

### 1.6.4 駕駛員 - 取件/裝載（pickup）`[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/tasks/:taskId/pickup` |
| **功能** | 裝載貨物到車上（建立 `vehicle_cargo`），插入 `package_events.picked_up`，並將任務段設為 `in_progress` |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

> 預付（`payment_type=prepaid`）必須已結清（`paid_at` 有值）才允許取件；若是預付現金流程需先走 `collect-cash`。

---

### 1.6.5 駕駛員 - 投遞/卸貨（dropoff）`[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/tasks/:taskId/dropoff` |
| **功能** | 卸貨（更新 `vehicle_cargo.unloaded_at`），並依目的地插入 `warehouse_in` 或 `delivered`，完成任務段 |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

> 到府代收（COD at home）會要求先完成收款（`paid_at` 有值）才允許 `delivered`。

---

### 1.6.6 駕駛員 - 完成任務段（complete）`[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/tasks/:taskId/complete` |
| **功能** | 將該 `delivery_tasks` 標記為 `completed` |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

---

### 1.6.7 駕駛員 - 現金收款（collect cash）`[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/packages/:packageId/collect-cash` |
| **功能** | 司機在現場收現，更新 `payments.paid_at` 並插入 `payment_collected_*` 事件 |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

> 收款窗口與限制請見：`docs/features/driver-cash-collection.md`（到府預付需 `arrived_pickup`；到府代收需 `arrived_delivery`；門市代收不可由司機收現）。

---

### 1.7 駕駛員 - 寫入包裹事件（Legacy）`[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/packages/:packageId/status` |
| **功能** | 直接插入一筆 `package_events`（不管理 `delivery_tasks` / `vehicle_cargo`） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

#### 輸入格式 (Request Body)

```json
{
  "status": "picked_up | in_transit | out_for_delivery | delivered",
  "note": "string",
  "location": "TRUCK_001 | REG_3 | END_HOME_0"
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 不支援 `status=exception`，請改用異常申報 API |
| 401 | 未認證 |
| 403 | 非 driver 角色 |
| 404 | 包裹不存在 |
| 409 | 包裹已是 terminal 或有 active exception |

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
  "location_id": "REG_3 | HUB_1 | TRUCK_001",
  "note": "string"
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

---

### 1.11 倉儲人員 - 派發下一段任務 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/warehouse/packages/:packageId/dispatch-next` |
| **功能** | 在本站點收後，派發包裹的下一段任務（必須是相鄰節點的一段） |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

#### 輸入格式 (Request Body)

```json
{ "toNodeId": "HUB_1 | REG_2 | REG_4" }
```

#### 行為摘要（重點）

- 起點 `fromNodeId` 由後端強制使用 `users.address`（本站）
- 包裹必須在本站且已點收（最新事件為本站 `warehouse_received` 或 `sorting`）
- `toNodeId` 必須與本站相鄰（`edges` 存在）
- 成功後會建立一筆新的 `delivery_tasks`（`status='pending'`），並寫入 `route_decided` 事件


