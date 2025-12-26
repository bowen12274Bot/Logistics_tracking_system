# Glossary（核心名詞表）

本文件屬於 `docs/architecture/` 概念層：集中定義專案常用名詞，避免在 features/handbook/reference 中用詞漂移。

> 規則/流程請以 `docs/modules/` 為準；接口與 schema 請以 `docs/reference/api/` 為準。

## Domain Objects（領域物件）

- `package`：包裹/寄件單的領域主體（資料主檔多在 `packages`）。
- `package_event`：包裹事件（事實來源），描述「在何時、於何地、發生了什麼狀態/動作」（資料多在 `package_events`）。
- `delivery_task`：可執行的工作段（司機/倉儲），描述「從哪裡到哪裡，要做什麼」（資料多在 `delivery_tasks`）。
- `vehicle`：司機的車輛與位置（資料多在 `vehicles`）。
- `vehicle_cargo`：車上載貨關聯（包裹是否仍在車上；多在 `vehicle_cargo`）。
- `exception`：異常事件/案件（需要人工介入）；本專案以「異常池」管理（資料多在 `package_exceptions`）。

## Locations（位置）

- `node`：地圖節點（配送網路中的站點）；同時是地址格式的一部分。
- `END_*`：端點（常見為住家/超商等）。
- `REG_*`：區域節點（regional）。
- `HUB_*`：樞紐節點（hub）。
- `TRUCK_*`：車輛位置（用於表示「在途」的 location）。

> 節點與路線的接口請見 `docs/reference/api/04-map-routing.md`。

## Status & Stage（狀態/階段）

- `packages.status`：顧客可見大階段（stage）的快取欄位，便於列表/查詢；不是事實來源。
- `package_events.delivery_status`：事件狀態（事實來源），用來推導顧客可見 stage、以及驅動任務與異常流程。
- `customer stage`：顧客端 UI 顯示的進度階段（由事件推導；具體渲染規則見 `docs/modules/tracking.md`）。

## Routing（路線）

- `route_path`：節點序列（通常為 JSON array/string），代表包裹配送路徑；用於追蹤圖、除錯與部分作業邏輯。
- `routeCost` / `route.total_cost`：地圖最短路徑的成本加總（edges `cost` 加總）。
  - 計價規格（權威）：`docs/modules/pricing.md`

## Payments & Billing（付款/帳單）

- `payment_type`：誰付錢（`prepaid` 寄件者付 / `cod` 收件者付）。
- `payment_method`：怎麼付（例如現金/信用卡/轉帳/第三方/月結等）。
- `billing_preference`：客戶偏好（建立包裹時作為預設付款方式候選），但付款時仍需再次確認。
- `monthly_billing`：月結帳單主檔；`monthly_billing_items` 代表帳單包含的包裹。

> 規則權威：`docs/modules/payments.md`

## Roles（角色）

- `customer`：客戶（包含非合約與合約客戶）。
- `customer_service`：客服（異常池/查詢/結案等）。
- `warehouse_staff`：倉儲（站內作業/派發/交接等）。
- `driver`：司機（任務接單、移動、取件/送達、收款等）。
- `admin`：管理員（帳務/人員/系統管理等）。

> 角色手冊入口：`docs/handbook/README.md`；端到端用例入口：`docs/features/README.md`

