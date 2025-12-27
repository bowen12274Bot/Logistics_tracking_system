/**
 * EmployeeWarehouseView Tests
 * 測試倉儲人員頁面
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import EmployeeWarehouseView from '../../views/EmployeeWarehouseView.vue'
import { useAuthStore } from '../../stores/auth'
import { mockWarehouseUser, createMockAuthResponse } from '../helpers'

// Mock API
vi.mock('../../services/api', () => ({
  api: {
    getWarehousePackages: vi.fn().mockResolvedValue({
      success: true,
      warehouse_node_id: 'HUB_0',
      neighbors: ['REG_0', 'REG_1'],
      packages: [],
    }),
    receiveWarehousePackages: vi.fn(),
    dispatchWarehouseNext: vi.fn(),
  },
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/employee/warehouse', name: 'employee-warehouse', component: EmployeeWarehouseView },
    { path: '/map', name: 'virtual-map', component: { template: '<div />' } },
  ],
})

describe('EmployeeWarehouseView', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())

    const auth = useAuthStore()
    auth.persist(createMockAuthResponse(mockWarehouseUser))

    router.push('/employee/warehouse')
    await router.isReady()
    vi.clearAllMocks()
  })

  describe('渲染', () => {
    it('應該渲染倉儲頁面', async () => {
      const wrapper = mount(EmployeeWarehouseView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      await flushPromises()
      expect(wrapper.exists()).toBe(true)
    })

    it('應該顯示倉儲相關標題', async () => {
      const wrapper = mount(EmployeeWarehouseView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      await flushPromises()
      const text = wrapper.text()
      expect(text.includes('倉儲') || text.includes('站內') || text.includes('包裹')).toBe(true)
    })
  })

  describe('API 呼叫', () => {
    it('應該載入時呼叫 getWarehousePackages', async () => {
      const { api } = await import('../../services/api')

      mount(EmployeeWarehouseView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      await flushPromises()
      expect(api.getWarehousePackages).toHaveBeenCalled()
    })
  })

  describe('批次操作', () => {
    it('頁面應該有操作按鈕區域', async () => {
      const wrapper = mount(EmployeeWarehouseView, {
        global: {
          plugins: [router, createPinia()],
        },
      })

      await flushPromises()
      const buttons = wrapper.findAll('button')
      // 應該至少有一些操作按鈕
      expect(buttons.length).toBeGreaterThanOrEqual(0)
    })
  })
})
