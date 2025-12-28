/**
 * EmployeeWarehouseView i18n smoke tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { i18n } from '../../i18n'
import EmployeeWarehouseView from '../../views/EmployeeWarehouseView.vue'

vi.mock('../../services/api', () => ({
  api: {
    getWarehousePackages: vi.fn().mockResolvedValue({
      success: true,
      packages: [],
      node_id: 'HUB_0',
      adjacent_nodes: [],
    }),
    getExceptions: vi.fn().mockResolvedValue({ success: true, records: [] }),
  },
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', name: 'home', component: { template: '<div />' } }],
})

describe('EmployeeWarehouseView', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'en-US'
    router.push('/')
    await router.isReady()
  })

  it('renders key sections with i18n text', async () => {
    const wrapper = mount(EmployeeWarehouseView, {
      global: {
        plugins: [router, createPinia(), i18n],
      },
    })

    expect(wrapper.text()).toContain(i18n.global.t('warehouse.page.title'))
    expect(wrapper.text()).toContain(i18n.global.t('warehouse.section.receive.title'))
    expect(wrapper.text()).toContain(i18n.global.t('warehouse.section.sorting.title'))
    expect(wrapper.text()).toContain(i18n.global.t('warehouse.section.dispatched.title'))
    expect(wrapper.text()).toContain(i18n.global.t('warehouse.section.exceptions.title'))
  })
})
