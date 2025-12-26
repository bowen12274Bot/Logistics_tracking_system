# Users & Access Control（使用者與權限）

本文件定義「身分、角色、token 與 RBAC」的規則層說明；API 介面請見 `docs/reference/api/01-users.md` 與 `docs/reference/api/06-super-user.md`（或從 `docs/reference/api-contract.md` 索引進入）。

## Intent（理念）

- 所有 staff 操作必須可追溯到 `users.id`（由 token 對應）。
- 前端/後端都要用同一套角色語意（以 `user_class` 為主）。

## Roles（角色）

對齊 `docs/reference/api-contract.md`（索引入口）：

- customer：`non_contract_customer` / `contract_customer`
- employee：`driver` / `warehouse_staff` / `customer_service` / `admin`

## Token（認證）

- Bearer token（`Authorization: Bearer <token>`）
- 權威來源：`tokens` 表（token → user_id）

## RBAC（授權）

- 規則：端點以 `user.user_class`（必要時含 `user_type`）判斷是否允許。
- 站點綁定：員工的 `users.address` 是工作站點/所屬節點的權威資料來源（倉儲尤其重要）。

## Access Control（權限邊界總索引）

本節集中描述各角色在系統中的「可做/不可做」邊界，避免權限規格分散在 features/handbook/reference 造成理解成本。

> 接口參考：`docs/reference/api/README.md`（各端點的認證/權限欄位）；若內容與現行實作衝突，以後端實作與本文件為準並回頭修正文件。

### Legend（符號）

- `✅`：允許
- `❌`：不允許
- `⚠️`：允許但有條件（例如只能操作自己的資源、或只能操作本站）

### Global Boundaries（全域邊界）

- Own-data：`customer` 只能讀寫「自己」名下的包裹/付款/帳單（`customer_id`/`payer_user_id` 綁定）。
- Station-bound：`warehouse_staff` 的站點由 `users.address` 決定，禁止由前端指定本站；所有「站內清單、點收、派發下一段」都必須以 `users.address` 為準。
- Driver-bound：`driver` 只能操作「指派給自己」的任務段與「自己的車輛」；交接（handoff）屬於受限例外（仍需符合規則）。
- Exception-gate：異常成立後會中止 normal flow（取消 active tasks / 封鎖操作），直到客服結案（resume/cancel）。
- Billing-preference：`billing_preference` 只是一個「預設偏好」，用於建立包裹時預設 `packages.payment_method`；非合約客戶不可設為 `monthly`，且非合約客戶在付款階段也不可選 `monthly_billing`（規則見 `docs/modules/payments.md`）。

### Permissions Matrix（能力/動作矩陣）

| 能力/動作 | 公開（無 token） | customer | driver | warehouse_staff | customer_service | admin | 參考文件 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| 註冊/登入/查自己 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `docs/reference/api/01-users.md` |
| 更新自己的個人資料 | ❌ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | `docs/reference/api/01-users.md`（`PUT /api/customers/me`） |
| 申請成為合約客戶 | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ | `docs/reference/api/01-users.md`、`docs/modules/contracts.md` |
| 查詢/審核合約申請 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | `docs/reference/api/02-review.md` |
| 取得地圖/算路線成本 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `docs/reference/api/04-map-routing.md` |
| 更新地圖邊成本 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | `docs/reference/api/04-map-routing.md` |
| 建立包裹（寄件） | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | `docs/reference/api/03-packages.md`、`docs/modules/shipping.md` |
| 運費試算 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `docs/reference/api/03-packages.md`、`docs/modules/pricing.md` |
| 查包裹列表/單筆（客戶） | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ | `docs/reference/api/03-packages.md` |
| 員工追蹤查詢（search） | ❌ | ❌ | ❌ | ⚠️ | ⚠️ | ⚠️ | `docs/reference/api/03-packages.md` |
| 客戶追蹤（事件查詢） | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ | `docs/reference/api/03-packages.md`、`docs/modules/tracking.md` |
| 待付款清單/更新付款方式/確認付款 | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ | `docs/reference/api/05-payments.md`、`docs/modules/payments.md` |
| 帳單查詢/付款/付款紀錄 | ❌ | ⚠️ | ❌ | ❌ | ⚠️ | ⚠️ | `docs/reference/api/05-payments.md` |
| 月結結算/手動調整（Admin） | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | `docs/reference/api/05-payments.md` |
| 司機任務清單/接單/更新狀態 | ❌ | ❌ | ⚠️ | ❌ | ❌ | ❌ | `docs/reference/api/08-operations-tasks.md`、`docs/modules/operations.md` |
| 司機車輛查詢/移動/載貨查詢 | ❌ | ❌ | ⚠️ | ❌ | ❌ | ❌ | `docs/reference/api/08-operations-tasks.md` |
| 倉儲站內包裹清單/點收/批次作業 | ❌ | ❌ | ❌ | ⚠️ | ❌ | ❌ | `docs/reference/api/08-operations-tasks.md`、`docs/modules/operations.md` |
| 倉儲派發下一段（dispatch-next） | ❌ | ❌ | ❌ | ⚠️ | ❌ | ❌ | `docs/reference/api/08-operations-tasks.md`、`docs/modules/operations.md` |
| 司機/倉儲異常申報 | ❌ | ❌ | ⚠️ | ⚠️ | ❌ | ❌ | `docs/reference/api/07-exceptions.md`、`docs/modules/exceptions.md` |
| 客服異常池/結案（resume/cancel） | ❌ | ❌ | ❌ | ❌ | ⚠️ | ❌ | `docs/reference/api/07-exceptions.md`、`docs/modules/exceptions.md` |
| 建立員工帳號/查系統錯誤 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | `docs/reference/api/06-super-user.md` |

### Event Writing Responsibility（事件寫入責任）

這張表描述「哪些事件通常由哪個角色/流程寫入」；實作可能因端點設計而整合在某些動作內（例如 driver 任務狀態更新時一併寫入事件）。

| `package_events.delivery_status` | 常見寫入角色 | 備註/參考 |
|---|---|---|
| `created` | customer | 建立包裹時寫入 |
| `enroute_pickup` / `arrived_pickup` | driver | 可選通知事件（不一定寫） |
| `picked_up` / `in_transit` | driver | 通常由任務操作（pickup/enroute）推進 |
| `warehouse_in` / `warehouse_received` / `sorting` / `warehouse_out` / `route_decided` | warehouse_staff | 站內事件以 `users.address` 綁定 |
| `out_for_delivery` / `enroute_delivery` / `arrived_delivery` / `delivered` | driver | 末端配送（部分為可選通知事件） |
| `payment_collected_prepaid` / `payment_collected_cod` | driver | 現金收款（窗口/限制見 `docs/modules/payments.md`） |
| `exception` | driver / warehouse_staff | 申報異常時寫入；會中止正常流轉 |
| `exception_resolved` | customer_service | 結案（resume）時寫入；回推 stage 依 location 推導 |
| `delivery_failed` | customer_service | 結案（cancel）時寫入；terminal |

## Links

- API：`docs/reference/api/01-users.md`、`docs/reference/api/06-super-user.md`
- 操作模組與站點綁定：`docs/modules/operations.md`
