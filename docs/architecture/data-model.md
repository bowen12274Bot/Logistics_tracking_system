# Data Model（資料模型）

本文件用「責任」描述資料表，而不是貼 migration SQL；具體 DDL 請以 `backend/migrations/` 為準。

## 事實來源 vs 快取

- 事實來源：`package_events`
- 快取：`packages.status`

> 追蹤 UI 與客服/倉儲/司機工作流應以事件為主；`packages.status` 只能用作「顧客可見的大階段」。

## 主要資料表（摘要）

- `users`：使用者（含員工/客戶），`address` 在員工情境作為工作站點/所屬節點。
- `packages`：出貨單/包裹主檔（含 sender/receiver 節點、費用、路徑等）。
- `package_events`：包裹事件（貨態/站內作業/在途/異常等），含 `delivery_status`、`events_at`、`location`。
- `delivery_tasks`：任務段（司機/倉儲執行），含 `from_location`/`to_location`、`assigned_driver_id`、`status`。
- `vehicles`：司機車輛狀態（`vehicle_code`、`home_node_id`、`current_node_id`）。
- `vehicle_cargo`：車上載貨關聯（是否卸貨用 `unloaded_at` 判斷）。
- `package_exceptions`：異常池（`handled`、`handling_report`、`reason_code`…）。

## 支援性資料表（常被引用）

- `nodes` / `edges`：虛擬地圖節點與路網（路由與相鄰性約束的基礎）。
- `payments`：單件費用的計費/收款紀錄（是否已付款、由誰收款等）。
- `monthly_billing` / `monthly_billing_items`：合約客戶月結帳單（帳單主檔 + 帳單包含哪些包裹）。
- `contract_applications`：合約申請資料（申請/審核流程的來源）。
- `tokens`：登入 token（驗證/授權用）。
- `system_errors`：系統錯誤/例外記錄（debug/查核用）。

## 資料字典（詳細表結構）

- `docs/reference/database-schema.md`（舊入口：`docs/database-schema.md`）

## Links

- 事件模型與貨態流程：`docs/architecture/event-model-and-flows.md`
- 名詞表：`docs/architecture/glossary.md`
