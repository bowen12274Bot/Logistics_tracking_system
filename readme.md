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
| [API 契約文件](docs/api-contract.md) | 完整的後端 API 規格說明 |
| [資料庫結構](docs/database-schema.md) | 資料庫表格與欄位定義 |
| [測試計畫](docs/vitest-plan.md) | Vitest 測試案例規劃 |
| [開發環境設定](docs/getting-started.md) | 詳細的開發環境設定指南 |
| [測試指南](docs/testing-guide.md) | 測試執行與報告說明 |
| [CI/CD 設定指南](docs/ci-cd-guide.md) | GitHub Actions 與 Cloudflare 部署設定 |
| [貢獻指南](docs/contributing.md) | 協作規範與 PR 流程 |

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
Logistics_tracking_system/
│  .gitignore                    # Git 忽略檔案設定
│  readme.md                     # 本文件
│  todoList.md                   # 待辦事項清單
│
├─backend/                       # [後端] Cloudflare Workers + Hono + Chanfana
│  │  wrangler.jsonc             # Workers 設定檔
│  │  package.json               # 依賴套件設定
│  │  vitest.config.ts           # Vitest 測試設定
│  │  apply_migrations.py        # 資料庫遷移腳本 (Python)
│  │
│  ├─migrations/                 # [資料庫遷移 (Database Migrations)]
│  │      0000_users.sql         # 使用者表 (users)
│  │      0001_packages.sql      # 包裹表 (packages)
│  │      0002_package_events.sql    # 物流事件 (package_events)
│  │      0003_payments.sql      # 支付紀錄 (payments)
│  │      0004_monthly_billing.sql   # 月結帳單 (monthly_billing)
│  │      0005_monthly_billing_items.sql  # 帳單細項
│  │      0006_virtual_map.sql   # 虛擬地圖數據 (nodes/edges)
│  │      0007-0012_*.sql        # 其他欄位新增與表格建立
│  │
│  └─src/
│      │  index.ts               # [入口] App 初始化、認證 (Auth)、CORS
│      │  index.test.ts          # 主要整合測試
│      │  types.ts               # 型別定義 (Type Definitions)
│      │
│      ├─endpoints/              # [API 端點 (Endpoints)]
│      │      adminContracts.ts      # 合約審核 API
│      │      adminErrors.ts         # 系統錯誤查詢 API
│      │      adminUsers.ts          # 員工帳號管理 API
│      │      authMe.ts              # 當前使用者 API
│      │      billingBills.ts        # 帳單查詢 API
│      │      billingPayments.ts     # 付款 API
│      │      contractApplication.ts # 合約申請 API
│      │      customerUpdate.ts      # 客戶資料更新 API
│      │      driverTasks.ts         # 駕駛員任務 API
│      │      mapFetch.ts            # 地圖查詢 API
│      │      mapRoute.ts            # 路線計算 API
│      │      mapUpdate.ts           # 地圖更新 API
│      │      packageCreate.ts       # 建立包裹 API
│      │      packageEstimate.ts     # 運費試算 API
│      │      packageEventCreate.ts  # 貨態事件 API
│      │      packageStatusQuery.ts  # 包裹狀態查詢 API
│      │      trackingPublic.ts      # 公開追蹤 API
│      │      trackingSearch.ts      # 進階追蹤搜尋 API
│      │      warehouseOperations.ts # 倉儲操作 API
│      │      task*.ts               # 範例任務 API
│      │
│      └─__tests__/              # [單元測試 (Unit Tests)]
│              helpers.ts            # 測試輔助函式
│              auth.test.ts          # 認證測試
│              packages.test.ts      # 包裹測試
│              tracking.test.ts      # 追蹤測試
│              map.test.ts           # 地圖測試
│              billing.test.ts       # 帳單測試
│              admin.test.ts         # 管理員測試
│              customer.test.ts      # 客戶測試
│              staff.test.ts         # 員工測試
│
├─frontend/                      # [前端] Vue 3 + Vite + Pinia
│  │  vite.config.ts             # Vite 設定檔
│  │  package.json               # 依賴套件設定
│  │
│  └─src/
│      │  main.ts                # 應用程式入口
│      │  App.vue                # 根組件 (Root Component)
│      │
│      ├─router/
│      │      index.ts           # 路由定義 (含權限守門員 Navigation Guards)
│      │
│      ├─stores/
│      │      auth.ts            # Pinia 認證狀態 (Auth Store)
│      │
│      ├─services/
│      │      api.ts             # API 呼叫封裝
│      │
│      ├─components/             # 可重用組件 (Reusable Components)
│      │
│      └─views/                  # 頁面視圖 (Page Views)
│              LoginView.vue         # 登入頁
│              HomeView.vue          # 首頁
│              AdminView.vue         # 管理員頁面
│              CustomerDashboard.vue     # 客戶主控台
│              CustomerTrackView.vue     # 包裹追蹤
│              CustomerSendView.vue      # 寄件建立
│              CustomerPaymentView.vue   # 付款頁面
│              CustomerContractView.vue  # 合約申請
│              CustomerScheduleView.vue  # 排程取件
│              EmployeeDriverView.vue        # 駕駛員頁面
│              EmployeeWarehouseView.vue     # 倉儲人員頁面
│              EmployeeCustomerServiceView.vue   # 客服頁面
│
├─docs/                          # [文件 (Documentation)]
│      api-contract.md           # API 契約文件
│      database-schema.md        # 資料庫結構說明
│      vitest-plan.md            # 測試計畫
│      getting-started.md        # 開發環境設定
│      testing-guide.md          # 測試指南
│      contributing.md           # 貢獻指南
│
├─UML/                           # 設計文件 (Design Documents)
│      使用者案例圖.puml/png     # Use Case Diagram
│      類別圖.puml/png           # Class Diagram
│      系統架構圖.puml/png       # System Architecture Diagram
│
└─Util/                          # 工具程式 (Utilities)
    └─virtual_map_generator/
            generator.py         # 地圖生成器 (Python)
```

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
# 後端
cd backend
npm install
npm install -g wrangler

# 前端（開新終端機）
cd frontend
npm install
```

### 2. 初始化資料庫 (Initialize Database)

```powershell
cd backend

# 產生 Type 定義
wrangler types

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

地圖包含 4 種層級的節點，模擬真實世界的物流中心結構：

| 層級 | 前綴 | 名稱 | 數量 | 速度係數 | 說明 |
|------|------|------|------|----------|------|
| 1 | `HUB_` | 轉運中心 (Hub) | 4 | 0.5 | 全域樞紐，連接所有區域 |
| 2 | `REG_` | 區域中心 (Regional) | 12 | 1.0 | 連接 HUB 與 LOC |
| 3 | `LOC_` | 營業所 (Local) | 30 | 2.0 | 區域內收派件管理 |
| 4 | `END_` | 收派點 (Endpoint) | 300 | 5.0 | 詳細地址或代收點 |

> 💡 速度係數 (Speed Factor)：數值越小代表移動成本越低/速度越快

### 資料庫結構 (Database Schema)

地圖數據儲存於 `nodes` 與 `edges` 資料表中：

- **nodes**：節點資訊（id, name, level, x, y）
- **edges**：路徑資訊（source, target, distance, road_multiple, cost）

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

---

## 📦 預設帳號 (Default Accounts)

系統已內建以下測試帳號（密碼皆為 `password123`）：

| 帳號 | 角色 |
|------|------|
| customer@example.com | 非合約客戶 |
| contract@example.com | 合約客戶 |
| driver@example.com | 駕駛員 |
| warehouse@example.com | 倉儲人員 |
| cs@example.com | 客服人員 |
| admin@example.com | 管理員 |

---

## 📝 版本歷史 (Version History)

| 版本 | 日期 | 說明 |
|------|------|------|
| 1.0 | 2025-12 | 初版：基本架構與核心功能 |
