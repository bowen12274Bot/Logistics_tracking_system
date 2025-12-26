# 系統序列圖（Sequence Diagrams）

本文件以「前端 UI 觸發點」為主線，展示關鍵流程的互動時序；API 僅作為對照。

參考：

- UI 規範：`docs/design/ui-spec.md`
- 端到端功能：`docs/features/`
- API 參考：`docs/reference/api/`

---

## 1) Customer：寄件 + 預付付款（Prepaid）

UI 觸發點：

- `/customer/send`：先估價、再建立訂單
- `/customer/payment`：更新付款方式、再確認付款

```mermaid
sequenceDiagram
  actor Customer as 客戶
  participant UI as 前端（Customer）
  participant API as 後端 API
  participant DB as DB

  Note over Customer,DB: 估價（送出估價表單）
  Customer->>UI: 填寫寄/收件、重量、尺寸、服務
  UI->>API: POST /api/packages/estimate
  API->>DB: Read nodes/edges + pricing rules
  DB-->>API: OK
  API-->>UI: { estimate, eta }
  UI-->>Customer: 顯示預估費用/時效

  Note over Customer,DB: 建立訂單（確認送出）
  Customer->>UI: 確認並建立包裹
  UI->>API: POST /api/packages
  API->>DB: INSERT packages + payments (預建費用)
  DB-->>API: OK
  API-->>UI: { package_id, tracking_number }

  Note over Customer,DB: 預付付款（付款頁）
  Customer->>UI: 選擇付款方式
  UI->>API: POST /api/payments/packages/:packageId/method
  API->>DB: UPDATE payments.payment_method
  UI->>API: POST /api/payments/packages/:packageId
  API->>DB: UPDATE payments.paid_at
  DB-->>API: OK
  API-->>UI: paid ok
  UI-->>Customer: 顯示完成/追蹤碼
```

---

## 2) Driver：任務清單 →（可選交接）→ 在途/到站 → 取件/投遞

UI 觸發點：

- 任務清單頁：`我的任務（assigned）`、`交接任務（handoff）`
- 任務詳情頁：`在途中`、`已到達`、`取件/裝載`、`投遞/卸貨`

```mermaid
sequenceDiagram
  actor Driver as 司機
  participant UI as 前端（Driver）
  participant API as 後端 API
  participant DB as DB

  Note over Driver,DB: 任務清單（進入頁面/下拉刷新）
  Driver->>UI: 開啟任務清單
  UI->>API: GET /api/driver/tasks?scope=assigned
  API->>DB: SELECT delivery_tasks (assigned)
  DB-->>API: tasks
  API-->>UI: tasks

  opt 交接任務（handoff tab）
    UI->>API: GET /api/driver/tasks?scope=handoff
    API->>DB: SELECT delivery_tasks (handoff at current node)
    DB-->>API: tasks
    API-->>UI: { node_id, tasks }
    Driver->>UI: 點「接手」
    UI->>API: POST /api/driver/tasks/:taskId/accept
    API->>DB: UPDATE delivery_tasks.assigned_driver_id/status
    DB-->>API: OK
    API-->>UI: success
  end

  Note over Driver,DB: 出發/在途（任務詳情）
  Driver->>UI: 點「在途中」
  UI->>API: POST /api/driver/tasks/:taskId/enroute
  API->>DB: INSERT package_events (in_transit, location=vehicle_code)
  DB-->>API: OK
  API-->>UI: success

  Note over Driver,DB: 到站（影響收款窗口）
  Driver->>UI: 點「已到達」
  UI->>API: POST /api/driver/tasks/:taskId/arrive
  API->>DB: INSERT package_events (arrived_pickup/arrived_delivery, idempotent)
  DB-->>API: OK
  API-->>UI: success

  Note over Driver,DB: 取件/投遞（依 task_type 顯示）
  alt pickup（取件/裝載）
    Driver->>UI: 點「取件/裝載」
    UI->>API: POST /api/driver/tasks/:taskId/pickup
    API->>DB: INSERT vehicle_cargo + package_events(picked_up)
    API->>DB: UPDATE delivery_tasks (in_progress)
    DB-->>API: OK
    API-->>UI: success
  else deliver（投遞/卸貨）
    Driver->>UI: 點「投遞/卸貨」
    UI->>API: POST /api/driver/tasks/:taskId/dropoff
    API->>DB: UPDATE vehicle_cargo(unloaded)
    API->>DB: INSERT package_events (delivered/warehouse_in)
    API->>DB: UPDATE delivery_tasks (completed)
    DB-->>API: OK
    API-->>UI: success
  end
```

---

## 3) Driver：到站收現（預付現金 / 到府代收）

UI 觸發點：

- 到站面板：到站後才顯示收現入口（並提示門檻）

```mermaid
sequenceDiagram
  actor Driver as 司機
  participant UI as 前端（Driver）
  participant API as 後端 API
  participant DB as DB

  Note over Driver,DB: 先到站（arrived_*）
  Driver->>UI: 點「已到達」
  UI->>API: POST /api/driver/tasks/:taskId/arrive
  API->>DB: INSERT package_events (arrived_*)
  DB-->>API: OK
  API-->>UI: success

  Note over Driver,DB: 收現
  Driver->>UI: 點「收現」
  UI->>API: POST /api/driver/packages/:packageId/collect-cash
  API->>DB: UPDATE payments (paid_at, method=cash, collected_by)
  API->>DB: INSERT package_events (payment_collected_*)
  DB-->>API: OK
  API-->>UI: { paid_at }
```

---

## 4) Warehouse：點收/分揀 → 派發下一段

UI 觸發點：

- 站內包裹頁：掃碼點收（可多筆）→ 派發下一段（單筆）

```mermaid
sequenceDiagram
  actor Staff as 倉儲人員
  participant UI as 前端（Warehouse）
  participant API as 後端 API
  participant DB as DB

  Note over Staff,DB: 查看本站包裹
  Staff->>UI: 開啟站內包裹頁
  UI->>API: GET /api/warehouse/packages
  API->>DB: SELECT packages by staff node
  DB-->>API: list
  API-->>UI: list

  Note over Staff,DB: 點收（多筆）
  Staff->>UI: 掃碼 N 筆 → 點「點收」
  UI->>API: POST /api/warehouse/packages/receive
  API->>DB: INSERT package_events (warehouse_received + sorting, idempotent)
  DB-->>API: OK
  API-->>UI: success

  Note over Staff,DB: 派發下一段（單筆）
  Staff->>UI: 選包裹 → 選 toNodeId → 派發
  UI->>API: POST /api/warehouse/packages/:packageId/dispatch-next
  API->>DB: INSERT delivery_tasks (pending) + package_events(route_decided)
  DB-->>API: OK
  API-->>UI: success
```

---

## 5) CS：異常池 → 結案（Resume / Cancel）

UI 觸發點：

- 異常池列表：未處理/已處理
- 結案 Modal：選擇 resume/cancel，填寫處理報告

```mermaid
sequenceDiagram
  actor CS as 客服
  participant UI as 前端（CS）
  participant API as 後端 API
  participant DB as DB

  Note over CS,DB: 異常池列表
  CS->>UI: 開啟異常池（未處理）
  UI->>API: GET /api/cs/exceptions?handled=0
  API->>DB: SELECT package_exceptions + context fields
  DB-->>API: list
  API-->>UI: list

  Note over CS,DB: 結案（handle）
  CS->>UI: 開啟結案 Modal，選 action 並填 handling_report
  UI->>API: POST /api/cs/exceptions/:exceptionId/handle
  API->>DB: UPDATE package_exceptions (handled=1, resolution fields)
  API->>DB: INSERT package_events (exception_resolved)
  opt cancel（銷毀）
    API->>DB: INSERT package_events (delivery_failed)
    API->>DB: UPDATE packages.status = delivery_failed
  end
  opt resume（恢復配送）
    API->>DB: INSERT delivery_tasks (new segment) OR restore warehouse stage event
  end
  DB-->>API: OK
  API-->>UI: success
```

---

## 6) Admin：月底結算（settle）+ 帳單補救（手動調整/增刪項目）

UI 觸發點：

- 帳務作業頁：輸入 `YYYY-MM` → 結算
- 帳單維護頁：調整 due_date/狀態/金額、手動增刪 item（補單/移除）

```mermaid
sequenceDiagram
  actor Admin as 管理員
  participant UI as 前端（Admin）
  participant API as 後端 API
  participant DB as DB

  Note over Admin,DB: 月底結算（設定 due_date）
  Admin->>UI: 輸入 cycle_year_month 並點結算
  UI->>API: POST /api/admin/billing/settle
  API->>DB: UPDATE monthly_billing (due_date set where due_date IS NULL)
  DB-->>API: OK
  API-->>UI: success

  Note over Admin,DB: 手動調整帳單欄位
  Admin->>UI: 調整 due_date/status/total_amount
  UI->>API: PATCH /api/admin/billing/bills/:billId
  API->>DB: UPDATE monthly_billing (fields)
  DB-->>API: OK
  API-->>UI: success

  Note over Admin,DB: 手動增刪帳單項目（補救）
  alt add item
    Admin->>UI: 輸入 package_id → 加入帳單
    UI->>API: POST /api/admin/billing/bills/:billId/items
    API->>DB: INSERT monthly_billing_items + UPDATE total_amount
    DB-->>API: OK
    API-->>UI: success
  else remove item
    Admin->>UI: 移除 item
    UI->>API: DELETE /api/admin/billing/bills/:billId/items/:itemId
    API->>DB: DELETE monthly_billing_items + UPDATE total_amount
    DB-->>API: OK
    API-->>UI: success
  end
```

