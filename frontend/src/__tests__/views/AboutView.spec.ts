/**
 * AboutView Tests
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AboutView from '../../views/AboutView.vue'
import { i18n } from '../../i18n'
import UiPageShell from '../../components/ui/UiPageShell.vue'

describe('AboutView', () => {
  it('renders about page content', () => {
    const wrapper = mount(AboutView, {
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.findComponent(UiPageShell).exists()).toBe(true)
    expect(wrapper.text()).toContain('關於 LogiSim')
    expect(wrapper.text()).toContain('角色分工')
  })
})
