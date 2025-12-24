# 司機端地圖 / 任務單（設計備忘）

本文件保留司機端地圖與任務單的 UI/UX 設計、MVP 拆解與（可能）API 提案；不作為規則權威來源。

## 介面拆分（公開地圖 vs 司機地圖）

- 公開/一般使用者地圖：展示 `nodes/edges`，不展示貨車（既有 `GET /api/map`）。
- 司機端地圖：只給 driver 使用，展示自己的貨車、任務目標點、導航路徑高亮。

## 貨車移動：DB vs UI（呈現策略）

- DB（權威狀態）：只存 `vehicles.current_node_id`（抵達節點後才更新）。
- UI（視覺狀態）：可用插值動畫呈現移動過程（例如 `requestAnimationFrame`）。

## 任務導航與高亮（UX）

1. 取當前車輛節點 `vehicles.current_node_id`
2. 取目的地節點（例如 task 的 `to_location`）
3. 呼叫 `GET /api/map/route?from=<car>&to=<target>` 拿到 `path[]`
4. 前端高亮 `path` 中相鄰邊（edge set）

## 抵達節點後：司機可執行的動作（UX）

- 接收/送出包裹（對應任務 `pickup/transfer_pickup`、`deliver/transfer_dropoff`）
- 收錢（現金/未付款）
- 申報異常（建立異常池並寫入 exception 事件）

## Vehicles API（提案，非契約權威）

是否納入契約請以 `docs/api-contract.md` 與 `docs/reference/api/` 為準。

- `GET /api/vehicles/me`：取得自己的車輛（必要時自動建立）
- `POST /api/vehicles/me/move`：移動（需相鄰節點 + optimistic concurrency）

## MVP 建議順序（參考）

1. 司機地圖頁（不含任務）：顯示自己的車
2. 相鄰節點移動：UI 動畫 + move API
3. 任務指派（分段任務）與接手規則
4. 任務導航高亮（route API）
5. 抵達面板：取件/送達/異常/收款

## Links

- 規則權威：`docs/modules/operations.md`
- 地圖規則：`docs/modules/map-routing.md`
- 異常規則：`docs/modules/exceptions.md`
