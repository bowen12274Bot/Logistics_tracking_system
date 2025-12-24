# Common（認證/錯誤/角色）

> 來源：`docs/reference/api-contract.legacy.md`（由 legacy 拆分）
>
> - 本頁定位：接口參考（endpoint / request/response schema / error codes）
> - 規則/流程：`docs/modules/users.md`
> - 若內容與現行實作衝突：以後端實作與 `docs/modules/` 為準

## 通用說明

### 認證機制

所有需要認證的 API 需在 Header 中帶入 Token：

```
Authorization: Bearer <token>
```

### 通用錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 請求格式錯誤、必填欄位缺失、參數驗證失敗 |
| 401 | 未認證（Token 缺失或無效） |
| 403 | 權限不足（已認證但無權執行此操作） |
| 404 | 資源不存在 |
| 405 | 參數超出合法範圍（如 limit 過大） |
| 409 | 資源衝突（如 Email 已存在） |
| 500 | 伺服器錯誤 |

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
