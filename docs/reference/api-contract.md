# 後端 API 接口契約文件（索引）

本文件是「接口契約索引入口」：只維護連結，不重複貼接口細節與 schema，避免規格分裂。

- 介面參考（endpoint / request/response schema / error codes）：`docs/reference/api/README.md`
- 規則/流程（權威來源）：`docs/modules/README.md`
- 端到端用例（UI→規則→API）：`docs/features/README.md`
- 舊版單檔快照（不再更新）：`docs/legacy/api-contract.legacy.md`
- 合併前單檔版本（保留用/非權威）：`docs/legacy/api-contract.main.md`

---

## API 分頁（依原章節拆分）

- 通用（認證/錯誤/角色）：`docs/reference/api/00-common.md`
- 使用者（User Module）：`docs/reference/api/01-users.md`
- 合約審核（Review）：`docs/reference/api/02-review.md`
- 包裹（Package Module）：`docs/reference/api/03-packages.md`
- 地圖與路線（Map & Routing）：`docs/reference/api/04-map-routing.md`
- 金流（Payment Module）：`docs/reference/api/05-payments.md`
- 超級使用者（Super User Management）：`docs/reference/api/06-super-user.md`
- 異常（Exceptions）：`docs/reference/api/07-exceptions.md`
- 作業/任務/車輛（Operations & Tasks）：`docs/reference/api/08-operations-tasks.md`

## 附錄

- 內部/範例 API（非物流領域核心功能）：`docs/reference/api/09-internal-demo.md`

---

## 重構原則（簡短版）

- 接口只在 `docs/reference/api/` 維護；模組規則只在 `docs/modules/` 維護。
- `docs/reference/api/` 如需描述規則，改用連結指向對應模組文件，不在接口頁重寫。
