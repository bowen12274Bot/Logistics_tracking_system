# Repository Structure（專案檔案架構）

本文件定義本 repo 的「檔案放置規則」與主要目錄的責任邊界，避免文件與程式散落、重複、或不小心放到錯的層級。

> 這裡的目標是提供「穩定、不易過期」的結構描述；不建議把每個檔名都完整列出（會快速過期）。若要看當下完整樹狀結構，請用工具指令產出（見文末）。

## 目錄責任（Top-level）

```text
logistics-system/
  readme.md                 # 專案入口（給新進/快速導覽），內容以連結為主
  docs/                     # 分層文件（權威入口：docs/README.md）
  backend/                  # 後端（Cloudflare Workers + D1）
  frontend/                 # 前端（Vue 3 + Vite）
  UML/                      # 原始需求/圖（歷史與參考）
  Util/                     # 工具程式（例如虛擬地圖產生器）
  .github/                  # CI / workflows
```

## `docs/` 分層（文件的權威放置規則）

`docs/` 採「分層文件」：

- `docs/README.md`：唯一導覽入口（先找這裡）
- `docs/architecture/`（L1 概念層）：系統概觀、資料模型、不變量
- `docs/modules/`（L2 規則層，權威）：跨角色的一致性規則、流程約束、狀態機/例外處理
- `docs/reference/`（L3 參考層）：API、資料字典、可查詢的規格（不講流程，不講做法）
- `docs/handbook/`（操作層）：依角色寫 UI 操作步驟（不做規則權威）
- `docs/design/`：設計備忘、流程圖、UI/UX 草稿與補充
- `docs/guides/`（L4 指南層）：開發/測試/部署/協作規範與排錯
- `docs/legacy/`：舊文件留存（非權威）
- `docs/*.md`：舊入口 stub（只保留轉址/索引，避免舊連結失效）

### 新文件放哪裡？

- 新增「規則/流程/一致性」：放 `docs/modules/`
- 新增「UI 操作手冊」：放 `docs/handbook/`
- 新增「開發與維運指引」：放 `docs/guides/`
- 新增「API/Schema 參考」：放 `docs/reference/`
- 新增「概念/架構」：放 `docs/architecture/`

如果是為了相容舊連結（例如別人還在引用 `docs/foo.md`），可以在 `docs/foo.md` 留一份 stub，指到新位置。

## `backend/`（後端）

```text
backend/
  src/                      # Worker source、endpoints、tests
  migrations/               # D1 migrations（schema + seed）
  scripts/                  # 維運腳本（reset DB、report…）
  wrangler.jsonc            # wrangler 設定（本機/部署）
  README.md                 # 後端入口（以連結為主，避免重複列 API）
```

- 資料庫的權威來源是 `backend/migrations/`（文件上的資料字典以它為準）。

## `frontend/`（前端）

```text
frontend/
  src/
    services/               # API 封裝（包含 `VITE_API_BASE`）
    router/                 # 路由與角色守門
    stores/                 # Pinia store
    views/                  # 各角色頁面
    __tests__/              # 前端測試
  README.md                 # 前端入口（以連結為主，避免複製規格）
```

## 產出「完整」樹狀結構（避免手寫過期）

- Windows PowerShell：`tree /F /A`
- Git 追蹤檔：`git ls-files`

