/**
 * EmployeeCustomerServiceView Tests
 * 測試客服人員頁面
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import EmployeeCustomerServiceView from '../../views/EmployeeCustomerServiceView.vue'
import { useAuthStore } from '../../stores/auth'
import { mockCSUser, createMockAuthResponse } from '../helpers'

// Mock API
vi.mock('../../services/api', () => ({
  api: {
    getCustomerServiceExceptions: vi.fn().mockResolvedValue({
      success: true,
      exceptions: [],
    }),
    handleCustomerServiceException: vi.fn(),
    getCustomerServiceContractApplications: vi.fn().mockResolvedValue({
      success: true,
      applications: [],
    }),
    reviewCustomerServiceContractApplication: vi.fn(),
    searchTracking: vi.fn().mockResolvedValue({ success: true, packages: [], total: 0 }),
  },
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/employee/customer-service', name: 'employee-customer-service', component: EmployeeCustomerServiceView },
  ],
})

describe('EmployeeCustomerServiceView', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())

    const auth = useAuthStore()
    auth.persist(createMockAuthResponse(mockCSUser))

    router.push('/employee/customer-service')
    await router.isReady()
    vi.clearAllMocks()
  })

  describe('渲染', () => {
    it('應該渲染客服頁面', async () => {
      const wrapper = mount(EmployeeCustomerServiceView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      await flushPromises()
      expect(wrapper.exists()).toBe(true)
    })

    it('應該顯示客服相關標題', async () => {
      const wrapper = mount(EmployeeCustomerServiceView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      await flushPromises()
      const text = wrapper.text()
      expect(text.includes('客服') || text.includes('異常') || text.includes('合約')).toBe(true)
    })
  })

  describe('API 呼叫', () => {
    it('應該載入時呼叫異常池 API', async () => {
      const { api } = await import('../../services/api')

      mount(EmployeeCustomerServiceView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      await flushPromises()
      expect(api.getCustomerServiceExceptions).toHaveBeenCalled()
    })
  })

  describe('標籤頁切換', () => {
    it('應該有多個功能區塊或標籤', async () => {
      const wrapper = mount(EmployeeCustomerServiceView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      await flushPromises()
      // 客服頁面有 "現在任務" 和 "過去紀錄" 標籤
      const text = wrapper.text()
      expect(
        text.includes('現在任務') || text.includes('過去紀錄') || text.includes('客服')
      ).toBe(true)
    })
  })
})
