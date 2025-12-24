# Operations（任務/車輛/倉儲作業）

本文件描述「執行面」：司機如何透過任務與車輛移動完成取件/送達；倉儲如何做站內作業與派發下一段任務。

## Intent（理念）

- 任務與車輛位置是「員工端」的工作核心；顧客端則以事件推導進度。
- 倉儲的站點必須被強制綁定（以 `users.address` 作為權威），避免跨站誤操作。

## 核心資料

- `delivery_tasks`：任務段（from/to、assignee、status）
- `vehicles` / `vehicle_cargo`：司機車輛與載貨狀態
- `package_events`：站內作業與在途事件（作為事實來源）

## Core Rules（核心規則）

### 1) 車輛移動（driver）

#### 1.1 車輛與權限

- 司機只能讀寫「自己的車輛」：以 token 對應的 `users.id` 綁定 `vehicles.driver_user_id`
- 車輛位置權威：`vehicles.current_node_id`
- 初始車輛建立（若尚無 row）：`home_node_id = users.address`，且 `current_node_id = home_node_id`

#### 1.2 移動限制與競態處理

- 只能移動到相鄰節點（`edges` 存在）
- 建議採 optimistic concurrency：`fromNodeId === current_node_id`，避免連點/多端競態；不符合時回 `409 Conflict`

### 2) 任務段（delivery_tasks）

#### 2.1 分段與相鄰性

- 任務段跨越相鄰節點：`from_location` / `to_location` 應是 `edges` 直接相連
- 任務分段派發：包裹建立後先建立「第一段」；後續由倉儲在站內決定下一跳並派發

#### 2.2 接手（handoff / re-assign）

- 只允許 HUB/REG 起點的段落被其他司機接手（避免 END_* 被陌生司機攔截）
- `from_location` 是 `END_*` 時禁止接手
- 只允許接手「尚未開始」的任務段（例如 `pending` / `accepted`）；進入 `in_progress` / `completed` 後禁止接手

#### 2.3 任務狀態與操作邊界（建議）

- 司機只能操作「指派給自己」的任務段（`assigned_driver_id = my user_id`）
- 任務狀態建議遵循：`pending → accepted → in_progress → completed`（取消由異常或其他流程觸發）
- 完成（complete）時建議再次驗證任務仍屬於自己且狀態合法；不合法時回 `409 Conflict`

### 3) 倉儲站內作業（warehouse_staff）

#### 3.1 權限與站點綁定（不可偽造站點）

- 權限：倉儲端操作需 Bearer token，且 `users.user_class === 'warehouse_staff'`
- 本站權威：`users.address`（地圖節點 ID，例如 `REG_3` / `HUB_1`）
- 不採信前端提供的 `location_id` / `fromNodeId` 作為本站；所有事件寫入與任務派發的起點皆以 `users.address` 為準

#### 3.2 事件為中心（events → stage）

- 倉儲作業以 `package_events` 為事實來源：寫入 `package_events.delivery_status`
- `packages.status` 僅作為顧客可見 stage 快取（由 trigger 依事件推導/同步），倉儲端不直接更新
- 倉儲常用事件（示例）：`warehouse_in`、`warehouse_received`、`sorting`、`warehouse_out`、`route_decided`

#### 3.3 站內包裹判斷（本站有哪些包裹）

站內包裹建議以「每個 package 的最新事件」判斷（依 `events_at` 最大）：

- 若最新事件滿足：
  - `location = <users.address>` 且 `delivery_status` 屬於站內階段（例如 `warehouse_in` / `warehouse_received` / `sorting*`）
  → 視為「在站」
- 若最新事件為 `warehouse_out`（且 `location=<users.address>`）
  → 視為「已離站」，不再列入站內清單

> 規範決定：`warehouse_received` 為必須步驟；未點收不可進入分揀/派發流程。

#### 3.4 點收（receive）與分揀（sorting）

- 點收確認以 `package_id` 為主（可一次多筆）
- 點收成功後的事件寫入順序（同一次操作內）：
  1) `warehouse_received`（`location=<users.address>`）
  2) `sorting`（`location=<users.address>`）
- 冪等（idempotent）：若包裹最新事件已是本站的 `warehouse_received` / `sorting`（或本站內後續事件），視為已點收成功，不重複寫入事件

#### 3.5 派發下一段（dispatch next / next hop）

- `toNodeId` 必須與 `users.address` 直接相鄰（`edges` 存在）
- 包裹必須「目前在本站」（依站內判斷規則）
- 該包裹不得存在仍在進行中的 segment（`pending`/`accepted`/`in_progress`）
- 行為：
  - 建立 `delivery_tasks` 新 segment：`from_location=<users.address>`、`to_location=<toNodeId>`、`status='pending'`，並讓 `segment_index`（同 package）遞增
  - 建議建立事件：`route_decided`（`location=<users.address>`），並在 `delivery_details` 記錄 next hop（例如 `next=REG_3`）

## Links

- 異常會中止 tasks：`docs/modules/exceptions.md`
## 操作手冊（Legacy）

- 倉儲作業手冊：`docs/handbook/warehouse-staff.md`（舊入口：`docs/warehouse-staff.md`）
- 司機作業手冊：`docs/handbook/driver.md`（舊入口：`docs/vehicle-movement.md`）
