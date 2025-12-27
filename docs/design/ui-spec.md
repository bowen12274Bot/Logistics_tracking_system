# 前端介面規範（UI Specifications）

本文件以「前端使用者角度」描述各角色的頁面、操作流程、狀態與錯誤處理；API 僅作為實作對照（避免打錯 endpoint）。

參考來源：

- 端到端功能：`docs/features/`
- 規則權威：`docs/modules/`
- API 參考：`docs/reference/api/`

---

## 共通規範（所有角色）

### Loading / Error / Empty

### Toast vs Inline Notice

- API 錯誤：使用 `toastFromApiError(...)` 統一吐 toast（422/409/5xx）；401/403 由全域導向處理，不需要各頁重複處理。
- 表單/頁面內的「需要留在畫面上」的訊息：使用 `UiNotice`（`frontend/src/components/ui/UiNotice.vue`）。
- 建議規則：
  - 阻擋操作的錯誤：`<UiNotice tone="error" role="alert">...</UiNotice>`
  - 成功/完成提示：`<UiNotice tone="success">...</UiNotice>`
  - 輕量提醒（例如必填欄位）：`toast.warning(...)` 或 `UiNotice tone="warning"`（擇一，避免同時出現造成吵雜）

- 所有列表頁必須有三態：Loading、Empty、Error（含可重試）。
- 所有「會改變狀態」的按鈕需有 disabled 條件與避免連點（防止重複送出）。

### 權限與導頁

- 任何 401 → 重新登入或導回登入頁。
- 任何 403 → 顯示「無權限」頁（並提供返回上一頁/首頁）。

### API 對照（落地原則）

- UI spec 只寫「用到哪些 endpoint + 觸發時機 + UI 需要哪些欄位」，request/response schema 交給 `docs/reference/api/`。
- 若 UI spec 與實作衝突：以後端實作與 `docs/reference/api/` 為準，並回頭修正本文件。

---

## 1. 司機端（Driver）

相關功能文件：

- `docs/features/driver-task-lifecycle.md`
- `docs/features/driver-cash-collection.md`
- `docs/features/exception-report-and-handle.md`

### 1.1 任務清單頁

目標：讓司機快速看到「我現在要做什麼」，以及「可交接的任務」。

資訊架構（建議）：

- 分頁：
  - 我的任務（assigned）
  - 交接任務（handoff）
- 每張任務卡片最少顯示：
  - `tracking_number`
  - `task_type`（pickup/deliver）
  - `from_location` → `to_location`
  - `status`
  - 金流提示：`payment_type`、`paid_at`、`payment_amount`

互動：

- 刷新/進入頁面：拉清單
- 交接任務卡片提供「接手」按鈕
- 點卡片進任務詳情頁

API（對照）：

- 取得清單：`GET /api/driver/tasks?scope=assigned`
- 取得交接：`GET /api/driver/tasks?scope=handoff`
- 接手交接：`POST /api/driver/tasks/:taskId/accept`

錯誤/狀態：

- `scope=handoff` 若回 `node_id=null`（車輛無節點）→ UI 提示需先完成車輛設定/指派（由 admin 操作）。
- 接手 409：提示「不在起點 / 任務不可交接 / 包裹已結案或有異常」。

### 1.2 任務詳情頁（導航 + 動作）

目標：把「導航資訊」與「下一個可按的動作」放在同一個畫面。

資訊顯示（建議）：

- From/To 節點、任務類型、備註（`instructions` 若有）
- 客戶資訊（若前端有）：聯絡人/電話（避免顯示不必要的敏感資料）
- 進度提示：目前任務 status 與建議下一步

主要動作（依狀態顯示）：

- `在途中`：標記在途
- `已到達`：標記到站（影響收款窗口）
- `取件/裝載` 或 `投遞/卸貨`
- `回報異常`

API（對照）：

- 導航路徑（選用）：`GET /api/map/route?from=NODE&to=NODE`
- 標記在途：`POST /api/driver/tasks/:taskId/enroute`
- 標記到站：`POST /api/driver/tasks/:taskId/arrive`
- 取件：`POST /api/driver/tasks/:taskId/pickup`
- 投遞：`POST /api/driver/tasks/:taskId/dropoff`

錯誤/狀態：

- 409 Not at node：提示司機需先到達正確節點（或先更新車輛位置）。
- 409 Payment not settled：提示需先付款/收現（見 1.3）。
- 409 Package has active exception：提示需先由客服結案。

### 1.3 到站面板（收現 / 取件 / 投遞）

目標：把一段任務的「到站後操作」做成可視化流程，避免司機做錯順序。

UI 流程（建議）：

1. 到站（按「已到達」）
2. 若需要收現，顯示收現區塊（並提示門檻）
3. 顯示「取件/投遞」主按鈕

API（對照）：

- 到站：`POST /api/driver/tasks/:taskId/arrive`
- 收現：`POST /api/driver/packages/:packageId/collect-cash`
- 取件：`POST /api/driver/tasks/:taskId/pickup`
- 投遞：`POST /api/driver/tasks/:taskId/dropoff`

UI 規則提示（必須呈現給司機）：

- 預付現金到府取件：必須先到站（arrived_pickup）才能收現。
- 到府代收：必須先到站（arrived_delivery）才能收現，且未收現不可完成 delivered。
- 門市代收：司機不收現（若嘗試會 409）。

### 1.4 異常回報

目標：讓司機用最少輸入完成申報，並立即從任務清單移除該包裹。

UI 欄位（建議）：

- `reason_code`：下拉必選（依規則文件列舉）
- `description`：必填文字
- `location`：不建議給自由輸入（後端會限制）；可顯示只讀提示（目前節點/車號）

API（對照）：

- `POST /api/driver/packages/:packageId/exception`

---

## 2. 倉儲端（Warehouse）

相關功能文件：

- `docs/features/warehouse-receive-and-sorting.md`
- `docs/features/warehouse-dispatch-next-task.md`
- `docs/features/exception-report-and-handle.md`

### 2.1 站內包裹清單頁

目標：讓倉儲人員看到「本站有哪些包裹」與「下一步怎麼派發」。

API（對照）：

- `GET /api/warehouse/packages`

UI 建議：

- 每列顯示：tracking、目前狀態、目前所在、建議下一跳（若後端有提供）
- 提供快捷入口：
  - 點收（批次）
  - 批次作業（入庫/出庫/分揀）
  - 派發下一段（單筆）
  - 申報異常（單筆）

### 2.2 點收（批次）

API（對照）：

- `POST /api/warehouse/packages/receive`

UI 建議：

- 條碼掃描清單 → 送出 `package_ids[]`
- 顯示冪等提示：已點收不會重複寫入

### 2.3 批次作業（batch-operation）

API（對照）：

- `POST /api/warehouse/batch-operation`

UI 規則：

- 必填：`operation`、`package_ids[]`、`location_id`（以及 `note` 建議填）

### 2.4 派發下一段（dispatch-next）

API（對照）：

- `POST /api/warehouse/packages/:packageId/dispatch-next`

UI 規則：

- 需提供 `toNodeId` 選擇器（只能選相鄰節點；若後端有回建議清單可用）

### 2.5 倉儲異常

API（對照）：

- `POST /api/warehouse/packages/:packageId/exception`
- `GET /api/warehouse/exceptions`

---

## 3. 客服後台（Customer Service）

相關功能文件：

- `docs/features/cs-exception-pool-and-handle.md`
- `docs/features/cs-billing-support.md`
- `docs/features/review-contract-application.md`

### 3.1 異常池頁

目標：客服能在列表快速判斷，並進入結案 modal。

API（對照）：

- `GET /api/cs/exceptions?handled=0|1`
- `POST /api/cs/exceptions/:exceptionId/handle`

UI 規則：

- 結案 modal 需支援：
  - `action=resume|cancel`
  - `handling_report`（必填）
  - resume 才顯示：`resume_mode` +（可能）`next_hop_override`/`destination_override`

### 3.2 查帳支援頁

API（對照）：

- `GET /api/billing/bills?customer_id=...`
- `GET /api/billing/bills/:billId`

UI 規則：

- 需要能判讀是否已出帳：`due_date == null`（未出帳）

### 3.3 合約審核（CS）

API（對照）：

- `GET /api/cs/contract-applications`
- `PUT /api/cs/contract-applications/:id`

---

## 4. 管理員後台（Admin）

相關功能文件：

- `docs/features/admin-user-management.md`
- `docs/features/admin-billing-operations.md`
- `docs/features/review-contract-application.md`

### 4.1 員工/權限管理

API（對照）：

- `GET /api/admin/users`（列表）
- `POST /api/admin/users`（建立）
- `GET /api/admin/users/:id`（明細）
- `PUT /api/admin/users/:id`（更新）
- `POST /api/admin/users/:id/suspend|activate`
- `POST /api/admin/users/:id/reset-password`
- `POST /api/admin/users/:id/assign-vehicle`

### 4.2 帳務作業

API（對照）：

- 月底結算：`POST /api/admin/billing/settle`
- 帳單調整：`PATCH /api/admin/billing/bills/:billId`
- 增刪項目：`POST /api/admin/billing/bills/:billId/items`、`DELETE /api/admin/billing/bills/:billId/items/:itemId`

UI 規則（建議）：

- 結算頁需提示：只會對 `due_date IS NULL` 的本期 pending 帳單補 due_date（不會改狀態）。
- 手動增刪項目前需提示風險：目前後端不檢查是否跨期/重複（屬管理端責任）。

### 4.3 系統錯誤列表

API（對照）：

- `GET /api/admin/system/errors`

> `GET /api/admin/stats` 目前未實作；若需要 KPI 需另行設計。

### 4.4 合約審核（Admin）

API（對照）：

- `GET /api/admin/contract-applications`
- `PUT /api/admin/contract-applications/:id`
