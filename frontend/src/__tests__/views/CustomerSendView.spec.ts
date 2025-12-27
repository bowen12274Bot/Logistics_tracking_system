/**
 * CustomerSendView Tests
 * 測試寄件頁面的表單驗證與建立包裹功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import CustomerSendView from '../../views/CustomerSendView.vue'
import { i18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { mockCustomerUser, createMockAuthResponse } from '../helpers'

// Mock API
vi.mock('../../services/api', () => ({
  api: {
    getMe: vi.fn().mockResolvedValue({ success: true, user: null }),
    createPackage: vi.fn(),
    estimatePackage: vi.fn(),
    customerExists: vi.fn().mockResolvedValue({ success: true, exists: false }),
  },
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/customer/send', name: 'customer-send', component: CustomerSendView },
    { path: '/customer/payment', name: 'customer-payment', component: { template: '<div />' } },
  ],
})

describe('CustomerSendView', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorage.clear()

    // 設置登入狀態
    const auth = useAuthStore()
    auth.persist(createMockAuthResponse(mockCustomerUser))

    router.push('/customer/send')
    await router.isReady()
    vi.clearAllMocks()
  })

  describe('渲染', () => {
    it('應該渲染寄件表單', () => {
      const wrapper = mount(CustomerSendView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      expect(wrapper.text()).toContain('寄件')
    })

    it('應該有寄件人資訊區塊', () => {
      const wrapper = mount(CustomerSendView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      expect(wrapper.text()).toContain('寄件人')
    })

    it('應該有收件人資訊區塊', () => {
      const wrapper = mount(CustomerSendView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      expect(wrapper.text()).toContain('收件人')
    })
  })

  describe('表單驗證', () => {
    it('地址欄位應該存在', () => {
      const wrapper = mount(CustomerSendView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      const inputs = wrapper.findAll('input')
      expect(inputs.length).toBeGreaterThan(3)
    })
  })

  describe('運費試算', () => {
    it('應該有配送時效選項', () => {
      const wrapper = mount(CustomerSendView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      // 檢查是否有時效相關文字
      const text = wrapper.text()
      expect(
        text.includes('隔日') ||
          text.includes('標準') ||
          text.includes('經濟') ||
          text.includes('兩日')
      ).toBe(true)
    })
  })

  describe('付款方式', () => {
    it('應該有付款方式選項', () => {
      const wrapper = mount(CustomerSendView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      const text = wrapper.text()
      expect(text.includes('預付') || text.includes('到付')).toBe(true)
    })
  })

  it('can save and apply common recipient', async () => {
    const wrapper = mount(CustomerSendView, {
      global: {
        plugins: [router, createPinia(), i18n],
        stubs: { Teleport: true },
      },
    })

    await wrapper.get('input[name="receiverName"]').setValue('收件人甲')
    await wrapper.get('input[name="receiverPhone"]').setValue('0912345678')
    await wrapper.get('input[name="receiverAddress"]').setValue('END_HOME_1')

    await wrapper.get('[data-testid="save-common-recipient"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="open-common-recipient"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="apply-common-recipient-0"]').trigger('click')
    await flushPromises()

    expect((wrapper.get('input[name="receiverName"]').element as HTMLInputElement).value).toBe('收件人甲')
    expect((wrapper.get('input[name="receiverPhone"]').element as HTMLInputElement).value).toBe('0912345678')
    expect((wrapper.get('input[name="receiverAddress"]').element as HTMLInputElement).value).toBe('END_HOME_1')
  })

  it('prepaid create should redirect to payment with tracking query', async () => {
    const { api } = await import('../../services/api')

    vi.mocked(api.estimatePackage).mockResolvedValue({
      estimate: { total_cost: 100, box_type: 'S', route_cost: 30, route_path: [] },
    } as any)
    vi.mocked(api.createPackage).mockResolvedValue({
      success: true,
      package: { id: 'pkg_123', tracking_number: 'TRK-123' },
    } as any)

    const wrapper = mount(CustomerSendView, {
      global: {
        plugins: [router, createPinia(), i18n],
      },
    })

    await wrapper.get('input[name="senderPhone"]').setValue('0911111111')
    await wrapper.get('input[name="senderAddress"]').setValue('END_HOME_0')
    await wrapper.get('input[name="receiverName"]').setValue('收件人乙')
    await wrapper.get('input[name="receiverPhone"]').setValue('0922222222')
    await wrapper.get('input[name="receiverAddress"]').setValue('END_HOME_1')
    await wrapper.get('input[name="weight"]').setValue('1')
    await wrapper.get('input[name="length"]').setValue('1')
    await wrapper.get('input[name="width"]').setValue('2')
    await wrapper.get('input[name="height"]').setValue('3')
    await wrapper.get('input[name="pickupDate"]').setValue('2026-01-01')
    await wrapper.get('select[name="pickupTimeWindow"]').setValue('09:00-12:00')

    await wrapper.get('.send-actions-right button.primary-btn').trigger('click')
    await flushPromises()

    await wrapper.get('.send-actions-right button.primary-btn').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('customer-payment')
    expect(router.currentRoute.value.query.package_id).toBe('pkg_123')
    expect(router.currentRoute.value.query.tracking_number).toBe('TRK-123')
  })

  it('should block create when estimate not completed', async () => {
    const { api } = await import('../../services/api')
    vi.mocked(api.createPackage).mockResolvedValue({
      success: true,
      package: { id: 'pkg_999', tracking_number: 'TRK-999' },
    } as any)

    const wrapper = mount(CustomerSendView, {
      global: {
        plugins: [router, createPinia(), i18n],
      },
    })

    await wrapper.get('input[name="senderPhone"]').setValue('0911111111')
    await wrapper.get('input[name="senderAddress"]').setValue('END_HOME_0')
    await wrapper.get('input[name="receiverName"]').setValue('收件人乙')
    await wrapper.get('input[name="receiverPhone"]').setValue('0922222222')
    await wrapper.get('input[name="receiverAddress"]').setValue('END_HOME_1')
    await wrapper.get('input[name="weight"]').setValue('1')
    await wrapper.get('input[name="length"]').setValue('1')
    await wrapper.get('input[name="width"]').setValue('2')
    await wrapper.get('input[name="height"]').setValue('3')
    await wrapper.get('input[name="pickupDate"]').setValue('2026-01-01')
    await wrapper.get('select[name="pickupTimeWindow"]').setValue('09:00-12:00')

    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(api.createPackage).not.toHaveBeenCalled()
  })
})
