# 功能：審核合約申請（Review Contract Application）

本文件描述客服/管理員「審核合約申請」的端到端流程：查清單→核准/拒絕→系統副作用。

## 適用角色與前置條件

- 角色：`customer_service`、`admin`
- 前置：需登入取得 Token（Bearer）

## 規則（權威）

- `docs/modules/contracts.md`

## API

> 合約審核在後端分為兩組端點：客服用 `/api/cs/*`、管理員用 `/api/admin/*`。

- 客服清單：`GET /api/cs/contract-applications`
- 客服審核：`PUT /api/cs/contract-applications/:id`
- 管理員清單：`GET /api/admin/contract-applications`
- 管理員審核：`PUT /api/admin/contract-applications/:id`

參考：
- API 參考頁：`docs/reference/api/02-review.md`

## Side Effects（摘要）

- 核准後會把客戶轉為 `contract_customer`，並建立本期「未出帳」月結帳單（`due_date = NULL`）。

## 端到端流程（建議作業順序）

1. 查詢待審清單（通常先看 `pending`）
2. 打開單筆申請內容（公司資訊、統編、聯絡人、帳單地址、備註）
3. 決策：`approved` 或 `rejected`
4.（核准時可選）填 `credit_limit` 與 `review_notes`
5. 送出審核 → 系統執行副作用（核准才會改客戶身分並建本期未出帳帳單）

## 查清單（List）

### 客服（Customer Service）

`GET /api/cs/contract-applications?status=pending&limit=50`

Success（摘要）：

```json
{
  "success": true,
  "applications": [
    {
      "id": "uuid",
      "customer": { "id": "uuid", "name": "王小明", "email": "a@b.com" },
      "company_name": "某公司",
      "tax_id": "12345678",
      "contact_person": "王小明",
      "contact_phone": "0912-345-678",
      "billing_address": "END_HOME_0",
      "notes": "string",
      "status": "pending",
      "created_at": "2025-12-10T00:30:00Z"
    }
  ]
}
```

> `notes` 是客戶申請時填的備註（申請內容的一部分）；審核人員的備註請用 `review_notes`。

### 管理員（Admin）

`GET /api/admin/contract-applications?status=pending`

回傳結構與客服清單相同（欄位略有差異時以後端回傳為準）。

## 審核（Review）

### Request（核准）

```json
{
  "status": "approved",
  "credit_limit": 50000,
  "review_notes": "核准：月結額度 5 萬"
}
```

### Request（拒絕）

```json
{
  "status": "rejected",
  "review_notes": "資料不齊，請補齊公司資訊"
}
```

### Response（摘要）

```json
{
  "success": true,
  "message": "申請已核准",
  "application_id": "uuid",
  "status": "approved"
}
```

### 常見錯誤

- 400：申請已審核過（非 `pending`）
- 401：未認證 / token 無效
- 403：角色不符（例如非客服用 `/api/cs/*`、非 admin 用 `/api/admin/*`）
- 404：申請不存在

## 核准後副作用（具體）

當 `status=approved` 時，後端會做：

1. 更新 `contract_applications`：寫入 `reviewed_by` / `reviewed_at` / `credit_limit` / `review_notes`
2. 更新客戶 `users`：
   - `user_class = contract_customer`
   - `billing_preference = monthly`
3. 立即建立本期月結帳單（未出帳：`due_date = NULL`）

> 與客戶端月結功能連結：`docs/features/customer-monthly-billing.md`
