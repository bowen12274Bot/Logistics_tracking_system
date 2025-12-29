import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiCard from '../../ui/UiCard.vue'

describe('UiCard', () => {
  it('renders default slot content', () => {
    const wrapper = mount(UiCard, {
      slots: {
        default: '<div>卡片內容</div>',
      },
    })

    expect(wrapper.text()).toContain('卡片內容')
  })


})
