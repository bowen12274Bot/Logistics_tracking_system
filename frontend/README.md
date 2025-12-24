# Frontend（Vue 3 + Vite）

此目錄是物流追蹤系統的前端（Vue 3 + Vite + Pinia）。前端會呼叫後端 Worker API（預設 `http://127.0.0.1:8787`）。

## 先看這些（權威文件）

- 專案總覽：`../readme.md`
- Docs Index（文件結構總覽）：`../docs/README.md`
- UI 規格（設計/頁面/元件）：`../docs/design/ui-spec.md`
- 角色操作手冊（步驟/操作）：`../docs/handbook/README.md`
- 角色/權限/規則：`../docs/modules/users.md`

## 快速開始（本地開發）

前端預設把 API 打到本機後端（`wrangler dev`）。如果你後端不是跑在預設位址，請改用環境變數。

1) 啟動後端（另開一個終端機）

- 參考：`../backend/README.md`

2) 啟動前端

```powershell
cd frontend
npm install
npm run dev
```

- 前端：`http://localhost:5173/`
- 後端（預設）：`http://127.0.0.1:8787/`（Swagger UI：`http://127.0.0.1:8787/`）

### API Base URL（Vite env）

前端 API base 由 `frontend/src/services/api.ts` 決定：

- Dev 預設：`http://127.0.0.1:8787`
- 可覆寫：`VITE_API_BASE`

範例（PowerShell，僅當次終端機有效）：

```powershell
$env:VITE_API_BASE="http://127.0.0.1:8787"
npm run dev
```

## 常用指令

```powershell
cd frontend

# 單元測試
npm run test:unit

# 型別檢查（vue-tsc）
npm run type-check

# 建置 / 預覽
npm run build
npm run preview
```

## 專案結構（快速）

| 路徑 | 放什麼 |
|---|---|
| `frontend/src/services/api.ts` | API 呼叫封裝、型別、`VITE_API_BASE` |
| `frontend/src/router/index.ts` | Route 定義與角色守門（RBAC） |
| `frontend/src/stores/` | Pinia stores（登入狀態等） |
| `frontend/src/views/` | 各角色頁面（customer/driver/warehouse/cs/admin） |
| `frontend/src/__tests__/` | Vitest 測試（含 views/stores 測試） |
| `frontend/vite.config.ts` | Vite 設定（alias `@` 等） |

## 角色與路由（避免文件過期）

- 前端以 `user.user_class` 控制路由存取（見 `frontend/src/router/index.ts`）。
- 角色定義與規則以文件為準：`../docs/modules/users.md`；實際操作請看：`../docs/handbook/README.md`。
