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
    const previousLocale = i18n.global.locale.value

    try {
      i18n.global.locale.value = 'zh-TW'

      const pinia = createPinia()
      setActivePinia(pinia)
      const auth = useAuthStore(pinia)
      auth.setUser(mockAdminUser)

      const wrapper = mount(AdminView, {
        global: {
          plugins: [pinia],
        },
      })

      const tabButtons = wrapper.findAll('[role="tablist"] button')
      expect(tabButtons.length).toBeGreaterThanOrEqual(4)
      await tabButtons[3].trigger('click')
      await nextTick()

      for (let i = 0; i < 10 && !wrapper.find('.user-row strong').exists(); i += 1) {
        await flushPromises()
        await nextTick()
      }

      expect(wrapper.find('.user-row strong').exists()).toBe(true)
      expect(wrapper.find('.user-row strong').text()).toContain(i18n.global.t('admin.samples.driver'))
      expect(wrapper.find('.user-row .pill-stack .pill:nth-child(2)').text()).toContain(i18n.global.t('admin.status.active'))

      i18n.global.locale.value = 'en-US'
      await nextTick()
      await flushPromises()
      await nextTick()

      expect(wrapper.find('.user-row strong').text()).toContain(i18n.global.t('admin.samples.driver'))
      expect(wrapper.find('.user-row .pill-stack .pill:nth-child(2)').text()).toContain(i18n.global.t('admin.status.active'))
    } finally {
      i18n.global.locale.value = previousLocale
    }
  })
})

