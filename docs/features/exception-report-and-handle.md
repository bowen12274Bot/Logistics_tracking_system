# 功能：異常申報與處理（Report / Handle / Resolve）

本功能描述異常從「申報」到「客服處理（恢復配送或取消委託）」的完整閉環，並說明異常如何影響司機任務、倉儲作業與客戶追蹤。

## 相關文件

- 規則權威：`docs/modules/exceptions.md`
- 追蹤顯示：`docs/modules/tracking.md`
- 司機任務：`docs/features/driver-task-lifecycle.md`
- 客服異常池（UI/操作）：`docs/features/cs-exception-pool-and-handle.md`
- API 參考：`docs/reference/api/07-exceptions.md`

## 參與角色與責任

- 司機（driver）：在取件/配送現場或運送途中申報異常
- 倉儲（warehouse_staff）：在站內作業（點收/分揀/路由）階段申報異常
- 客服（customer_service）：查看異常池並做結案決策（恢復配送 / 取消委託）

## 異常一旦成立會發生什麼事（系統副作用）

當司機或倉儲申報異常時，後端會強制做到「資料一致」：

1. 新增 `package_exceptions` 一筆（異常池資料，`handled=0`）
2. 新增 `package_events` 一筆：`delivery_status = exception`
3. 取消此包裹所有 active 任務段：`delivery_tasks.status IN ('pending','accepted','in_progress')` → `canceled`
4. 後續任何司機任務動作（`accept/enroute/arrive/pickup/dropoff/complete`）與金流收款（`collect-cash`）都會被「active exception」阻擋（回 `409`）

> 另有員工手動寫入事件端點 `POST /api/packages/:packageId/events`，但後端禁止手動寫入 `exception/exception_resolved/delivery_failed`，避免事件與異常池不一致。

## 異常位置 location 的語意（影響追蹤圖）

- `location = END_*/REG_*/HUB_*`：點異常（發生在某個節點）
- `location = TRUCK_*`：線異常（發生在運送途中/貨車上）

後端會針對不同角色與情境，限制 `location` 來源（避免任意亂填，詳見 `docs/modules/exceptions.md`）。

## 流程 A：司機申報異常

API：`POST /api/driver/packages/:packageId/exception`

Request body（摘要）：

```json
{
  "reason_code": "lost | damaged | unpaid | no_answer | refused | address_issue | other",
  "description": "string",
  "location": "TRUCK_0 | END_HOME_0 | REG_1 | HUB_0"
}
```

後端重點規則（實作導向）：

- 包裹不能是 terminal（如 `delivered` / `delivery_failed`），且不能已有 active exception
- `location` 不是自由輸入：後端會用「貨物是否仍在車上」「司機車輛目前節點」「與該包裹的 active 任務節點關聯」來決定允許值
  - 若包裹仍在車上（`vehicle_cargo.unloaded_at IS NULL`）：通常會鎖定為該車 `vehicle_code`（`TRUCK_*`）
  - 若允許用節點模式（例如已到站但未卸貨、或到府 `no_answer`）：`location` 必須等於司機車輛 `current_node_id`，且需與該包裹目前任務節點有關聯

成功後回應（示例）：

```json
{ "success": true, "exception_id": "uuid" }
```

## 流程 B：倉儲申報異常

API：`POST /api/warehouse/packages/:packageId/exception`

Request body（摘要）：

```json
{
  "reason_code": "lost | damaged | label_issue | misroute | other",
  "description": "string"
}
```

後端重點規則（實作導向）：

- 包裹不能是 terminal，且不能已有 active exception
- 包裹不可仍在車上（`vehicle_cargo.unloaded_at IS NULL`）→ 否則 `409`
- 包裹必須在「本站」且處於站內階段（最新事件 `location = users.address` 且狀態屬於 `warehouse_in/warehouse_received/sorting/route_decided`）→ 否則 `409`
- `location` 由後端強制使用倉儲人員的站點（`users.address`）

成功後回應（示例）：

```json
{ "success": true, "exception_id": "uuid", "event_id": "uuid" }
```

## 流程 C：客服查看異常池

API：`GET /api/cs/exceptions?handled=0`

回傳包含（實作導向，節選）：

- `package_exceptions.*`（含 `reason_code/description/reported_role/reported_at/handled...`）
- `packages.tracking_number/status/sender_address/receiver_address`
- 若包裹仍在車上：`active_vehicle_code` / `active_vehicle_node_id`
- 最近一次被取消的任務段資訊（幫助客服判斷該從哪段恢復）：`last_canceled_task_type/from/to`

## 流程 D：客服結案（恢復配送 / 取消委託）

API：`POST /api/cs/exceptions/:exceptionId/handle`

Request body（摘要）：

```json
{
  "action": "resume | cancel",
  "handling_report": "string",
  "resume_mode": "continue_segment | reroute_next_hop | redirect_destination",
  "next_hop_override": "REG_1 | HUB_0",
  "destination_override": "END_HOME_0 | END_STORE_0",
  "location": "HUB_0 | REG_1 | TRUCK_0 | END_HOME_0"
}
```

### D1) `action = resume`（恢復配送）

共同限制：

- 該異常必須尚未處理（`handled=0`），且包裹不可為 terminal
- 包裹不可同時已經有 active 任務段（避免「恢復」造成重複派工）

後端會：

1. 將 `package_exceptions.handled=1`，寫入 `handled_by/handled_at/handling_report/...`
2. 插入 `package_events.exception_resolved`
3. 視情況建立新的 `delivery_tasks`（用 `handling_report` 作為 `instructions`）
4. 特殊情況：若異常由倉儲申報，且異常發生前仍在站內流程，後端可能會「補一筆站內事件」把狀態還原回站內流程（並可能跳過建立司機任務）

#### `resume_mode` 行為差異

- `continue_segment`（預設）：盡量沿用「最後一次被取消的任務段」作為恢復目標；若包裹仍在車上，會偏向讓原司機繼續同一段（避免跳下一跳）
- `reroute_next_hop`：指定下一跳 `next_hop_override`，後端會檢查它必須與「恢復起點」相鄰（`edges` 必須存在）
- `redirect_destination`：改收件目的地
  - `destination_override` 有值：必須是存在於 `nodes` 的節點；後端會更新 `packages.receiver_address`
  - `destination_override` 不填：視為退回寄件點（return-to-origin），要求包裹必須有 `sender_address`

#### 「恢復起點」如何決定（實作導向）

後端會依序嘗試決定 `startNodeId`：

1. 若包裹仍在車上：使用該車 `vehicles.current_node_id`
2. 否則使用最新一筆 `exception` 事件的 `location`
   - 若 `location` 是 `TRUCK_*`：會再去查該車的 `current_node_id` 作為起點
3. 若以上都取不到，才使用客服 request body 的 `location` 作為 fallback

### D2) `action = cancel`（取消委託 / 銷毀）

後端會：

1. 將 `package_exceptions.handled=1`，並記錄 `resolution_action = destroy`
2. 取消該包裹所有 active 任務段（若尚存在）
3. 插入 `package_events.exception_resolved`
4. 再插入 `package_events.delivery_failed`，並將 `packages.status` 設為 `delivery_failed`（terminal）

Response（示例）：

```json
{
  "success": true,
  "event_id": "uuid",
  "delivery_failed_event_id": "uuid|null",
  "action": "resume|cancel"
}
```
