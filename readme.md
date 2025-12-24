# 物流追蹤系統 (Logistics Tracking System)

![CI/CD](https://github.com/bowen12274Bot/Logistics_tracking_system/workflows/CI%2FCD/badge.svg)
![Backend Tests](https://img.shields.io/badge/backend%20tests-95%20passed-brightgreen)
![Frontend](https://img.shields.io/badge/frontend-Vue%203-42b883)
![Backend](https://img.shields.io/badge/backend-Cloudflare%20Workers-f38020)

一個基於 Cloudflare Workers 與 Vue 3 的前後端分離物流追蹤系統專案。

---

## 📚 文件索引

| 文件 | 說明 |
|------|------|
| [API 契約文件](docs/api-contract.md) | API 契約索引（分頁參考入口） |
| [文件導覽](docs/README.md) | `docs/` 目錄導覽入口（分層閱讀） |
| [系統概觀](docs/architecture/overview.md) | 系統核心概念與責任邊界（概念層） |
| [異常模組](docs/modules/exceptions.md) | 異常申報/異常池/結案與 location 規則（規則層） |
| [資料庫結構](docs/database-schema.md) | 資料庫表格與欄位定義 |
| [測試計畫](docs/guides/vitest-plan.md) | Vitest 測試案例規劃 |
| [開發環境設定](docs/guides/getting-started.md) | 詳細的開發環境設定指南 |
| [測試指南](docs/guides/testing-guide.md) | 測試執行與報告說明 |
| [CI/CD 設定指南](docs/guides/ci-cd-guide.md) | GitHub Actions 與 Cloudflare 部署設定 |
| [貢獻指南](docs/guides/contributing.md) | 協作規範與 PR 流程 |

---

## 🤝 協作規範 (Collaboration Guidelines)

雖然這只是一個小小的期末專案，但為了讓開發順利，建議大家嘗試遵守以下流程：

1. **開新分支 (Branch)**：當你要做一個新功能時，請先開一個新的分支 (branch)，不要直接在 main/master 上改。
2. **多 Commit 與寫清楚敘述**：盡可能多 commit，並寫清楚 commit message，這樣大家才看得懂你改了什麼。
3. **禁止 Force Push**：推送時請**不要**使用 `-f` (force push)，這會讓 commit 歷史全部消失，造成災難。
4. **使用 Pull Request (PR)**：如果可行的話，請使用 Pull Request 合併代碼，而非直接 push 上去，這樣才能強制大家幫你 Code Review。

> **備註**：當然，如果你覺得太麻煩，以上規則也可以適度放寬，畢竟目標是把專案做出來！🚀

---

## 📂 專案結構 (Project Structure)

此專案採用前後端分離架構 (Monorepo)，以下為實際檔案結構：

```text
logistics-system/               # Repo 根目錄
│  .gitignore                    # Git 忽略檔案設定
│  readme.md                     # 本文件
│  todoList.md                   # 待辦事項清單
│
├─.github/                       # GitHub Actions / PR 設定
│  └─workflows/                  # CI/CD workflows（自動測試/部署）
│
├─backend/                       # [後端] Cloudflare Workers + Hono + Chanfana
│  │  README.md                  # 後端文件與 API 列表
│  │  wrangler.jsonc             # Workers 設定檔（JSONC）
│  │  wrangler.toml              # Workers 設定檔（TOML）
│  │  worker-configuration.d.ts  # wrangler types 產生的型別
│  │  package.json               # 依賴套件設定
│  │  package-lock.json          # 依賴鎖檔
│  │  tsconfig.json              # TS 設定
│  │  vitest.config.ts           # Vitest 測試設定
│  │  apply_migrations.py        # 資料庫遷移腳本 (Python)
│  │
│  ├─migrations/                 # [資料庫模型]
│  │      0000_users.sql                 # users（使用者表）
│  │      0001_packages.sql              # packages（包裹主檔）
│  │      0002_package_events.sql        # package_events（貨態事件）
│  │      0003_payments.sql              # payments（費用/付款）
│  │      0004_monthly_billing.sql       # monthly_billing（月結帳單主檔）
│  │      0005_monthly_billing_items.sql # monthly_billing_items（帳單明細）
│  │      0006_virtual_map_schema.sql    # nodes/edges schema（虛擬地圖）
│  │      0007_virtual_map_seed.sql      # nodes/edges seed（虛擬地圖資料）
│  │      0008_contract_applications.sql # contract_applications（合約申請）
│  │      0009_tokens.sql                # tokens（登入 token）
│  │      0010_system_errors.sql         # system_errors（系統錯誤/紀錄）
│  │      0011_seed_test_users.sql       # 測試帳號/員工配置 seed
│  │      0012_package_exceptions.sql    # package_exceptions（異常池）
│  │      0013_delivery_tasks.sql        # delivery_tasks（司機任務）
│  │      0014_vehicles.sql              # vehicles（車輛/位置）
│  │
│  └─src/                        # 後端程式碼（Worker source）
│      │  index.ts               # API 路由註冊（OpenAPI）
│      │  types.ts               # OpenAPI schema 與共用型別
│      │  index.test.ts          # 主要整合測試
│      │
│      ├─endpoints/              # [API 端點 (Endpoints)]
│      │      authMe.ts                    # GET /api/auth/me
│      │      packageCreate.ts             # POST /api/packages
│      │      packageStatusQuery.ts        # GET /api/packages/:id/status、GET /api/packages
│      │      packageEventCreate.ts        # POST /api/packages/:id/events
│      │      packageEstimate.ts           # POST /api/packages/estimate
│      │      trackingPublic.ts            # GET /api/tracking/:trackingNumber
│      │      trackingSearch.ts            # GET /api/tracking/search（員工用）
│      │      mapFetch.ts                  # GET /api/map
│      │      mapRoute.ts                  # GET /api/map/route
│      │      mapUpdate.ts                 # PUT /api/map/edges/:id（admin）
│      │      driverTasks.ts               # 司機工作清單/貨態更新
│      │      warehouseOperations.ts       # 倉儲批次入庫/出庫/分揀
│      │      billingBills.ts              # 帳單查詢（合約/月結）
│      │      billingPayments.ts           # 付款與付款紀錄
│      │      contractApplicationCreate.ts # 合約申請建立（客戶）
│      │      contractApplicationStatus.ts # 合約申請查詢狀態（客戶）
│      │      adminUsers.ts                # 員工帳號管理（admin）
│      │      adminContracts.ts            # 合約審核（admin/cs）
│      │      adminErrors.ts               # 系統錯誤查詢（admin）
│      │      billingAdmin.ts              # 月結帳單管理（admin）
│      │      billingCycle.ts              # 月循環結算（admin）
│      │      customerUpdate.ts            # 客戶資料更新
│      │      customerExists.ts            # 客戶查詢（輔助）
│      │      task*.ts                     # 範例任務 API（示範用）
│      │
│      └─__tests__/              # [單元/整合測試]
│              helpers.ts              # 測試共用 helper（建立使用者/包裹/取得 token）
│              auth.test.ts            # Auth 測試（register/login/me）
│              packages.test.ts        # 包裹測試（create/list/status/events）
│              tracking.test.ts        # 追蹤測試（public/search）
│              map.test.ts             # 地圖測試（fetch/route/update edge）
│              billing.test.ts         # 計費測試（bills/payments）
│              admin.test.ts           # 管理端測試（users/contracts/errors）
│              customer.test.ts        # 客戶模組測試（profile/contract）
│              staff.test.ts           # 員工權限測試（driver/warehouse）
│
├─frontend/                      # [前端] Vue 3 + Vite + Pinia
│  │  README.md                  # 前端文件
│  │  index.html                 # 入口 HTML
│  │  vite.config.ts             # Vite 設定檔
│  │  vitest.config.ts           # Vitest 設定
│  │  package.json               # 依賴套件設定
│  │  package-lock.json          # 依賴鎖檔
│  │
│  ├─public/                     # 靜態資源（favicon 等）
│  └─src/                        # 前端程式碼（Vue source）
│      │  main.ts                # 應用程式入口
│      │  App.vue                # 根組件 (Root Component)
│      │
│      ├─assets/                 # 全域樣式/圖片
│      ├─components/             # 可重用組件 (Reusable Components)
│      ├─router/                 # 路由定義（含權限守門員）
│      ├─services/               # API 呼叫封裝
│      ├─stores/                 # Pinia stores
│      │      auth.ts                # 登入狀態與 token 管理
│      │      packages.ts            # 包裹查詢/建立等狀態
│      │      counter.ts             # 範例 store（Vue/Vite 模板）
│      ├─types/                  # 前端型別
│      └─views/                  # 頁面視圖 (Page Views)
│              HomeView.vue                  # 首頁
│              LoginView.vue                 # 登入
│              VirtualMapView.vue            # 虛擬地圖展示/模擬
│              DriverMapView.vue             # 司機地圖（路線/車輛位置）
│              CustomerDashboard.vue         # 客戶主控台
│              CustomerTrackView.vue         # 包裹追蹤
│              PublicTrackView.vue           # 公開查詢（免登入）
│              CustomerSendView.vue          # 建立寄件
│              CustomerPaymentView.vue       # 付款/帳單（客戶）
│              CustomerContractView.vue      # 合約/月結申請
│              CustomerProfileView.vue       # 客戶資料
│              ShippingEstimateView.vue      # 運費試算（頁面）
│              EmployeeDriverView.vue        # 司機端（工作清單/操作）
│              EmployeeWarehouseView.vue     # 倉儲端（入庫/分揀/轉運）
│              EmployeeCustomerServiceView.vue # 客服端（查詢/異常池）
│              AdminView.vue                 # 管理員後台
│              AboutView.vue                 # 範例頁（Vue/Vite 模板）
│
├─docs/                          # [文件 (Documentation)]
│      api-contract.md           # 後端 API 契約（含規劃中端點）
│      database-schema.md        # 資料庫 schema（含規劃中資料表）
│      guides/                   # 開發/測試/部署/協作指南
│      ├─ getting-started.md     # 開發環境設定
│      ├─ testing-guide.md       # 測試指南
│      ├─ vitest-plan.md         # 測試案例規劃
│      ├─ ci-cd-guide.md         # CI/CD 說明
│      └─ contributing.md        # 貢獻指南/協作規範
│
├─UML/                           # 設計文件 (Design Documents)
│      TermProject114.md         # 需求/說明文件（原始資料）
│      使用者案例圖.puml/png     # Use Case Diagram
│      類別圖.puml/png           # Class Diagram
│      系統架構圖.puml/png       # System Architecture Diagram
│
└─Util/                          # 工具程式 (Utilities)
    └─virtual_map_generator/     # 虛擬地圖產生器
            generator.py         # 地圖生成器 (Python)
```

---

## Remote D1 操作（--remote）

> 注意：`--remote` 會操作線上的 Cloudflare D1，執行期間 DB 可能短暫不可用；請確認你正在操作正確的資料庫。

### 套用 migrations（不清空資料）

在 `backend/` 目錄下執行：

- `npx wrangler d1 migrations apply DB --remote`

### 手動重設 Remote DB（清空 + 重建）

在 repo 根目錄執行（Windows PowerShell）：

- `powershell -NoProfile -ExecutionPolicy Bypass -File ".\backend\scripts\reset-remote-db.ps1" -Yes`

### 只清空 Remote DB（讓 GitHub Actions 之後自動重建）

本 repo 的 GitHub Actions 會在部署時跑 `npx wrangler d1 migrations apply DB --remote`。
如果你想「先手動清空 remote，push 之後讓 action 自動建新表」，需要同時清掉 D1 的 migration 記錄表，否則 action 可能會以為 migration 已跑過而跳過。

在 VSCode 終端機直接貼下面這行（Windows PowerShell / CMD 都可）：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\backend\scripts\reset-remote-db.ps1" -Yes -DropOnly
```

（如果你的 D1 binding 不是 `DB`，可以加 `-DatabaseBinding <你的binding>`；若要指定 wrangler 設定檔可加 `-ConfigPath backend/wrangler.jsonc`）

---

## 🧹 本地資料庫清空/重建（D1 --local）

本專案後端在本地開發時，D1 會落地成 sqlite 檔案在：
`backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`

### 清空本地 DB（刪除 sqlite）

1. 先停止本地 worker（避免檔案被鎖定）
   - `npm --prefix backend run dev:clean`
   - 或：`powershell -NoProfile -ExecutionPolicy Bypass -File backend/scripts/stop-local-workers.ps1 -Port 8787`
2. 刪除本地 sqlite 檔
   - `Remove-Item -Force backend\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\*.sqlite`

### 清空 + 重建本地 DB（重新套用 migrations）

在做完「清空本地 DB」後，執行：

- `cd backend`
- `npx wrangler d1 migrations apply DB --local`

---

## 🛠️ 技術細節 (Tech Stack Details)

| 層級 | 技術 | 說明 |
|------|------|------|
| **後端框架 (Backend)** | Hono + Chanfana | 輕量 Web 框架，自動生成 OpenAPI 3.1 文件 |
| **資料庫 (Database)** | Cloudflare D1 | 基於 SQLite 的邊緣資料庫 (Edge Database) |
| **認證 (Authentication)** | Token Based | 自刻驗證，密碼使用 SHA-256 雜湊 |
| **前端框架 (Frontend)** | Vue 3 + Vite | 現代化前端建構工具 |
| **狀態管理 (State)** | Pinia | Vue 官方推薦的狀態管理方案 |
| **路由 (Routing)** | Vue Router | 含 Navigation Guards 實作 RBAC 權限控制 |
| **測試 (Testing)** | Vitest | 支援 Cloudflare Workers 環境的測試框架 |

---

## 🚀 快速開始 (Quick Start)

### 1. 安裝依賴 (Install Dependencies)

```powershell
# 後端（終端機 1）
cd backend
npm install   # 或 npm ci
cd ..

# 前端（終端機 2）
cd frontend
npm install   # 或 npm ci
```

### 2. 初始化資料庫 (Initialize Database)

```powershell
cd backend

# 產生 Type 定義
npm run cf-typegen

# 套用資料庫遷移 (Migrations) 到本地模擬器
npx wrangler d1 migrations apply DB --local
```

### 3. 啟動開發伺服器 (Start Development Server)

```powershell
# 後端（終端機 1）
cd backend
npm run dev
# 啟動後開啟 http://localhost:8787/ 可看到 Swagger UI

# 前端（終端機 2）
cd frontend
npm run dev
# 啟動後開啟 http://localhost:5173/ 瀏覽網頁
```

### 4. 執行測試 (Run Tests)

```powershell
# 後端測試
cd backend
npm test

# 前端測試
cd frontend
npm run test:unit
```

---

## 🗺️ 虛擬地圖定義 (Virtual Map)

本系統使用虛擬地圖模擬物流路網，由 `Util/virtual_map_generator/generator.py` 生成。

### 節點層級 (Node Levels)

地圖包含 3 種層級的節點，模擬真實世界的物流中心結構：

1.  **HUB (配送中心)**
    -   數量: 6
    -   功能: 全域樞紐，連接所有區域。
    -   速度係數: 0.5 (最快，數值越小代表移動成本越低/速度越快)
    -   間距: ~2000
2.  **REG (配送站)**
    -   數量: 27
    -   功能: 連接 HUB 與大量 END。
    -   速度係數: 1.0 (幹線運輸)
    -   間距: ~1500
3.  **END (住家/超商)**
    -   數量: 100
    -   功能: 模擬詳細地址或代收點。
    -   速度係數: 5.0 (市區慢速配送)
    -   間距: ~300

- 💡 速度係數 (Speed Factor)：數值越小代表移動成本越低/速度越快
- 💡 節點數量 (Count)：數量是地圖上最多可能的節點數量，實際生成會嘗試在地圖找可以生成的點位，如果找不到就有可能不生成。

地圖數據儲存於 `nodes` 與 `edges` 資料表中 (參見 `backend/migrations/0006_virtual_map_schema.sql`、`backend/migrations/0007_virtual_map_seed.sql`)：

-   **nodes**: 節點資訊
    -   `id` (TEXT): 節點唯一識別碼
    -   `name` (TEXT): 節點名稱 (如 `HUB_0`, `REG_5`)
    -   `level` (INTEGER): 層級 (1-3)
    -   `subtype` (TEXT): 終端節點類型（僅 END 使用：`home` 住家、`store` 超商；其他層為 NULL）
    -   `x` (INTEGER), `y` (INTEGER): 座標位置

-   **edges**: 路徑資訊 (雙向)
    -   `id` (INTEGER PRIMARY KEY): 路徑 ID
    -   `source` (TEXT), `target` (TEXT): 連接的節點 ID
    -   `distance` (REAL): 兩點間距離
    -   `road_multiple` (INTEGER): 道路權重係數 (通常取決於兩端點中較低級別者的速度係數)
    -   `cost` (INTEGER): 運輸成本 (`distance * road_multiple`)

### 資料庫結構 (Database Schema)

核心資料表包含 `users`、`packages`、`package_events`、`payments`、`nodes`、`edges` 等；並規劃新增：

- `package_exceptions`：客服異常池（未處理/已處理 + 處理報告）
- `delivery_tasks`：司機工作清單/任務狀態
- `vehicles`：司機住家起點、車輛編號、目前節點（支援地圖移動）

詳細說明請參考 [資料庫結構文件](docs/database-schema.md)。

---

## 👥 使用者角色 (User Roles)

| 角色 | user_type | user_class | 說明 |
|------|-----------|------------|------|
| 非合約客戶 | customer | non_contract_customer | 一般寄件/收件客戶 |
| 合約客戶 | customer | contract_customer | 月結客戶 |
| 客服人員 | employee | customer_service | 處理客戶問題、更新貨態 |
| 倉儲人員 | employee | warehouse_staff | 入庫/出庫/分揀 |
| 駕駛員 | employee | driver | 取件/配送 |
| 管理員 | employee | admin | 系統管理 |

### 角色工作流程（規劃中）

- 客服：異常池檢視未處理/已處理，將未處理標示為已處理並填寫處理報告
- 司機：取得工作清單、可在地圖點選相鄰節點移動、取件/送達含到付收款、貨態更新、異常申報
- 倉儲：入站後設為分揀轉運處理 → 完成後設為待貨車轉運、可調整後續配送路徑、貨態更新、異常申報

---

## 📦 預設帳號 (Default Accounts)

系統已內建以下測試帳號（請依下表使用對應密碼）：

| 帳號 | 角色 |
|------|------|
| noncontract@example.com | 非合約客戶 |
| cust@example.com | 合約客戶 |
| driver_hub_0@example.com | 駕駛員 |
| warehouse_hub_0@example.com | 倉儲人員 |
| cs@example.com | 客服人員 |
| admin@example.com | 管理員 |

員工帳號的 `address` 代表工作地（地圖節點 ID）：`driver/admin/cs/warehouse` 預設為 `HUB_0`。

另會依地圖自動補齊測試員工（見 `backend/migrations/0011_seed_test_users.sql`）：
- 其他配送中心司機：`driver_hub_1@example.com`（規則：`driver_<hubId>@example.com`），密碼 `driver123`
- 其他配送中心倉儲：`warehouse_hub_1@example.com`（規則：`warehouse_<hubId>@example.com`），密碼 `warehouse123`
- 其他配送站倉儲：`warehouse_reg_1@example.com`（規則：`warehouse_<regId>@example.com`），密碼 `warehouse123`

---

## 📝 版本歷史 (Version History)

| 版本 | 日期 | 說明 |
|------|------|------|
| 1.0 | 2025-12 | 初版：基本架構與核心功能 |
