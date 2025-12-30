# 測試指南 (Testing Guide)

本文件說明物流追蹤系統的測試架構與執行方式。

> [!NOTE]
> 最後更新時間：2025-12-30


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
├── index.test.ts                          # 主要整合測試
└── __tests__/
    ├── helpers.ts                         # 測試輔助函式
    ├── authTestUtils.ts                   # 認證測試工具
    ├── setup.ts                           # 測試環境設定
    │
    │  # 認證模組 (Auth)
    ├── auth.test.ts                       # 認證測試 (18 cases)
    │
    │  # 管理員模組 (Admin)
    ├── admin.test.ts                      # 管理員基本功能 (7 cases)
    ├── adminErrors.test.ts                # 管理員錯誤處理 (6 cases)
    ├── adminReports.test.ts               # 管理員報表 (5 cases)
    ├── adminUserMgmt.test.ts              # 使用者管理 (8 cases)
    │
    │  # 計費模組 (Billing)
    ├── billing.test.ts                    # 計費基本功能 (7 cases)
    ├── billingAdmin.test.ts               # 計費管理 (9 cases)
    ├── billingPayments.test.ts            # 付款處理 (6 cases)
    │
    │  # 包裹模組 (Package)
    ├── packages.test.ts                   # 包裹 CRUD (17 cases)
    ├── packagePayments.test.ts            # 包裹付款 (3 cases)
    ├── packageExceptionEdgeCases.test.ts  # 包裹異常邊界案例 (10 cases)
    │
    │  # 追蹤模組 (Tracking)
    ├── tracking.test.ts                   # 追蹤功能 (6 cases)
    ├── trackingSearch.test.ts             # 追蹤搜尋 (12 cases)
    │
    │  # 地圖模組 (Map)
    ├── map.test.ts                        # 地圖功能 (12 cases)
    ├── mapUpdate.test.ts                  # 地圖更新 (5 cases)
    │
    │  # 司機模組 (Driver)
    ├── driverTaskPool.test.ts             # 任務池管理 (2 cases)
    ├── driverTaskEnRoute.test.ts          # 途中狀態 (2 cases)
    ├── driverTaskArrive.test.ts           # 到達處理 (4 cases)
    ├── driverArrivePanel.test.ts          # 到達面板 (1 case)
    ├── driverCollectCash.test.ts          # 現金收取 (4 cases)
    ├── driverPickupCustomerStatus.test.ts # 取件客戶狀態 (1 case)
    │
    │  # 倉庫模組 (Warehouse)
    ├── warehouse.test.ts                  # 倉庫基本功能 (4 cases)
    ├── warehouseOperations.test.ts        # 倉庫作業 (8 cases)
    │
    │  # 客戶模組 (Customer)
    ├── customer.test.ts                   # 客戶功能 (10 cases)
    ├── customerExists.test.ts             # 客戶存在檢查 (4 cases)
    │
    │  # 客服模組 (Customer Service)
    ├── csContracts.test.ts                # 合約處理 (2 cases)
    ├── csExceptions.test.ts               # 異常處理 (8 cases)
    ├── contractApplicationStatus.test.ts  # 合約申請狀態 (0 cases)
    │
    │  # 員工模組 (Staff)
    ├── staff.test.ts                      # 員工功能 (4 cases)
    │
    │  # 車輛模組 (Vehicle)
    ├── vehicles.test.ts                   # 車輛管理 (4 cases)
    ├── vehiclesCargoMe.test.ts            # 車輛貨物關聯 (4 cases)
    │
    │  # 其他模組 (Others)
    ├── cargoFlow.test.ts                  # 貨物流程 (3 cases)
    ├── deliverySignature.test.ts          # 簽收功能 (2 cases)
    ├── internationalFlow.test.ts          # 國際運送流程 (3 cases)
    ├── pricing.test.ts                    # 計價功能 (10 cases)
    ├── serviceRules.test.ts               # 服務規則 (3 cases)
    ├── taskFetch.test.ts                  # 任務獲取 (3 cases)
    │
    │  # 效能測試 (Performance)
    ├── benchmark.test.ts                  # 效能基準測試 (2 cases)
    │
    └── integration/                       # 整合測試 (Integration Tests)
```

### 前端 (Frontend)

```
frontend/src/
├── __tests__/
│   ├── helpers.ts                             # 測試輔助函式
│   ├── setup.ts                               # 測試環境設定
│   │
│   ├── services/
│   │   └── api-auth-redirect.spec.ts          # API 認證重導向 (3 cases)
│   │
│   ├── stores/
│   │   ├── auth.spec.ts                       # Auth Store (15 cases)
│   │   ├── counter.spec.ts                    # Counter Store (2 cases)
│   │   └── packages.spec.ts                   # Packages Store (6 cases)
│   │
│   └── views/
│       ├── AboutView.spec.ts                  # 關於頁面 (1 case)
│       ├── AdminView.spec.ts                  # 管理員頁面 (0 cases, 待實作)
│       ├── AdminView.i18n.spec.ts             # 管理員 i18n (1 case)
│       ├── CustomerBillingCenterView.spec.ts  # 客戶帳單中心 (3 cases)
│       ├── CustomerContractView.spec.ts       # 客戶合約 (5 cases)
│       ├── CustomerDashboard.spec.ts          # 客戶儀表板 (1 case)
│       ├── CustomerPaymentView.spec.ts        # 客戶付款 (5 cases)
│       ├── CustomerProfileView.spec.ts        # 客戶個人資料 (3 cases)
│       ├── CustomerSendView.spec.ts           # 客戶寄件 (9 cases)
│       ├── CustomerTrackView.spec.ts          # 客戶追蹤 (6 cases)
│       ├── DriverMapView.spec.ts              # 司機地圖 (3 cases)
│       ├── EmployeeCustomerServiceView.spec.ts # 客服員工 (4 cases)
│       ├── EmployeeDriverView.spec.ts         # 司機員工 (5 cases)
│       ├── EmployeeWarehouseView.spec.ts      # 倉庫員工 (2 cases)
│       ├── ForbiddenView.spec.ts              # 禁止訪問 (5 cases)
│       ├── HomeView.spec.ts                   # 首頁 (3 cases)
│       ├── LoginView.spec.ts                  # 登入頁面 (7 cases)
│       ├── PublicTrackView.spec.ts            # 公開追蹤 (3 cases)
│       ├── ShippingEstimateView.spec.ts       # 運費估算 (0 cases, 待實作)
│       └── VirtualMapView.spec.ts             # 虛擬地圖 (5 cases)
│
└── components/
    ├── __tests__/
    │   └── UiButton.spec.ts                   # 按鈕組件 (5 cases)
    │
    └── ui/__tests__/
        ├── UiCard.spec.ts                     # 卡片組件 (1 case)
        ├── UiModal.spec.ts                    # 模態框組件 (4 cases)
        └── UiNotice.spec.ts                   # 通知組件 (3 cases)
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

# 生成覆蓋率報告
npm run test:unit -- --coverage
```

---

## 📊 測試覆蓋模組 (Test Coverage)

### 後端模組覆蓋 (Backend Modules)

| 模組 | 測試檔案數 | 案例數 | 狀態 |
|------|------------|--------|------|
| 認證 (Auth) | 1 | 18 | ✅ Passed |
| 管理員 (Admin) | 4 | 26 | ✅ Passed |
| 計費 (Billing) | 3 | 22 | ✅ Passed |
| 包裹 (Package) | 3 | 30 | ✅ Passed |
| 追蹤 (Tracking) | 2 | 18 | ✅ Passed |
| 地圖 (Map) | 2 | 17 | ✅ Passed |
| 司機 (Driver) | 6 | 14 | ✅ Passed |
| 倉庫 (Warehouse) | 2 | 12 | ✅ Passed |
| 客戶 (Customer) | 2 | 14 | ✅ Passed |
| 客服 (CS) | 3 | 10 | ✅ Passed |
| 員工 (Staff) | 1 | 4 | ✅ Passed |
| 車輛 (Vehicle) | 2 | 8 | ✅ Passed |
| 其他 (Others) | 6 | 24 | ✅ Passed |
| 效能 (Benchmark) | 1 | 2 | ✅ Passed |

**後端總計：38 個測試檔案、約 219 個測試案例**

### 前端模組覆蓋 (Frontend Modules)

| 模組 | 測試檔案數 | 案例數 | 狀態 |
|------|------------|--------|------|
| Stores | 3 | 23 | ✅ Passed |
| Services | 1 | 3 | ✅ Passed |
| Views | 20 | 67 | ✅ Passed |
| Components | 4 | 13 | ✅ Passed |

**前端總計：28 個測試檔案、約 106 個測試案例**

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

### 認證測試工具 (Auth Test Utils)

位於 `backend/src/__tests__/authTestUtils.ts`：

```typescript
// 測試 401 未授權回應
export async function test401Unauthorized(
  endpoint: string,
  method: string = 'GET',
  body?: object
): Promise<void>
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
- [API 契約文件](../reference/api-contract.md) - API 規格參考
- [開發環境設定](getting-started.md) - 環境設定指南
