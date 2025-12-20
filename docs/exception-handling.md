# 異常事件（Exception）處理規範（骨架）

本文件將用來完整定義「異常申報、異常池處理、解除/取消、對任務與貨態的影響」等規範；目前先建立骨架，待後續優先順序到達再補齊細節。

---

## 1. 目標與範圍

### 1.1 目標
- 統一異常的資料結構、事件寫入、顧客可見追蹤內容與內部處理流程。
- 讓異常能「暫停流轉」、避免司機/倉儲繼續對同一包裹做正常派發/交接造成衝突。

### 1.2 範圍（In / Out）
- In：
  - 異常申報（driver / warehouse_staff / customer_service）
  - 異常池查詢與處理（customer_service 為主）
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

角色範圍（暫定）：
- `driver`：運送途中可申報異常。
- `warehouse_staff`：站內分揀/點收/交接時可申報異常。
- `customer_service`：處理異常結案（resume/cancel）。
- `admin`：查閱/管理（是否可直接結案待定）。

---

## 3. 資料模型（既有表）

### 3.1 `package_exceptions`
- 來源：`backend/migrations/0012_package_exceptions.sql`
- 重點欄位：
  - `reason_code`：建議枚舉（見第 4 章）
  - `description`：人類可讀描述（顧客追蹤可選是否顯示）
  - `reported_role`：`driver|warehouse_staff|customer_service`
  - `handled`/`handled_at`/`handling_report`

### 3.2 `package_events`
- 異常相關事件（既有）：`exception`、`exception_resolved`
- `location` 的填寫規則：節點 ID（`END_*/REG_*/HUB_*`）或 `TRUCK_*`（視角色/場景而定）

### 3.3 `delivery_tasks`
- 異常對任務的影響（暫定）：異常成立後應取消 active tasks，避免繼續派送/交接。

---

## 4. reason_code 規範（暫定）

建議值（snake_case）：
- `damaged`
- `lost`
- `delayed`
- `address_issue`
- `payment_dispute`
- `refused`
- `misroute`
- `vehicle_issue`
- `other`

待決定：
- 是否強制必填
- 是否依角色限制可用選項（例如 driver 不一定要填）

---

## 5. 事件規範（package_events）

### 5.1 建立異常
- `delivery_status = 'exception'`
- `delivery_details`：建議寫入 `description`
- `location`：依申報角色決定
- 期望 stage：`packages.status` 應落在 `exception`

### 5.2 異常解除/結案
- `delivery_status = 'exception_resolved'`
- `delivery_details`：應包含處理摘要與 action（resume/cancel）
- `location`：建議填入「處理時的站點/車輛/目的地」
- stage 回復規則：依 `location` 推導回 `warehouse_in` 或 `in_transit`（既有 trigger 方向）

---

## 6. 流程規範（待補齊）

### 6.1 申報（driver）
- 前置條件：
- 寫入：
- 對 tasks 的影響：
- 對顧客追蹤的影響：

### 6.2 申報（warehouse_staff）
- 前置條件：
- 寫入：
- 對 tasks 的影響：
- 站點綁定：`users.address`（是否一律強制）

### 6.3 查詢異常池（customer_service）
- 篩選：handled=0、日期、站點、原因、關鍵字
- 追蹤號/包裹查詢關聯

### 6.4 結案（customer_service）
- action：
  - `resume`：解除異常並允許倉儲重新派發後續 segments
  - `cancel`：取消配送（並取消 active tasks）
- 結案後的「下一步」責任分工（倉儲是否需重新分揀/派發）

---

## 7. API 契約（待補齊）

候選端點（以既有 `docs/api-contract.md` 為準，後續在此章節落地完整 request/response）：
- `POST /api/driver/packages/:packageId/exception`
- `POST /api/warehouse/packages/:packageId/exception`
- `GET /api/cs/exceptions`
- `POST /api/cs/exceptions/:exceptionId/handle`

待決定：
- `GET /api/packages/:packageId/status` 是否需要回傳 active exception（handled=0）資訊
- `dispatch-next` / 司機任務流程是否需統一在「有未結案 exception」時回 409

---

## 8. 顯示與權限（待補齊）

- 顧客追蹤頁是否顯示：
  - reason_code
  - description（是否需要脫敏/客服用語）
  - handling_report（通常不顯示）
- 站點/車輛 location 的呈現方式（REG/HUB/END/TRUCK）

---

## 9. 風險與邊界案例（待補齊）

- 多次異常：同一包裹是否允許重複申報（多筆 exceptions），或只允許一筆未結案？
- 任務競態：異常與 accept/complete 同時發生時的一致性
- location 記錄：driver 申報時如何取得可信 location

