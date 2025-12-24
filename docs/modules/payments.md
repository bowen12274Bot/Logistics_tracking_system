# Payments & Billing（金流與帳單）

本文件整理付款方式與月結帳單相關的規則層；API 介面請見 `docs/reference/api/05-payments.md`（或從 `docs/api-contract.md` 索引進入）與 `docs/reference/database-schema.md` 的 billing 表格說明。

## Intent（理念）

- 非合約客戶走即時付款/到付；合約客戶可走月結帳單。
- 帳單的產生/結算應可追溯到包裹與計費期間。

## Data（資料落點）

- `payments`：付款紀錄（paid_at/amount/method…）
- `monthly_billing` / `monthly_billing_items`：月結帳單主檔與明細

## Links

- API：`docs/reference/api/05-payments.md`
- 表結構：`docs/reference/database-schema.md`（monthly_billing；舊入口：`docs/database-schema.md`）
