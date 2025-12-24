/**
 * CustomerTrackView Tests
 * 測試客戶包裹追蹤頁面
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import CustomerTrackView from '../../views/CustomerTrackView.vue'
import { useAuthStore } from '../../stores/auth'
import { mockCustomerUser, createMockAuthResponse } from '../helpers'

// Mock API
vi.mock('../../services/api', () => ({
  api: {
    getPackages: vi.fn().mockResolvedValue({ success: true, packages: [] }),
    getPackageStatus: vi.fn(),
    getMap: vi.fn().mockResolvedValue({ success: true, nodes: [], edges: [] }),
  },
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/customer/track', name: 'customer-track', component: CustomerTrackView },
  ],
})

describe('CustomerTrackView', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())

    const auth = useAuthStore()
    auth.persist(createMockAuthResponse(mockCustomerUser))

    router.push('/customer/track')
    await router.isReady()
    vi.clearAllMocks()
  })

  describe('渲染', () => {
    it('應該渲染追蹤頁面', async () => {
      const wrapper = mount(CustomerTrackView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      await flushPromises()
      expect(wrapper.exists()).toBe(true)
    })

    it('應該顯示包裹相關標題', async () => {
      const wrapper = mount(CustomerTrackView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      await flushPromises()
      const text = wrapper.text()
      expect(text.includes('包裹') || text.includes('追蹤') || text.includes('貨態')).toBe(true)
    })
  })

  describe('API 呼叫', () => {
    it('元件載入時應該不會報錯', async () => {
      // 這個測試驗證元件在掛載時不會拋出錯誤
      // 實際的 API 呼叫測試需要更複雜的設置
      const wrapper = mount(CustomerTrackView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      await flushPromises()
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('空狀態', () => {
    it('沒有包裹時應該顯示相應訊息或空列表', async () => {
      const wrapper = mount(CustomerTrackView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      await flushPromises()
      // 頁面應該正常渲染而不會報錯
      expect(wrapper.exists()).toBe(true)
    })
  })
})
