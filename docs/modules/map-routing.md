# Map & Routing（地圖與路線）

本文件整理虛擬地圖、路線查詢與 route_path 的規則層；API 介面請見 `docs/reference/api/04-map-routing.md`（或從 `docs/reference/api-contract.md` 索引進入）。

## Intent（理念）

- `nodes/edges` 表示物流路網；路徑由後端計算，前端主要負責呈現。
- `route_path` 用於顧客追蹤視覺化（點/線進度推導），不是唯一事實來源。

## Data（資料落點）

- `nodes` / `edges`：地圖節點與道路
- `packages.route_path`：建議路徑（JSON）

## Links

- API：`docs/reference/api/04-map-routing.md`
- 追蹤顯示：`docs/modules/tracking.md`
- 作業執行（車輛只能走相鄰節點）：`docs/modules/operations.md`
