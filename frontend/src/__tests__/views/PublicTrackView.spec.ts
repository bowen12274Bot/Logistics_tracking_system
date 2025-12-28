/**
 * PublicTrackView Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { i18n } from '../../i18n'
import PublicTrackView from '../../views/PublicTrackView.vue'

// Mock API
vi.mock('../../services/api', () => ({
  api: {
    getTrackingPublic: vi.fn(),
  },
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/track', name: 'public-track', component: PublicTrackView }],
})

describe('PublicTrackView', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    router.push('/track')
    await router.isReady()
    i18n.global.locale.value = 'en-US'
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render tracking input with localized placeholder', () => {
      const wrapper = mount(PublicTrackView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      const input = wrapper.find('input')
      expect(input.exists()).toBe(true)
      expect(input.attributes('placeholder')).toBe(i18n.global.t('publicTrack.placeholder'))
    })

    it('should render search button with localized text', () => {
      const wrapper = mount(PublicTrackView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      const button = wrapper.find('button')
      expect(button.exists()).toBe(true)
      expect(button.text()).toBe(i18n.global.t('publicTrack.submit'))
    })
  })

  describe('search flow', () => {
    it('should call API after submitting tracking number and render status tag', async () => {
      const { api } = await import('../../services/api')
      vi.mocked(api.getTrackingPublic).mockResolvedValue({
        success: true,
        tracking_number: 'TRK12345',
        current_status: 'in_transit',
        current_location: 'HUB_0',
        estimated_delivery: '2025-12-25',
        events: [],
      })

      const wrapper = mount(PublicTrackView, {
        global: {
          plugins: [router, createPinia(), i18n],
        },
      })

      const input = wrapper.find('input')
      await input.setValue('TRK12345')

      const form = wrapper.find('form')
      if (form.exists()) {
        await form.trigger('submit.prevent')
      } else {
        const button = wrapper.find('button')
        await button.trigger('click')
      }
      await flushPromises()

      expect(api.getTrackingPublic).toHaveBeenCalledWith('TRK12345')

      const tag = wrapper.find('.tag')
      expect(tag.text()).toBe(i18n.global.t('publicTrack.progress.inTransit'))
    })
  })
})
