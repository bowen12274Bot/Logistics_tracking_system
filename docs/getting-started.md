# 開發環境設定指南 (Getting Started Guide)

本文件說明如何設定物流追蹤系統的開發環境。

---

## 📋 前置需求 (Prerequisites)

### 必要軟體 (Required Software)

| 軟體 | 版本需求 | 說明 |
|------|----------|------|
| **Node.js** | v18+ | JavaScript 執行環境 |
| **npm** | v9+ | 套件管理器（隨 Node.js 安裝） |
| **Git** | - | 版本控制 |

### 建議軟體 (Recommended)

| 軟體 | 說明 |
|------|------|
| **VS Code** | 推薦的程式碼編輯器 |
| **Wrangler CLI** | Cloudflare Workers 開發工具 |
| **micromamba** | Python 虛擬環境（若需使用 Python 腳本） |

---

## 🚀 安裝步驟 (Installation Steps)

### 1. 複製專案 (Clone Repository)

```powershell
git clone https://github.com/bowen12274Bot/Logistics_tracking_system.git
cd Logistics_tracking_system
```

### 2. 安裝後端依賴 (Backend Dependencies)

```powershell
cd backend
npm install
```

### 3. 安裝 Wrangler CLI（全域）

```powershell
npm install -g wrangler
```

### 4. 安裝前端依賴 (Frontend Dependencies)

```powershell
cd ../frontend
npm install
```

---

## 🗄️ 資料庫設定 (Database Setup)

### 產生型別定義 (Generate Types)

```powershell
cd backend
wrangler types
```

此指令會產生 `worker-configuration.d.ts`，包含 D1 資料庫的型別定義。

### 套用資料庫遷移 (Apply Migrations)

```powershell
# 套用所有遷移到本地模擬器
npx wrangler d1 migrations apply DB --local
```

> ⚠️ **注意**：首次執行時會建立本地 SQLite 資料庫檔案於 `.wrangler/` 目錄。

### 遷移檔案說明 (Migration Files)

遷移檔案位於 `backend/migrations/`，按編號順序執行：

| 編號 | 檔案 | 說明 |
|------|------|------|
| 0000 | users.sql | 使用者表 |
| 0001 | packages.sql | 包裹表 |
| 0002 | package_events.sql | 物流事件表 |
| 0003 | payments.sql | 付款表 |
| 0004 | monthly_billing.sql | 月結帳單表 |
| 0005 | monthly_billing_items.sql | 帳單明細表 |
| 0006 | virtual_map.sql | 虛擬地圖（含 346 個節點和邊資料） |
| 0007-0012 | *.sql | 額外欄位與表格 |

---

## 🖥️ 啟動開發伺服器 (Start Development Servers)

### 後端 (Backend)

```powershell
cd backend
npm run dev
```

啟動後：
- **Swagger UI**: http://localhost:8787/
- **API 端點**: http://localhost:8787/api/*

### 前端 (Frontend)

開啟新的終端機視窗：

```powershell
cd frontend
npm run dev
```

啟動後：
- **網頁介面**: http://localhost:5173/

---

## 🔑 預設帳號 (Default Accounts)

系統已內建測試帳號（密碼皆為 `password123`）：

| 類別 | 帳號 | user_type | user_class |
|------|------|-----------|------------|
| 非合約客戶 | customer@example.com | customer | non_contract_customer |
| 合約客戶 | contract@example.com | customer | contract_customer |
| 駕駛員 | driver@example.com | employee | driver |
| 倉儲人員 | warehouse@example.com | employee | warehouse_staff |
| 客服人員 | cs@example.com | employee | customer_service |
| 管理員 | admin@example.com | employee | admin |

---

## 🐍 Python 環境設定（選用）

若需使用 Python 腳本（如 `apply_migrations.py` 或 `generator.py`）：

### 使用 micromamba

```powershell
# 啟動虛擬環境
micromamba activate SE_class

# 安裝依賴（若尚未安裝）
micromamba install sqlite3
```

### 執行地圖生成器

```powershell
cd Util/virtual_map_generator
python generator.py
```

---

## 🔧 VS Code 設定建議 (VS Code Setup)

### 推薦擴充套件 (Recommended Extensions)

```json
// .vscode/extensions.json
{
  "recommendations": [
    "Vue.volar",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-python.python"
  ]
}
```

### 設定檔建議 (Settings)

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[vue]": {
    "editor.defaultFormatter": "Vue.volar"
  }
}
```

---

## ❓ 常見問題 (Troubleshooting)

### Q: `wrangler` 指令找不到？

確認已全域安裝 Wrangler：

```powershell
npm install -g wrangler
```

或使用 npx：

```powershell
npx wrangler dev
```

### Q: 資料庫遷移失敗？

嘗試刪除本地資料庫後重新執行：

```powershell
# 刪除本地資料庫
Remove-Item -Recurse -Force .wrangler

# 重新套用遷移
npx wrangler d1 migrations apply DB --local
```

### Q: 前端無法連接後端？

確認後端已啟動於 http://localhost:8787/，並檢查 CORS 設定。

---

## 📚 相關文件 (Related Documentation)

- [專案 README](../readme.md)
- [測試指南](testing-guide.md)
- [貢獻指南](contributing.md)
