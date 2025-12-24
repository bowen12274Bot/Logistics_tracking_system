# 物流追蹤系統 (Logistics Tracking System)

![CI/CD](https://github.com/bowen12274Bot/Logistics_tracking_system/workflows/CI%2FCD/badge.svg)
![Frontend](https://img.shields.io/badge/frontend-Vue%203-42b883)
![Backend](https://img.shields.io/badge/backend-Cloudflare%20Workers-f38020)

一個基於 Cloudflare Workers 與 Vue 3 的前後端分離物流追蹤系統專案（monorepo：`backend/` + `frontend/` + `docs/`）。

---

## 📚 文件索引（建議入口）

> `docs/` 已重構為分層文件；完整導覽請以 `docs/README.md` 為準。

| 文件 | 說明 |
|------|------|
| [Docs Index](docs/README.md) | `docs/` 分層文件入口（概念/規則/API/手冊/指南） |
| [API 契約索引](docs/api-contract.md) | API 索引入口（各接口頁在 `docs/reference/api/`） |
| [資料字典（Schema）](docs/reference/database-schema.md) | 資料庫表格、欄位、索引（權威） |
| [測試指南](docs/guides/testing-guide.md) | 測試執行與排錯（含 benchmark 指令） |
| [測試計畫](docs/guides/vitest-plan.md) | 測試案例規劃 |
| [開發環境設定](docs/guides/getting-started.md) | 安裝、migrations、預設帳號、工具 |
| [CI/CD 設定指南](docs/guides/ci-cd-guide.md) | GitHub Actions 與 Cloudflare 部署設定 |
| [貢獻指南](docs/guides/contributing.md) | 協作規範與 PR 流程 |

（相容舊連結入口：`docs/database-schema.md`、`docs/testing-guide.md`、`docs/getting-started.md`…仍保留 stub 轉址。）

---

## 🤝 協作規範 (Collaboration Guidelines)

完整版本請看：`docs/guides/contributing.md`。以下是最小共識：

1. **開新分支 (Branch)**：新功能請開 branch，避免直接改 `main`。
2. **小步提交**：多 commit + 清楚訊息，方便 review 與回溯。
3. **禁止 Force Push**：避免破壞歷史造成難以修復。
4. **以 PR 合併**：至少 1 人 review（能做到就做）。

---

## 📂 專案結構 (Project Structure)

```text
logistics-system/
  readme.md
  docs/                      # 分層文件入口：docs/README.md
    architecture/            # L1 概念層
    modules/                 # L2 規則層（權威）
    reference/               # L3 參考層（API/Schema）
    handbook/                # 角色操作手冊（UI/步驟）
    design/                  # 設計備忘 / 圖表
    guides/                  # 開發/測試/部署/協作指南
    legacy/                  # 舊文件留存（非權威）
    *.md                     # 舊入口 stub（避免舊連結失效）
  backend/                   # Cloudflare Workers 後端
    migrations/              # D1 migrations（schema + seed）
    src/                     # Worker source + endpoints + tests
    scripts/                 # 維運腳本（remote db reset、benchmark report…）
  frontend/                  # Vue 3 前端
    src/                     # views / stores / services / tests
  UML/                       # 設計與需求（歷史/參考）
  Util/                      # 工具（virtual map generator）
```

---

## Remote D1 操作（`--remote`）

> 注意：`--remote` 會操作線上的 Cloudflare D1；請確認 binding 名稱與設定檔（預設：`backend/wrangler.jsonc`）。

### 套用 migrations（不清空資料）

在 `backend/` 目錄下執行：

- `npx wrangler d1 migrations apply DB --remote`

### 手動重設 Remote DB（清空 + 重建）

在 repo 根目錄執行（Windows PowerShell）：

- `powershell -NoProfile -ExecutionPolicy Bypass -File ".\backend\scripts\reset-remote-db.ps1" -Yes`

### 只清空 Remote DB（讓 CI 之後重建）

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\backend\scripts\reset-remote-db.ps1" -Yes -DropOnly
```

---

## 🧹 本地資料庫清空/重建（D1 `--local`）

本專案後端在本地開發時，D1 會落地成 sqlite 檔案在：
`backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`

### 清空本地 DB（刪除 sqlite）

1. 先停止本地 worker（避免檔案被鎖定）
   - `npm --prefix backend run dev:clean`
   - 或：`powershell -NoProfile -ExecutionPolicy Bypass -File backend/scripts/stop-local-workers.ps1 -Port 8787`
2. 刪除本地 sqlite 檔
   - `Remove-Item -Force backend\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\*.sqlite`

### 清空 + 重建本地 DB（重新套用 migrations）

```powershell
cd backend
npx wrangler d1 migrations apply DB --local
```

---

## 🛠️ 技術細節 (Tech Stack Details)

> 以文件化的「權威規則」為主，實作以程式碼與 migrations 為準。

| 層級 | 技術 | 說明 |
|------|------|------|
| 後端 Runtime | Cloudflare Workers / workerd | 以 wrangler 本機模擬與雲端部署 |
| 後端框架 | Hono | API routing / middleware |
| OpenAPI | Chanfana + Zod | 以型別/校驗推導 OpenAPI schema |
| 資料庫 | Cloudflare D1 | SQLite 相容；schema 以 `backend/migrations/` 為權威 |
| 認證/權限 | Token + RBAC | 角色以 `users.user_class` 為準；流程見 `docs/modules/users.md` |
| 後端測試 | Vitest + `@cloudflare/vitest-pool-workers` | Workers 環境測試；benchmark 獨立執行（避免影響 isolated storage） |
| 前端框架 | Vue 3 + Vite | SPA 前端 |
| 狀態管理 | Pinia | 以 token/user_class 控制視圖與行為 |
| 路由/權限 | Vue Router | Navigation Guards 做 RBAC |

---

## 🗺️ 虛擬地圖定義 (Virtual Map)

本系統用「三層物流路網」模擬：HUB（配送中心）→ REG（配送站）→ END（終端：住家/店）。

### 採用的資料架構（DB + 生成器 + 規則）

- DB Schema：`nodes` / `edges`（見 `docs/reference/database-schema.md` 及 migrations `backend/migrations/0006_virtual_map_schema.sql`、`backend/migrations/0007_virtual_map_seed.sql`）
- 生成器：`Util/virtual_map_generator/generator.py` 產生對應 SQL（可用於更新 seed）
- 規則（權威）：`docs/modules/map-routing.md`（路由/相鄰性/呈現）

### 節點層級（Node Levels）

> 具體數量/間距等參數以 generator 為準；此處描述「採用的結構」。

1. **HUB（配送中心，level=1）**：樞紐節點，連接多個 REG/HUB
2. **REG（配送站，level=2）**：承接 HUB 與大量 END，部分 REG 之間可能有側向連接
3. **END（終端，level=3）**：住家/店（`subtype=home/store`）

### edges 與成本模型

- `edges` 連接兩個節點（在 seed 中常為雙向邊：A→B + B→A）
- 每條邊有 `distance`、`road_multiple`、`cost`
- `cost` 是路由與運費/服務水準的重要基礎（更完整說明：`docs/architecture/delivery-service-standards.md`）

---

## 👥 使用者角色 (User Roles)

角色權威規則：`docs/modules/users.md`。操作指南（UI/步驟）請直接看手冊：

- 客戶（非合約）：`docs/handbook/non-contract-customer.md`
- 客戶（合約）：`docs/handbook/contract-customer.md`
- 司機：`docs/handbook/driver.md`
- 倉儲：`docs/handbook/warehouse-staff.md`
- 客服：`docs/handbook/customer-service.md`
- 管理員：`docs/handbook/admin.md`

| 角色 | user_type | user_class | 手冊 |
|------|-----------|------------|------|
| 非合約客戶 | customer | non_contract_customer | `docs/handbook/non-contract-customer.md` |
| 合約客戶 | customer | contract_customer | `docs/handbook/contract-customer.md` |
| 客服人員 | employee | customer_service | `docs/handbook/customer-service.md` |
| 倉儲人員 | employee | warehouse_staff | `docs/handbook/warehouse-staff.md` |
| 駕駛員 | employee | driver | `docs/handbook/driver.md` |
| 管理員 | employee | admin | `docs/handbook/admin.md` |

---

## 📦 預設帳號 (Default Accounts)

預設/測試帳號由 seed 寫入：`backend/migrations/0011_seed_test_users.sql`（該檔也包含對應密碼）。

| 類別 | 帳號 | 密碼 | user_class |
|------|------|------|------------|
| 非合約客戶 | `noncontract@example.com` | `custnc123` | `non_contract_customer` |
| 合約客戶 | `cust@example.com` | `cust123` | `contract_customer` |
| 駕駛員（HUB_0） | `driver_hub_0@example.com` | `driver123` | `driver` |
| 倉儲人員（HUB_0） | `warehouse_hub_0@example.com` | `warehouse123` | `warehouse_staff` |
| 客服人員 | `cs@example.com` | `cs123` | `customer_service` |
| 管理員 | `admin@example.com` | `admin123` | `admin` |

補齊帳號規則（由 seed 依地圖節點自動產生）：

- 其他配送中心司機：`driver_<hubId>@example.com`（例：`driver_hub_1@example.com`），密碼 `driver123`
- 其他配送中心倉儲：`warehouse_<hubId>@example.com`（例：`warehouse_hub_1@example.com`），密碼 `warehouse123`
- 配送站倉儲：`warehouse_<regId>@example.com`（例：`warehouse_reg_1@example.com`），密碼 `warehouse123`

> 員工帳號的 `users.address` 代表工作地（地圖節點 ID），例如 `HUB_0` / `REG_3`。

---

## 📝 版本歷史 (Version History)

版本摘要集中記錄在：`docs/guides/version-history.md`（詳細仍以 git commit / PR 為準）。

