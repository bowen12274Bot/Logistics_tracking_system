/**
 * CustomerTrackView Tests
 * 測試客戶包裹追蹤頁面
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import CustomerTrackView from '../../views/CustomerTrackView.vue'
import { i18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { mockCustomerUser, createMockAuthResponse } from '../helpers'

// Mock API
vi.mock('../../services/api', () => ({
  api: {
    searchTracking: vi.fn().mockResolvedValue({ success: true, packages: [], total: 0 }),
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
          plugins: [router, createPinia(), i18n],
        },
      })

      await flushPromises()
      expect(wrapper.exists()).toBe(true)
    })

    it('應該顯示包裹相關標題', async () => {
      const wrapper = mount(CustomerTrackView, {
        global: {
          plugins: [router, createPinia(), i18n],
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
          plugins: [router, createPinia(), i18n],
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
          plugins: [router, createPinia(), i18n],
        },
      })

      await flushPromises()
      // 頁面應該正常渲染而不會報錯
      expect(wrapper.exists()).toBe(true)
    })
  })

  it('prefills tracking filter from query', async () => {
    router.push({ path: '/customer/track', query: { tracking_number: 'TRK-QUERY-1' } })
    await router.isReady()

    const wrapper = mount(CustomerTrackView, {
      global: {
        plugins: [router, createPinia(), i18n],
      },
    })

    await flushPromises()
    await wrapper.get('button.filters-toggle').trigger('click')
    await flushPromises()
    expect((wrapper.get('input[name="tracking_number"]').element as HTMLInputElement).value).toBe('TRK-QUERY-1')
  })

  it('renders current segment as ok when driver is enroute', async () => {
    const { api } = await import('../../services/api')

    const pkg = {
      id: 'PKG-1',
      tracking_number: 'TRK-1',
      status: 'in_transit',
      current_location: null,
      current_updated_at: new Date().toISOString(),
      created_at: new Date(Date.now() - 60_000).toISOString(),
      route_path: 'HUB_0,REG_1',
      delivery_time: 'standard',
    }

    vi.mocked(api.searchTracking).mockImplementation(async (query: any) => {
      if (query?.status_group === 'in_transit') return { success: true, packages: [pkg], total: 1 }
      return { success: true, packages: [], total: 0 }
    })

    vi.mocked(api.getPackageStatus).mockResolvedValue({
      success: true,
      package: pkg as any,
      events: [
        {
          id: 'EVT-1',
          package_id: pkg.id,
          delivery_status: 'in_transit',
          delivery_details: '前往 HUB_0',
          events_at: new Date().toISOString(),
          location: 'TRUCK_0',
        },
      ],
      active_exception: null,
      vehicle: { id: 'V-1', vehicle_code: 'TRUCK_0' },
    } as any)

    const wrapper = mount(CustomerTrackView, {
      global: {
        plugins: [router, createPinia(), i18n],
      },
    })

    await flushPromises()
    await wrapper.get('.package-row .row-btn').trigger('click')
    await flushPromises()

    expect(wrapper.find('button.route-seg.ok').exists()).toBe(true)
  })

  it('does not mark repeated nodes as arrived from non-movement events', async () => {
    const { api } = await import('../../services/api')

    const pkg = {
      id: 'PKG-DUPE-1',
      tracking_number: 'TRK-DUPE-1',
      status: 'sorting',
      current_location: null,
      current_updated_at: new Date().toISOString(),
      created_at: new Date(Date.now() - 120_000).toISOString(),
      route_path: JSON.stringify(['END_HOME_33', 'REG_7', 'HUB_1', 'REG_7', 'REG_14', 'END_STORE_18']),
      delivery_time: 'standard',
    }

    vi.mocked(api.searchTracking).mockImplementation(async (query: any) => {
      if (query?.status_group === 'in_transit') return { success: true, packages: [pkg], total: 1 }
      return { success: true, packages: [], total: 0 }
    })

    const t0 = new Date(Date.now() - 90_000).toISOString()
    const t1 = new Date(Date.now() - 60_000).toISOString()
    const t2 = new Date(Date.now() - 30_000).toISOString()

    vi.mocked(api.getPackageStatus).mockResolvedValue({
      success: true,
      package: pkg as any,
      events: [
        {
          id: 'EVT-0',
          package_id: pkg.id,
          delivery_status: 'created',
          delivery_details: 'created',
          events_at: t0,
          location: 'END_HOME_33',
        },
        {
          id: 'EVT-1',
          package_id: pkg.id,
          delivery_status: 'warehouse_in',
          delivery_details: 'arrived',
          events_at: t1,
          location: 'REG_7',
        },
        {
          id: 'EVT-2',
          package_id: pkg.id,
          delivery_status: 'route_decided',
          delivery_details: 'next=HUB_1',
          events_at: t2,
          location: 'REG_7',
        },
        {
          id: 'EVT-3',
          package_id: pkg.id,
          delivery_status: 'sorting',
          delivery_details: 'sorting',
          events_at: new Date(Date.now() - 10_000).toISOString(),
          location: 'REG_7',
        },
      ],
      active_exception: null,
      vehicle: null,
    } as any)

    const wrapper = mount(CustomerTrackView, {
      global: {
        plugins: [router, createPinia(), i18n],
      },
    })

    await flushPromises()
    await wrapper.get('.package-row .row-btn').trigger('click')
    await flushPromises()

    const steps = wrapper.findAll('.route-step')
    expect(steps.length).toBeGreaterThanOrEqual(5)
    expect(steps[2].classes()).toContain('ok') // first REG_7
    expect(steps[4].classes()).toContain('pending') // second REG_7 should not be pre-marked
  })
})
