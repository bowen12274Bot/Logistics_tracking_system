# Term Project 合作指南

我們現在建立起了共用的 GitHub 存儲庫，可以共同用 AI 開發這個物流追蹤系統。

## 🤝 協作規範 (建議遵守)

雖然這只是一個小小的期末專案，但為了讓開發順利，建議大家嘗試遵守以下流程：

1.  **開新分支 (Branch)**：當你要做一個新功能時，請先開一個新的 branch，不要直接在 main/master 上改。
2.  **多 Commit 與寫清楚敘述**：盡可能多 commit，並寫清楚 commit message，這樣大家才看得懂你改了什麼。
3.  **禁止 Force Push**：推送時請**不要**使用 `-f` (force push)，這會讓 commit 歷史全部消失，造成災難。
4.  **使用 Pull Request (PR)**：如果可行的話，請使用 Pull Request 合併代碼，而非直接 push 上去，這樣才能強制大家幫你 Code Review。

> **備註**：當然，如果你覺得太麻煩，以上規則也可以適度放寬，畢竟目標是把專案做出來！🚀

---

## 📂 專案結構深度解析

此專案採用前後端分離架構 (Monorepo)，以下為實際檔案結構：

```text
Logistics_tracking_system/
│  .gitignore           # Git 忽略檔案設定
│  readme.md            # 本文件
│  todoList.md          # 待辦事項
│
├─backend/              # [後端] Cloudflare Workers + Hono + Chanfana
│  │  wrangler.jsonc    # Workers 設定
│  │  package.json
│  │  apply_migrations.py
│  │
│  ├─migrations/        # [資料庫模型]
│  │      0000_users.sql                 # 使用者表
│  │      0001_packages.sql              # 包裹表
│  │      0002_package_events.sql        # 物流事件
│  │      0003_payments.sql              # 支付紀錄
│  │      0004_monthly_billing.sql       # 月結帳單
│  │      0005_monthly_billing_items.sql # 帳單細項
│  │      0006_virtual_map_schema.sql    # 虛擬地圖 Schema (Nodes/Edges tables)
│  │      0007_virtual_map_seed.sql      # 虛擬地圖 seed data
│  │
│  └─src/
│      │  index.ts      # [入口] App 初始化, Auth, CORS
│      │  types.ts      # 型別定義
│      │
│      └─endpoints/     # [API Endpoints]
│              taskCreate.ts
│              taskDelete.ts
│              taskFetch.ts
│              taskList.ts
│
├─frontend/             # [前端] Vue 3 + Vite + Pinia
│  │  vite.config.ts
│  │
│  └─src/
│      │  main.ts
│      │  App.vue
│      │
│      ├─router/
│      │      index.ts  # 路由定義 (含權限守門員)
│      │
│      ├─stores/
│      │      auth.ts   # Pinia Auth Store (登入狀態)
│      │
│      ├─services/
│      │      api.ts    # API 呼叫封裝
│      │
│      ├─components/
│      │      HelloWorld.vue
│      │      TheWelcome.vue
│      │      WelcomeItem.vue
│      │
│      └─views/         # 頁面視圖
│              LoginView.vue
│              HomeView.vue
│              AboutView.vue
│              AdminView.vue
│              # 客戶端
│              CustomerDashboard.vue
│              CustomerTrackView.vue
│              CustomerSendView.vue
│              CustomerPaymentView.vue
│              CustomerContractView.vue
│              CustomerScheduleView.vue
│              # 員工端
│              EmployeeDriverView.vue
│              EmployeeWarehouseView.vue
│              EmployeeCustomerServiceView.vue
│
├─UML/                  # 設計文件
│      使用者案例圖.png
│      使用者案例圖.puml
│      類別圖.png
│      類別圖.puml
│
└─Util/                 # 工具程式
    └─virtual_map_generator/
            generator.py # 地圖生成器 (Python)
```

## 🛠️ 技術細節 (Tech Stack Details)

- **Backend Framework**: 使用 **Hono** 作為 Web 框架，搭配 **Chanfana** 自動生成 OpenAPI 3.1 文件 (Swagger UI)。
- **Database**: **Cloudflare D1** (基於 SQLite 的邊緣資料庫)。
- **Authentication**: 自刻的 Token Based 驗證，密碼使用 SHA-256 雜湊儲存 (位於 `backend/src/index.ts`)。
- **Frontend Router**: 使用 **Vue Router** 的 Navigation Guards (`router.beforeEach`) 實作角色權限控制 (RBAC)。

## 🚀 如何開始 (Quick Start)

1.  **安裝依賴**:

    - 後端: `cd backend && npm install && npm install -g wrangler`
    - 前端: `cd frontend && npm install`

2. **初始化模擬器**:
    - 後端: `cd backend && wrangler types`
    - **[重要] 初始化資料庫**: `cd backend && npx wrangler d1 migrations apply DB --local`
      - 這會將 `migrations/` 資料夾內的 SQL 檔案套用到本地的模擬資料庫中，建立 `users` 等資料表。

3.  **啟動開發伺服器**:
    - 後端: `cd backend && wrangler dev`
      - 啟動後打開 `http://localhost:8787/` 可以看到 **Swagger UI** (API 文件與測試介面)。
    - 前端: `cd frontend && npm run dev`
      - 啟動後打開 `http://localhost:5173/` 瀏覽網頁。

## 虛擬地圖定義

本系統使用虛擬地圖模擬物流路網，由 `Util/virtual_map_generator/generator.py` 生成。

### 節點層級 (Levels)

地圖包含 4 種層級的節點，模擬真實世界的物流中心結構：

1.  **HUB (轉運中心)**
    -   數量: 4
    -   功能: 全域樞紐，連接所有區域。
    -   速度係數: 0.5 (最快，數值越小代表移動成本越低/速度越快)
    -   間距: ~4000
2.  **REG (區域中心)**
    -   數量: 12
    -   功能: 連接 HUB 與大量 LOC。
    -   速度係數: 1.0 (幹線運輸)
    -   間距: ~1500
3.  **LOC (營業所)**
    -   數量: 30
    -   功能: 負責區域內的收派件管理。
    -   速度係數: 2.0 (區域運輸)
    -   間距: ~600
4.  **END (收派點/終端)**
    -   數量: 300
    -   功能: 模擬詳細地址或代收點。
    -   速度係數: 5.0 (市區慢速配送)
    -   間距: ~100

### 資料庫 Schema

地圖數據儲存於 `nodes` 與 `edges` 資料表中 (參見 `backend/migrations/0006_virtual_map_schema.sql`、`backend/migrations/0007_virtual_map_seed.sql`)：

-   **nodes**: 節點資訊
    -   `id` (TEXT): 節點唯一識別碼
    -   `name` (TEXT): 節點名稱 (如 `HUB_0`, `REG_5`)
    -   `level` (INTEGER): 層級 (1-4)
    -   `x` (INTEGER), `y` (INTEGER): 座標位置

-   **edges**: 路徑資訊 (雙向)
    -   `id` (INTEGER PRIMARY KEY): 路徑 ID
    -   `source` (TEXT), `target` (TEXT): 連接的節點 ID
    -   `distance` (REAL): 兩點間距離
    -   `road_multiple` (INTEGER): 道路權重係數 (通常取決於兩端點中較低級別者的速度係數)
    -   `cost` (INTEGER): 運輸成本 (`distance * road_multiple`)
