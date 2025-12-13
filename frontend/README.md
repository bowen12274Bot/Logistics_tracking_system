# Frontend Documentation

此目錄包含物流追蹤系統的前端程式碼，使用 Vue 3 + Vite + Pinia 建構。

---

## 🚀 快速開始 (Quick Start)

### 安裝依賴 (Install Dependencies)

```powershell
npm install
```

### 啟動開發伺服器 (Start Development Server)

```powershell
npm run dev
```

啟動後開啟 http://localhost:5173/ 瀏覽網頁。

### 正式環境建構 (Production Build)

```powershell
npm run build
```

### 執行單元測試 (Run Unit Tests)

```powershell
npm run test:unit
```

---

## 📂 專案結構 (Project Structure)

```
frontend/src/
├── main.ts                 # 應用程式入口 (Entry Point)
├── App.vue                 # 根組件 (Root Component)
│
├── router/
│   └── index.ts            # 路由定義 (含 Navigation Guards 權限控制)
│
├── stores/
│   └── auth.ts             # Pinia 認證狀態 (Auth Store)
│
├── services/
│   └── api.ts              # API 呼叫封裝 (API Service)
│
├── types/
│   └── index.ts            # TypeScript 型別定義 (Type Definitions)
│
├── components/             # 可重用組件 (Reusable Components)
│   ├── icons/              # 圖標組件 (Icon Components)
│   └── *.vue               # 各種 UI 組件
│
├── views/                  # 頁面視圖 (Page Views)
│   ├── LoginView.vue           # 登入頁面
│   ├── HomeView.vue            # 首頁
│   ├── AboutView.vue           # 關於頁面
│   ├── AdminView.vue           # 管理員頁面
│   │
│   ├── CustomerDashboard.vue       # 客戶主控台
│   ├── CustomerTrackView.vue       # 包裹追蹤頁面
│   ├── CustomerSendView.vue        # 寄件建立頁面
│   ├── CustomerPaymentView.vue     # 付款頁面
│   ├── CustomerContractView.vue    # 合約申請頁面
│   ├── CustomerScheduleView.vue    # 排程取件頁面
│   │
│   ├── EmployeeDriverView.vue          # 駕駛員頁面
│   ├── EmployeeWarehouseView.vue       # 倉儲人員頁面
│   └── EmployeeCustomerServiceView.vue # 客服人員頁面
│
└── assets/                 # 靜態資源 (Static Assets)
    ├── base.css            # 基礎樣式
    ├── main.css            # 主樣式
    └── logo.svg            # Logo 圖檔
```

---

## 👥 角色權限 (Role-Based Access Control)

前端路由使用 Navigation Guards 實作角色權限控制 (RBAC)：

| 路由 | 需要登入 | 允許角色 |
|------|----------|----------|
| `/` | ❌ | 所有人 |
| `/login` | ❌ | 未登入使用者 |
| `/customer/*` | ✅ | customer |
| `/driver/*` | ✅ | driver |
| `/warehouse/*` | ✅ | warehouse_staff |
| `/cs/*` | ✅ | customer_service |
| `/admin/*` | ✅ | admin |

### 路由守衛邏輯 (Navigation Guard Logic)

```typescript
// router/index.ts
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  // 檢查是否需要認證
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
    return
  }
  
  // 檢查角色權限
  if (to.meta.allowedRoles && !to.meta.allowedRoles.includes(authStore.userClass)) {
    next('/') // 導向首頁
    return
  }
  
  next()
})
```

---

## 🔧 狀態管理 (State Management)

使用 Pinia 管理全域狀態，主要 Store：

### Auth Store (`stores/auth.ts`)

| 狀態 | 型別 | 說明 |
|------|------|------|
| `user` | `User \| null` | 當前使用者資訊 |
| `token` | `string \| null` | 認證 Token |
| `isAuthenticated` | `boolean` | 是否已登入 (computed) |
| `userClass` | `string \| null` | 使用者類別 (computed) |

| 動作 (Actions) | 說明 |
|----------------|------|
| `login(identifier, password)` | 使用者登入 |
| `logout()` | 登出並清除狀態 |
| `fetchMe()` | 取得當前使用者資訊 |

---

## 🌐 API 呼叫 (API Calls)

API 呼叫封裝於 `services/api.ts`：

```typescript
// 使用範例
import { api } from '@/services/api'

// GET 請求
const packages = await api.get('/packages')

// POST 請求
const result = await api.post('/packages', {
  sender: { name: '張三', ... },
  receiver: { name: '李四', ... },
  ...
})
```

### API 服務功能 (Features)

- 自動附加 `Authorization` Header（若已登入）
- 統一錯誤處理
- TypeScript 型別支援

---

## 💻 開發建議 (Development Tips)

### 推薦 IDE 設定 (Recommended IDE Setup)

- [VS Code](https://code.visualstudio.com/)
- [Vue (Official) Extension](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
- 請停用 Vetur 擴充套件（與 Vue 3 不相容）

### 推薦瀏覽器設定 (Recommended Browser Setup)

**Chromium 系列（Chrome, Edge, Brave）：**
- [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)

**Firefox：**
- [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)

### TypeScript 支援 (TypeScript Support)

TypeScript 預設無法處理 `.vue` 檔案的型別，需使用 `vue-tsc` 取代 `tsc` 進行型別檢查：

```powershell
npm run type-check
```

---

## 📚 相關文件 (Related Documentation)

- [專案 README](../readme.md) - 專案總覽
- [API 契約文件](../docs/api-contract.md) - 後端 API 規格
- [Vite 設定參考](https://vite.dev/config/) - Vite 官方文件
