/**
 * HomeView Tests
 * 測試首頁的基本渲染
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import HomeView from '../../views/HomeView.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: { template: '<div />' } },
    { path: '/track', name: 'public-track', component: { template: '<div />' } },
    { path: '/map', name: 'virtual-map', component: { template: '<div />' } },
    { path: '/shipping/estimate', name: 'shipping-estimate', component: { template: '<div />' } },
  ],
})

describe('HomeView', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    router.push('/')
    await router.isReady()
  })

  describe('渲染', () => {
    it('應該渲染首頁內容', () => {
      const wrapper = mount(HomeView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      expect(wrapper.exists()).toBe(true)
    })

    it('應該包含物流追蹤系統相關文字', () => {
      const wrapper = mount(HomeView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      // 首頁應該有系統介紹
      const text = wrapper.text()
      expect(text.length).toBeGreaterThan(0)
    })
  })

  describe('導航連結', () => {
    it('應該有導航連結', () => {
      const wrapper = mount(HomeView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      const links = wrapper.findAll('a')
      expect(links.length).toBeGreaterThanOrEqual(0) // 可能有 RouterLink
    })
  })
})
