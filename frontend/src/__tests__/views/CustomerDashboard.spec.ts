import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import CustomerDashboard from '../../views/CustomerDashboard.vue'
import { useAuthStore } from '../../stores/auth'
import { mockCustomerUser, createMockAuthResponse } from '../helpers'

vi.mock('../../services/api', () => ({
  api: {
    getPackagePayables: vi.fn().mockResolvedValue({ success: true, items: [] }),
    searchTracking: vi.fn().mockImplementation(({ status_group }: any) => {
      if (status_group === 'in_transit') {
        return Promise.resolve({
          success: true,
          total: 2,
          packages: [
            { id: 'p1', tracking_number: 'TRK-TEST-1', created_at: '2025-01-01 10:00:00' },
            { id: 'p2', tracking_number: 'TRK-TEST-2', created_at: '2025-01-02 10:00:00' },
          ],
        })
      }
      return Promise.resolve({ success: true, total: 5, packages: [] })
    }),
  },
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/customer', name: 'customer-dashboard', component: CustomerDashboard },
    { path: '/customer/track', name: 'customer-track', component: { template: '<div />' } },
    { path: '/customer/send', name: 'customer-send', component: { template: '<div />' } },
    { path: '/customer/profile', name: 'customer-profile', component: { template: '<div />' } },
    { path: '/customer/contract', name: 'customer-contract', component: { template: '<div />' } },
    { path: '/customer/payment', name: 'customer-payment', component: { template: '<div />' } },
  ],
})

describe('CustomerDashboard', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())

    const auth = useAuthStore()
    auth.persist(createMockAuthResponse(mockCustomerUser))

    router.push('/customer')
    await router.isReady()
    vi.clearAllMocks()
  })

  it('renders quick links and summary', async () => {
    const wrapper = mount(CustomerDashboard, {
      global: {
        plugins: [router, createPinia()],
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('你的包裹主控台')
    expect(wrapper.text()).toContain('概況')
    expect(wrapper.text()).toContain('TRK-TEST-2')
  })
})

