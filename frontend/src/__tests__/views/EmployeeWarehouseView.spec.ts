/**
 * EmployeeWarehouseView Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import EmployeeWarehouseView from '../../views/EmployeeWarehouseView.vue'
import { i18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { mockWarehouseUser, createMockAuthResponse } from '../helpers'

vi.mock('../../services/api', () => ({
  api: {
    getWarehousePackages: vi.fn().mockResolvedValue({
      success: true,
      warehouse_node_id: 'HUB_0',
      neighbors: ['REG_0', 'REG_1'],
      packages: [],
    }),
    getWarehouseExceptionReports: vi.fn().mockResolvedValue({
      success: true,
      exceptions: [],
    }),
    receiveWarehousePackages: vi.fn(),
    dispatchWarehouseNext: vi.fn(),
    reportWarehouseException: vi.fn(),
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

  it('renders station header and tabs', async () => {
    const wrapper = mount(EmployeeWarehouseView, {
      global: {
        plugins: [router, createPinia()],
      },
    })

    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('HUB_0')
    expect(text).toContain(i18n.global.t('warehouse.page.title'))
    expect(text).toContain(i18n.global.t('warehouse.stats.awaitReceive'))
    expect(text).toContain(i18n.global.t('warehouse.stats.sorting'))
    expect(text).toContain(i18n.global.t('warehouse.stats.dispatched'))
  })

  it('calls warehouse APIs on mount', async () => {
    const { api } = await import('../../services/api')

    mount(EmployeeWarehouseView, {
      global: {
        plugins: [router, createPinia()],
      },
    })

    await flushPromises()
    expect(api.getWarehousePackages).toHaveBeenCalled()
    expect(api.getWarehouseExceptionReports).toHaveBeenCalled()
  })
})

