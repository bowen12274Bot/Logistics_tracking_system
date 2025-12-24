# 測試指南 (Testing Guide)

本文件說明物流追蹤系統的測試架構與執行方式。

---

## 🏗️ 測試架構概述 (Testing Architecture)

### 後端測試 (Backend Tests)

| 項目 | 說明 |
|------|------|
| **測試框架 (Framework)** | Vitest |
| **環境模擬 (Runtime)** | @cloudflare/vitest-pool-workers |
| **測試類型 (Types)** | 單元測試 (Unit)、整合測試 (Integration) |

### 前端測試 (Frontend Tests)

| 項目 | 說明 |
|------|------|
| **測試框架 (Framework)** | Vitest |
| **環境模擬 (Runtime)** | jsdom |
| **測試類型 (Types)** | 單元測試 (Unit)、組件測試 (Component) |

---

## 📁 測試檔案結構 (Test File Structure)

### 後端 (Backend)

```
backend/src/
├── index.test.ts           # 主要整合測試
└── __tests__/
    ├── helpers.ts          # 測試輔助函式 (Test Helpers)
    ├── auth.test.ts        # 認證模組測試 (25 cases)
    ├── packages.test.ts    # 包裹模組測試 (35 cases)
    ├── tracking.test.ts    # 追蹤模組測試 (25 cases)
    ├── map.test.ts         # 地圖模組測試 (18 cases)
    ├── billing.test.ts     # 計費模組測試 (15 cases)
    ├── admin.test.ts       # 管理員模組測試 (15 cases)
    ├── customer.test.ts    # 客戶模組測試 (12 cases)
    ├── staff.test.ts       # 員工模組測試 (20 cases)
    └── integration/        # 整合測試 (Integration Tests)
```

### 前端 (Frontend)

```
frontend/src/
└── __tests__/              # 組件測試
```

---

## 🚀 執行測試 (Running Tests)

### 後端測試

```powershell
cd backend

# 執行所有測試
npm test

# 執行特定檔案
npm test -- src/__tests__/auth.test.ts

# 執行符合模式的測試
npm test -- --grep "AUTH-REG"

# 監看模式 (Watch Mode)
npm test -- --watch

# 顯示詳細輸出 (Verbose)
npm test -- --reporter=verbose

# 執行效能測試
npm run benchmark        

# 生成 HTML 報告
npm run benchmark:report 
```

### 前端測試

```powershell
cd frontend

# 執行單元測試
npm run test:unit

# 監看模式
npm run test:unit -- --watch
```

---

## 📊 測試覆蓋模組 (Test Coverage)

### 後端模組覆蓋 (Backend Modules)

| 模組 | 測試檔案 | 案例數 | 狀態 |
|------|----------|--------|------|
| 認證 (Auth) | auth.test.ts | ~25 | ✅ Passed |
| 包裹 (Package) | packages.test.ts | ~35 | ✅ Passed |
| 追蹤 (Tracking) | tracking.test.ts | ~25 | ✅ Passed |
| 地圖 (Map) | map.test.ts | ~18 | ✅ Passed |
| 計費 (Billing) | billing.test.ts | ~15 | ✅ Passed |
| 管理員 (Admin) | admin.test.ts | ~15 | ✅ Passed |
| 客戶 (Customer) | customer.test.ts | ~12 | ✅ Passed |
| 員工 (Staff) | staff.test.ts | ~20 | ✅ Passed |

**總計：約 165 個測試案例**

---

## 🧪 測試類型說明 (Test Types)

### 正向測試 (Positive Tests)

驗證正常輸入下 API 的預期行為。

```typescript
it('AUTH-REG-001: 使用完整有效資料註冊', async () => {
  const { status, data } = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      user_name: '測試用戶',
      email: uniqueEmail(),
      password: 'testpass123',
      phone_number: uniquePhone(),
      address: '100,200'
    })
  })
  
  expect(status).toBe(200)
  expect(data.success).toBe(true)
  expect(data.token).toBeDefined()
})
```

### 負向測試 (Negative Tests)

驗證錯誤輸入時的錯誤處理。

```typescript
it('AUTH-REG-002: 缺少 user_name 應回傳 400', async () => {
  const { status } = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: uniqueEmail(),
      password: 'testpass123'
      // 缺少 user_name
    })
  })
  
  expect(status).toBe(400)
})
```

### 權限測試 (Permission Tests)

驗證角色權限控制。

```typescript
it('TRACK-EVT-008: customer 無權限建立事件', async () => {
  const { token } = await createTestUser() // customer 角色
  
  const { status } = await authenticatedRequest(
    '/api/packages/pkg-1/events',
    token,
    { method: 'POST', body: JSON.stringify({ status: 'picked_up', location: 'HUB_0' }) }
  )
  
  expect(status).toBe(403)
})
```

---

## 🛠️ 測試輔助函式 (Test Helpers)

位於 `backend/src/__tests__/helpers.ts`：

### 基本請求函式 (Request Functions)

```typescript
// 一般 API 請求
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>>

// 帶認證的 API 請求
export async function authenticatedRequest<T>(
  endpoint: string,
  token: string,
  options?: RequestInit
): Promise<ApiResponse<T>>
```

### 測試資料產生器 (Data Generators)

```typescript
// 產生唯一 Email
export const uniqueEmail = () => 
  `test_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`

// 產生唯一電話號碼
export const uniquePhone = () => 
  `09${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`
```

### 測試使用者建立 (Create Test User)

```typescript
// 建立測試使用者並回傳 token
export async function createTestUser(overrides = {}) {
  const userData = {
    user_name: '測試用戶',
    email: uniqueEmail(),
    password: 'testpass123',
    phone_number: uniquePhone(),
    address: '100,200',
    ...overrides
  }
  
  const { data } = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  })
  
  return { ...data, password: userData.password }
}
```

---

## ⚙️ 測試設定檔 (Configuration)

### 後端 (`backend/vitest.config.ts`)

```typescript
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' }
      }
    }
  }
})
```

### 前端 (`frontend/vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom'
  }
})
```

---

## 📝 撰寫新測試 (Writing New Tests)

### 命名慣例 (Naming Convention)

使用 `{模組}-{功能}-{編號}` 格式：

- `AUTH-REG-001` - 認證模組、註冊功能、第 1 案例
- `PKG-CREATE-005` - 包裹模組、建立功能、第 5 案例
- `MAP-ROUTE-003` - 地圖模組、路線功能、第 3 案例

### 測試檔案範本 (Template)

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { apiRequest, authenticatedRequest, createTestUser } from './helpers'

describe('模組名稱 API', () => {
  let token: string
  
  beforeAll(async () => {
    const user = await createTestUser()
    token = user.token
  })
  
  describe('功能名稱', () => {
    it('TEST-001: 測試案例描述', async () => {
      // Arrange
      const payload = { ... }
      
      // Act
      const { status, data } = await authenticatedRequest(
        '/api/endpoint',
        token,
        { method: 'POST', body: JSON.stringify(payload) }
      )
      
      // Assert
      expect(status).toBe(200)
      expect(data.success).toBe(true)
    })
  })
})
```

---

## 📚 相關文件 (Related Documentation)

- [測試計畫](vitest-plan.md) - 完整測試案例規劃
- [API 契約文件](api-contract.md) - API 規格參考
- [開發環境設定](getting-started.md) - 環境設定指南
