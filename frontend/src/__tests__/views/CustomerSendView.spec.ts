/**
 * CustomerSendView Tests
 * 測試寄件頁面的表單驗證與建立包裹功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import CustomerSendView from '../../views/CustomerSendView.vue'
import { i18n } from '@/i18n'
import { useAuthStore } from '../../stores/auth'
import { mockCustomerUser, createMockAuthResponse } from '../helpers'

// Mock API
vi.mock('../../services/api', () => ({
  api: {
    getMe: vi.fn().mockResolvedValue({ success: true, user: null }),
    createPackage: vi.fn(),
    estimatePackage: vi.fn(),
    customerExists: vi.fn().mockResolvedValue({ success: true, exists: false }),
  },
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/customer/send', name: 'customer-send', component: CustomerSendView },
    { path: '/customer/payment', name: 'customer-payment', component: { template: '<div />' } },
  ],
})

describe('CustomerSendView', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())

    // 設置登入狀態
    const auth = useAuthStore()
    auth.persist(createMockAuthResponse(mockCustomerUser))

    router.push('/customer/send')
    await router.isReady()
    vi.clearAllMocks()
  })

  describe('渲染', () => {
    it('應該渲染寄件表單', () => {
      const wrapper = mount(CustomerSendView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      expect(wrapper.text()).toContain('寄件')
    })

    it('應該有寄件人資訊區塊', () => {
      const wrapper = mount(CustomerSendView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      expect(wrapper.text()).toContain('寄件人')
    })

    it('應該有收件人資訊區塊', () => {
      const wrapper = mount(CustomerSendView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      expect(wrapper.text()).toContain('收件人')
    })
  })

  describe('表單驗證', () => {
    it('地址欄位應該存在', () => {
      const wrapper = mount(CustomerSendView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      const inputs = wrapper.findAll('input')
      expect(inputs.length).toBeGreaterThan(3)
    })
  })

  describe('運費試算', () => {
    it('應該有配送時效選項', () => {
      const wrapper = mount(CustomerSendView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      // 檢查是否有時效相關文字
      const text = wrapper.text()
      expect(
        text.includes('隔日') ||
          text.includes('標準') ||
          text.includes('經濟') ||
          text.includes('兩日')
      ).toBe(true)
    })
  })

  describe('付款方式', () => {
    it('應該有付款方式選項', () => {
      const wrapper = mount(CustomerSendView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      const text = wrapper.text()
      expect(text.includes('預付') || text.includes('到付')).toBe(true)
    })
  })
})
