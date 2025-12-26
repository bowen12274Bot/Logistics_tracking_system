# Super User Management

> 來源：`docs/legacy/api-contract.legacy.md`（由 legacy 拆分）
>
> - 本頁定位：接口參考（endpoint / request/response schema / error codes）
> - 規則/流程（權威）：`docs/modules/users.md`
> - 若內容與現行實作衝突：以後端實作與 `docs/modules/` 為準

## 6. 超級使用者管理模組 (Super User Management)

### 6.1 建立員工帳號 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/admin/users` |
| **功能** | 管理員建立員工帳號 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Request Body)

```json
{
  "user_name": "string",
  "email": "string",
  "password": "string",
  "phone_number": "string",
  "address": "HUB_0 | REG_0 (optional)",
  "user_class": "customer_service | warehouse_staff | driver | admin"
}
```

> 備註：員工的 `address` 代表「工作地」（地圖節點 ID），例如配送中心 `HUB_0`、配送站 `REG_0`。

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 必填欄位缺失 |
| 401 | 未認證 |
| 403 | 非 admin 角色 |
| 409 | Email 已存在 |

---

### 6.2 處理系統異常 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/admin/system/errors` |
| **功能** | 管理員查詢系統異常／錯誤紀錄列表，用於偵錯與後續處理 |
| **認證** | 需要 Token |
| **權限** | `admin` |

#### 輸入欄位 (Query Parameters)

| 參數        | 類型    | 必填 | 說明                                  |
|-------------|---------|------|---------------------------------------|
| `level`     | string  | 否   | 錯誤等級：`info` / `warning` / `error` / `critical` |
| `date_from` | string  | 否   | 開始時間（ISO 8601）                 |
| `date_to`   | string  | 否   | 結束時間（ISO 8601）                 |
| `resolved`  | boolean | 否   | 是否已處理：`true` / `false`        |
| `limit`     | integer | 否   | 每頁筆數 1–100，預設 20              |
| `offset`    | integer | 否   | 位移量，用於分頁                      |

#### 輸出欄位 (Success Response - 200)

```json
{
  "success": true,
  "errors": [
    {
      "id": "uuid",
      "level": "error",
      "code": "INTERNAL_ERROR",
      "message": "string",
      "details": "string",
      "occurred_at": "2025-12-10T00:30:00Z",
      "resolved": false
    }
  ],
  "total": 10,
  "limit": 20,
  "offset": 0
}
```

