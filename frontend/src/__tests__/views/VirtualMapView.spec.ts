/**
 * VirtualMapView Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import VirtualMapView from '../../views/VirtualMapView.vue'
import { i18n } from '../../i18n'

// Mock API
const apiMock = vi.hoisted(() => ({
  getMap: vi.fn(),
}))

vi.mock('../../services/api', () => ({
  api: apiMock,
}))

// Mock useFullscreen
vi.mock('../../composables/useFullscreen', () => ({
  useFullscreen: () => ({
    isSupported: true,
    isFullscreen: { value: false },
    toggle: vi.fn(),
  }),
}))

// Mock errorToast
vi.mock('../../services/errorToast', () => ({
  toastFromApiError: vi.fn(),
}))

const mockNodes = [
  { id: 'HUB_0', level: 1, x: 0, y: 0, name: 'Main Hub' },
  { id: 'REG_1', level: 2, x: 100, y: 100, name: 'Region 1' },
]

const mockEdges = [
  { id: 'e1', source: 'HUB_0', target: 'REG_1' },
]

describe('VirtualMapView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getMap.mockResolvedValue({ nodes: mockNodes, edges: mockEdges })
  })

  const mountView = async (query = {}) => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/map', component: VirtualMapView }],
    })
    await router.push({ path: '/map', query })
    await router.isReady()
    
    return mount(VirtualMapView, {
      global: {
        plugins: [router, createPinia(), i18n],
        stubs: {
          UiPageShell: { template: '<div><slot name="header"></slot><slot></slot></div>' }
        }
      },
    })
  }

  it('renders map nodes and edges', async () => {
    const wrapper = await mountView()
    await flushPromises()

    expect(wrapper.findAll('.node').length).toBe(2)
    expect(wrapper.findAll('.edge-line').length).toBe(1)
    expect(wrapper.text()).toContain('Main Hub')
  })

  it('shows loading state initially', async () => {
    // Delay resolution
    let resolveMap: any
    apiMock.getMap.mockImplementation(() => new Promise(r => resolveMap = r))
    
    const wrapper = await mountView()
    expect(wrapper.find('.hint').exists()).toBe(true)
    
    resolveMap({ nodes: [], edges: [] })
    await flushPromises()
    expect(wrapper.text()).not.toContain('載入中')
  })

  it('shows error message on failure', async () => {
    apiMock.getMap.mockRejectedValue(new Error('Network Error'))
    const wrapper = await mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('載入失敗') // map.loadFailed
    expect(wrapper.text()).toContain('Network Error')
  })

  it('selects node on click', async () => {
    const wrapper = await mountView()
    await flushPromises()

    const node = wrapper.find('.node')
    await node.trigger('click')
    await wrapper.vm.$nextTick()
    
    expect(node.classes()).toContain('selected')
    expect(wrapper.text()).toContain('ID：HUB_0')
  })

  it('focuses node from query param', async () => {
    const wrapper = await mountView({ node: 'REG_1' })
    await flushPromises()
    await wrapper.vm.$nextTick()
    
    const nodes = wrapper.findAll('.node')
    const regNode = nodes.find(n => n.text().includes('Region 1'))
    
    expect(regNode?.classes()).toContain('selected')
  })
})
