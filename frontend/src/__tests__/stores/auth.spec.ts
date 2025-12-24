/**
 * Auth Store Tests
 * 測試 Pinia Auth Store 的登入、登出、持久化功能
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../../stores/auth'
import {
  mockCustomerUser,
  mockDriverUser,
  createMockAuthResponse,
  mockLocalStorage,
} from '../helpers'

// Mock localStorage
const localStorageMock = mockLocalStorage()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock API module
vi.mock('../../services/api', () => ({
  api: {
    login: vi.fn(),
    register: vi.fn(),
  },
}))

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('初始狀態', () => {
    it('未登入時 user 和 token 應為 null', () => {
      const auth = useAuthStore()
      expect(auth.user).toBeNull()
      expect(auth.token).toBeNull()
    })

    it('未登入時 isLoggedIn 應為 false', () => {
      const auth = useAuthStore()
      expect(auth.isLoggedIn).toBe(false)
    })
  })

  describe('persist()', () => {
    it('應該儲存 user 和 token 到 state', () => {
      const auth = useAuthStore()
      const mockAuth = createMockAuthResponse(mockCustomerUser)

      auth.persist(mockAuth)

      expect(auth.user).toEqual(mockCustomerUser)
      expect(auth.token).toBe(mockAuth.token)
    })

    it('應該將認證資料儲存到 localStorage', () => {
      const auth = useAuthStore()
      const mockAuth = createMockAuthResponse(mockCustomerUser)

      auth.persist(mockAuth)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'logisim-auth',
        expect.any(String)
      )

      const stored = JSON.parse(localStorageMock._store['logisim-auth'])
      expect(stored.user).toEqual(mockCustomerUser)
      expect(stored.token).toBe(mockAuth.token)
    })

    it('persist 後 isLoggedIn 應為 true', () => {
      const auth = useAuthStore()
      const mockAuth = createMockAuthResponse(mockDriverUser)

      auth.persist(mockAuth)

      expect(auth.isLoggedIn).toBe(true)
    })
  })

  describe('logout()', () => {
    it('應該清除 user 和 token', () => {
      const auth = useAuthStore()
      auth.persist(createMockAuthResponse(mockCustomerUser))

      auth.logout()

      expect(auth.user).toBeNull()
      expect(auth.token).toBeNull()
    })

    it('應該移除 localStorage 中的認證資料', () => {
      const auth = useAuthStore()
      auth.persist(createMockAuthResponse(mockCustomerUser))

      auth.logout()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('logisim-auth')
    })

    it('logout 後 isLoggedIn 應為 false', () => {
      const auth = useAuthStore()
      auth.persist(createMockAuthResponse(mockCustomerUser))

      auth.logout()

      expect(auth.isLoggedIn).toBe(false)
    })
  })

  describe('role getter', () => {
    it('未登入時 role 應為 undefined', () => {
      const auth = useAuthStore()
      expect(auth.role).toBeUndefined()
    })

    it('客戶登入後應返回 contract_customer', () => {
      const auth = useAuthStore()
      auth.persist(createMockAuthResponse(mockCustomerUser))

      expect(auth.role).toBe('contract_customer')
    })

    it('司機登入後應返回 driver', () => {
      const auth = useAuthStore()
      auth.persist(createMockAuthResponse(mockDriverUser))

      expect(auth.role).toBe('driver')
    })
  })

  describe('setUser()', () => {
    it('應該更新 user 資料', () => {
      const auth = useAuthStore()
      auth.persist(createMockAuthResponse(mockCustomerUser))

      const updatedUser = { ...mockCustomerUser, user_name: '更新名稱' }
      auth.setUser(updatedUser)

      expect(auth.user?.user_name).toBe('更新名稱')
    })

    it('應該同步更新 localStorage', () => {
      const auth = useAuthStore()
      auth.persist(createMockAuthResponse(mockCustomerUser))

      const updatedUser = { ...mockCustomerUser, user_name: '更新名稱' }
      auth.setUser(updatedUser)

      const stored = JSON.parse(localStorageMock._store['logisim-auth'])
      expect(stored.user.user_name).toBe('更新名稱')
    })
  })

  describe('login()', () => {
    it('應該呼叫 API 並儲存認證資料', async () => {
      const { api } = await import('../../services/api')
      const mockAuth = createMockAuthResponse(mockCustomerUser)
      vi.mocked(api.login).mockResolvedValue(mockAuth)

      const auth = useAuthStore()
      const result = await auth.login({
        identifier: 'test@test.com',
        password: 'password123',
      })

      expect(api.login).toHaveBeenCalledWith({
        identifier: 'test@test.com',
        password: 'password123',
      })
      expect(result).toEqual(mockCustomerUser)
      expect(auth.isLoggedIn).toBe(true)
    })
  })

  describe('register()', () => {
    it('應該呼叫 API 並儲存認證資料', async () => {
      const { api } = await import('../../services/api')
      const mockAuth = createMockAuthResponse(mockCustomerUser)
      vi.mocked(api.register).mockResolvedValue(mockAuth)

      const auth = useAuthStore()
      const result = await auth.register({
        user_name: '新用戶',
        email: 'new@test.com',
        password: 'password123',
        phone_number: '0912345678',
        address: 'END_HOME_0',
      })

      expect(api.register).toHaveBeenCalled()
      expect(result).toEqual(mockCustomerUser)
      expect(auth.isLoggedIn).toBe(true)
    })
  })
})
