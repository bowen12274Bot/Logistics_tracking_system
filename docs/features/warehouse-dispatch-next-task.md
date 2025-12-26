# 功能：倉儲派發下一段任務（Dispatch Next Task）

本文件描述倉儲端在站內決策後，如何派發包裹的下一段任務（dispatch model）。

## 適用角色與前置條件

- 角色：`warehouse_staff`
- 前置：需登入取得 Token（Bearer）
- 本站節點：`fromNodeId` 來源固定為登入倉儲人員的 `users.address`

## 規則（權威）

- `docs/modules/operations.md`

## API（入口以後端路由為準）

- 派發下一段：`POST /api/warehouse/packages/:packageId/dispatch-next`

## 端到端流程（站內 → 下一跳）

1. 確認包裹已點收並進入站內處理（最新事件在本站，且 `delivery_status ∈ { warehouse_received, sorting }`）
2. 決定下一跳 `toNodeId`（必須與本站相鄰）
3. 呼叫派發端點建立下一段 `delivery_tasks`，並寫入 `route_decided` 事件
4. 司機端會在自己的任務清單看到該段任務並接手

## Request / Response（具體）

### Request

`POST /api/warehouse/packages/:packageId/dispatch-next`

```json
{ "toNodeId": "HUB_1" }
```

### Response（摘要）

```json
{
  "success": true,
  "task_id": "uuid",
  "assigned_driver_id": "uuid-or-null",
  "segment_index": 2
}
```

## 成功時的副作用（具體）

成功派發會做兩件事：

1. 建立一筆新的 `delivery_tasks`（下一段任務）
   - `task_type = 'deliver'`
   - `from_location = users.address`
   - `to_location = toNodeId`
   - `status = 'pending'`
   - `segment_index`：同一包裹的段號遞增
2. 寫入一筆 `package_events`
   - `delivery_status = 'route_decided'`
   - `delivery_details = 'next=<toNodeId>'`
   - `location = users.address`

## 主要限制（後端會擋）

- `toNodeId` 不可為空，且不可等於 `users.address`
- 相鄰性：`users.address` 與 `toNodeId` 必須是 `edges` 直接相連（否則 400 `Not adjacent`）
- 包裹必須存在，且不可為終態（`delivered` / `delivery_failed`）
- 包裹不可有 active exception
- 包裹必須「在本站」且已點收（若最新事件是 `warehouse_in` 會回 409，要求先點收）
- 包裹不可仍存在進行中的任務段（`pending/accepted/in_progress`）：
  - 若仍有 active task，回 409 `Package already has an active task`

## 司機指派規則（摘要）

- 後端會用本站節點向上回溯到對應的根 HUB（level=1）
- 若存在「`users.user_class='driver'` 且 `users.address=<HUB>`」的司機，會把該段任務指派給該司機（`assigned_driver_id`）
- 找不到則不指派（`assigned_driver_id = null`），等司機端/派工機制後續接手
