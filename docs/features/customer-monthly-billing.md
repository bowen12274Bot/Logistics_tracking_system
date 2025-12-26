# 功能：月結（Contract Customer Monthly Billing）

本文件描述合約客戶「月結」的端到端能力：合約申請→核准→本期未出帳累積→出帳→付帳單→付款紀錄。

## 入口與 UI

- 合約/月結：`/customer/contract`
- 付款與紀錄：`/customer/payment`

## 名詞與狀態

- 合約申請狀態：`pending | approved | rejected`
- 未出帳（本期累積）：帳單 `due_date = NULL`
- 出帳後：帳單會有 `due_date`（表示已結算，進入可繳費狀態）
- 月結「確認付款」：是把包裹加入本期 `monthly_billing_items`（不是付帳單）

## 規則（權威）

- 合約流程：`docs/modules/contracts.md`
- 帳務規則：`docs/modules/payments.md`（含 `due_date = NULL` 代表未出帳）

## API

- 申請合約：`POST /api/customers/contract-application`（`docs/reference/api/01-users.md`）
- 查申請狀態：`GET /api/customers/contract-application/status`（`docs/reference/api/01-users.md`）
- 審核：`PUT /api/admin/contract-applications/:id`（`docs/reference/api/02-review.md`）
- 查帳單：`GET /api/billing/bills`、`GET /api/billing/bills/:billId`（`docs/reference/api/05-payments.md`）
- 付帳單：`POST /api/billing/payments`（`docs/reference/api/05-payments.md`）
- 查帳單付款紀錄：`GET /api/billing/payments`（`docs/reference/api/05-payments.md`）

## 關鍵定義

- 未出帳：`monthly_billing.due_date = NULL`

## 端到端流程（具體）

### A) 申請成為合約客戶

1. 客戶送出申請：`POST /api/customers/contract-application`
2. 前端查狀態決定 UI：`GET /api/customers/contract-application/status?customer_id=<id>`

### B) 客服/管理員審核

- 審核端點：`PUT /api/admin/contract-applications/:id`

審核核准後的副作用（摘要）：

- `users.user_class` 變更為 `contract_customer`
- `users.billing_preference` 預設為 `monthly`
- 系統會立即建立本期月結帳單（未出帳：`due_date = NULL`）

### C) 本期累積（未出帳）

當合約客戶在「付款清單」把某筆 `prepaid` 包裹的付款方式選為 `monthly_billing` 並「確認付款」：

- 該包裹視為已付款（`payments.paid_at` 被寫入）
- 會新增一筆 `monthly_billing_items` 把包裹加入本期未出帳帳單

前端在 `/customer/contract` 的顯示邏輯（摘要）：

- 以當月 UTC 區間呼叫 `GET /api/billing/bills?period_from=...&period_to=...`
- 優先選擇 `due_date = NULL` 的帳單作為「本期未出帳」

### D) 出帳與繳費

- 出帳（結算）由管理員執行：`POST /api/admin/billing/settle`
- 出帳後，帳單會有 `due_date`，客戶即可用 `POST /api/billing/payments` 付清帳單

## Request / Response（具體範例）

### 1) 查帳單列表（客戶）

```json
{
  "success": true,
  "bills": [
    {
      "id": "uuid",
      "period": "2025-12-01T00:00:00Z - 2025-12-31T23:59:59Z",
      "total_amount": 15000,
      "package_count": 45,
      "status": "pending",
      "due_date": null
    }
  ]
}
```

### 2) 付帳單（客戶）

```json
{ "bill_id": "uuid", "payment_method": "bank_transfer", "amount": 15000 }
```

