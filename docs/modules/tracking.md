# Tracking（顧客追蹤顯示）

本文件描述顧客端追蹤頁如何由 `packages.route_path` + `package_events` 推導「點/線」狀態與異常顯示。

## Intent（理念）

- 事件（`package_events`）是事實來源；顧客端的大階段（`packages.status`）是快取。
- `route_path` 提供「建議路徑」用於視覺化，不代表每一步都已發生。

## 規格（本專案以此為準）

以下規則視為「追蹤頁渲染規格」，需與前端一致：

- `route_path` 若缺失：顧客端無法繪製路徑進度（只顯示列表/事件文字）。
- `exception_resolved`：視為客服決策事件，不應推進顧客可見的路徑進度時間軸。
- 同一節點可能重複經過：節點到達時間以該節點最早 `events_at` 為準，避免後續 pass-by 覆蓋。
- 線段在途只以 `delivery_status = in_transit` 的事件判定，並依 `location = TRUCK_*` + `delivery_details` 解析出的「目的地節點」定位到對應線段。
- 異常顯示：
  - `location` 是節點 ID → 標記該節點（點）異常
  - `location` 是 `TRUCK_*` 且可解析目的地 → 標記對應線段（線）異常

> 追蹤圖更完整的「點/線判定」規則與相容狀態列表，請見 `docs/reference/api/03-packages.md` 的「客戶追蹤圖渲染規則」章節（此章節視為規格的一部分）。

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
