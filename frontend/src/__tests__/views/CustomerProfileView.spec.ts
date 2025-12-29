/**
 * CustomerProfileView Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CustomerProfileView from '../../views/CustomerProfileView.vue'
import { i18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { mockCustomerUser, createMockAuthResponse } from '../helpers'

// Mock API
const apiMock = vi.hoisted(() => ({
  updateCustomerMe: vi.fn(),
}))

vi.mock('../../services/api', () => ({
  api: apiMock,
}))

// Mock Toast
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}))

vi.mock('../../components/ui/toast', () => ({
  useToasts: () => toastMock
}))

vi.mock('../../services/errorToast', () => ({
  toastFromApiError: vi.fn(),
}))

describe('CustomerProfileView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    const auth = useAuthStore()
    auth.persist(createMockAuthResponse(mockCustomerUser))
  })

  it('renders user profile data', async () => {
    const wrapper = mount(CustomerProfileView, {
      global: {
        plugins: [createPinia(), i18n],
      },
    })
    
    // Need to wait for watchEffect to populate form
    await flushPromises()

    const nameInput = wrapper.find('input[name="user_name"]') as any
    const phoneInput = wrapper.find('input[name="phone_number"]') as any
    
    expect(nameInput.element.value).toBe(mockCustomerUser.user_name)
    expect(phoneInput.element.value).toBe(mockCustomerUser.phone_number)
  })

  it('submits updated profile', async () => {
    const updatedUser = { ...mockCustomerUser, user_name: 'New Name' }
    apiMock.updateCustomerMe.mockResolvedValue({ success: true, user: updatedUser })

    const wrapper = mount(CustomerProfileView, {
      global: {
        plugins: [createPinia(), i18n],
      },
    })

    await flushPromises()

    // Update input
    await wrapper.find('input[name="user_name"]').setValue('New Name')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(apiMock.updateCustomerMe).toHaveBeenCalledWith(expect.objectContaining({
      user_name: 'New Name',
      user_id: mockCustomerUser.id
    }))
    expect(wrapper.text()).toContain('個人資料已更新')
  })

  it('shows error when update fails', async () => {
    apiMock.updateCustomerMe.mockRejectedValue(new Error('Update failed'))

    const wrapper = mount(CustomerProfileView, {
      global: {
        plugins: [createPinia(), i18n],
      },
    })

    await flushPromises()
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('.ui-notice--error').exists()).toBe(true)
  })
})
