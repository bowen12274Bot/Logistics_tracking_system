# 前端介面規範 (UI Specifications)

本文件補足 `todoList.md` 中各角色 (Driver, Warehouse, Admin, CS) 的介面需求與規範。

---

## 1. 司機端介面 (Driver UI)

### 1.1 工作清單頁面 (Task List)
- **對應 API**: `GET /api/driver/tasks`
- **功能描述**: 顯示今日分配的任務清單。
- **UI 元素**:
    - **頂部資訊列**: 顯示司機姓名、車號、今日完成進度 (e.g., 5/20)。
    - **篩選器**: 全部 / 待取件 / 待配送 / 待轉運。
    - **任務卡片列表**:
        - 顯示：地址 (From/To)、時效要求 (Overnight/Standard)、包裹數量。
        - 狀態標籤：待辦 (Pending) / 進行中 (In Progress) / 完成 (Completed)。
        - 動作按鈕：點擊卡片進入「任務詳情與導航」。

### 1.2 任務詳情與導航 (Task Detail & Nav)
- **對應 API**: `POST /api/driver/tasks/:id/status`, `GET /api/map/route`
- **功能描述**: 執行單一任務的介面。
- **UI 元素**:
    - **地圖視圖**: 顯示當前位置到目標點的路徑。
    - **資訊面板**: 詳細地址、聯絡人電話 (可點擊撥打)、備註。
    - **主要動作按鈕**:
        - 「開始任務」 (Accept/Start)
        - 「抵達目標」 (Arrive) -> 觸發抵達面板。
    - **異常回報**: 顯眼的「回報異常」按鈕。

### 1.3 抵達互動面板 (Arrival Panel)
- **對應 API**: `POST /api/driver/packages/:id/status` (含簽收/收費)
- **功能描述**: 抵達後的作業流程。
- **UI 元素**:
    - **取件模式**:
        - 核對包裹數量。
        - 確認收費 (若為現金預付)。
        - 「確認取件」按鈕。
    - **配送模式**:
        - 電子簽收板 (Canvas)。
        - `COD` (貨到付款) 金額提示與確認輸入框。
        - 「確認送達」按鈕。

---

## 2. 倉儲端介面 (Warehouse UI)

### 2.1 倉儲主控台 (Warehouse Dashboard)
- **對應 API**: `GET /api/warehouse/stats` (需新增), `GET /api/warehouse/tasks`
- **功能描述**: 倉儲人員的作業總覽。
- **UI 元素**:
    - **看板 (Kanban) / 區塊**:
        - **待入庫**: 司機已抵達但尚未掃碼入庫的包裹。
        - **待分揀/轉運**: 在站內需處理的包裹。
        - **待出庫**: 分派給司機等待裝車的包裹。
    - **掃描入口**: 顯眼的 Barcode/QR Code 掃描按鈕，用於快速觸發批次作業。

### 2.2 批次作業介面 (Batch Operations)
- **對應 API**: `POST /api/warehouse/batch-operation`
- **功能描述**: 使用條碼槍或手動輸入進行大量包裹的狀態更新。
- **UI 元素**:
    - **模式選擇**: 入庫 (Inbound) / 出庫 (Outbound) / 分揀 (Sorting)。
    - **刷讀清單**: 顯示已掃描的包裹列表。
    - **目標設定**: 
        - 出庫時選擇「目標車輛」或「下一站」。
    - **提交按鈕**: 「確認執行 (N 筆)」。

### 2.3 路徑調整介面 (Route Override)
- **對應 API**: `PATCH /api/warehouse/packages/:id/route`
- **功能描述**: 允許倉儲人員手動修改包裹的後續路徑。
- **UI 元素**:
    - **目前路徑顯示**: 顯示系統規劃的節點序列。
    - **編輯模式**: 允許拖節點或新增/刪除中途節點。
    - **原因輸入**: 必填修改原因 (e.g., 道路中斷、轉運站爆倉)。

---

## 3. 客服後台介面 (Customer Service UI)

### 3.1 異常池管理 (Exception Pool)
- **對應 API**: `GET /api/cs/exceptions`, `POST /api/cs/exceptions/:id/handle`
- **功能描述**: 處理全系統的異常包裹。
- **UI 元素**:
    - **清單視圖**: 表格顯示，包含 `Tracking No.`、`異常原因`、`申報人`、`申報時間`、`狀態 (未處理/已處理)`。
    - **篩選器**: 依原因分類、依時間。
    - **處理彈窗 (Modal)**:
        - 顯示完整異常描述與歷程。
        - 動作選擇: `Resume` (恢復配送) / `Cancel` (取消訂單)。
        - 報告輸入框: 填寫處理結果。

### 3.2 貨態查詢與修正 (Advanced Tracking)
- **對應 API**: `GET /api/tracking/search`, `POST /api/packages/:id/events`
- **功能描述**: 客服協助客戶查詢或修正狀態。
- **UI 元素**:
    - **多條件搜尋**: 支援 `Tracking No`、`客戶電話`、`訂單日期`。
    - **完整歷程視圖**: 顯示比客戶端更詳細的內部 Log (含操作者 ID)。
    - **手動新增事件**: 允許客服插入「補錄事件」(Manual Entry)，需備註原因。

### 3.3 合約審核介面
- **對應 API**: `PUT /api/admin/contract-applications/:id`
- **功能描述**: 審核企業月結申請。
- **UI 元素**:
    - **申請列表**: 待審核的申請案。
    - **詳情頁**: 顯示公司資料、統編、聯絡人。
    - **審核動作**: 核准 (設定信用額度) / 駁回 (填寫駁回原因)。

---

## 4. 管理員後台介面 (Admin UI)

### 4.1 系統總覽 (System Dashboard)
- **對應 API**: `GET /api/admin/stats` (需新增)
- **功能描述**: 高階主管/管理員查看系統運作狀況。
- **UI 元素**:
    - **關鍵指標 (KPI)**: 今日單量、異常率、營收總額。
    - **圖表**: 最近 7 日單量趨勢。
    - **即時警示**: 顯示 Critical 等級的系統錯誤。

### 4.2 使用者與權限管理
- **對應 API**: `POST /api/admin/users`, `GET /api/admin/users`
- **功能描述**: 管理員工帳號。
- **UI 元素**:
    - **員工列表**: 搜尋與列表。
    - **新增/編輯員工**: 設定角色 (Driver/Warehouse/CS/Admin) 與工作地 (Hub/Station)。
    - **帳號狀態**: 停用/啟用 / 重設密碼。

### 4.3 服務規則設定 (Service Rules)
- **功能描述**: 設定運費與服務參數 (對應 S3/S5 需求)。
- **UI 元素**:
    - **表格編輯器**: 編輯各 Box Type 與 Service Level 的基礎費率與價格係數。
    - **特定規則**: 是否啟用國際運送加價、易碎品加價設定。
