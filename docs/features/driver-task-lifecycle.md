# 功能：司機任務流程（Driver Task Lifecycle）

本文件描述「司機」如何從系統取得任務、接手交接任務，並透過任務動作更新包裹事件（`package_events`），讓客戶追蹤與內部作業都能反映真實進度。

## UI

- 司機任務頁：依前端實作為主（本功能文件聚焦後端行為與規則）。

## 相關規則（Modules）

- 作業/節點與任務派發：`docs/modules/operations.md`
- 追蹤事件與顯示：`docs/modules/tracking.md`
- 現金收款：`docs/features/driver-cash-collection.md`

## API（本功能涵蓋）

- 任務清單（V2）：`GET /api/driver/tasks`
- 交接接手：`POST /api/driver/tasks/:taskId/accept`
- 出發/在途中：`POST /api/driver/tasks/:taskId/enroute`
- 到達節點：`POST /api/driver/tasks/:taskId/arrive`
- 取件/裝載：`POST /api/driver/tasks/:taskId/pickup`
- 投遞/卸貨：`POST /api/driver/tasks/:taskId/dropoff`
- 任務結束：`POST /api/driver/tasks/:taskId/complete`

> 另有 legacy 事件寫入：`POST /api/driver/packages/:packageId/status`（僅寫入事件，不管理 `delivery_tasks` 與 `vehicle_cargo`）。

## 核心資料模型（實作導向）

- `delivery_tasks`：包裹的每一段運輸/配送任務（分段）
  - `task_type`：常見為 `pickup` / `deliver`（實際字串以資料庫資料為準）
  - `from_location` / `to_location`：節點 ID（例如 `REG_1` / `HUB_0` / `END_HOME_0`）
  - `status`：`pending | accepted | in_progress | completed | canceled`
- `vehicles` + `vehicle_cargo`：司機車輛與貨物裝卸狀態
- `package_events`：追蹤事件（客戶/內部共用）

## 典型流程（建議順序）

### 1) 取得任務清單

`GET /api/driver/tasks?scope=assigned`

- `scope=assigned`：我自己的任務（預設回傳進行中：`pending/accepted/in_progress`）
- `scope=handoff`：我所在節點（車輛 `current_node_id`）可交接的任務（限定 `HUB_*` / `REG_*`，且尚未指派給我）

回應（示意，欄位以實際回傳為準）：

```json
{
  "success": true,
  "scope": "assigned",
  "tasks": [
    {
      "id": "uuid",
      "package_id": "uuid",
      "task_type": "pickup",
      "from_location": "REG_1",
      "to_location": "HUB_0",
      "status": "pending",
      "tracking_number": "TRK-xxxx-xxxxxxxx",
      "payment_type": "prepaid | cod",
      "payment_amount": 120,
      "paid_at": null
    }
  ]
}
```

### 2)（可選）接手交接任務（handoff）

`POST /api/driver/tasks/:taskId/accept`

成功條件（後端強制）：

- 司機的車輛必須有 `current_node_id`
- `current_node_id` 必須等於該任務的 `from_location`
- 僅允許 `from_location` 是 `HUB_*` 或 `REG_*` 的交接
- 任務狀態需為 `pending/accepted`
- 包裹不能是 terminal、且不能有 active exception

### 3)（可選）標記「在途中」

`POST /api/driver/tasks/:taskId/enroute`

- 會插入一筆 `package_events.delivery_status = in_transit`
- `package_events.location` 會記錄車輛代碼（`vehicle_code`）
- 若任務狀態為 `in_progress`，後端會檢查包裹確實已在車上（`vehicle_cargo` 未卸貨）

### 4)（建議）標記到達節點（影響收款窗口）

`POST /api/driver/tasks/:taskId/arrive`

- `task_type=pickup`：在 `from_location` 插入（若不存在）`arrived_pickup`
- 其他段：在 `to_location` 插入（若不存在）`arrived_delivery`
- 用途：搭配 `collect-cash` 控制「到站後才能收現」的窗口（詳見 `docs/features/driver-cash-collection.md`）

### 5) 取件/裝載（pickup）

`POST /api/driver/tasks/:taskId/pickup`

成功條件（後端強制）：

- 任務狀態必須是 `pending/accepted`
- 車輛 `current_node_id` 必須等於 `from_location`
- 包裹不能是 terminal、且不能有 active exception
- 若包裹 `payment_type = prepaid`：必須已結清（`payments.paid_at` 有值）
  - 若是「預付但現金」流程：必須先用 `collect-cash` 設定 `paid_at`，再來 `pickup`

副作用：

- 新增 `vehicle_cargo`（表示貨物已在車上）
- 插入 `package_events.picked_up`
- 將 `delivery_tasks.status` 更新為 `in_progress`

### 6) 投遞/卸貨（dropoff）

`POST /api/driver/tasks/:taskId/dropoff`

成功條件（後端強制）：

- 任務狀態必須是 `in_progress`
- 車輛 `current_node_id` 必須等於 `to_location`
- 包裹必須存在於該車輛的 `vehicle_cargo`（未卸貨）
- 包裹不能是 terminal、且不能有 active exception
- 若本段會產生 `delivered`，且為「到府代收（COD at home）」：必須先完成收款（`paid_at` 有值），否則拒絕交付

副作用（依 `to_location` 類型）：

- `to_location` 是 `REG_*` / `HUB_*`：插入 `package_events.warehouse_in`
- `to_location` 是 `END_*`：插入 `package_events.delivered`
- 同時卸貨（更新 `vehicle_cargo.unloaded_at`）並將任務設為 `completed`

### 7)（可選）任務結束（complete）

`POST /api/driver/tasks/:taskId/complete`

- 將該 `delivery_tasks` 標記為 `completed`
- 若你已呼叫 `dropoff`，通常不需要再呼叫一次

## 常見錯誤與排查

- `409 Not at pickup/delivery node`：車輛 `current_node_id` 與任務節點不一致
- `409 Payment not settled yet`：預付（prepaid）未付款即取件
- `409 COD payment not settled yet`：到府 COD 未收款即嘗試投遞完成
- `409 Package has active exception`：需先走異常處理流程（`/api/driver/packages/:packageId/exception`）

