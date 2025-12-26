# 文件導覽（Docs Index）

這份 `docs/` 目錄是「分層文件」的入口：先看全貌，再往下看模組規格與 API 參考，最後才是操作手冊與圖表。

## Docs 結構總覽（快速）

| 目錄 | 放什麼 | 定位 |
|---|---|---|
| `docs/architecture/` | 系統概念、不變量、資料模型 | L1（概念層） |
| `docs/modules/` | 規則/流程/一致性（權威） | L2（規則層） |
| `docs/features/` | 以功能/用例串聯 UI→規則→API | 功能層（端到端） |
| `docs/reference/` | 可查詢的參考資料（API/Schema） | L3（接口層） |
| `docs/handbook/` | 各角色操作手冊（UI/步驟） | 操作層（不做規則權威） |
| `docs/design/` | UI/UX、流程圖、設計備忘 | 支援資料 |
| `docs/guides/` | 開發/測試/部署/協作指南 | L4（指南層） |
| `docs/legacy/` | 舊文件留存（非權威） | 歷史參考 |
| `docs/*.md` | 舊入口 stub（避免舊連結失效） | 轉址/索引 |

## 建議閱讀順序

- 新加入/想快速跑起來：`docs/guides/getting-started.md`（舊入口：`docs/getting-started.md`）→ `docs/guides/testing-guide.md`（舊入口：`docs/testing-guide.md`）→ `docs/reference/api-contract.md`
- 想理解系統怎麼運作（概念/規則）：`docs/architecture/overview.md` → `docs/architecture/data-model.md` → `docs/modules/exceptions.md`
- 想以「功能」看端到端（UI→規則→API）：`docs/features/README.md`
- 想對照 UI：`docs/design/ui-spec.md`（舊入口：`docs/ui-spec.md`）→ `docs/handbook/customer-service.md` / `docs/handbook/warehouse-staff.md` / `docs/handbook/driver.md` / `docs/handbook/non-contract-customer.md` / `docs/handbook/contract-customer.md` / `docs/handbook/admin.md`

## 文檔衝突時的優先順序

若不同文件對同一件事描述不一致，請依下列順序判定「哪個是準」：

1. `docs/modules/`（規則權威）
2. `docs/reference/api/`（API 介面與 schema）
3. `docs/features/`（端到端流程與角色協作）
4. `docs/design/`（前端/產品設計；需與實作同步更新）
5. `docs/legacy/`、`docs/legacy/api-contract.legacy.md`（歷史文件，僅供參考）

## 目前文件分層

### L1：系統概觀（概念/資料）

- 架構索引：`docs/architecture/README.md`
- 概觀：`docs/architecture/overview.md`
- Repo 結構（檔案放置規則）：`docs/architecture/repository-structure.md`
- 資料模型（摘要）：`docs/architecture/data-model.md`（DDL 以 `backend/migrations/` 為準）
- 核心名詞表：`docs/architecture/glossary.md`
- 系統組件：`docs/architecture/components.md`
- 事件模型與資料流：`docs/architecture/event-model-and-flows.md`
- 既有詳細表結構（資料字典）：`docs/reference/database-schema.md`（舊入口：`docs/database-schema.md`）
- 運費/計價規格（routeCost 計價）：`docs/modules/pricing.md`

### L2：核心模組（規則/流程）

> 規則與一致性約束以 `docs/modules/` 為準；舊文件/舊入口保留以免連結失效。

- 模組索引：`docs/modules/README.md`
- 異常（新）：`docs/modules/exceptions.md`（來源：`docs/legacy/exception-handling.md`；舊入口：`docs/exception-handling.md`；手冊：`docs/handbook/customer-service.md`）
- 作業/任務/車輛（新）：`docs/modules/operations.md`（操作手冊：`docs/handbook/warehouse-staff.md`、`docs/handbook/driver.md`；設計備忘：`docs/design/driver-map.md`）
- 追蹤顯示（新）：`docs/modules/tracking.md`（來源：`docs/reference/api/03-packages.md`）
- 舊入口（stubs）：
  - 舊文件索引：`docs/legacy/README.md`
  - 資料字典（舊入口）：`docs/database-schema.md`（資料字典：`docs/reference/database-schema.md`）
  - UI 規範（舊入口）：`docs/ui-spec.md`（UI 規範：`docs/design/ui-spec.md`）
  - 序列圖（舊入口）：`docs/sequence-diagrams.md`（序列圖：`docs/design/sequence-diagrams.md`）
  - 異常規範（舊入口）：`docs/exception-handling.md`（舊規範：`docs/legacy/exception-handling.md`）
  - 客服流程（舊入口）：`docs/customer-service.md`（手冊：`docs/handbook/customer-service.md`）
  - 倉儲作業手冊（舊入口）：`docs/warehouse-staff.md`（手冊：`docs/handbook/warehouse-staff.md`）
  - 車輛/任務/移動（舊入口）：`docs/vehicle-movement.md`（手冊：`docs/handbook/driver.md`）
  - 開發環境設定（舊入口）：`docs/getting-started.md`（指南：`docs/guides/getting-started.md`）
  - 測試指南（舊入口）：`docs/testing-guide.md`（指南：`docs/guides/testing-guide.md`）
  - 測試計畫（舊入口）：`docs/vitest-plan.md`（指南：`docs/guides/vitest-plan.md`）
  - CI/CD（舊入口）：`docs/ci-cd-guide.md`（指南：`docs/guides/ci-cd-guide.md`）
  - 貢獻規範（舊入口）：`docs/contributing.md`（指南：`docs/guides/contributing.md`）
- 流程圖（概念流程）：`docs/design/sequence-diagrams.md`（舊入口：`docs/sequence-diagrams.md`）

### L3：API 參考

- 參考索引：`docs/reference/README.md`
- API 參考（接口參考）：`docs/reference/api/README.md`
- API 參考分頁索引：`docs/reference/api/README.md`
- API 契約索引（入口）：`docs/reference/api-contract.md`（舊入口：`docs/api-contract.md`）

### L4：開發/測試/部署（Guides）

- 指南索引：`docs/guides/README.md`
- Docs 維護規範：`docs/guides/docs-maintenance.md`
- 快速開始：`docs/guides/getting-started.md`（舊入口：`docs/getting-started.md`）
- 測試指南：`docs/guides/testing-guide.md`（舊入口：`docs/testing-guide.md`）
- 測試規劃/覆蓋：`docs/guides/vitest-plan.md`（舊入口：`docs/vitest-plan.md`）
- CI/CD：`docs/guides/ci-cd-guide.md`（舊入口：`docs/ci-cd-guide.md`）
- 貢獻規範：`docs/guides/contributing.md`（舊入口：`docs/contributing.md`）

## UML 與需求來源

- 系統架構圖：`UML/系統架構圖.puml`
- 類別圖：`UML/類別圖.puml`
- 原始需求文件：`UML/TermProject114.md`

## 模組對齊（UML vs API 契約）

UML 的 5 大模組偏「領域（Domain）」；API 參考（`docs/reference/api/README.md`）的分頁偏「能力（Capability）」。

- User Module（UML）→ `docs/reference/api/01-users.md`、`docs/reference/api/06-super-user.md`
- Cargo Module（UML）→ `docs/reference/api/03-packages.md`、`docs/reference/api/04-map-routing.md`、`docs/reference/api/07-exceptions.md`、`docs/reference/api/08-operations-tasks.md`
- Payment Module（UML）→ `docs/reference/api/05-payments.md`
- Review Module（UML）→ `docs/reference/api/02-review.md`
- Super User Management（UML）→ `docs/reference/api/06-super-user.md`

## 後續重構方向（你可以先看這段是否同意）

- 入口統一：`docs/README.md` 作為唯一導覽入口（本文件）
- API/規則分離：`docs/reference/api-contract.md` 作為索引入口；接口與 schema 放在 `docs/reference/api/`；規則集中到模組文件（exceptions/operations/tracking/payment…）
- 避免重複：同一條規則只在一個模組文件說明，其他文件用連結引用
