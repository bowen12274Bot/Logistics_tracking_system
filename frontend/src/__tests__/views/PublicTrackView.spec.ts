/**
 * PublicTrackView Tests
 * 測試公開追蹤頁面功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import PublicTrackView from '../../views/PublicTrackView.vue'

// Mock API
vi.mock('../../services/api', () => ({
  api: {
    getTrackingPublic: vi.fn(),
  },
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/track', name: 'public-track', component: PublicTrackView },
  ],
})

describe('PublicTrackView', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    router.push('/track')
    await router.isReady()
    vi.clearAllMocks()
  })

  describe('渲染', () => {
    it('應該渲染追蹤輸入欄位', () => {
      const wrapper = mount(PublicTrackView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      const input = wrapper.find('input')
      expect(input.exists()).toBe(true)
    })

    it('應該有查詢按鈕', () => {
      const wrapper = mount(PublicTrackView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      const button = wrapper.find('button')
      expect(button.exists()).toBe(true)
    })
  })

  describe('查詢功能', () => {
    it('輸入追蹤號碼後點擊查詢應呼叫 API', async () => {
      const { api } = await import('../../services/api')
      vi.mocked(api.getTrackingPublic).mockResolvedValue({
        success: true,
        tracking_number: 'TRK12345',
        current_status: 'in_transit',
        current_location: 'HUB_0',
        estimated_delivery: '2025-12-25',
        events: [],
      })

      const wrapper = mount(PublicTrackView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      const input = wrapper.find('input')
      await input.setValue('TRK12345')

      const form = wrapper.find('form')
      if (form.exists()) {
        await form.trigger('submit.prevent')
      } else {
        const button = wrapper.find('button')
        await button.trigger('click')
      }
      await flushPromises()

      expect(api.getTrackingPublic).toHaveBeenCalledWith('TRK12345')
    })
  })
})
