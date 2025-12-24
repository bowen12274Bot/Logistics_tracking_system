# Contracts（合約審核）

本文件整理「合約申請/審核」的規則層說明；API 介面請見 `docs/reference/api/02-review.md`（審核）與 `docs/reference/api/01-users.md`（合約申請），或從 `docs/api-contract.md` 索引進入。

## Intent（理念）

- 合約客戶（`contract_customer`）可使用月結/帳單能力（`billing_preference`/`payment_type` 的限制依 API 為準）。
- 審核流程可由客服/管理端執行，但權限邊界需清楚（誰能核准/拒絕）。

## Core Flow（核心流程）

1. 客戶（非合約）提出合約申請
2. 客服/管理端審核（核准/拒絕）
3. 審核結果影響客戶的 `user_class` 與可用的付款/帳務能力

## Links

- API：`docs/reference/api/02-review.md`、`docs/reference/api/01-users.md`
- 客服作業手冊：`docs/handbook/customer-service.md`
