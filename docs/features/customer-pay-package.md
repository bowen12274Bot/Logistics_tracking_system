# 功能：包裹付款（Package Payment）

本文件描述客戶端「包裹付款」的端到端流程：待付清單、更新付款方式（意圖）、確認付款，以及 `payable_now/reason` 的門檻規則。

## 入口與 UI

- UI：`/customer/payment`

## 名詞（本功能用到的最小集合）

- `payment_type`：付款責任（`prepaid` / `cod`）
- `payment_method`：付款方式（`cash | credit_card | bank_transfer | third_party_payment | monthly_billing`）
- `paid_at`：不為空代表「已付款」
- `payable_now` / `reason`：是否已達到可付款門檻（現金/到付會受事件影響）

## 規則（權威）

- `docs/modules/payments.md`
- 合約/月結限制：`docs/modules/contracts.md`

## API

- 待付/已付清單：`GET /api/payments/packages`（`docs/reference/api/05-payments.md`）
- 更新付款方式（意圖）：`POST /api/payments/packages/:packageId/method`（`docs/reference/api/05-payments.md`）
- 確認付款：`POST /api/payments/packages/:packageId`（`docs/reference/api/05-payments.md`）

## 端到端流程（建議 UI 行為）

1. 讀取待付清單：呼叫 `GET /api/payments/packages?include_paid=false`
2. 使用者選擇付款方式：
   - 呼叫 `POST /api/payments/packages/:packageId/method`（只更新「意圖」，不會寫入 `paid_at`）
3. 使用者按下「確認付款」：
   - 呼叫 `POST /api/payments/packages/:packageId`
   - 成功後 `payments.paid_at` 會被寫入，該項目會從待付清單消失

## Request / Response（具體範例）

### 1) 待付清單（GET）

回傳項目（重點欄位）：

```json
{
  "success": true,
  "items": [
    {
      "package": { "id": "uuid", "tracking_number": "TRK-xxxx-xxxxxxxx", "payment_type": "prepaid" },
      "amount": 150,
      "paid_at": null,
      "payer_user_id": "uuid",
      "payable_now": false,
      "reason": "Cash prepaid at home is payable after arrived_pickup"
    }
  ]
}
```

### 2) 更新付款方式（POST /method）

```json
{ "payment_method": "credit_card" }
```

> 這一步只代表「選擇/切換」付款方式；仍需下一步確認付款才算完成。

### 3) 確認付款（POST /:packageId）

```json
{ "payment_method": "credit_card" }
```

成功：

```json
{ "success": true, "paid_at": "2025-12-10T00:30:00Z" }
```

## 邊界案例（摘要）

- 非合約客戶不可選 `monthly_billing`（更新付款方式與確認付款都會擋）。
- `payable_now=false` 時需看 `reason`（現金/到付會受事件門檻限制）。

## `payable_now` 的門檻（實作摘要）

- `payment_type=prepaid`
  - `payment_method != cash`：建單後即可付款
  - `payment_method=cash`
    - 寄件點是 `END_STORE_*`：建單後即可付款
    - 寄件點是 `END_HOME_*`：需 `arrived_pickup` 事件後可付款
- `payment_type=cod`
  - 收件點是 `END_STORE_*`：需 `delivered` 事件後可付款
  - 收件點是 `END_HOME_*`：需 `arrived_delivery` 事件後可付款
- `payment_method=monthly_billing`
  - 僅 `payment_type=prepaid` 且合約客戶可用
  - 「確認付款」後視為已付款，並加入本期未出帳月結帳單

