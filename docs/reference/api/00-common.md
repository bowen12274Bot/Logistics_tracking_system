# Common（認證/錯誤/角色）

> 來源：`docs/legacy/api-contract.legacy.md`（由 legacy 拆分）
>
> - 本頁定位：接口參考（endpoint / request/response schema / error codes）
> - 規則/流程（權威）：`docs/modules/users.md`
> - 若內容與現行實作衝突：以後端實作與 `docs/modules/` 為準

## 通用說明

### 認證機制

所有需要認證的 API 需在 Header 中帶入 Token：

```
Authorization: Bearer <token>
```

### 通用錯誤回應

本專案的錯誤回應目前以「簡單 JSON」為主，常見格式如下：

```json
{ "error": "string" }
```

有些端點會額外附帶可協助前端判斷/除錯的欄位：

```json
{
  "error": "string",
  "detail": "string (optional)",
  "status": "string (optional)",
  "current_node_id": "string (optional)",
  "from_location": "string (optional)"
}
```

> 注意：目前並沒有統一的 `code` 欄位或巢狀 `errors[]` schema；若後續需要前端做更一致的錯誤處理，可再升級成單一錯誤 schema。

| 狀態碼 | 說明 |
|--------|------|
| 400 | 請求格式錯誤、必填欄位缺失、參數驗證失敗 |
| 401 | 未認證（Token 缺失或無效） |
| 403 | 權限不足（已認證但無權執行此操作） |
| 404 | 資源不存在 |
| 405 | 參數超出合法範圍（如 limit 過大） |
| 409 | 資源衝突（如 Email 已存在） |
| 500 | 伺服器錯誤 |

#### 401 vs 403 vs 409（常見語意）

- `401 Unauthorized`：沒有有效 token（未登入、token 過期/無效、token 找不到使用者）
- `403 Forbidden`：已登入但角色/資源不符合（例如非 admin、或不是該資源的 owner）
- `409 Conflict`：狀態/門檻衝突（例如任務狀態不允許、包裹有 active exception、尚未到達付款門檻、車輛不在起點）

#### 常見錯誤案例（回應欄位提示）

- 任務不可操作：`{ "error": "Task not eligible", "status": "pending" }`（搭配 409）
- 不在任務起點：`{ "error": "Not at task start node", "from_location": "...", "current_node_id": "..." }`（搭配 409）
- 包裹異常封鎖：`{ "error": "Package has active exception" }`（搭配 409）

### 使用者角色

| 角色 | user_type | user_class | 說明 |
|------|-----------|------------|------|
| 客戶（非合約） | `customer` | `non_contract_customer` | 一般寄件/收件客戶 |
| 客戶（合約/月結） | `customer` | `contract_customer` | 月結客戶 |
| 客服人員 | `employee` | `customer_service` | 處理異常池、協助查詢/更正貨態、回應合約申請 |
| 倉儲人員 | `employee` | `warehouse_staff` | 入站/分揀/轉運作業、改路徑、異常申報 |
| 駕駛員 | `employee` | `driver` | 取件/配送、貨態更新、到付收款、異常申報 |
| 管理員 | `employee` | `admin` | 系統管理、帳號管理 |

### 角色類型 (user_class)

| 類型 | 說明 |
|------|------|
| `non_contract_customer` | 非合約客戶 |
| `contract_customer` | 合約客戶 |
| `customer_service` | 客服人員 |
| `warehouse_staff` | 倉儲人員 |
| `driver` | 駕駛員 |
| `admin` | 管理員 |

---
