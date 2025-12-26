# 司機（driver）作業手冊

本文件描述司機端的日常操作流程（怎麼做）；任務/車輛/站點移動的規則與一致性以 `docs/modules/operations.md` 為準。

## 角色目標

- 依任務清單完成取件/配送/交接
- 在相鄰節點間移動車輛並同步位置
- 遇到無法正常流轉時申報異常

## 操作流程（摘要）

1. 取得自己的車輛狀態（位置、車碼）
2. 查看被指派的任務段（以及可接手的 HUB/REG 起點段落）
3. 依任務目標在地圖上移動（僅相鄰節點）
4. 抵達節點後完成任務（取件/送達/交接）
5. 需要時：收款、申報異常

## Links

- 任務/車輛/移動規則（權威）：`docs/modules/operations.md`
- 地圖與路線（權威）：`docs/modules/map-routing.md`
- 異常規則（權威）：`docs/modules/exceptions.md`
- 金流與收款（權威）：`docs/modules/payments.md`
- 功能文檔：`docs/features/driver-task-lifecycle.md`、`docs/features/driver-cash-collection.md`、`docs/features/exception-report-and-handle.md`
- API（接口參考）：`docs/reference/api/08-operations-tasks.md`、`docs/reference/api/07-exceptions.md`、`docs/reference/api/05-payments.md`
- 司機端地圖設計與提案（非規則）：`docs/design/driver-map.md`
