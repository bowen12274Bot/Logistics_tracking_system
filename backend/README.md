# Backend Documentation

此目錄包含物流追蹤系統的後端程式碼，使用 Cloudflare Workers + Hono 建構。

## 🚀 快速開始

### 安裝依賴
```bash
npm install
```

### 啟動開發伺服器
```bash
npm run dev
# 或
wrangler dev
```
啟動後，Swagger UI 文件位於: http://localhost:8787/

### 初始化資料庫
```bash
# 建立 Type 定義
wrangler types

# 套用資料庫遷移 (本地)
npx wrangler d1 migrations apply DB --local
```

---

## 📡 API 列表

所有 API 均以 `/api` 開頭。

### 🔐 認證 (Auth)

| Method | Endpoint | 描述 |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | 註冊新使用者 |
| `POST` | `/api/auth/login` | 使用者登入 |

#### 使用範例

**註冊**
```bash
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"user_name": "John", "email": "john@example.com", "password": "secret123"}'
```

**登入**
```bash
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "john@example.com", "password": "secret123"}'
```

---

### 🗺️ 虛擬地圖 (Virtual Map)

| Method | Endpoint | 描述 |
| :--- | :--- | :--- |
| `GET` | `/api/map` | 取得完整地圖資訊 (Nodes + Edges) |
| `PUT` | `/api/map/edges/:id` | 更新特定路徑的權重 (Cost/Road Multiple) |

#### 使用範例

**取得地圖**
```bash
curl http://localhost:8787/api/map
```

**更新路徑成本**
```bash
curl -X PUT http://localhost:8787/api/map/edges/1 \
  -H "Content-Type: application/json" \
  -d '{"cost": 500, "road_multiple": 2}'
```

---

### 📦 物流 (Shipments)

| Method | Endpoint | 描述 |
| :--- | :--- | :--- |
| `POST` | `/api/shipments` | 建立新物流單 |
| `GET` | `/api/shipments/:id` | 查詢物流單 |

#### 使用範例

**建立物流單**
```bash
curl -X POST http://localhost:8787/api/shipments \
  -H "Content-Type: application/json" \
  -d '{"sender": "Alice", "receiver": "Bob"}'
```

**查詢物流單**
```bash
curl http://localhost:8787/api/shipments/{id}
```

---

### 📦 包裹追蹤 (Packages) - T3 & T4

| Method | Endpoint | 描述 |
| :--- | :--- | :--- |
| `GET` | `/api/packages` | 取得包裹列表 (可依 customer_id 篩選) |
| `GET` | `/api/packages/:id/status` | 查詢包裹狀態與事件歷程 (T4) |
| `POST` | `/api/packages/:id/events` | 建立貨態事件 (T3) |

#### 使用範例

**查詢包裹列表**
```bash
curl http://localhost:8787/api/packages
curl http://localhost:8787/api/packages?customer_id=xxx
```

**查詢包裹狀態 (T4)**
```bash
curl http://localhost:8787/api/packages/{packageId}/status
```

**建立貨態事件 (T3)**
```bash
curl -X POST http://localhost:8787/api/packages/{packageId}/events \
  -H "Content-Type: application/json" \
  -d '{"delivery_status": "收件", "location": "HUB_0"}'
```

---

### 📋 任務 (Tasks) - 範例

| Method | Endpoint | 描述 |
| :--- | :--- | :--- |
| `GET` | `/api/tasks` | 取得任務列表 |
| `POST` | `/api/tasks` | 建立新任務 |
| `GET` | `/api/tasks/:slug` | 取得特定任務 |
| `DELETE` | `/api/tasks/:slug` | 刪除任務 |

---

## 🧪 測試

本專案使用 **Vitest** 搭配 `@cloudflare/vitest-pool-workers` 進行單元測試。

### 執行測試
```bash
npm test
```

### 測試覆蓋範圍
- ✅ Hello API (`/api/hello`)
- ✅ 認證 API (Register, Login)
- ✅ 地圖 API (Fetch, Update Edge)
- ✅ 包裹追蹤 API (T3, T4)
- ⏭️ 物流 API (Skipped - 資料表尚未建立)
- ✅ 任務 API (List)

### 測試檔案位置
```
backend/src/index.test.ts
```
