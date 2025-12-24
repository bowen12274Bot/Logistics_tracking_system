# Backend（Cloudflare Workers）

後端以 Cloudflare Workers + Hono 實作，資料庫使用 Cloudflare D1（SQLite 相容）。本文件以「如何開發/測試/操作 D1」為主；API 內容請以 `docs/` 的索引與接口頁為準，避免 README 長期過時。

## 文件入口

- 專案入口：`readme.md`
- Docs Index：`docs/README.md`
- API 索引入口：`docs/api-contract.md`
- API 接口頁索引：`docs/reference/api/README.md`
- Schema（資料字典）：`docs/reference/database-schema.md`
- 測試指南：`docs/guides/testing-guide.md`

## 目錄結構（快速）

| 路徑 | 用途 |
|---|---|
| `backend/src/` | Worker 主程式、endpoint、utils |
| `backend/src/__tests__/` | Vitest（Workers pool）測試 |
| `backend/migrations/` | D1 migrations（schema 與 seed） |
| `backend/scripts/` | 維運腳本（remote DB reset、benchmark report…） |
| `backend/wrangler.jsonc` | 本機/部署設定（D1 binding 等） |
| `backend/vitest.config.ts` | 預設測試設定（不含 benchmark） |
| `backend/vitest.benchmark.config.ts` | benchmark 專用測試設定 |

## 開發（本機）

```powershell
cd backend
npm install

# 初始化本機 D1（第一次或重建 DB 時需要）
npx wrangler d1 migrations apply DB --local

# 啟動 worker（http://localhost:8787）
npm run dev
```

Swagger / OpenAPI（若有啟用）：`http://localhost:8787/`

## D1（local/remote）

### 本機（`--local`）

```powershell
cd backend
npx wrangler d1 migrations apply DB --local
```

本機 D1 sqlite 檔案位置（miniflare）：`backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`

### Remote（`--remote`）

```powershell
cd backend
npx wrangler d1 migrations apply DB --remote
```

重設 remote DB（清空 + 重建，危險操作）：

```powershell
cd ..   # repo root
powershell -NoProfile -ExecutionPolicy Bypass -File ".\\backend\\scripts\\reset-remote-db.ps1" -Yes
```

只清空 remote（不套 migrations）：

```powershell
cd ..   # repo root
powershell -NoProfile -ExecutionPolicy Bypass -File ".\\backend\\scripts\\reset-remote-db.ps1" -Yes -DropOnly
```

## 測試

```powershell
cd backend
npm test
```

### Benchmark

benchmark 不會納入 `npm test`（避免影響 Workers test runner 的 isolated storage），請獨立執行：

```powershell
cd backend
npm run benchmark
```

產生 HTML 報表（依 `reports/benchmark-results.json`）：

```powershell
cd backend
npm run benchmark:report
```

## 部署

```powershell
cd backend
npm run deploy
```

