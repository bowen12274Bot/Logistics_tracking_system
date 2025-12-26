# Payment Module

> 來源：`docs/legacy/api-contract.legacy.md`（由 legacy 拆分）
>
> - 本頁定位：接口參考（endpoint / request/response schema / error codes）
> - 規則/流程：`docs/modules/payments.md`、`docs/modules/contracts.md`
> - 若內容與現行實作衝突：以後端實作與 `docs/modules/` 為準

## 5. 金流模組 (Payment Module)

> 此模組主要服務合約客戶（月結），非合約客戶使用預付或貨到付款。

### 5.0 包裹付款（單件費用） `[已實作]`

> 規則/流程請以 `docs/modules/payments.md` 為準；此段僅描述 API 介面（待付清單、更新付款方式、確認付款）。

#### 5.0.1 查詢待付/已付包裹清單

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/payments/packages` |
| **功能** | 查詢「目前登入者」需要付款的包裹費用（預付：寄件者；到付：收件者） |
| **認證** | 需要 Token |
| **權限** | `customer`（僅能查自己的待付/已付） |

Query:

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `include_paid` | boolean | 否 | `true` 則包含已付款項目（預設 `false` 只回待付） |
| `limit` | number | 否 | 最大 200（預設 50） |

Success (200):

```json
{
  "success": true,
  "items": [
    {
      "package": { "id": "uuid", "tracking_number": "TRK-...", "payment_type": "prepaid", "payment_method": "credit_card" },
      "amount": 150,
      "paid_at": null,
      "payer_user_id": "uuid",
      "payable_now": true,
      "reason": null
    }
  ]
}
```

Notes:

- `payable_now` / `reason` 會依 `payment_type`、地點（住家/超商）與事件門檻（例如 `arrived_pickup` / `arrived_delivery` / `delivered`）計算。

---

#### 5.0.2 更新付款方式（意圖/選擇）

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/payments/packages/:packageId/method` |
| **功能** | 更新待付包裹的 `payment_method`（不會寫入 `paid_at`，不代表已付款） |
| **認證** | 需要 Token |
| **權限** | `customer`（僅能更新自己的待付項目） |

Request body:

```json
{ "payment_method": "cash | credit_card | bank_transfer | third_party_payment | monthly_billing" }
```

Success (200):

```json
{ "success": true, "payment_method": "credit_card", "updated_at": "2025-12-10T00:30:00Z" }
```

Errors:

| 狀態碼 | 說明 |
|------|------|
| 401 | 未認證 |
| 403 | 非付款人（`payer_user_id` 不符）或 `monthly_billing` 但非合約客戶 |
| 404 | 包裹不存在 |
| 409 | 已付款不可再變更 |

---

#### 5.0.3 確認付款（模擬付款）

> ⚠️ 注意：本段是「確認付款」端點 `POST /api/payments/packages/:packageId`（沒有 `/method`）。

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/payments/packages/:packageId` |
| **功能** | 確認付款（會寫入 `payments.paid_at`，並依付款方式產生相對應效果） |
| **認證** | 需要 Token |
| **權限** | `customer`（僅能支付自己的待付項目） |

Request body:

```json
{ "payment_method": "cash | credit_card | bank_transfer | third_party_payment | monthly_billing" }
```

Success (200):

```json
{ "success": true, "paid_at": "2025-12-10T00:30:00Z" }
```

Behavior notes:

- `monthly_billing`：僅限合約客戶且 `payment_type = prepaid`，確認付款後視為已付款，並加入本期「未出帳」月結帳單（`monthly_billing_items`）。
- 其他方式：確認付款即視為付清；`cash` / `cod` 類型會受「到場/到站」事件門檻限制（不符合會回 409）。

Errors:

| 狀態碼 | 說明 |
|------|------|
| 401 | 未認證 |
| 403 | 非付款人（`payer_user_id` 不符）或 `monthly_billing` 但非合約客戶 |
| 404 | 包裹不存在 |
| 409 | 尚未達付款條件（`payable_now = false`）或已付款 |

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

