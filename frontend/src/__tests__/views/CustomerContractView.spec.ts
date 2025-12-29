/**
 * CustomerContractView Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CustomerContractView from '../../views/CustomerContractView.vue'
import { i18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { mockCustomerUser, createMockAuthResponse } from '../helpers'

// Mock API
const apiMock = vi.hoisted(() => ({
  getContractApplicationStatus: vi.fn(),
  applyForContract: vi.fn(),
  getBillingBills: vi.fn(),
  getBillingBillDetail: vi.fn(),
  getPackageStatus: vi.fn(),
}))

vi.mock('../../services/api', () => ({
  api: apiMock,
}))

vi.mock('../../services/errorToast', () => ({
  toastFromApiError: vi.fn(),
}))

// Mock Date for consistent billing cycle calc
const mockDate = new Date('2023-10-15T10:00:00Z')
vi.setSystemTime(mockDate)

describe('CustomerContractView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    const auth = useAuthStore()
    auth.persist(createMockAuthResponse(mockCustomerUser))
  })

  it('renders application form when not submitted', async () => {
    apiMock.getContractApplicationStatus.mockResolvedValue({ has_application: false })

    const wrapper = mount(CustomerContractView, {
      global: {
        plugins: [createPinia(), i18n],
      },
    })

    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.text()).toContain('申請成為合約客戶')
  })

  it('submits application', async () => {
    apiMock.getContractApplicationStatus.mockResolvedValue({ has_application: false })
    apiMock.applyForContract.mockResolvedValue({ 
      success: true, 
      status: 'pending', 
      application_id: 'APP-123',
      message: 'Application submitted' 
    })

    const wrapper = mount(CustomerContractView, {
      global: {
        plugins: [createPinia(), i18n],
      },
    })

    await flushPromises()

    // Fill form
    await wrapper.find('input[name="company_name"]').setValue('My Company')
    await wrapper.find('input[name="tax_id"]').setValue('88888888')
    await wrapper.find('input[name="contact_person"]').setValue('Me')
    await wrapper.find('input[name="contact_phone"]').setValue('0900000000')
    await wrapper.find('input[name="billing_address"]').setValue('Taipei')
    
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(apiMock.applyForContract).toHaveBeenCalled()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('APP-123')
  })

  it('renders pending status', async () => {
    apiMock.getContractApplicationStatus.mockResolvedValue({ 
      has_application: true, 
      status: 'pending',
      application_id: 'APP-PENDING'
    })

    const wrapper = mount(CustomerContractView, {
      global: {
        plugins: [createPinia(), i18n],
      },
    })

    await flushPromises()

    expect(wrapper.find('.status-panel').exists()).toBe(true)
    expect(wrapper.text()).toContain('審核中')
  })

  it('renders billing section when approved', async () => {
    apiMock.getContractApplicationStatus.mockResolvedValue({ 
      has_application: true, 
      status: 'approved',
      application_id: 'APP-APPROVED'
    })
    
    // Mock bills
    apiMock.getBillingBills.mockResolvedValue({ 
      success: true, 
      bills: [{ id: 'bill_1', period: '2023-10', total_amount: 500, status: 'pending' }] 
    })
    apiMock.getBillingBillDetail.mockResolvedValue({
      success: true,
      bill: {
        id: 'bill_1',
        period: '2023-10',
        total_amount: 500,
        status: 'pending',
        items: [
            { package_id: 'p1', tracking_number: 'TRK-BILL', cost: 100 }
        ]
      }
    })

    const wrapper = mount(CustomerContractView, {
      global: {
        plugins: [createPinia(), i18n],
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('本期月結帳單')
    expect(wrapper.text()).toContain('500 元')
    expect(wrapper.text()).toContain('TRK-BILL')
  })

  it('expands bill item details', async () => {
    apiMock.getContractApplicationStatus.mockResolvedValue({ has_application: true, status: 'approved' })
    apiMock.getBillingBills.mockResolvedValue({ 
      bills: [{ id: 'bill_1', items: [] }] 
    })
    apiMock.getBillingBillDetail.mockResolvedValue({
      bill: {
        id: 'bill_1',
        items: [{ package_id: 'p1', tracking_number: 'TRK-1', cost: 100 }]
      }
    })
    
    apiMock.getPackageStatus.mockResolvedValue({
      success: true,
      package: {
        id: 'p1',
        sender_name: 'Sender',
        weight: 5
      }
    })

    const wrapper = mount(CustomerContractView, {
      global: {
        plugins: [createPinia(), i18n],
      },
    })

    await flushPromises()
    
    // Click row button
    await wrapper.find('.row-btn').trigger('click')
    await flushPromises()
    
    expect(apiMock.getPackageStatus).toHaveBeenCalledWith('p1')
    expect(wrapper.text()).toContain('5 kg')
  })
})
