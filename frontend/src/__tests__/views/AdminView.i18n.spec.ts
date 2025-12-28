import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import AdminView from '../../views/AdminView.vue'
import { useAuthStore } from '../../stores/auth'
import { mockAdminUser } from '../helpers'
import { i18n } from '../../i18n'

vi.mock('../../services/api', async () => {
  const actual = await vi.importActual<typeof import('../../services/api')>('../../services/api')
  return {
    ...actual,
    api: {
      ...actual.api,
      adminGetUsers: vi.fn().mockRejectedValue(new Error('fail users')),
      adminListContractApplications: vi.fn().mockRejectedValue(new Error('fail contracts')),
      adminSystemErrors: vi.fn().mockRejectedValue(new Error('fail errors')),
    },
  }
})

describe('AdminView i18n', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    // default tests run with zh-TW from setup file
  })

  it('updates fallback data text when locale switches', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore(pinia)
    auth.setUser(mockAdminUser)

    const wrapper = mount(AdminView, {
      global: {
        plugins: [pinia],
      },
    })

    const reload = (wrapper.vm as any).loadUsers
    if (typeof reload === 'function') {
      await reload()
    }

    for (let i = 0; i < 5 && !wrapper.find('.user-row strong').exists(); i += 1) {
      await flushPromises()
      await nextTick()
    }

    const firstUser = wrapper.find('.user-row strong')
    const statusPill = wrapper.find('.user-row .pill-stack .pill:nth-child(2)')

    expect(firstUser.exists()).toBe(true)
    expect(firstUser.text()).toContain('司機')
    expect(statusPill.text()).toContain('啟用')

    i18n.global.locale.value = 'en-US'
    await nextTick()
    await flushPromises()

    expect(wrapper.find('.user-row strong').text()).toContain('Driver')
    expect(wrapper.find('.user-row .pill-stack .pill:nth-child(2)').text()).toContain('Active')
  })
})
