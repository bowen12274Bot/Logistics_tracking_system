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

    const selectTab = (wrapper.vm as any).selectWorkbenchTab
    if (typeof selectTab === 'function') {
      selectTab('users')
      await nextTick()
    }

    const reload = (wrapper.vm as any).loadUsers
    if (typeof reload === 'function') {
      await reload()
    }

    for (let i = 0; i < 5 && !wrapper.find('.user-row strong').exists(); i += 1) {
      await flushPromises()
      await nextTick()
    }

    expect(wrapper.find('.user-row strong').exists()).toBe(true)
    expect(wrapper.find('.user-row strong').text()).toContain('司機')
    expect(wrapper.find('.user-row .pill-stack .pill:nth-child(2)').text()).toContain('啟用')

    const previousLocale = i18n.global.locale.value
    i18n.global.locale.value = 'en-US'
    await nextTick()
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.user-row strong').text()).toContain('Driver')
    expect(wrapper.find('.user-row .pill-stack .pill:nth-child(2)').text()).toContain('Active')

    i18n.global.locale.value = previousLocale
  })
})

