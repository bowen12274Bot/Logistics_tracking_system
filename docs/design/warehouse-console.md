# 倉儲員工作台（Warehouse Console）- 前端畫面設計規格

## 目的
- 統一倉儲員介面的資訊架構與視覺呈現，使其與既有客戶 / 客服 / 司機頁面風格一致。
- 提升現場作業的可讀性與操作效率（少滾動、少找按鈕、狀態一眼可辨）。

## 範圍（Scope）
**In scope（本次先做）**
- `frontend/src/views/EmployeeWarehouseView.vue` 的 UI 重整：頁首固定區 + 主區 Tabs + 次區（異常紀錄）。
- 清單呈現規格（欄位、狀態 badge、空狀態、錯誤/載入狀態、RWD）。
- 不改既有流程邏輯（點收 / 派發 / 申報異常的 API 呼叫與基本互動維持）。

**Out of scope（本次不做）**
- 後端 API 調整、資料欄位新增、權限/角色規則變更。
- 即時更新（WebSocket/SSE）與掃碼槍整合（可列入後續里程碑）。

## 參考基準（Baseline）
- 視覺與互動模式優先對齊「客服」的清單/處理流（列表 + 展開細節 + 主要操作列）。
- 元件沿用既有：`UiPageShell`、`UiCard`、`UiList`、`UiModal`、`UiNotice`、toast。

## 資訊架構（IA）
頁面路徑：`/employee/warehouse`

### 1) 頁首固定區（Header / Station Bar）
位置：頁面最上方，固定呈現。

內容：
- 站點資訊：`warehouse_node_id`（例如 `HUB_0`）
- 最後更新時間：`lastRefreshedAt`（前端本地時間）
- 主要操作：
  - `重新整理`（沿用 `refresh()`）
  - `查看地圖`（導到 `/map`）
  - 預留：`掃碼/輸入追蹤號`（後續）

狀態規格：
- `loading`：顯示載入提示，主要操作 disable
- `error`：使用 `UiNotice tone="error"` 顯示，保留「重新整理」可點

### 1.5) 迷你統計（Mini Stats）
位置：頁首固定區下方、主區 Tabs 上方（作為視覺與資訊的「總覽帶」）。

初版統計項目（不依賴後端新增欄位）：
- `待點收`：`awaitingReceive.length`
- `分揀中`：`sorting.length`
- `已派發`：`dispatched.length`

### 2) 主區（Main）— Tabs
目標：避免同頁三段清單互相干擾，讓作業者能「聚焦在當下工作」。

Tabs：
1. `待點收`（對應 `ui_state === "await_receive"`）
2. `分揀中`（對應 `ui_state === "sorting"`）
3. `已派發`（對應 `ui_state === "dispatched"`）

通用規格：
- 每個 Tab 有自己的「操作列」與「清單區」，清單支援空狀態。
- Tab 標籤顯示件數（例如：`待點收 (12)`）。
- 預設進入 Tab：`待點收`（可在實作時保留可調整）。

### 3) 次區（Secondary）— 異常申報紀錄
初版位置：頁面底部獨立 `UiCard`（避免打斷主區作業流）。

內容：
- 僅顯示「我提交的倉儲異常」列表（沿用 `api.getWarehouseExceptionReports()`）
- 每筆顯示：追蹤號 / 狀態（已處理/未處理）/ 時間 / 原因 / 說明

後續選項（不在本次 scope）：改為右側抽屜或獨立頁籤。

## 清單呈現規格
### 待點收（await_receive）
操作列：
- `全選/取消全選`
- `點收（N）`
- （可後續加）搜尋/掃碼定位

列（row）最小顯示欄位：
- 勾選框
- 追蹤號（`tracking_number`，fallback `id`）
- 最新狀態與時間（`latest_event.delivery_status` + `latest_event.events_at`）
- 起訖地址簡寫（`sender_address → receiver_address`）
- 次要操作：`申報異常`

### 分揀中（sorting）
呈現方式（倉儲分揀工作流）：
- 點收後的包裹進入分揀（`ui_state=sorting`）。
- 左欄：**未分揀清單**（尚未分配下一跳的包裹），支援多選。
  - 可將左欄選取的包裹「移入」右欄目前分頁（指定下一跳）。
  - 支援「自動整理分配」：依建議下一跳或平均分攤，將未分揀包裹分配到各分頁。
- 右欄：**配發地分頁（Tabs）**，每個分頁代表一個相鄰節點（`neighbors`）。
  - 分頁內容顯示「放到此區的包裹」清單（僅顯示追蹤號/識別，不顯示地址等詳細資訊）。
  - 支援「全部派發」（該分頁全部）與「單一派發」。
  - 每個包裹在分揀過程可個別：申報異常 / 單獨派發。
- 操作優化（B 方案）：左欄先勾選包裹，再點右欄的目的地分頁即可完成分配並切換檢視（不用先切分頁再回左欄勾選）。
- RWD：窄螢幕時改單欄，上方左欄清單、下方右欄分頁；分頁 tabs 支援水平捲動。

列（row）最小顯示欄位：
- 追蹤號
- receiver 地址簡寫
- 下一跳選擇（dropdown）
- 操作：`派發`、`申報異常`

### 已派發（dispatched）
列（row）最小顯示欄位：
- 追蹤號
- 時間（`latest_event.events_at`）
- 最新詳情（`latest_event.delivery_details`）
- 次要操作：`申報異常`

## Modal：申報異常
沿用既有 `UiModal`：
- 必填：原因（`reason_code`）、說明（`description`）
- 成功：toast + 關閉 modal + `refresh()`
- 失敗：modal 內顯示 `UiNotice`（`exceptionSubmitError`）

## 載入/空狀態/錯誤（UX）
- `loading`：主區顯示「載入中…」
- `error`：頁首或該區塊顯示 `UiNotice`（避免整頁跳動）
- 空狀態：每個 Tab 有明確文案（例如「目前沒有待點收包裹」）

## RWD（<= 900px）
- Header 操作列換行，按鈕維持可點尺寸。
- Tabs 置頂可水平滑動（若使用 button tab 列）。
- 清單行距加大、避免過長文字溢出（地址做截斷或換行）。

## 資料與 API 對應（不改 API）
- 站點/鄰居/包裹：`api.getWarehousePackages(limit)`
- 點收：`api.receiveWarehousePackages(package_ids)`
- 派發：`api.dispatchWarehouseNext(packageId, { toNodeId })`
- 申報異常：`api.reportWarehouseException(packageId, { reason_code, description })`
- 異常列表：`api.getWarehouseExceptionReports(limit)`

## 驗收清單（Acceptance Checklist）
- 頁首固定呈現站點與最後更新時間，`重新整理` 可用且 `busy/loading` 時有正確 disable 行為。
- 主區改為 Tabs：待點收/分揀中/已派發；每個 Tab 顯示正確件數。
- 各 Tab 空狀態、載入狀態、錯誤狀態文案一致且不破版（桌機與手機寬度）。
- 原本流程仍可完成：勾選點收、分揀選下一跳並派發、申報異常、查看異常紀錄。
- UI 視覺與其他角色頁面一致（使用既有 `Ui*` 元件與既有按鈕樣式）。

## 待確認（實作前最後定案）
- 預設 Tab 是否固定為「待點收」，或記憶上次使用的 Tab（localStorage）。
- 異常紀錄維持頁面底部（本次預設）或改成抽屜/頁籤（後續）。
