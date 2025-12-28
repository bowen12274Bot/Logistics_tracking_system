# 司機端入口面板 + 地圖工作面板（設計/計畫）

本文件聚焦「司機端 UI」的資訊架構與互動流程（**入口 `/employee/driver` → 執行 `/driver/map`**），並把既有的**搶單/交接（handoff）**、**車輛/車上包裹**、**異常申報紀錄**、**到站後收款/取卸貨**整理成可落地的介面規格。

> 規則權威來源：`docs/modules/operations.md`、`docs/modules/payments.md`、`docs/features/driver-task-lifecycle.md`
>
> API 參考：`docs/reference/api/08-operations-tasks.md`、`docs/reference/api/05-payments.md`、`docs/reference/api/07-exceptions.md`

---

## 1. 目標與背景

### 1.1 目標

- 讓司機「一進來不迷路」：先進 `/employee/driver` 看懂現在要做什麼，再去 `/driver/map` 移動與執行任務。
- 讓司機「到站後不做錯順序」：把收款門檻、取件/卸貨門檻、異常封鎖門檻清楚呈現並防呆。
- 讓搶單（handoff）不突兀：清楚顯示「為什麼現在有可接手任務」、「在哪個節點才會出現」、「接手失敗怎麼辦」。
- 桌機演示為主，手機可用：面板資訊密度可調整、操作按鈕更大、地圖仍可互動。

### 1.2 非目標（本次刻意不做）

- 不新增後端 API / DB 欄位；以既有能力重組 UI（若需新增，列入「待確認」）。
- 不新增派單/優先級/排班等工作流（司機只做 assigned + handoff）。
- 不做完整追蹤時間軸（客戶追蹤已存在；司機端以任務/車上狀態為主）。

---

## 2. 設計輸入（可用素材）

### 2.1 既有頁面與路由（現況）

- 入口（司機工作看板）：`/employee/driver` → `frontend/src/views/EmployeeDriverView.vue`
- 地圖（司機移動 + 抵達面板）：`/driver/map` → `frontend/src/views/DriverMapView.vue`
- 路由權限：`frontend/src/router/index.ts`

### 2.2 既有 API（不可超出範圍）

- 任務清單：
  - assigned：`GET /api/driver/tasks?scope=assigned`
  - handoff（可搶/可接手）：`GET /api/driver/tasks?scope=handoff`（回應含 `node_id`）
- 接手（handoff）：`POST /api/driver/tasks/:taskId/accept`
- 任務動作：`POST /api/driver/tasks/:taskId/enroute|arrive|pickup|dropoff|complete`
- 車輛與車上包裹：`GET /api/vehicles/me`、`GET /api/vehicles/me/cargo`
- 現金收款：`POST /api/driver/packages/:packageId/collect-cash`
- 司機異常申報/查詢：
  - 申報：`POST /api/driver/packages/:packageId/exception`
  - 查詢：`GET /api/driver/exceptions`

（定義集中：`frontend/src/services/api.ts`）

### 2.3 既有 UI 規範（優先使用）

- Driver 章節（任務清單/詳情/到站面板/異常回報）：`docs/design/ui-spec.md`
- 地圖設計備忘：`docs/design/driver-map.md`

---

## 3. 使用者流程（司機心智模型）

### 3.1 三段式流程（主軸）

1. **找任務**（`/employee/driver`）
   - 看「待做任務」是否存在（assigned）
   - 看「此節點是否可搶單」（handoff，與車輛 `current_node_id` 綁定）
2. **出發導航**（`/driver/map`）
   - 選任務後：高亮路徑、聚焦目標節點、顯示「下一站」與注意事項（收款/客服指示）
3. **到站操作**（`/driver/map` 的抵達面板）
   - 到站（arrive）→ 必要時收款（collect-cash）→ 取件/卸貨（pickup/dropoff）
   - 若遇到問題：申報異常（exception）

### 3.2 搶單（handoff）插入點

- 搶單不是獨立流程；它是「到站後」可能出現的選項：
  - 司機在 `HUB_*` / `REG_*` 節點，且車輛 `current_node_id` 正確時，才會在 handoff 池看到可接手任務。
  - 搶單成功後：該任務進入 assigned，司機可立刻「出發」或稍後處理。

---

## 4. 資訊架構（IA）

### 4.1 `/employee/driver`（入口面板 / 決策頁）

**定位**：讓司機快速回答三個問題：「我在哪裡？我車上有什麼？我現在要做什麼？」

建議分區（同頁卡片化即可，不要求左右欄）：

1. **我的狀態（固定顯示）**
   - 貨車資訊：`vehicle_code`、`current_node_id`、`home_node_id`
   - 快捷操作：
     - `前往地圖`（不帶任務 → 讓司機自由探索/移動）
     - `前往下一站`（帶任務 → 直接聚焦導航目標，見 5.2）

2. **我的任務（assigned）**
   - 預設 tab：`待做/進行中`（以後端回傳的 `pending/accepted/in_progress` 為主）
   - 每張任務卡：提供單一主 CTA `出發`（導去 `/driver/map`）

3. **可搶任務（handoff）**
   - 入口必須顯示「此功能只在 HUB/REG 節點出現」
   - 若 `node_id=null`：顯示「車輛尚未設定/指派，請聯絡管理員」（來自 `docs/design/ui-spec.md`）
   - 每張任務卡：主 CTA `接手`（`POST /accept`），成功後刷新並引導「出發」

4. **我的貨車（車上包裹 / cargo）**
   - 顯示車上件數、異常件標記
   - 點任一包裹可「跳到地圖」並聚焦下一個相關節點（若可推導）

5. **異常申報紀錄**
   - 顯示待處理/已處理，並可依最近時間排序
   - 目標是「知道有沒有卡住的包裹」，不是做客服的結案

> 注意：入口面板不應承擔太多操作；「取/卸/收款/到站」都留在地圖的抵達面板完成。

### 4.2 `/driver/map`（地圖頁 / 執行頁）

**定位**：地圖是主體；工作面板（抵達面板）是「現在能按什麼」的入口。

- 地圖主區：
  - 顯示節點/相鄰邊、司機貨車位置（已存在）
  - 任務路徑高亮（`GET /api/map/route?from&to`；既有設計備忘）
- 工作面板（建議右側抽屜；手機改 bottom sheet）：
  - Header：目前節點、車號、最後更新時間、刷新/關閉
  - 兩種狀態（可用同一面板的切換）：
    - **導航中**：顯示目標節點、路徑 chips、下一站提示、客服指示、收款提示
    - **已到站**：顯示到站後可執行動作（arrive/collect-cash/pickup/dropoff/exception）

建議 tabs（桌機/手機皆一致，依狀態顯示 badge）：

- `此節點可執行`：取件/卸貨/到站/收款/異常
- `可搶（此節點）`：handoff 任務池（若 `HUB/REG` 且 `node_id` 有值）
- `車上（運送中）`：車上包裹清單、未卸貨段落提示
- `異常`：司機已申報異常清單（只讀）

---

## 5. 任務卡片規格（最小欄位）

### 5.1 任務卡（assigned / handoff 共用）

最少顯示：

- `tracking_number`（或 fallback `package_id`）
- `task_type`（pickup/deliver）+ `segment_index`
- `from_location → to_location`
- `status`
- 金流提示（至少其一）：
  - `payment_type`（prepaid/cod）
  - `paid_at`（是否已付款）
  - `payment_amount`（需收金額，若有）
- `instructions`（若有，顯示一行即可）

CTA（依列表類型）：

- assigned：`出發`
- handoff：`接手`

### 5.2 「出發」導向規則（決定 focus 目標）

目的：避免司機進地圖後不知道要去哪。

建議規則（前端可用既有欄位推導）：

- 若任務 `status` 是 `pending/accepted`：focus `from_location`（先去起點）
- 若任務 `status` 是 `in_progress`：focus `to_location`（先去終點）
- 若無法推導（欄位缺失）：仍可導到地圖，但面板顯示「請先選擇節點或任務」

導頁方式：

- `/driver/map?taskId=<id>&focus=<nodeId>`（query 只是 UI 提示，不是權威）

---

## 6. 抵達面板（到站後操作的具體呈現）

### 6.1 面板主結構（已到站）

1. **摘要區（固定）**
   - 包裹/任務識別：追蹤碼、任務類型、from/to
   - 收款提示：是否需收款、金額、付款方式（現金/非現金）
   - 客服指示（若有，顯示在摘要下方）

2. **流程區（依門檻顯示）**
   - Step A：`已到達`（`POST /api/driver/tasks/:taskId/arrive`）
   - Step B：`收現`（若符合收款窗口與條件；`POST /collect-cash`）
   - Step C：`取件上車`（pickup）或 `卸貨完成`（dropoff）

3. **其他動作**
   - `申報異常`（常駐次要按鈕）

### 6.2 必要的門檻提示（UI 必須說人話）

依 `docs/design/ui-spec.md` + `docs/features/driver-task-lifecycle.md`：

- 預付現金到府取件：必須先到站（arrived_pickup）才能收現；且未付款不可取件（pickup 會 409）。
- 到府 COD：必須先到站（arrived_delivery）才能收現；且未收現不可完成 delivered（dropoff 會 409）。
- 門市 COD：通常司機不收現（若收現會 409；以 `docs/modules/payments.md` 為準）。
- active exception：任務操作會被封鎖（409），需先由客服結案。

> 建議：每個按鈕旁都顯示「為什麼不能按」的短提示（例如：需先到站/需先收款/包裹不在車上）。

---

## 7. 搶單（handoff）規則摘要與 UI 對應

### 7.1 handoff 何時會出現

- 透過 `GET /api/driver/tasks?scope=handoff` 拉取
- 後端回應 `node_id`（車輛 `current_node_id`）
- 條件摘要（後端強制）：
  - 司機車輛必須有 `current_node_id`
  - `current_node_id` 必須等於任務 `from_location`
  - `from_location` 必須是 `HUB_*` / `REG_*`
  - 任務狀態 `pending/accepted`
  - 包裹非 terminal、無 active exception

### 7.2 接手失敗（409）要怎麼提示

接手 API：`POST /api/driver/tasks/:taskId/accept`

建議前端把 409 依錯誤訊息分流為可理解的提示：

- `Vehicle has no current node` / `node_id=null`：車輛尚未指派/無節點
- `Not at task start node`：你不在起點節點（需移動車輛到 `from_location`）
- `Handoff not allowed from this node`：此節點不允許交接（非 HUB/REG）
- `Task not eligible for handoff` / `conflict`：已被其他司機接走或狀態已改變（刷新列表）
- `Package has active exception`：包裹有異常，需先由客服結案
- `Package is terminal`：包裹已結案

---

## 8. 桌機 vs 手機（版面策略）

### 8.1 桌機（演示主場）

- 地圖 + 右側工作面板（抽屜）同時可見
- 重要資訊（下一站/可執行/可搶數量）放在面板 header 區

### 8.2 手機（可用，不追求一次看完）

- 工作面板改為 bottom sheet（半屏/全屏切換）
- 面板預設停在「此節點可執行」或「導航中」摘要，避免資訊太密
- 大按鈕、少文字；任務細節改為展開

---

## 9. 待確認（寫設計前先定掉的點）

- 任務「導航目標」是否以 `task.status` 作為唯一依據（pending/accepted→from，in_progress→to），或需額外判斷（例如包裹是否已在車上）。
- 手機 bottom sheet 的互動（拖曳/固定高度）是否要做成共用元件（目前 UI 元件庫是否已有）。
- 「車上包裹」在地圖面板是否需要額外顯示「下一站建議」（需推導或新增 API；本次先不做推導也可）。

