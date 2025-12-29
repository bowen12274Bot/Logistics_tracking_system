/**
 * CustomerPaymentView Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import CustomerPaymentView from '../../views/CustomerPaymentView.vue'
import { i18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { mockCustomerUser, createMockAuthResponse } from '../helpers'

// Mock API
const apiMock = vi.hoisted(() => ({
  getPackagePayables: vi.fn(),
  getBillingPayments: vi.fn(),
  setPackagePaymentMethod: vi.fn(),
  payPackage: vi.fn(),
  getBillingBillDetail: vi.fn(),
}))

vi.mock('../../services/api', () => ({
  api: apiMock,
}))

vi.mock('../../services/errorToast', () => ({
  toastFromApiError: vi.fn(),
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/customer/payment', name: 'customer-payment', component: CustomerPaymentView },
    { path: '/customer/track', name: 'customer-track', component: { template: '<div />' } },
    { path: '/customer/send', name: 'customer-send', component: { template: '<div />' } },
  ],
})

describe('CustomerPaymentView', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    const auth = useAuthStore()
    auth.persist(createMockAuthResponse(mockCustomerUser))

    // Default mock responses
    apiMock.getPackagePayables.mockResolvedValue({
      success: true,
      items: [
        {
          package: {
            id: 'pkg_1',
            tracking_number: 'TRK-001',
            payment_method: 'cash',
            amount: 100,
          },
          amount: 100,
          payable_now: true,
        },
      ],
    })
    apiMock.getBillingPayments.mockResolvedValue({ success: true, payments: [] })

    router.push('/customer/payment')
    await router.isReady()
  })

  it('renders list of unpaid packages', async () => {
    const wrapper = mount(CustomerPaymentView, {
      global: {
        plugins: [router, createPinia(), i18n],
        stubs: { Teleport: true },
      },
    })

    await flushPromises()
    expect(apiMock.getPackagePayables).toHaveBeenCalled()
    expect(wrapper.text()).toContain('TRK-001')
    expect(wrapper.text()).toContain('100 元')
  })

  it('expands package details on click', async () => {
    const wrapper = mount(CustomerPaymentView, {
      global: {
        plugins: [router, createPinia(), i18n],
        stubs: { Teleport: true },
      },
    })

    await flushPromises()
    
    // Find row button
    const rowBtn = wrapper.find('.row-btn')
    await rowBtn.trigger('click')
    
    expect(wrapper.find('.package-detail').exists()).toBe(true)
    
    const detail = wrapper.find('.package-detail')
    // Check for button existence first
    const confirmBtn = detail.find('button.ghost-btn')
    expect(confirmBtn.exists()).toBe(true)
    
    // Check text broadly
    expect(confirmBtn.text()).toMatch(/確認|Confirm|Pay/)
  })

  it('updates payment method', async () => {
    const wrapper = mount(CustomerPaymentView, {
      global: {
        plugins: [router, createPinia(), i18n],
        stubs: { Teleport: true },
      },
    })

    await flushPromises()
    
    // Open detail
    await wrapper.find('.row-btn').trigger('click')
    
    // Change select
    const select = wrapper.find('select[name="paymentChoice"]')
    await select.setValue('credit_card')
    
    expect(apiMock.setPackagePaymentMethod).toHaveBeenCalledWith('pkg_1', { payment_method: 'credit_card' })
  })

  it('confirms payment', async () => {
    apiMock.payPackage.mockResolvedValue({ success: true })
    
    const wrapper = mount(CustomerPaymentView, {
      global: {
        plugins: [router, createPinia(), i18n],
        stubs: { Teleport: true },
      },
    })

    await flushPromises()
    
    // Open detail
    await wrapper.find('.row-btn').trigger('click')
    
    // Click pay
    const payBtn = wrapper.find('.package-detail button.ghost-btn') 
    
    // Check text broadly
    expect(payBtn.exists()).toBe(true)
    expect(payBtn.text()).toMatch(/確認|Confirm|Pay/)
    
    if (payBtn.exists()) {
        await payBtn.trigger('click')
        expect(apiMock.payPackage).toHaveBeenCalled()
        expect(apiMock.getPackagePayables).toHaveBeenCalledTimes(2) 
    }
  })

  it('switches to records tab', async () => {
    const wrapper = mount(CustomerPaymentView, {
      global: {
        plugins: [router, createPinia(), i18n],
        stubs: { Teleport: true },
      },
    })

    await flushPromises()

    const tabs = wrapper.findAll('.tab-btn')
    const recordsTab = tabs.find(t => t.text().includes('紀錄'))
    
    if (recordsTab) {
        await recordsTab.trigger('click')
        expect(apiMock.getPackagePayables).toHaveBeenCalledWith(expect.objectContaining({ include_paid: true }))
    }
  })
})
