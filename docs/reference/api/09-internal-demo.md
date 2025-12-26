# Internal / Demo APIs（非領域功能）

本頁收錄專案中「已實作但非物流領域核心功能」的 API（多為 scaffold/demo 或開發用），避免文件與實作不一致。

> 若要看物流核心 API，請以 `docs/reference/api/README.md` 的 01~07 分頁為主。

## 9.1 Health / Hello `[已實作]`

| 項目 | 說明 |
|---|---|
| **位置** | `GET /api/hello` |
| **功能** | 簡單健康檢查/測試回應 |
| **認證** | 不需要 |

Success (200):

```json
{ "message": "Hello from Worker!" }
```

---

## 9.2 Tasks（Scaffold / Demo）`[已實作]`

> 注意：此組 API 目前為範例用，回應為固定或 mock；不代表物流任務（物流任務請見 driver V2：`/api/driver/tasks*`）。

### 9.2.1 列表

| 項目 | 說明 |
|---|---|
| **位置** | `GET /api/tasks` |
| **功能** | 範例任務清單 |
| **認證** | 不需要 |

Query:

| 參數 | 類型 | 必填 | 說明 |
|---|---:|:---:|---|
| `page` | number | ❌ | 預設 0 |
| `isCompleted` | boolean | ❌ | 篩選完成狀態 |

Success (200)（示意）：

```json
{
  "success": true,
  "tasks": [
    { "name": "Clean my room", "slug": "clean-room", "description": null, "completed": false, "due_date": "2025-01-05" }
  ]
}
```

### 9.2.2 建立

| 項目 | 說明 |
|---|---|
| **位置** | `POST /api/tasks` |
| **功能** | 建立範例任務（回傳 request body 的 echo） |
| **認證** | 不需要 |

### 9.2.3 單筆查詢

| 項目 | 說明 |
|---|---|
| **位置** | `GET /api/tasks/:taskSlug` |
| **功能** | 依 slug 取得範例任務 |
| **認證** | 不需要 |

### 9.2.4 刪除

| 項目 | 說明 |
|---|---|
| **位置** | `DELETE /api/tasks/:taskSlug` |
| **功能** | 刪除範例任務（回傳示意資料） |
| **認證** | 不需要 |

---

## 9.3 Shipments（Demo table）`[已實作]`

> 注意：此組 API 目前直接寫入 `shipments` 範例表，未與物流核心 `packages` 串接。

### 9.3.1 建立 Shipment

| 項目 | 說明 |
|---|---|
| **位置** | `POST /api/shipments` |
| **功能** | 建立範例 shipment |
| **認證** | 不需要 |

Request body（示意）：

```json
{
  "id": "uuid (optional)",
  "sender": "string",
  "receiver": "string"
}
```

Success (200):

```json
{ "id": "uuid", "message": "Shipment created" }
```

### 9.3.2 查詢 Shipment

| 項目 | 說明 |
|---|---|
| **位置** | `GET /api/shipments/:id` |
| **功能** | 取得 shipment |
| **認證** | 不需要 |

Errors:

| 狀態碼 | 說明 |
|---:|---|
| 404 | Not found |

