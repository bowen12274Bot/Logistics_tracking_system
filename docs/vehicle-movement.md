# 司機端地圖 + 貨車移動 + 任務單：規劃文件

這份文件把你補充的需求落成可實作的規格：司機端有獨立地圖介面，只看到「自己的貨車 + 任務相關標記」，並能在相鄰節點間移動；司機有任務單，可導航高亮路徑，抵達節點時可進行取件/送達/收款/異常等操作。

---

## 1. 介面拆分（公開地圖 vs 司機地圖）

### 1.1 公開/一般使用者地圖（既有）
- 目的：展示地圖結構（nodes/edges），不展示貨車。
- 既有頁面：`frontend/src/views/VirtualMapView.vue`
- 既有 API：`GET /api/map`

### 1.2 司機端地圖（新增）
- 目的：只給 driver 使用，展示：
  - 自己的貨車（位置/移動動畫）
  - 任務單中的目標節點（多個點標記）
  - 導航路徑高亮（車輛位置 → 選定任務目的地的最佳路徑）
- 建議新增頁面：`DriverMapView.vue`（路由例如 `/driver/map`，需登入且 `user_class=driver`）

---

## 2. 既有資料與模組（你已具備的基礎）

- 地圖表：`nodes / edges`（`backend/migrations/0006_virtual_map_schema.sql`），並提供 `GET /api/map`。
- 車輛表：`vehicles`（`backend/migrations/0014_vehicles.sql`），含 `home_node_id`、`current_node_id`。
- 司機任務表：`delivery_tasks`（`backend/migrations/0013_delivery_tasks.sql`），含 `task_type/from_location/to_location/assigned_driver_id/status`。
- 付款表：`payments`（`backend/migrations/0003_payments.sql`），可用 `paid_at IS NULL` 判斷是否未付款。
- 異常表：`package_exceptions`（見 `docs/database-schema.md`）。
- 路徑 API：`GET /api/map/route?from=...&to=...`（`backend/src/endpoints/mapRoute.ts`）。

---

## 3. 貨車移動（司機端地圖的核心）

### 3.1 狀態分層：DB vs UI
- DB（權威狀態）：只存 `vehicles.current_node_id`（抵達節點後才更新）。
- UI（視覺狀態）：用 `requestAnimationFrame` 在 SVG 座標系做插值動畫。

### 3.2 移動限制：「只能移動到相鄰節點」
- 前端：用 `edges` 建 adjacency，只有 `neighbors[currentNodeId]` 可點選。
- 後端：更新 DB 前再次驗證兩點是否有 edge 相連（防繞過）。

---

## 4. Vehicles API（司機只看自己的車）

後端認證模式可沿用現有 Bearer token（多個 staff endpoint 已使用 `tokens` 表驗證）。

### 4.1 `GET /api/vehicles/me`
- 權限：登入且 `user_class === "driver"`
- 行為（建議）：若該 driver 尚未有 vehicles row，則自動建立：
  - `home_node_id = users.address`（目前 seed 用 address 放節點 id）
  - `current_node_id = home_node_id`
  - `vehicle_code` 用規則或 UUID
- 回傳（建議）：`{ success: true, vehicle: { id, vehicle_code, home_node_id, current_node_id, updated_at } }`

### 4.2 `POST /api/vehicles/me/move`
- 權限：登入且 `user_class === "driver"`
- Body（建議）：`{ fromNodeId: string, toNodeId: string }`
- 驗證（建議）：
  - `fromNodeId === vehicles.current_node_id`（optimistic concurrency，避免連點/多端競態）
  - `toNodeId` 存在於 `nodes`
  - `fromNodeId` 與 `toNodeId` 需有直接 edge 相連
- 更新（建議條件 UPDATE）：
  - `UPDATE vehicles SET current_node_id=?, updated_at=? WHERE driver_user_id=? AND current_node_id=?`
  - 更新筆數為 0 → 回 `409 Conflict`

---

## 5. 司機任務單：來源、內容、優先邏輯

你描述的任務單，其實可以拆成「任務來源/分配」與「任務呈現/操作」兩塊。

### 5.1 任務來源：優先 HUB 附近 + 可額外接任務

你提到「優先接收自己 hub 附近的出貨單（節點向上找根）」，建議定義一個可重用的概念：
- `rootHub(nodeId)`：從任意節點往上找到所屬的 HUB 節點（level=1）。

實作方式（建議其一即可）：
- 方式 A（依圖搜尋）：在 `edges` 圖上從該 node BFS，找到最近的 `level=1` 節點作為 root hub。
- 方式 B（預先建表）：新增 `node_root_hub` 映射表，seed 時就算好（查詢最快）。

任務推薦規則（建議 MVP 先做簡版）：
- driver 的「工作 hub」= `vehicles.home_node_id`（或 `users.address`）
- 推薦任務 = `rootHub(from_location)` 或 `rootHub(to_location)` 等於 driver hub 的任務
- 額外接任務：提供「任務池」讓 driver 可以自行 `accept`

### 5.2 任務內容（你希望任務列出/判斷的欄位）

你希望任務包含：
- 配送路徑：把完整 path 拆成「當次兩節點的路徑」
  - 現有 `delivery_tasks` 只有 `from_location/to_location`，建議新增其中之一：
    - A：在 `delivery_tasks` 加 `segment_path TEXT`（JSON array）
    - B：不加欄位，每次要導航時即時計算（用 `GET /api/map/route`）
- 是否該收錢：
  - `cash` 或 `payments.paid_at IS NULL` → 需要收款
- 配送時效：
  - 使用 `packages.delivery_time` / `packages.estimated_delivery` 讓 driver 排序參考

---

## 6. 司機端地圖：任務導航與高亮

### 6.1 任務點標記（多個目的地）
- 在地圖上標示任務單中「所有要去的點」（通常是 task 的 `to_location`，或依 task_type 決定 from/to）。
- 讓司機可以「順路配送」：地圖上看得到所有目標點，但不強制一定要照任務順序。

### 6.2 點選任務 → 導航高亮
- 司機在任務單點選某個任務：
  1. 取當前車輛節點 `vehicles.current_node_id`
  2. 取目的地節點（例如 task 的 `to_location`）
  3. 呼叫 `GET /api/map/route?from=<car>&to=<target>` 拿到 `path[]`
  4. 把 `path` 中相鄰節點組成 edge set，前端用不同 stroke/opacity 高亮顯示

---

## 7. 抵達節點後：司機可執行的事件（手動確認為主）

你列的事件可以設計成「一個節點到達面板（Arrive Panel）」：

- 接收包裹（手動確認）：對應任務 `pickup/transfer_pickup`
- 送出包裹（手動確認）：對應任務 `deliver/transfer_dropoff`
- 收錢（現金/未付款）：依 `payment_type` + `payments.paid_at` 判斷是否顯示操作
- 申報異常：建立 `package_exceptions`
- 更新貨態：可由「接收/送出/異常」觸發自動更新，也允許手動修正

建議落到 API 時，以「事件為中心」而不是「直接改欄位」：
- 更新 packages.status + 插入 package_events（你已有 `/api/driver/packages/:packageId/status` 類似能力）
- 收款：寫入 payments.paid_at / 插入 payment event（若後續要對帳）
- 異常：插入 `package_exceptions` + package_events

---

## 8. MVP 建議順序（避免一次做太大）

1. 司機地圖頁（不含任務）：顯示自己的車（`GET /api/vehicles/me`）
2. 相鄰節點移動：UI 動畫 + `POST /api/vehicles/me/move`
3. 任務清單（先列出 assigned 或推薦任務）
4. 任務導航高亮：用 `GET /api/map/route` 高亮 path
5. 抵達面板：取件/送達/異常/收款（串既有或新增事件 API）

