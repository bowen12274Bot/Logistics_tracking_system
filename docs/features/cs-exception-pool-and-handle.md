# 功能：客服異常池（CS Exception Pool & Handle）

本文件聚焦「客服（customer_service）」在後台處理異常的操作界面與決策欄位；若你要看異常從申報到結案的完整閉環，請看 `docs/features/exception-report-and-handle.md`。

## 相關文件

- 規則權威：`docs/modules/exceptions.md`
- 端到端閉環：`docs/features/exception-report-and-handle.md`
- API 參考：`docs/reference/api/07-exceptions.md`

## UI（建議區塊）

### 1) 異常池列表

目標：讓客服快速判斷「發生在哪」「目前卡住什麼」「需要採取哪種結案策略」。

建議欄位：

- `tracking_number`
- `reported_role`（driver / warehouse_staff / customer_service）
- `reason_code` + `description`
- `reported_at`
- `active_vehicle_code` / `active_vehicle_node_id`（若仍在車上）
- `last_canceled_task_type/from/to`（幫助判斷 resume 走向）
- `sender_address` / `receiver_address`

資料來源 API：

- `GET /api/cs/exceptions?handled=0&limit=50`
- 已處理查詢：`GET /api/cs/exceptions?handled=1`

## 結案操作（Handle modal）

資料來源 API：

- `POST /api/cs/exceptions/:exceptionId/handle`

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

### A) Resume（恢復配送）

UI 建議：

- `handling_report`：必填（用來紀錄客服判斷，並會被寫入 `delivery_tasks.instructions`）
- `resume_mode`：
  - `continue_segment`（預設）：讓系統盡量沿用上一次被取消的段落/目的地
  - `reroute_next_hop`：顯示 `next_hop_override` 欄位，並提示「必須與恢復起點相鄰」
  - `redirect_destination`：顯示 `destination_override` 欄位；若不填視為退回寄件點（return-to-origin）
- `location`：可選；後端會用它來決定 `exception_resolved.location`（影響追蹤圖 stage mapping），未填會以最近 `exception` 事件 location 為主

成功後（概念）：

- `package_exceptions.handled=1`
- 新增 `package_events.exception_resolved`
- 視情況建立新的 `delivery_tasks`（或在倉儲異常且仍站內流程時，先還原站內事件）

### B) Cancel（取消委託 / 銷毀）

UI 建議：

- `handling_report`：必填
- `location`：可選（同上）

成功後（概念）：

- `package_exceptions.handled=1`
- 新增 `package_events.exception_resolved`
- 新增 `package_events.delivery_failed`，並將包裹狀態進入 terminal

## 常見錯誤（客服端）

- `409 Already handled`：該 exception 已結案，不可重複操作
- `409 Package is terminal`：包裹已 `delivered` 或 `delivery_failed`
- `409 Package already has an active task`：代表有人已恢復派工或流程尚未清乾淨
- `400 next_hop_override is required` / `next_hop_override must be adjacent`：reroute 模式欄位/相鄰性驗證失敗
- `409 Cannot resolve resume start location`：後端無法決定 resume 起點（通常是缺少事件 location 或車輛節點資訊）
