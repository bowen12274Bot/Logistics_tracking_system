# 倉儲員（warehouse_staff）作業規範 v1

本文件定義倉儲員的工作流程、資料寫入規則、權限邊界與前端介面需求，用於後續實作與驗收依據。

> 本版決策重點：
> - 倉儲掃描/操作以 `package_id` 為主（可由清單點選後按確認）。
> - 倉儲員工作站點 **強制綁定** `users.address`，不允許手動選站或變更站點。
> - 倉儲員只決定「下一跳（相鄰節點）」；每站都會再決定一次，不做整段路徑編輯。

---

## 1. 名詞與角色

- **倉儲員**：`users.user_class = 'warehouse_staff'`。
- **工作站點（本站）**：`users.address`（地圖節點 ID，例如 `REG_3` / `HUB_1`），為倉儲員一切操作的權威站點來源。
- **站內包裹（在站）**：包裹目前所在 `location` 為本站（規則見「站內判斷」）。
- **下一跳（next hop）**：本站相鄰節點之一，必須存在 `edges` 直接相連。
- **事件（events）**：以 `package_events` 為貨態與站內作業的**唯一事實來源**；`packages.status` 僅作為顧客可見 stage 的快取（由 trigger 同步）。

---

## 2. 權限與安全規範

### 2.1 權限
- 所有倉儲端 API 必須：
  - 需要 Bearer token；
  - token 對應的 `users.user_class` 必須為 `warehouse_staff`。

### 2.2 站點綁定（不可偽造站點）
- 後端不得採信任何由前端傳入的 `location_id` / `fromNodeId` 作為「本站」。
- 後端必須以 `users.address` 作為本站節點 ID，並用它：
  - 寫入 `package_events.location`
  - 作為派發任務的 `from_location`
  - 作為「站內包裹」的查詢條件

---

## 3. 資料寫入規則（事件為中心）

### 3.1 事件與 stage 映射
- 倉儲作業寫入 `package_events.delivery_status`，建議採用既有清單（例如：`warehouse_in`、`warehouse_received`、`sorting`、`warehouse_out`、`route_decided`…）。
- `packages.status` 由 DB trigger 依 `package_events.delivery_status` 轉換/快取，不由倉儲端直接更新。

### 3.2 站內判斷（本站有哪些包裹）
倉儲員必須能「一次看到本站所有包裹」。站內包裹建議以「最新事件」判斷：
- 取每個 package 的最新 `package_events`（依 `events_at` 最大）。
- 當最新事件滿足下列之一時視為在站：
  - `location = <users.address>` 且 `delivery_status` 屬於站內階段（例如 `warehouse_in`/`warehouse_received`/`sorting*`）
- 當最新事件為 `warehouse_out`（且 location=本站）後，視為已離站，不再列為站內包裹。

> 規範決定：`warehouse_received` 為必須步驟；未點收不可進入分揀/派發流程。

---

## 4. 工作流程（從卸貨到轉運）

### 4.1 貨車卸貨到站（司機）
- 司機將包裹送達 `REG_*`/`HUB_*` 並卸貨時，系統應已存在包裹資料並寫入到站事件：
  - `delivery_status = 'warehouse_in'`
  - `location = <本站 nodeId>`

### 4.2 倉儲點收確認（倉儲員）
倉儲員在站內清單對包裹按「確認到站」：
- 以 `users.address` 作為 `location` 寫入：
  - `delivery_status = 'warehouse_received'`
  - `events_at = now`
  - `delivery_details` 可選（例如備註）

### 4.3 進入分揀工作區（sorting）
點收後包裹進入分揀工作區（可視為 UI 狀態 + 可選事件）：
- 本版規範採用單一事件：`delivery_status='sorting'`（表示包裹目前位於分揀轉運工作區）。
- 觸發時機（規範決定）：包裹「點收成功」後，後端在同一次操作中寫入 `warehouse_received`，並接著寫入一筆 `sorting`，包裹即進入分揀工作區。

### 4.4 分組與決定下一跳（next hop）
倉儲介面必須展示本站相鄰節點的「群組」：
- 群組來源：查 `edges` 建 adjacency（本站相鄰節點清單）。
- 每個站內包裹都要被分到一個「下一跳群組」。
- 支援：
  - **自動分組（預設）**：系統提供建議下一跳
  - **手動改派**：倉儲員可把包裹移到另一相鄰群組

自動分組建議策略（不影響本文件的驗收，只影響 UX）：
- 以「每個相鄰節點 neighbor 作為 next hop」去估算 neighbor 到最終目的地（通常是 receiver 節點）的最短路徑成本，選成本最小者。

### 4.5 送出派發（指派司機轉運）
倉儲員對包裹按「送出／派發下一段」後，系統會建立新的分段任務（delivery task segment）：
- 驗證：
  - 呼叫者為 `warehouse_staff`
  - `fromNodeId = users.address`
  - `toNodeId` 必須與 `fromNodeId` 直接相鄰（edges 存在）
  - 該包裹不得存在仍在進行中的 segment（`pending/accepted/in_progress`）
  - 該包裹必須「目前在本站」（依站內判斷規則）
- 行為：
  - 建立 `delivery_tasks` 新 segment：
    - `from_location = <users.address>`
    - `to_location = <toNodeId>`
    - `segment_index` 遞增（同 package）
    - `status = 'pending'`
  - 建立事件（建議）：
    - `delivery_status = 'route_decided'`
    - `location = <users.address>`
    - `delivery_details` 可記錄 next hop（例如 `next=REG_3`）

> 站內持有時間：從 `warehouse_in`（卸貨到站）到 `warehouse_out`（交接出站）之間。倉儲員需在此期間能看到並操作本站包裹。

---

## 5. 前端介面需求（倉儲員）

### 5.1 功能模組
- **倉庫包裹**：顯示本站站內包裹清單（含待點收/分揀中/待派發/已派發等狀態視圖）。
- **分揀與下一跳決策**：
  - 顯示「相鄰節點群組」的看板式 UI（每個群組是一個相鄰節點）
  - 預設自動分組，允許手動改派
  - 送出派發（建立下一段任務）
- **異常申報**：選包裹 + 原因 + 描述 → 送出（建立 exception + exception 事件）。
- **查看地圖**：
  - 顯示本站與相鄰節點
  - 選擇包裹/選擇不同下一跳時，能預覽「下一跳 → 最終目的地」的最佳路徑（若已提供 route API）

### 5.2 UI 最小驗收
- 倉儲員登入後，只能看到本站包裹（不跨站）。
- 倉儲員不能選擇或更改站點。
- 分揀群組僅包含「本站相鄰節點」，不能派發到非相鄰節點。

---

## 6. API 規範（需對齊/待實作）

> 本章節只定義「倉儲端需要哪些行為」，不要求本回合立即改動程式碼。

### 6.1 站內包裹清單
- `GET /api/warehouse/packages`
- 權限：`warehouse_staff`
- 查詢條件：後端以 `users.address` 作為本站，回傳站內包裹與其最新事件、建議下一跳（若有）。

### 6.2 點收確認（以 package_id）
點收支援「一筆筆」與「一次多筆」兩種操作，前端以點收清單（勾選 + 全選）送出。
- `POST /api/warehouse/packages/receive`
- 權限：`warehouse_staff`
- Body：
  - `package_ids: string[]`（允許 1 筆或多筆；不可為空）
- 後端規範：
  - 本站一律以 `users.address` 為準（不採信前端傳 location）
  - 每個 package 依序寫入兩筆事件：
    1) `warehouse_received`（location=users.address）
    2) `sorting`（location=users.address）
  - 已點收/已在分揀中的包裹：採用「冪等（idempotent）」策略
    - 若包裹最新事件已是本站的 `warehouse_received`/`sorting`（或本站內後續事件），則視為已點收成功，回傳 success，但不重複寫入事件

### 6.3 派發下一段（下一跳）
- `POST /api/warehouse/packages/:packageId/dispatch-next`
- 權限：`warehouse_staff`
- Body：`{ "toNodeId": "REG_3" }`
- 後端必須：
  - `fromNodeId = users.address`
  - 驗證 adjacency
  - 驗證包裹在本站
  - 建立 delivery_tasks 新 segment（下一跳）

### 6.4 異常申報
- `POST /api/warehouse/packages/:packageId/exception`
- 權限：`warehouse_staff`
- 先保留端點與權限，詳細的異常申報/解除/取消、對任務的影響與顧客可見追蹤內容，待後續詳盡規劃後再落地。
- 詳見（規範骨架）：`docs/exception-handling.md`

---

## 7. 風險與邊界案例

- **events_at 的唯一性/排序**：同秒多事件可能導致「最新事件」判斷歧義；建議 `events_at` 精確到 ms 或補上 tie-break（例如 rowid）。
- **是否必須點收**：若允許未點收就分揀/派發，可能造成流程不嚴謹；若強制點收，需明確 UI 提示與阻擋規則。
- **跨站派發風險**：必須以「包裹在本站」驗證避免錯站操作。

---

## 8. 已決定事項

1) `warehouse_received` 為必須步驟：未點收不可分揀/派發。
2) 分揀事件採用單一 `sorting`：目前無需拆分 `sorting_started/sorting_completed`。
