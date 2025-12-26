# Operations & Tasks API（作業 / 任務 / 車輛）

> 來源：`docs/legacy/api-contract.legacy.md`（由 legacy 拆分）
>
> - 本頁定位：接口參考（endpoint / request/response schema / error codes）
> - 規則/流程（權威）：`docs/modules/operations.md`
> - 若內容與現行實作衝突：以後端實作與 `docs/modules/` 為準

## 8. 作業 / 任務 / 車輛（Operations & Tasks）`[已實作/部分規劃]`

### 8.1 司機任務（Driver Tasks, V2）`[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/driver/tasks` |
| **功能** | 取得司機任務清單（assigned / handoff） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/tasks/:taskId/accept` |
| **功能** | 交接接手（handoff take over） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/tasks/:taskId/enroute` |
| **功能** | 標記在途（寫入 in_transit 事件） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/tasks/:taskId/arrive` |
| **功能** | 標記到站（arrived_pickup / arrived_delivery） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/tasks/:taskId/pickup` |
| **功能** | 取件/裝載（vehicle_cargo + picked_up） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/tasks/:taskId/dropoff` |
| **功能** | 投遞/卸貨（warehouse_in / delivered） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/tasks/:taskId/complete` |
| **功能** | 將任務段標記 completed |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

### 8.2 司機車輛（Vehicles）`[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/vehicles/me` |
| **功能** | 取得司機車輛狀態（home/current/vehicle_code/current_node_id） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/vehicles/me/move` |
| **功能** | 司機車輛移動到相鄰節點（後端檢查 edges） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/vehicles/me/cargo` |
| **功能** | 查詢目前車上未卸貨貨物 |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

### 8.3 倉儲作業（Warehouse Operations）`[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/warehouse/packages` |
| **功能** | 本站包裹清單（綁定登入者站點） |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/warehouse/packages/receive` |
| **功能** | 點收（冪等寫入 warehouse_received + sorting） |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/warehouse/batch-operation` |
| **功能** | 批次入庫/出庫/分揀 |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/warehouse/packages/:packageId/dispatch-next` |
| **功能** | 派發下一段（下一跳決策） |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

