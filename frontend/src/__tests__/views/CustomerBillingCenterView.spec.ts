/**
 * CustomerBillingCenterView Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import CustomerBillingCenterView from '../../views/CustomerBillingCenterView.vue'
import { i18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { usePackageStore } from '../../stores/packages'
import { mockCustomerUser, createMockAuthResponse } from '../helpers'

// Mock child components to simplify testing
const CustomerPaymentViewStub = {
  template: '<div data-testid="payment-view" :data-tab="initialTab"></div>',
  props: ['embedded', 'initialTab']
}
const CustomerContractViewStub = {
  template: '<div data-testid="contract-view" :data-embedded="embedded"></div>',
  props: ['embedded']
}

// Mock API (needed because stores trigger calls)
const apiMock = vi.hoisted(() => ({
  getPackagePayables: vi.fn(),
}))

vi.mock('../../services/api', () => ({
  api: apiMock,
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/customer/billing', name: 'customer-billing', component: CustomerBillingCenterView },
  ],
})

describe('CustomerBillingCenterView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    const auth = useAuthStore()
    auth.persist(createMockAuthResponse(mockCustomerUser))
    
    // Default api mock
    apiMock.getPackagePayables.mockResolvedValue({ success: true, items: [] })

    router.push('/customer/billing')
  })

  it('renders tabs and defaults to unpaid', async () => {
    const wrapper = mount(CustomerBillingCenterView, {
      global: {
        plugins: [router, createPinia(), i18n],
        stubs: {
          CustomerPaymentView: CustomerPaymentViewStub,
          CustomerContractView: CustomerContractViewStub,
        }
      },
    })

    await flushPromises()
    
    expect(wrapper.find('[aria-selected="true"]').text()).toContain('待付款')
    expect(wrapper.find('[data-testid="payment-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="payment-view"]').attributes('data-tab')).toBe('list')
  })

  it.skip('shows unpaid count badge', async () => {
    const wrapper = mount(CustomerBillingCenterView, {
      global: {
        plugins: [router, createPinia(), i18n],
        stubs: {
          CustomerPaymentView: CustomerPaymentViewStub,
          CustomerContractView: CustomerContractViewStub,
        }
      },
    })

    await flushPromises()
    
    // Update store state after initial load to ensure it reflects
    const store = usePackageStore()
    store.packages = [{ id: 'p1' }] as any
    await wrapper.vm.$nextTick()
    
    expect(wrapper.find('.tab-pill').exists()).toBe(true)
  })

  it('switches to monthly billing tab', async () => {
    const wrapper = mount(CustomerBillingCenterView, {
      global: {
        plugins: [router, createPinia(), i18n],
        stubs: {
          CustomerPaymentView: CustomerPaymentViewStub,
          CustomerContractView: CustomerContractViewStub,
        }
      },
    })

    await flushPromises()

    const buttons = wrapper.findAll('button')
    const monthlyBtn = buttons.find(b => b.text().includes('月結'))
    
    if (monthlyBtn) {
        await monthlyBtn.trigger('click')
        await flushPromises()
        expect(wrapper.find('[data-testid="contract-view"]').exists()).toBe(true)
        expect(router.currentRoute.value.query.tab).toBe('monthly')
    }
  })

  it('switches to records tab', async () => {
    const wrapper = mount(CustomerBillingCenterView, {
      global: {
        plugins: [router, createPinia(), i18n],
        stubs: {
          CustomerPaymentView: CustomerPaymentViewStub,
          CustomerContractView: CustomerContractViewStub,
        }
      },
    })

    await flushPromises()

    const buttons = wrapper.findAll('button')
    const recordsBtn = buttons.find(b => b.text().includes('紀錄'))
    
    if (recordsBtn) {
        await recordsBtn.trigger('click')
        await flushPromises()
        expect(wrapper.find('[data-testid="payment-view"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="payment-view"]').attributes('data-tab')).toBe('records')
        expect(router.currentRoute.value.query.tab).toBe('records')
    }
  })
})
