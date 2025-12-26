# Components（系統組件）

本文件屬於 `docs/architecture/` 概念層：描述系統有哪些組件、各自負責什麼、以及它們如何連接；不承載細部業務規則或 API schema。

> 規則/流程權威：`docs/modules/README.md`；接口參考：`docs/reference/api/README.md`

## 1) High-level Architecture（高層結構）

```text
Browser (Vue)
  └─ frontend/ (views + services/api.ts)
        └─ HTTP
            └─ backend/ (Cloudflare Worker / Hono + OpenAPI routes)
                  └─ D1 (SQLite) - tables via backend/migrations/
```

## 2) Frontend（Vue 3）

- **角色頁面**：各角色的 UI 放在 `frontend/src/views/`。
- **API client**：集中在 `frontend/src/services/api.ts`，負責：
  - 組裝 request（含 token）
  - 定義 request/response 型別（前端側）
  - 角色頁面呼叫的單一入口（避免各 view 自己 hardcode endpoint）
- **路由與守門**：`frontend/src/router/` 負責頁面路由與基本的角色導向。

## 3) Backend（Cloudflare Worker）

- **路由入口**：`backend/src/index.ts` 組裝 API routes（含 OpenAPI routes 與部分 app routes）。
- **Endpoints**：`backend/src/endpoints/` 以 route class/handler 封裝：
  - 驗證與授權（角色/權限）
  - 核心業務流程（packages/tasks/exceptions/payments…）
  - DB 讀寫（D1）
- **測試**：`backend/src/__tests__/` 與 `backend/src/index.test.ts`。

## 4) Database（D1 / SQLite）

- **DDL / seed**：以 `backend/migrations/` 為權威來源。
- **概念模型**：`docs/architecture/data-model.md`（表責任摘要）。
- **資料字典**：`docs/reference/database-schema.md`（詳細欄位）。

## 5) Cross-cutting Concerns（橫切關注點）

- **權威來源分層**
  - 規則：`docs/modules/`
  - 接口：`docs/reference/api/`
  - 端到端用例：`docs/features/`
  - UI 操作：`docs/handbook/`
- **事件作為事實來源**
  - `package_events` 是流程事件的事實來源；追蹤顯示與部分快取欄位由它推導。
  - 事件模型與資料流詳見：`docs/architecture/event-model-and-flows.md`

