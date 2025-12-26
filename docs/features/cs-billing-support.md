# 功能：客服查帳支援（CS Billing Support）

本文件描述客服（customer_service）如何協助客戶查詢「月結帳單」：列出帳單、查看帳單明細、協助判斷是否已出帳（`due_date` 是否為 `NULL`）。

> 注意：客服不應代替客戶付款；付款動作由客戶端 `POST /api/billing/payments` 進行（且後端會驗證帳單歸屬）。

## 相關文件

- 規則權威：`docs/modules/payments.md`
- Admin 帳務作業：`docs/features/admin-billing-operations.md`
- 客戶月結體驗：`docs/features/customer-monthly-billing.md`
- API 參考：`docs/reference/api/05-payments.md`

## 核心概念（客服需要會判讀）

- 「是否已出帳」：看 `monthly_billing.due_date`
  - `due_date = NULL`：本期累積中（未出帳）
  - `due_date != NULL`：已出帳（可被催繳/可付款）
- `status`：
  - `pending`：待付款（可能已出帳或未出帳，需搭配 `due_date` 判斷）
  - `paid`：已付款

## 查詢入口（CS 使用）

### 1) 帳單列表（可指定 customer）

API：`GET /api/billing/bills`

CS 可以帶 `customer_id` 查詢指定客戶：

`GET /api/billing/bills?customer_id={customerId}&status=pending`

常用篩選：

- `status=pending|paid|overdue`
- `period_from` / `period_to`：用 `cycle_start/cycle_end` 篩選（實際欄位行為以後端為準）

### 2) 帳單明細（核對包裹項目）

API：`GET /api/billing/bills/:billId`

客服用途：

- 檢查帳單包含哪些包裹（tracking number、service level、cost）
- 對照客戶回報的「某筆包裹是否有進本期月結」

## 常見客服情境與處理建議

### 情境 A：客戶說「我月結看不到帳單」

判斷流程：

1. 先用 `GET /api/billing/bills?customer_id=...&status=pending` 找該期是否存在帳單
2. 若找到但 `due_date = NULL`：表示尚未出帳（admin 尚未 settle），屬正常狀態
3. 若找不到：
   - 可能尚未累積任何月結項目（本期 `monthly_billing_items` 還沒有）
   - 或客戶其實不是合約客戶（月結付款方式不應成立）

### 情境 B：客戶說「某筆包裹應該要進月結，但帳單裡沒有」

判斷流程：

1. 用 `GET /api/billing/bills?customer_id=...` 找到對應週期的 bill
2. 用 `GET /api/billing/bills/:billId` 檢查明細是否含該 `tracking_number`
3. 若確實漏單：請走管理員補救流程（`docs/features/admin-billing-operations.md` 的「手動新增帳單項目」）

