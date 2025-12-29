import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiButton from '../ui/UiButton.vue'

describe('UiButton - System Health Check', () => {
    it('renders properly with text content', () => {
        const wrapper = mount(UiButton, {
            slots: {
                default: 'Click Me'
            }
        })
        expect(wrapper.text()).toContain('Click Me')
        expect(wrapper.find('button').exists()).toBe(true)
    })

    it('applies correct variant classes', () => {
        const wrapper = mount(UiButton, {
            props: { variant: 'primary' },
            slots: { default: 'Primary Button' }
        })
        expect(wrapper.classes()).toContain('ui-button--primary')
    })

    it('applies correct size classes', () => {
        const wrapper = mount(UiButton, {
            props: { size: 'small' },
            slots: { default: 'Small Button' }
        })
        expect(wrapper.classes()).toContain('ui-button--small')
    })

    it('handles disabled state correctly', () => {
        const wrapper = mount(UiButton, {
            props: { disabled: true },
            slots: { default: 'Disabled Button' }
        })
        expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    })

    it('renders with correct button type', () => {
        const wrapper = mount(UiButton, {
            props: { type: 'submit' },
            slots: { default: 'Submit' }
        })
        expect(wrapper.find('button').attributes('type')).toBe('submit')
    })
})
