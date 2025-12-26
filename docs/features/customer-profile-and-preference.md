# 功能：個人資料與付款偏好（Customer Profile & Billing Preference）

本文件描述客戶端「個人資料」與 `billing_preference` 的端到端行為：更新欄位、合約限制、以及如何影響建單預設付款方式。

## 入口與 UI

- UI：`/customer/profile`

## 規則（權威）

- `docs/modules/users.md`
- `docs/modules/payments.md`
- 合約限制：`docs/modules/contracts.md`

## API

- 取得自己：`GET /api/auth/me`（`docs/reference/api/01-users.md`）
- 更新自己：`PUT /api/customers/me`（`docs/reference/api/01-users.md`）

## 限制

- 非合約客戶不可設定 `billing_preference = monthly`。

## `billing_preference` 與建單預設付款方式

- 建立包裹時，後端會用使用者的 `billing_preference` 作為「預設付款方式」的來源（若建單 payload 未指定 `payment_method`）。
  - `billing_preference=monthly` → 預設 `payment_method=monthly_billing`
- 但不論預設為何，客戶仍需在 `/customer/payment` 再次「確認付款」才會寫入 `paid_at`。

## 取得自己（GET /api/auth/me）

成功回傳（摘要）：

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "user_name": "王小明",
    "phone_number": "0912-345-678",
    "address": "END_HOME_0",
    "email": "user@example.com",
    "user_type": "customer",
    "user_class": "contract_customer",
    "billing_preference": "monthly"
  }
}
```

## 更新自己（PUT /api/customers/me）

### Request（可更新欄位）

```json
{
  "user_name": "王小明",
  "phone_number": "0912-345-678",
  "address": "END_HOME_0",
  "billing_preference": "credit_card"
}
```

> 後端以 Token 決定要更新的使用者，不需要也不會使用 `user_id`；前端若有帶 `user_id`，後端會忽略。

### Response（現行實作）

```json
{ "success": true, "message": "更新成功" }
```

> 若前端需要更新後的完整 `user` 物件，建議更新成功後再呼叫一次 `GET /api/auth/me` 取得最新資料。

### 常見錯誤

- 401：Token 缺失/無效
- 403：非合約客戶嘗試設定 `billing_preference=monthly`

