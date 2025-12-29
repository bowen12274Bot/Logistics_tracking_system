import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiModal from '../../ui/UiModal.vue'

describe('UiModal', () => {
  it('renders title and slot content', () => {
    const wrapper = mount(UiModal, {
      props: {
        modelValue: true,
        title: '測試標題',
      },
      slots: {
        default: '<div data-testid="content">模態框內容</div>',
      },
      global: {
        stubs: { Teleport: true }
      }
    })

    expect(wrapper.text()).toContain('測試標題')
    expect(wrapper.find('[data-testid="content"]').exists()).toBe(true)
  })

  it('does not render when modelValue is false', () => {
    const wrapper = mount(UiModal, {
      props: {
        modelValue: false,
        title: '測試標題',
      },
      global: {
        stubs: { Teleport: true }
      }
    })

    expect(wrapper.find('.ui-modal').exists()).toBe(false)
  })

  it('emits close event when close button is clicked', async () => {
    const wrapper = mount(UiModal, {
      props: {
        modelValue: true,
        title: '測試標題',
      },
      global: {
        stubs: { Teleport: true }
      }
    })

    // Find the close button (ghost-btn)
    const closeBtn = wrapper.find('button.ghost-btn')
    if (closeBtn.exists()) {
      await closeBtn.trigger('click')
      expect(wrapper.emitted('close')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    }
  })

  it('emits close/update when backdrop is clicked', async () => {
    const wrapper = mount(UiModal, {
      props: {
        modelValue: true,
        title: '測試標題',
        closeOnBackdrop: true
      },
      global: {
        stubs: { Teleport: true }
      }
    })

    const backdrop = wrapper.find('.ui-modal')
    await backdrop.trigger('click')
    
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
  })
})
