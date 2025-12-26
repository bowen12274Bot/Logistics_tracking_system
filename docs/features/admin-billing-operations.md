# 功能：管理員帳務作業（Billing Admin Operations）

本文件描述管理員如何對「月結帳單」做結算、調整與補救操作，讓月結（`monthly_billing` / `monthly_billing_items`）可以在可控的流程下出帳與修正。

## 相關文件

- 規則權威：`docs/modules/payments.md`
- 客戶月結體驗：`docs/features/customer-monthly-billing.md`
- 客服查帳支援：`docs/features/cs-billing-support.md`
- API 參考：`docs/reference/api/05-payments.md`

## 名詞與狀態（實作導向）

- 帳單資料表：`monthly_billing`
- 帳單項目：`monthly_billing_items`（每一筆通常對應一個包裹 `package_id`）
- 「未出帳」定義：`monthly_billing.due_date = NULL`（尚未由 admin 進行月底結算）
- 帳單狀態：`pending | paid | overdue`（目前系統主要使用 `pending/paid`；`overdue` 可由管理流程或後續擴充處理）
- 計費週期（cycle）：每個月 `YYYY-MM-01T00:00:00Z` ～ 當月最後一刻 `...T23:59:59.999Z`

> 計費週期計算與結算行為由後端 service 實作（`billingService.getBillingCycle/settleBillingCycle`）。

## 管理員作業清單（Use cases）

### 1) 月底結算（設定 due date，讓帳單可進入「可繳費」狀態）

API：`POST /api/admin/billing/settle`

用途：

- 把指定月份、尚未出帳的 `pending` 帳單批次設定 `due_date`
- 讓「本期月結」從「累積中（due_date=NULL）」轉成「待繳費（due_date!=NULL）」狀態

Request：

```json
{ "cycle_year_month": "2025-12" }
```

後端實作重點：

- `cycle_year_month` 必須符合 `YYYY-MM`
- `due_date` 設定為「下個月 15 號 end-of-day（UTC）」的 ISO 時間
- 只更新符合條件的帳單：
  - `cycle_start = YYYY-MM-01T00:00:00Z`
  - `status = 'pending'`
  - `due_date IS NULL`

Response（示例）：

```json
{
  "success": true,
  "result": { "cycle": "2025-12", "message": "Billing cycle settled. Due dates updated." }
}
```

### 2) 手動更新帳單欄位（修正 due_date / total_amount / status）

API：`PATCH /api/admin/billing/bills/:billId`

用途（常見場景）：

- 因政策調整或補救處理，需要修改 `due_date`
- 因項目補單/移除或人工折抵，調整 `total_amount`
- 手動將帳單標為 `paid/overdue`（注意：這是資料層更新，不等同於真實支付金流）

Request body（可部分更新）：

```json
{
  "total_amount": 12000,
  "status": "pending | paid | overdue",
  "due_date": "2026-01-15T23:59:59.999Z"
}
```

後端實作備註：

- `notes` 欄位目前不會更新到資料庫（schema 允許但實作未寫入）
- 若 request body 沒有任何可更新欄位，會回 `{ success: true, message: "No changes" }`

### 3) 手動新增帳單項目（把包裹塞進指定帳單）

API：`POST /api/admin/billing/bills/:billId/items`

用途（常見場景）：

- 某包裹原本應進本期月結但漏單，管理員手動補入
- 用於修復「月結項目」與「帳單總額」不一致

Request：

```json
{ "package_id": "uuid" }
```

後端實作重點（務必知道的限制）：

- 目前實作不會檢查「包裹是否屬於該帳單 cycle」，也不會檢查「包裹是否已在該帳單中」
  - 代表可能造成重複項目或跨期塞單（屬於管理端責任與風險）
- 加入金額來源：`payments.total_amount`（若找不到 payment 記錄會視為 0）
- 成功後會：
  - `INSERT monthly_billing_items (monthly_billing_id=billId, package_id=...)`
  - `UPDATE monthly_billing SET total_amount = total_amount + amount`

Response（示例）：

```json
{ "success": true, "item_id": "uuid" }
```

### 4) 手動移除帳單項目（從帳單中刪掉某個 item）

API：`DELETE /api/admin/billing/bills/:billId/items/:itemId`

用途：

- 移除重複或不該計入的包裹項目

後端實作重點：

- 扣回金額來源：以 `itemId` 查到的 `package_id` → `payments.total_amount`（若不存在視為 0）
- 成功後會：
  - `DELETE FROM monthly_billing_items WHERE id = :itemId`
  - `UPDATE monthly_billing SET total_amount = total_amount - amount`

Response（示例）：

```json
{ "success": true }
```

## 查詢與對帳（管理員日常）

管理員可用一般帳單查詢 API 來核對：

- 帳單列表：`GET /api/billing/bills?status=pending&customer_id=...`
- 帳單明細：`GET /api/billing/bills/:billId`

> `GET /api/billing/bills` 允許 `admin/customer_service` 透過 `customer_id` 查他人的帳單；客戶僅能查自己的。

## 與月結「累積」的關聯（理解出帳時點）

- 客戶在包裹付款選擇 `monthly_billing` 並「確認付款」後，該包裹會加入本期未出帳帳單（`monthly_billing_items`）
- 未出帳帳單會保持 `due_date = NULL`，直到管理員執行 `settle`
- `settle` 不會改 `status`（仍為 `pending`），只負責設定 `due_date` 讓帳單進入可催繳/可付款狀態
