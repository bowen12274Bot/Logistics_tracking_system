/**
 * LoginView Tests
 * 測試登入/註冊頁面的基本功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import LoginView from '../../views/LoginView.vue'
import { i18n } from '@/i18n'
import { mockCustomerUser, createMockAuthResponse } from '../helpers'

// Mock API
vi.mock('../../services/api', () => ({
  api: {
    login: vi.fn(),
    register: vi.fn(),
  },
}))

// Create minimal router
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div />' } },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/customer', name: 'customer-dashboard', component: { template: '<div />' } },
  ],
})

describe('LoginView', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    router.push('/login')
    await router.isReady()
    vi.clearAllMocks()
  })

  describe('渲染', () => {
    it('應該渲染登入/註冊標籤切換', () => {
      const wrapper = mount(LoginView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      expect(wrapper.text()).toContain('登入')
      expect(wrapper.text()).toContain('註冊')
    })

    it('預設應該顯示登入表單', () => {
      const wrapper = mount(LoginView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      // 登入表單應包含 identifier 輸入框
      const inputs = wrapper.findAll('input')
      expect(inputs.length).toBeGreaterThanOrEqual(2)
    })

    it('應該顯示快速測試帳號區塊', () => {
      const wrapper = mount(LoginView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      expect(wrapper.text()).toContain('快速測試帳號')
    })
  })

  describe('登入功能', () => {
    it('點擊登入按鈕應觸發登入', async () => {
      const { api } = await import('../../services/api')
      vi.mocked(api.login).mockResolvedValue(createMockAuthResponse(mockCustomerUser))

      const wrapper = mount(LoginView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      // 找到輸入框並填寫
      const inputs = wrapper.findAll('input')
      await inputs[0].setValue('test@example.com')
      await inputs[1].setValue('password123')

      // 提交表單
      const form = wrapper.find('form')
      await form.trigger('submit.prevent')
      await flushPromises()

      expect(api.login).toHaveBeenCalledWith({
        identifier: 'test@example.com',
        password: 'password123',
      })
    })
  })

  describe('快速測試帳號', () => {
    it('應該有多個測試帳號按鈕', () => {
      const wrapper = mount(LoginView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      const testButtons = wrapper.findAll('.test-account-btn')
      expect(testButtons.length).toBeGreaterThan(0)
    })
  })

  describe('模式切換', () => {
    it('點擊註冊標籤應切換到註冊表單', async () => {
      const wrapper = mount(LoginView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      // 找到註冊標籤並點擊
      const tabs = wrapper.findAll('[role="tab"]')
      const registerTab = tabs.find((t) => t.text().includes('註冊'))
      if (registerTab) {
        await registerTab.trigger('click')
        await flushPromises()

        // 註冊表單應該有更多欄位
        const inputs = wrapper.findAll('input')
        expect(inputs.length).toBeGreaterThan(2)
      }
    })
  })
})
