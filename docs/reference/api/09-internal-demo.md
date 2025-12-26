# Internal / Demo APIs（非領域功能）

本頁收錄專案中「已實作但非物流領域核心功能」的 API（多為 scaffold/demo 或開發用），避免文件與實作不一致。

> - 本頁定位：接口參考（非物流 domain；多為 demo/scaffold / 開發用）
> - 物流核心 API：請以 `docs/reference/api/README.md` 的 00~08 分頁為主
> - 規則/流程（權威）：`docs/modules/README.md`（本頁不承載物流規則）
> - 若內容與現行實作衝突：以後端實作為準

## 定位與使用範圍

- 這些端點**不屬於物流 domain**（不影響 `packages` / `delivery_tasks` / `package_events`）。
- 多數端點**不需要認證**，適合做本機開發、CI smoke test、或示範用途；正式流程/前端功能**不應依賴**。
- 若未來需要收斂對外接口，這些端點可視為**可移除**或改成 internal-only。

## 9.1 Health / Hello `[已實作]`

| 項目 | 說明 |
|---|---|
| **位置** | `GET /api/hello` |
| **功能** | 簡單健康檢查/測試回應 |
| **認證** | 不需要 |

實作位置：`backend/src/index.ts`

使用位置：`backend/src/index.test.ts`

Success (200):

```json
{ "message": "Hello from Worker!" }
```

---

## 9.2 Tasks（Scaffold / Demo）`[已實作]`

> 注意：此組 API 目前為範例用，回應為固定或 mock；不代表物流任務（物流任務請見 driver V2：`/api/driver/tasks*`）。

實作位置：`backend/src/endpoints/taskList.ts`、`backend/src/endpoints/taskCreate.ts`、`backend/src/endpoints/taskFetch.ts`、`backend/src/endpoints/taskDelete.ts`

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

實作位置：`backend/src/index.ts`

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
