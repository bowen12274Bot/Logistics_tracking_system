# Review

> 來源：`docs/legacy/api-contract.legacy.md`（由 legacy 拆分）
>
> - 本頁定位：接口參考（endpoint / request/response schema / error codes）
> - 規則/流程：`docs/modules/contracts.md`
> - 若內容與現行實作衝突：以後端實作與 `docs/modules/` 為準

## 2. 審核合約模組 (Review)

### 2.1 查詢合約申請清單 `[已實作]`

> 合約審核在後端分為兩組端點：客服（`/api/cs/*`）與管理員（`/api/admin/*`）。

#### 2.1.1 客服：合約申請清單

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/cs/contract-applications` |
| **功能** | 客服查詢合約申請清單 |
| **認證** | ✅ 需要 Token |
| **權限** | `customer_service` |

Query（可選）：

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `status` | string | ❌ | `pending` / `approved` / `rejected` |
| `limit` | number | ❌ | 1–200（預設 50） |

---

#### 2.1.2 管理員：合約申請清單

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/admin/contract-applications` |
| **功能** | 管理員查詢合約申請清單 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

Query（可選）：

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `status` | string | ❌ | `pending` / `approved` / `rejected` |

---

### 2.2 審核合約申請 `[已實作]`

> 客服與管理員各自有對應的審核端點：
>
> - `customer_service`：`PUT /api/cs/contract-applications/:id`
> - `admin`：`PUT /api/admin/contract-applications/:id`

#### 2.2.1 客服審核

| 項目 | 說明 |
|------|------|
| **位置** | `PUT /api/cs/contract-applications/:id` |
| **功能** | 客服審核客戶的合約申請 |
| **認證** | ✅ 需要 Token |
| **權限** | `customer_service` |

#### 2.2.2 管理員審核

| 項目 | 說明 |
|------|------|
| **位置** | `PUT /api/admin/contract-applications/:id` |
| **功能** | 管理員審核客戶的合約申請 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

| 項目 | 說明 |
|------|------|
| **功能** | 審核客戶的合約申請 |
| **認證** | ✅ 需要 Token |
| **權限** | 見上方端點分流 |

#### 輸入格式 (Request Body)

```json
{
  "status": "approved | rejected",
  "review_notes": "string (optional)",
  "credit_limit": 50000
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 無效的 status 值 |
| 401 | 未認證 |
| 403 | 權限不足 |
| 404 | 申請不存在 |

---

