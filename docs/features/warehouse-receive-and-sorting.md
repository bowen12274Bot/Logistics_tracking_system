# 功能：倉儲點收與站內作業（Receive / Sorting / Batch Operations）

本文件描述倉儲端的站內包裹清單、點收、批次入庫/出庫/分揀等端到端流程。

## 適用角色與前置條件

- 角色：`warehouse_staff`
- 前置：需登入取得 Token（Bearer）
- 站點綁定：倉儲人員的 `users.address` 必須是地圖節點 ID（例如 `REG_3` / `HUB_1`），作為本站的權威資料

## 規則（權威）

- `docs/modules/operations.md`
- `docs/modules/shipping.md`

## API（入口以後端路由為準）

- 站內清單：`GET /api/warehouse/packages`
- 點收：`POST /api/warehouse/packages/receive`
- 批次作業：`POST /api/warehouse/batch-operation`
-（相關）派發下一段：`POST /api/warehouse/packages/:packageId/dispatch-next`（另見 `docs/features/warehouse-dispatch-next-task.md`）

參考：
- `docs/reference/api/01-users.md`（warehouse 段）

## 端到端流程（建議作業順序）

1. 查「本站站內包裹」清單：`GET /api/warehouse/packages`
2. 對「剛到站但未點收」的包裹做點收：`POST /api/warehouse/packages/receive`
3.（選用）批次寫入站內事件（入庫/出庫/分揀）：`POST /api/warehouse/batch-operation`
4. 對已點收（在 sorting 區）的包裹派發下一段任務：`POST /api/warehouse/packages/:packageId/dispatch-next`

## 站內包裹清單（GET /api/warehouse/packages）

### 行為與限制（摘要）

- 本站節點 ID 來源：`users.address`（後端會強制綁定，不接受前端傳入本站）
- 回傳包裹條件（摘要）：包裹最新事件必須
  - `location == users.address`，且
  - `delivery_status ∈ { warehouse_in, warehouse_received, sorting, route_decided }`
- 回傳會帶 `neighbors`（本站相鄰節點）與「建議下一跳」：
  - `suggested_to_node_id`：在本站相鄰節點中挑一個，讓它到收件地址的最短路徑成本最低
  - `suggested_total_cost`：該成本（供 UI 提示）

### Response 範例（摘要）

```json
{
  "success": true,
  "warehouse_node_id": "REG_3",
  "neighbors": ["HUB_1", "REG_2", "REG_4"],
  "packages": [
    {
      "id": "uuid",
      "tracking_number": "TRK-xxxx-xxxxxxxx",
      "sender_address": "END_HOME_0",
      "receiver_address": "END_STORE_3",
      "delivery_time": "standard",
      "estimated_delivery": "2025-12-13T00:00:00Z",
      "payment_type": "prepaid",
      "route_path": null,
      "latest_event": { "delivery_status": "warehouse_in", "delivery_details": null, "events_at": "2025-12-10T10:30:00Z", "location": "REG_3" },
      "ui_state": "await_receive",
      "suggested_to_node_id": "HUB_1",
      "suggested_total_cost": 5147
    }
  ]
}
```

`ui_state`（倉儲 UI 可直接用）：

- `await_receive`：包裹已到站（warehouse_in），但尚未點收
- `sorting`：已點收並在站內處理中（warehouse_received / sorting）
- `dispatched`：已決定下一跳（route_decided），等待任務被司機端接手

## 點收（POST /api/warehouse/packages/receive）

### 前置條件（核心）

- 包裹必須「最新事件」是本站 `warehouse_in`，才能點收
- 若包裹已有 active exception 或已到達終態（delivered/delivery_failed），會拒絕點收
- 冪等：若包裹最新事件已是本站 `warehouse_received` / `sorting` / `route_decided`，視為已點收成功，不重複寫入

### Request 範例

```json
{ "package_ids": ["uuid1", "uuid2"] }
```

### Response 範例（摘要）

```json
{
  "success": true,
  "warehouse_node_id": "REG_3",
  "processed": 2,
  "failed": 0,
  "details": { "success": ["uuid1", "uuid2"], "failed": [] }
}
```

### 寫入事件（成功時）

對每個包裹依序寫入兩筆事件（同一站點）：

1. `warehouse_received`
2. `sorting`

> 兩筆事件會用兩個非常接近的時間戳（相差 1ms）確保排序穩定。

## 批次作業（POST /api/warehouse/batch-operation）

用途：倉儲端批次補寫站內事件（入庫/出庫/分揀）。這是「事件寫入 API」，不會自動派發任務段。

### Request 範例

```json
{
  "operation": "warehouse_in",
  "package_ids": ["uuid-or-tracking", "uuid-or-tracking"],
  "location_id": "REG_3",
  "note": "入庫掃描"
}
```

### 行為摘要

- `package_ids` 可傳包裹 `id` 或 `tracking_number`（後端會解析）
- 若包裹有 active exception 或已到終態，會拒絕處理該筆
- 成功會對每筆包裹寫入一筆 `package_events`（`delivery_status=operation`、`location=location_id`、`delivery_details=note`）
