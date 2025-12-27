# 客服後台工作台（Demo）介面重設計：設計/計畫

## 1. 目標與背景

本設計文件的目標是：在**不新增領域功能**、不擴充 API 的前提下，將客服端介面整理成更像「正式後台」的工作台，用於系統演示。

- 演示假設：
  - 客服不需要依賴「完整追蹤時間軸」來判斷（系統目前也沒有提供該查詢能力）。
  - 沒有 SLA / 優先級規則。
  - 客服目前可處理的核心工作只包含：**異常結案**、**合約審核回覆**。

## 2. 設計輸入（系統內可用來設計的素材）

### 2.1 設計/規範文件（優先使用）

- UI 規範（含客服章節）：`docs/design/ui-spec.md`
  - 客服後台：異常池、合約審核（已定義 UI 規則與 API 對照）
- 客服作業手冊（操作面向）：`docs/handbook/customer-service.md`
- 功能文件（端到端與欄位建議）：
  - 客服異常池與結案：`docs/features/cs-exception-pool-and-handle.md`
  - 合約審核流程：`docs/features/review-contract-application.md`
- API 參考（欄位/錯誤碼/限制）：
  - Exceptions（客服異常池與結案）：`docs/reference/api/07-exceptions.md`
  - Review（合約審核）：`docs/reference/api/02-review.md`

### 2.2 前端可重用元件與既有樣式

（以下皆為現有資產；本次設計優先「重組與一致化」，避免引入新 UI 框架。）

- Page 容器：`frontend/src/components/ui/UiPageShell.vue`
- 卡片/提示：`frontend/src/components/ui/UiCard.vue`、`frontend/src/components/ui/UiNotice.vue`
- Modal（適合做結案/審核操作）：`frontend/src/components/ui/UiModal.vue`
- Toast（動作結果提示）：`frontend/src/components/ui/toast.ts`、`frontend/src/components/ui/UiToastHost.vue`
- 導航外殼（頂欄、角色入口）：`frontend/src/App.vue`
- i18n 框架已存在：`frontend/src/i18n/index.ts`、`frontend/src/i18n/locales/zh-TW.json`、`frontend/src/i18n/locales/en-US.json`

### 2.3 現有客服端頁面與 API 串接（作為「可用功能上限」）

- 路由與權限：
  - 客服工作台入口：`frontend/src/router/index.ts`（`/employee/customer-service`，僅 `customer_service` 可見）
- 客服 View（現況實作）：
  - `frontend/src/views/EmployeeCustomerServiceView.vue`
- 既有 API（本次設計不可超出範圍）：
  - 異常池：`GET /api/cs/exceptions?handled=...&limit=...`
  - 異常結案：`POST /api/cs/exceptions/:exceptionId/handle`
  - 合約清單：`GET /api/cs/contract-applications?status=...&limit=...`
  - 合約審核：`PUT /api/cs/contract-applications/:id`
  - 前端定義集中於：`frontend/src/services/api.ts`

## 3. 範圍（Scope / Non-goals）

### 3.1 本次要做到（只用既有能力）

- 異常池（待處理/已結案）：
  - 列表可快速辨識：原因、來源、時間、包裹識別、位置資訊（若有）
  - 結案：resume/cancel + handling_report（必填）+ resume_mode（及必要 override 欄位）
- 合約審核（待審/已審）：
  - 列表可快速辨識：公司名稱、統編、申請時間、狀態
  - 審核：approved/rejected +（選填）credit_limit、review_notes
- UI 一致化與專業感：
  - 將「列表 → 詳情 → 執行動作」整理成清楚的工作台流程
  - 錯誤/載入/空狀態一致（依 `docs/design/ui-spec.md`）
  - 文案 i18n 化（避免硬編碼散落）

### 3.2 不做（本次刻意不堆新功能）

- 不新增後端 API、不增加資料模型欄位、不加分頁/搜尋端點。
- 不新增「追蹤時間軸查詢」或任何判斷依賴事件歷史的功能。
- 不新增 SLA / 優先級 / 搶單 / 指派等工作流機制。
- 不新增「電話紀錄/聯繫紀錄」資料（即使演示很加分，也先不做）。
- 不延伸「查帳支援頁」等客服其他功能（設計文件可保留未來擴充點，但不納入本次交付）。

## 4. 介面資訊架構（IA）

本次設計建議把客服視為一個「工作台」，但仍維持現有行為：同頁面內同時處理異常與合約，並以「現在/歷史」概念切換。

### 4.1 導航入口（不改路由）

- 仍使用：`/employee/customer-service`
- 頂欄角色入口（已存在）：`frontend/src/App.vue` 的 `nav.customerService`

### 4.2 工作台分區（同一頁內）

建議把目前「混在同清單」的兩類任務視覺上分離，避免演示時認知負擔：

- 視角切換（Primary / Views）：
  - 異常：顯示待結案異常（`handled=0`）
  - 合約：顯示待審合約（`status=pending`）
  - 已處理：顯示已結案異常（`handled=1`）+ 已審合約（`status!=pending`）

> 若希望完全不改資料結構，也可保留「同清單混排」，但在 UI 上用「分組區塊」把兩類任務分段呈現；本文件偏好前者（更像正式後台）。

#### 4.2.1 分頁呈現（方案：三視角 + 清單篩選）

本次決議改採「三視角」取代「兩維度 tabs」，降低認知負擔並更符合演示敘事：

- 視角列只顯示：`異常 / 合約 / 已處理`（並顯示 count）
- 清單區提供篩選器（同頁前端篩選，不新增 API）：
  - 異常視角：可依 `reason_code` 篩選（含 `other`）
  - 已處理視角：可切換 `全部/異常/合約`，並可在顯示異常時套用 `reason_code` 篩選

視覺規則（落地約束）：

- 視角列應是單一層級（避免再次拆成多排同權重控制）。
- 「已處理」視角在右欄應預設只讀（不顯示送出按鈕），並可在右欄提供相同的「類型」切換以便快速瀏覽。

### 4.3 工作台資訊區（非任務操作）

本次決議：客服頁除了任務佇列與處理，也要提供「可演示的總覽資訊」，但**不新增 API**。

- 總覽卡（放在「左側列表」上方）：
  - 位置：放在兩欄工作台外（任務區上方），避免左欄擁擠
  - 待處理異常數、已結案異常數、待審合約數、已審合約數
  - 資料來源：同頁已載入的 exceptions/contracts 清單（見 6.1/6.2），前端計算即可
- 右欄空狀態（未選取任務時）：
  - 顯示「操作小抄」：resume/cancel 差異、handling_report 必填、常見錯誤（以人話描述）
  - 目標：演示時讓觀眾理解客服怎麼做決策與送出

## 5. 畫面結構（Wireframe / Layout）

### 5.1 推薦版型：兩欄工作台（列表 + 詳情），右欄可長單（內滾動）

本次決議：右欄可採「長單」呈現（可滾動），但避免左右擠爆，需拆出「固定區」與「內滾動區」。

- Header（頁首）
  - `UiPageShell`：顯示 eyebrow/title/lede（例如「員工 · 客服 / 客服任務工作台」）
  - 右側操作：重新整理（沿用現有 refresh）
- Body（主區）
  - 左欄：總覽卡 + 任務列表（列表列設計見 6）
  - 右欄：詳情/表單（可長單、內滾動），並保留固定 header/footer
    - 右欄 header（sticky）：標題、狀態 pill、關鍵 meta（時間/來源）
    - 右欄 body（scroll）：摘要與可編輯欄位（依任務類型）
    - 右欄 footer（sticky action bar）：主要動作（送出/取消/重設）

### 5.1.1 版面空間約束（避免左右不可用）

本次決議：為避免「任務空時左右欄高度不一致」與「左欄內容膨脹擠壓右欄」，需要明確定義容器高度與滾動責任。

- 左右欄高度一致：
  - 左右兩欄視覺上需同高（同一張工作台卡的上下緣），避免一邊短一邊長造成空洞。
  - 實作建議：外層使用 grid/flex 並 `align-stretch`，欄內用「固定區 + 可滾動區」承接高度。
- 滾動責任切分（只在欄內滾動）：
  - 左欄：總覽卡與 tabs 固定；清單區塊獨立滾動（避免整欄因清單變長而無限膨脹）。
  - 右欄：header/footer 固定；中段內容獨立滾動（長單可行，但不能把整頁撐長）。
- 左欄寬度限制：
  - 左欄固定寬度區間（例如 360–420px），不因內容變寬/變高而影響主閱讀區。

### 5.2 RWD（演示最低要求）

- 桌機：兩欄（列表/詳情）
- 小尺寸：改為單欄（列表在上、詳情在下或折疊），避免兩欄擠壓導致不可用

### 5.3 危險動作確認（B 方案）

本次決議：右欄可直接編輯與送出，但遇到「不可逆/高風險」決策需二次確認，避免誤操作。

- 異常結案 `action=cancel`：
  - 送出前跳出確認 `UiModal`
  - Modal 內容顯示摘要：tracking/package、原因、動作、handling_report（截斷）
  - 需再次按「確認取消」才送 API

### 5.4 空狀態策略（左欄/右欄）

本次決議：當任務為空時，左右欄都要「有內容」且不破壞版面高度。

- 右欄（未選取任務）：顯示操作小抄（見 4.3），讓演示時仍有可講的內容。
- 左欄（清單為空）：
  - 左欄仍顯示總覽卡與 tabs（讓觀眾知道目前是在「異常/合約」與「現在/歷史」哪個視角）。
  - 清單區塊顯示空狀態卡（取代空白）：
    - 文案：目前沒有資料（依當前 tabs 組合：例如「目前沒有待處理異常」/「目前沒有合約審核紀錄」）
    - 引導：提示可切換 tabs 或點「重新整理」
  - 目的：左欄即使沒任務，也不會看起來「空一大片」或因內容太少而高度塌陷。

## 6. 資料與呈現（以既有 API 回傳欄位為準）

### 6.1 異常（CustomerServiceExceptionRecord）

資料來源：

- `GET /api/cs/exceptions?handled=false|true&limit=...`
- 欄位建議對照：`docs/features/cs-exception-pool-and-handle.md`

列表列（最低需要）：

- 主標：`tracking_number`（若無則 fallback `package_id`）
- Tag/Pill：
  - 狀態：未結案 / 已結案（由 `handled` 或列表來源推導）
  - 原因分類：`reason_code`（前端已有對照：`frontend/src/lib/exceptionReasons`）
- 次資訊：
  - 申報來源：`reported_role`
  - 申報時間：`reported_at`

詳情區（演示可見的「看起來完整」資訊）：

- 描述：`description`
- 寄收件地：`sender_address` / `receiver_address`
- 若仍在車上：`active_vehicle_code` / `active_vehicle_node_id`
- 上次任務段：`last_canceled_from_location` → `last_canceled_to_location`

結案（右欄長單；cancel 有二次確認，見 5.3）：

- `action`：resume / cancel
- `handling_report`：必填
- resume 才顯示：
  - `resume_mode`
  - `next_hop_override`（reroute_next_hop 才需要）
  - `destination_override`（redirect_destination 才需要）

錯誤情境（演示要能說得通）：

- 409：已結案/terminal/狀態衝突 → 用 `UiNotice` 顯示可讀訊息（toast 可作輔助）
  - 既有錯誤訊息策略：`frontend/src/services/errorToast.ts`

### 6.2 合約（CustomerServiceContractApplication）

資料來源：

- `GET /api/cs/contract-applications?status=...&limit=...`
- 審核：`PUT /api/cs/contract-applications/:id`

列表列（最低需要）：

- 主標：`company_name`
- Tag/Pill：`status`（pending/approved/rejected）
- 次資訊：
  - 客戶識別：`customer.email`（或 fallback `customer.id`）
  - 統編：`tax_id`
  - 申請時間：`created_at`（歷史可用 `reviewed_at`）

詳情區：

- 公司與聯絡：`company_name`、`tax_id`、`contact_person`、`contact_phone`
- 開票地址：`billing_address`
- 客戶備註：`notes`
- 已審核時可顯示（若後端回傳）：`review_notes`、`credit_limit`、`reviewed_at`

審核（右欄長單）：

- `status`：approved/rejected
- `credit_limit`：選填（整數、>=0）
- `review_notes`：選填

## 7. 文案與 i18n（以重構為主，不新增功能）

現況：客服頁面大量硬編碼中文；但系統已導入 `vue-i18n`，也已有導航相關 key（例如 `nav.customerService`）。

本次設計建議：

- 新增/整理客服專用 key（示例命名，不強制，但應統一）：
  - `cs.title`、`cs.tabs.exceptions`、`cs.tabs.contracts`
  - `cs.scope.current`、`cs.scope.history`
  - `cs.actions.refresh`、`cs.actions.handleException`、`cs.actions.reviewContract`
  - `cs.exception.action.resume`、`cs.exception.action.cancel`
  - `cs.contract.status.pending/approved/rejected`
- 保留英文 locale 最低可用（演示可先以 zh-TW 為主，但 key 應齊全）

## 8. 驗收標準（Demo 視角）

- 觀眾能在 10 秒內理解：客服端在做「異常結案」與「合約審核」兩件事。
- 現在/歷史切換清楚，且每個列表列可一眼辨識「這筆是什麼、什麼狀態、何時發生」。
- 異常結案流程可完整演示：
  - 點一筆異常 → 開結案 modal → 填 handling_report → 送出 → 該筆消失並出現在歷史
- 合約審核流程可完整演示：
  - 點一筆 pending 合約 → 開審核 modal → 核准/拒絕 → 送出 → 狀態轉為 approved/rejected
- 載入中/失敗/空清單的狀態都有專業呈現（不破版、不閃爍、可重試）。

## 9. 落地計畫（只規劃，不在本次文件內實作）

1. 版型重組：列表/詳情兩欄 + modal 承載動作（沿用既有 API 與欄位）
2. 視覺一致化：使用現有 UI 元件（card/notice/modal/toast）統一 spacing、字級、狀態呈現
3. 文案 i18n 化：抽 key、補 zh/en 翻譯
4. 測試更新：調整 `frontend/src/__tests__/views/EmployeeCustomerServiceView.spec.ts` 以符合新結構（仍驗證核心行為與 API 呼叫）
