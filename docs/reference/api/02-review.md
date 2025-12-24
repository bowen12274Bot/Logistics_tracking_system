# Review

> 來源：`docs/reference/api-contract.legacy.md`（由 legacy 拆分）
>
> - 本頁定位：接口參考（endpoint / request/response schema / error codes）
> - 規則/流程：`docs/modules/contracts.md`
> - 若內容與現行實作衝突：以後端實作與 `docs/modules/` 為準

## 2. 審核合約模組 (Review)

### 2.1 審核合約申請 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `PUT /api/admin/contract-applications/:id` |
| **功能** | 審核客戶的合約申請 |
| **認證** | ✅ 需要 Token |
| **權限** | `customer_service`、`admin` |

#### 輸入格式 (Request Body)

```json
{
  "status": "approved | rejected",
  "notes": "string",
  "credit_limit": 50000
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 無效的 status 值 |
| 401 | 未認證 |
| 403 | 非 customer_service 或 admin |
| 404 | 申請不存在 |

---

