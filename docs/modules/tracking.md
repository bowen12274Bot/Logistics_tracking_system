# Tracking（顧客追蹤顯示）

本文件描述顧客端追蹤頁如何由 `packages.route_path` + `package_events` 推導「點/線」狀態與異常顯示。

## Intent（理念）

- 事件（`package_events`）是事實來源；顧客端的大階段（`packages.status`）是快取。
- `route_path` 提供「建議路徑」用於視覺化，不代表每一步都已發生。

## Customer Stage（顧客顯示大階段）

Stage 是「顧客顯示用的大階段」：用於 UI 呈現與篩選；來源仍以 `package_events` 為準，`packages.status` 僅是快取（由事件推導/同步）。

### Stage 狀態機（摘要）

```
Stage 可能在配送站/轉運中心之間重複循環（多段轉運）。

created → picked_up → in_transit → warehouse_in → sorting → warehouse_out → in_transit → … → delivered

末端配送（最後一哩）：
warehouse_out → out_for_delivery → delivered

異常（可從任意 stage 發生）：
ANY → exception
exception --(客服處理 exception_resolved, action=resume)--> warehouse_in / in_transit
exception --(客服處理 action=cancel)-->（取消委託；不再派發任務段）
```

## Location 語意（節點 vs 車上/在途）

- `location` 若是節點 ID（`END_*`/`REG_*`/`HUB_*`）：視為「到達點」
- `location` 若是 `TRUCK_*`：視為「在途/車上」（前端通常呈現為線段/移動狀態）

## 異常顯示（與 location 的關係）

- `delivery_status='exception'`：
  - `location` 為節點 → 顯示點異常
  - `location` 為 `TRUCK_*`（且 details 可解析目的地）→ 顯示線異常

> 進一步的 location 權威/驗證（員工端寫入規則）請見 `docs/modules/exceptions.md`。

## Links

- API（追蹤查詢/事件）：`docs/reference/api/03-packages.md`（原 3.5、3.6 等段落）
