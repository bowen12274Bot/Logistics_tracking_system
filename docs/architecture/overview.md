# Architecture Overview（系統概觀）

本文件是「概念層」入口，用於描述系統的核心不變量（invariants）與資料/流程的責任邊界；具體 API 與欄位定義請見 `docs/reference/api.md` 與 `docs/api-contract.md`（索引）。

## 核心概念（目前實作）

- `package_events` 是貨態/流程事件的**事實來源**；`packages.status` 是顧客端 stage 的**快取**（由事件推導/同步）。
- `delivery_tasks` 用來描述「下一步要做什麼」（取件/送達/交接/派發），供司機與倉儲作業使用。
- `vehicles` 用來描述司機的車輛與位置（節點移動）；`vehicle_cargo` 表示包裹是否仍在車上（未卸貨）。
- `package_exceptions` 是異常池；異常成立後會**中止正常流轉**並取消 active tasks，直到客服結案。

## 文件連結

- Repo 結構：`docs/architecture/repository-structure.md`
- 資料模型：`docs/architecture/data-model.md`
- 模組規格（規則權威）：
  - 異常：`docs/modules/exceptions.md`
  - 作業/任務/車輛：`docs/modules/operations.md`
  - 追蹤呈現（事件→顯示）：`docs/modules/tracking.md`
