# 功能：司機現金收款（Driver Cash Collection）

本文件描述司機在現場收現（預付現金 / 到府代收）時，後端如何限制收款窗口、寫入付款結果（`payments.paid_at`），並同步產生可追蹤事件（`package_events`）。

## 相關規則（Modules / Features）

- 付款規則：`docs/modules/payments.md`
- 司機任務流程（到站事件）：`docs/features/driver-task-lifecycle.md`

## API

- 收現：`POST /api/driver/packages/:packageId/collect-cash`
- 到站（前置條件之一）：`POST /api/driver/tasks/:taskId/arrive`

## 什麼時候可以收現（實作規則）

後端會先檢查：

- 司機必須有車輛，且車輛必須有 `current_node_id`
- 該包裹必須存在一個「指派給此司機」且仍在進行中的任務段（`delivery_tasks.status in pending/accepted/in_progress`）
- 該包裹不可已付款（`paid_at` 不可已存在）

接著依 `packages.payment_type` 分流：

### A) 預付（`payment_type = prepaid`）的現金收款

限制條件：

- 必須在「取件任務」上收現：`delivery_tasks.task_type = pickup`
- 司機所在節點必須是任務起點：`current_node_id = from_location`
- 若寄件點是到府（`sender_address` 為 `END_HOME_*`）：必須先寫入 `arrived_pickup`
  - 建議流程：`arrive` → `collect-cash` → `pickup`

成功後副作用：

- 更新 `payments.paid_at = now`、`payments.payment_method = cash`、`payments.collected_by = driver_id`
- 插入 `package_events.delivery_status = payment_collected_prepaid`

### B) 到府代收（`payment_type = cod`）的現金收款

限制條件：

- 僅允許「到府代收」：若收件點是門市（`receiver_address` 為 `END_STORE_*`），後端會拒絕收現
  - 原因：門市代收由收件方在門市端完成付款；司機只負責投遞/卸貨
- 必須在「配送任務」上收現：`delivery_tasks.task_type = deliver`
- 司機所在節點必須是任務目的地：`current_node_id = to_location`
- 必須先寫入 `arrived_delivery`
  - 建議流程：`arrive` → `collect-cash` → `dropoff`（完成交付）

成功後副作用：

- 更新 `payments.paid_at = now`、`payments.payment_method = cash`、`payments.collected_by = driver_id`
- 插入 `package_events.delivery_status = payment_collected_cod`

## Request / Response（示例）

### Request

`POST /api/driver/packages/:packageId/collect-cash`

（無 request body）

### Response（200）

```json
{
  "success": true,
  "paid_at": "2025-12-25T10:30:00.000Z",
  "payment_method": "cash"
}
```

## 常見錯誤（409）

- `Vehicle has no current node`：車輛未設定目前節點
- `No active task for this package`：此包裹沒有指派給此司機的進行中任務段
- `Already paid`：付款已完成，不可重複收現
- `Cash prepaid at home requires arrived_pickup first`：到府取件的預付現金，需先 `arrive`
- `COD at home requires arrived_delivery first`：到府代收需先 `arrive`
- `Store COD is paid by receiver after dropoff`：門市代收不可由司機收現

