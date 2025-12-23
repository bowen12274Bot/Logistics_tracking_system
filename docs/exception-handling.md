# 異常事件（Exception）處理規範（v0.2）

本文件定義「異常申報、異常池處理、解除/取消、對任務與貨態的影響」等規範。異常目前先只涵蓋「包裹相關問題」（可擴充到其他因素），並確保異常成立後包裹會停止流轉、留在當下位置等待客服指引。

---

## 1. 目標與範圍

### 1.1 目標
- 統一異常的資料結構、事件寫入、顧客可見追蹤內容與內部處理流程。
- 讓異常能「暫停流轉」，避免司機/倉儲繼續對同一包裹做正常派發/交接造成衝突。
- 讓前端能一致呈現異常位置：在路上（線段）或在節點（點位）顯示黃色。

### 1.2 範圍（In / Out）
- In：
  - 異常申報（driver / warehouse_staff）
  - 異常池查詢與處理（customer_service）
  - 異常解除（resume）與取消（cancel）
  - 與 `delivery_tasks`、`package_events`、`packages.status` 的一致性規則
- Out（暫不做/後續再評估）：
  - 退款/賠償金額計算
  - 客訴工單/客服對話紀錄
  - 影像/附件上傳與存證

---

## 2. 名詞與角色

- **異常（Exception）**：包裹因不可正常流轉的原因被標記為例外狀態。
- **異常池**：未結案的 `package_exceptions.handled = 0` 集合，供客服處理。
- **申報者（reported_by）**：建立異常的人。
- **處理者（handled_by）**：結案的人（通常為客服）。
- **留置（hold）**：異常成立後包裹「停止流轉」，留在當下（節點或車上）等待客服指引。

角色範圍（暫定）：
- `driver`：運送途中可申報異常。
- `warehouse_staff`：站內分揀/點收/交接時可申報異常。
- `customer_service`：處理異常結案（resume/cancel）。
- `admin`：查閱/管理（本版不允許直接結案；僅保留後續擴充空間）。

---

## 3. 資料模型（既有表）

### 3.1 `package_exceptions`
- 來源：`backend/migrations/0012_package_exceptions.sql`
- 重點欄位：
  - `reason_code`：異常分類（字串枚舉，可擴充）
  - `description`：詳細說明（必填）
  - `reported_role`：`driver|warehouse_staff|customer_service`
  - `handled`/`handled_at`/`handling_report`

### 3.2 `package_events`
- 異常相關事件：`exception`、`exception_resolved`、`delivery_failed`（終端）
- `location` 規則：節點 ID（`END_*/REG_*/HUB_*`）或 `TRUCK_*`（代表在路上/車上）

### 3.3 `delivery_tasks`
- 異常對任務的影響（規範）：異常成立後必須取消 active tasks，避免繼續派送/交接。

---

## 4. reason_code 規範（MVP：包裹問題，可擴充）

### 4.1 設計原則
- `reason_code` 採「可擴充字串枚舉」：後端以字串儲存，不做 DB enum；前端以字典映射成中文顯示。
- `reason_code`、`description` 均為必填（driver/warehouse_staff）。
- 新增 code 不應破壞舊資料：若遇到未知 code，前端顯示「其他」並保留原始 code/description 供內部查看。

### 4.2 目前先納入：包裹/交付相關（MVP）

| reason_code | 中文顯示（建議） | 說明（何時用） |
|---|---|---|
| `damaged` | 包裹破損 | 外箱破損/凹陷/明顯受損 |
| `tampered` | 疑似拆封/被動過 | 封條破壞、重封、疑似被拆開 |
| `wet` | 受潮/泡水 | 受潮、泡水、潮濕導致損壞 |
| `leaking` | 滲漏 | 液體/粉末滲出、污染其他包裹風險 |
| `missing_item` | 內容物疑似缺失 | 重量明顯不符、內容物疑似缺件（不做理賠計算，僅停件） |
| `label_issue` | 標籤問題 | 條碼/面單破損、無法辨識、資訊不全 |
| `wrong_package` | 錯件/包裹不符 | 取到/送到的不是該件、包裹 ID 不一致 |
| `lost` | 包裹遺失 | 車上/站內找不到、交接點缺件 |
| `address_issue` | 地址問題/無法送達 | 地址不存在、地址資訊不全、需客服協助更正（先停件） |
| `payment_dispute` | 付款爭議/拒付 | 貨到付款拒付、金額爭議（先停件） |
| `refused` | 收件人拒收 | 明確拒收或拒絕簽收（先停件） |
| `misroute` | 錯分流向/誤送 | 站內錯分、送錯站、路徑明顯不合理（先停件） |
| `other` | 其他 | 不在以上分類，必填 description |

### 4.3 保留擴充（暫不啟用）

下列屬於「非包裹本身」或「營運因素」，目前不納入 UI 選項，但後續可加入而不影響資料結構：
- `vehicle_issue`（車輛故障）
- `traffic_delay`（交通/天候延誤）
- `facility_issue`（站點設備/系統故障）

---

## 5. 事件規範（package_events）

### 5.1 建立異常
- `delivery_status = 'exception'`
- `delivery_details`：至少包含 `description`；建議格式：`[<中文分類>] <description>`
- `location`：依申報角色與情境決定（節點 ID 或 `TRUCK_*`）
- 期望 stage：`packages.status` 應落在 `exception`

### 5.2 異常解除/結案
- `delivery_status = 'exception_resolved'`
- `delivery_details`：應包含處理摘要與 action（resume/cancel）
- `location`：建議填入「處理時的站點/車輛/目的地」
- stage 回復規則：依 `location` 推導回 `warehouse_in` 或 `in_transit`（既有 trigger 方向）

### 5.3 取消（配送失敗）
規範決定：`cancel` 的顧客端最終呈現為「配送失敗（紅色）」，且該包裹需保留在配送紀錄中。

本版採用方案 A：新增終端事件 + 終端 stage。

#### 5.3.1 事件定義
- 新增 `package_events.delivery_status = 'delivery_failed'`
- 事件意義：配送已終止，不再繼續流轉（terminal）。
- `delivery_details`：建議至少包含「終止原因摘要」，例如：
  - `配送失敗：客服取消委託`
  - 或 `配送失敗：[<中文分類>] <簡短摘要>`（摘要不必等於 description）
- `location`（規範決定）：必須沿用「最新一筆 `package_events(exception)`」的 `location`（節點 ID 或 `TRUCK_*`），代表包裹留置位置；不得由客服端任意指定，以避免顧客端顯示與實際留置點不一致。
- 寫入來源（規範決定）：只能由客服在 `cancel` 流程寫入；driver/warehouse_staff 不得直接寫入 `delivery_failed`。

#### 5.3.2 stage 映射（packages.status）
- `packages.status` 新增 stage：`delivery_failed`（紅色）。
- 映射規則：
  - 當最新事件為 `delivery_failed` 時 → `packages.status = 'delivery_failed'`
- 終端性（terminal）：
  - 一旦進入 `delivery_failed`，不得再被 `resume` 或寫入其他「推進貨態」事件。

#### 5.3.3 對查詢/配送紀錄的影響
- 進入配送紀錄（History tab）條件需包含：
  - `delivered`（既有完成）
  - `delivery_failed`（終止完成）
- 配送中（In transit）需排除：
  - `delivered`
  - `delivery_failed`

> 與「收件者未確認 7 天自動完成」的規則分離：該規則屬於 delivered 流程的完成判定（見 `docs/customer-service.md`），不影響 delivery_failed 的終端性。

---

## 6. 申報流程（driver / warehouse_staff）

### 6.1 申報（driver）

#### 6.1.1 輸入
- `reason_code`：必填（使用第 4 章枚舉；前端顯示中文）
- `description`：必填（補充說明，供客服判斷與對外顯示）

#### 6.1.2 前置條件（可控）
司機申報異常時必須符合下列任一條件：
- **在節點當地**：司機/貨車目前位置為某個節點（`HUB_*` / `REG_*` / `END_*`），且異常位置就是該節點；或
- **包裹在車上**：該包裹目前已上車（vehicle cargo）且尚未卸貨。

#### 6.1.3 寫入（規範）
1) 新增一筆 `package_exceptions`：
   - `package_id`
   - `reason_code`
   - `description`
   - `reported_by = driver user_id`
   - `reported_role = 'driver'`
   - `reported_at = now`
   - `handled = 0`
2) 新增一筆 `package_events`：
   - `delivery_status = 'exception'`
   - `delivery_details`：建議格式：`[<中文分類>] <description>`（至少要包含 description）
   - `events_at = now`
   - `location`（規則見 6.1.4）
3) 停止活動（必須）：
   - 取消該包裹所有 active `delivery_tasks`：`status IN ('pending','accepted','in_progress') → 'canceled'`

#### 6.1.4 location 規則（顧客地圖顯示）
location 目的是讓顧客地圖能區分「路上（線段）」與「在節點（點位）」。

規範決定（以包裹留置狀態為準，而不是以貨車是否已抵達節點為準）：
- **包裹在車上（尚未卸貨）** → `package_events.location = TRUCK_*`
  - 顧客地圖：線段顯示為黃色（例如綠→黃、灰→黃）
  - 重要情境：貨車已抵達配送站但尚未卸貨，此時若申報異常，仍視為「在路上/車上」，包裹需被鎖在貨車上，禁止卸下該包裹。
- **包裹已卸貨在節點** → `package_events.location = 節點 ID`（`END_*`/`REG_*`/`HUB_*`）
  - 顧客地圖：該節點顯示為黃色

#### 6.1.5 異常成立後包裹狀態（停件/留置）
- 異常成立後包裹需「停止流轉」並「留在當下」：
  - 若在收件端貨到付款拒收（`payment_dispute/refused`）等：留置在住家節點（location 為 `END_*`）。
  - 若在車上發現問題：包裹留在車上（location 為 `TRUCK_*`），等待客服指引下一步（例如指示回站、改派、退回）。

### 6.2 申報（warehouse_staff）

#### 6.2.1 輸入
- `reason_code`：必填（使用第 4 章枚舉；前端顯示中文）
- `description`：必填

#### 6.2.2 前置條件（可控）
- 包裹必須在本站（`users.address`）：
  - 以最新 `package_events` 判斷 `location = users.address` 且屬站內狀態（例如 `warehouse_in/warehouse_received/sorting/route_decided`）

#### 6.2.3 寫入（規範）
1) 新增一筆 `package_exceptions`：
   - `reported_by = warehouse_staff user_id`
   - `reported_role = 'warehouse_staff'`
   - 其餘欄位同 6.1.3
2) 新增一筆 `package_events`：
   - `delivery_status = 'exception'`
   - `delivery_details`：建議格式同 6.1.3
   - `events_at = now`
   - `location = users.address`（強制站點綁定，不採信前端）
3) 停止活動（必須）：
   - 取消該包裹所有 active `delivery_tasks`（避免仍被司機接手/完成）

#### 6.2.4 異常成立後包裹狀態（停件/留置）
- 包裹留置在本站倉庫（location=本站），等待客服指引下一步（例如指示改派、退回、補件、聯絡客戶）。

---

## 7. 客服流程

客服的「異常池 → 決策 → 結案」流程與任務清單，請見 `docs/customer-service.md`。

---

## 8. API 契約與一致性規則

候選端點（以既有 `docs/api-contract.md` 為準，後續在此章節落地完整 request/response）：
- `POST /api/driver/packages/:packageId/exception`
- `POST /api/warehouse/packages/:packageId/exception`
- `GET /api/cs/exceptions`
- `POST /api/cs/exceptions/:exceptionId/handle`

### 8.1 `GET /api/packages/:packageId/status`（建議補強）

目的：讓前端在 `packages.status === 'exception'` 時能顯示「異常原因（中文分類）」，而不把原因塞進 `packages.status`（stage 只作快取）。

建議回傳欄位：
- `active_exception`：該包裹「最新一筆未結案」的 exception（`package_exceptions.handled = 0` 的最新 `reported_at`）
  - `id`
  - `reason_code`
  - `description`
  - `reported_role`（`driver|warehouse_staff|customer_service`）
  - `reported_at`
  - `location`（可選：節點 ID 或 `TRUCK_*`；若目前資料無單獨欄位，可用最新 `package_events` 的 exception 事件 location 推導）

前端呈現規範（建議）：
- 若 `packages.status !== 'exception'`：不顯示異常區塊
- 若 `packages.status === 'exception'` 且 `active_exception` 存在：
  - 顯示 `reason_code` 對應中文（依第 4 章字典）
  - 不顯示 `description`（description 僅供客服/內部使用）
- 若 `packages.status === 'exception'` 但 `active_exception` 為空：
  - 顯示「異常處理中」與最後一筆 `package_events(exception)` 的 `delivery_details`（或顯示 fallback）

### 8.2 統一行為（規範決定）
本版規範決定：
- **同一包裹只允許 1 筆未結案異常**（`package_exceptions.handled = 0` 視為「active exception」）
  - 異常處理後（handled=1）若又再發生異常，視為「另一次異常」可再次申報（會新增新的一筆 `package_exceptions`）。
  - 異常未結案時，包含「再次申報異常」也必須被禁止（回 409），避免重複申報造成異常池污染。
- **active_exception.location 的權威來源：A**
  - 以最新的 `package_events(delivery_status='exception')` 的 `location` 作為權威 location（節點 ID 或 `TRUCK_*`）。
  - `active_exception.location` 的查詢可用「最新未結案 exception → 對應最新 exception event」推導（實作細節在後端決定）。
- **異常成立後暫停寫入其他貨態事件（避免覆蓋）**
  - 只要存在 active exception，除了「異常處理（exception_resolved）」之外，其他任何會寫入 `package_events` 的行為都必須被阻擋。
  - 相關 API 建議統一回 `409 Conflict`，錯誤訊息包含 `Package has active exception`。
  - 例外：客服處理結案端點（`/api/cs/exceptions/:exceptionId/handle`）仍可寫入 `exception_resolved`。
- **cancel 的事件寫入**
  - 客服 action=cancel 時，除了寫入 `exception_resolved` 外，必須再寫入一筆 `delivery_failed`，確保客戶端能以終端紅色呈現並進入配送紀錄。
- **異常成立後的封鎖操作（具體）**
  - 禁止卸貨/點收/派發該包裹：
    - 司機端：不得對該包裹執行卸貨/交接（若包裹在車上需保持在車上）。
    - 倉儲端：不得對該包裹執行點收、分揀、派發下一跳（直到異常結案）。
  - 禁止任何會讓該包裹「狀態前進」的事件寫入：
    - 例如：`warehouse_in/warehouse_received/sorting/route_decided/in_transit/picked_up/...` 等（依實作點統一攔截）。

---

## 9. 顯示與權限

規範決定（顧客端）：
- 只顯示異常「中文分類」（reason_code → 中文），不顯示 description / handling_report。
- 地圖顯示：
  - `location = TRUCK_*`：線段顯示黃色
  - `location = HUB_*/REG_*/END_*`：節點顯示黃色

---

## 10. 風險與邊界案例

- 任務競態：異常與 accept/complete 同時發生時的一致性
- 「已抵達但未卸貨」：需以包裹是否仍在車上決定 location（TRUCK vs node），並確保異常成立後禁止卸下該包裹

---

## 11. 後續擴充點

- 是否在 `package_exceptions` 增加 `assigned_to/assigned_at`（目前單客服不影響流程，僅保留擴充空間）。
