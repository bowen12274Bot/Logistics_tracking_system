/**
 * EmployeeDriverView Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import EmployeeDriverView from '../../views/EmployeeDriverView.vue'
import { i18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { mockDriverUser, createMockAuthResponse } from '../helpers'

// Mock API - 使用新的聚合 Dashboard API
const apiMock = vi.hoisted(() => ({
  getDriverDashboard: vi.fn(),
  getDriverExceptionReports: vi.fn(),
}))

vi.mock('../../services/api', () => ({
  api: apiMock,
}))

vi.mock('../../services/errorToast', () => ({
  toastFromApiError: vi.fn(),
}))

describe('EmployeeDriverView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    
    // Default mocks - 使用新的 Dashboard API
    apiMock.getDriverDashboard.mockResolvedValue({
      success: true,
      vehicle: { id: 'v1', vehicle_code: 'V-001', current_node_id: 'HUB_0' },
      assigned_tasks: [],
      handoff_tasks: [],
      cargo: [],
      exception_count: 0,
      synced_at: new Date().toISOString(),
    })
    apiMock.getDriverExceptionReports.mockResolvedValue({ exceptions: [] })

    const auth = useAuthStore()
    auth.persist(createMockAuthResponse(mockDriverUser))
  })

  const mountView = () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/employee/driver', component: EmployeeDriverView }],
    })
    return mount(EmployeeDriverView, {
      global: {
        plugins: [router, createPinia(), i18n],
      },
    })
  }

  it('renders loading state initially', async () => {
    // Delay resolution
    apiMock.getDriverDashboard.mockImplementation(() => new Promise(() => {}))
    const wrapper = mountView()
    expect(wrapper.text()).toContain('...') 
  })

  it('renders vehicle info loaded', async () => {
    const wrapper = mountView()
    await flushPromises()
    
    expect(wrapper.text()).toContain('V-001')
    expect(wrapper.text()).toContain('HUB_0')
  })

  it('renders assigned tasks', async () => {
    apiMock.getDriverDashboard.mockResolvedValue({
      success: true,
      vehicle: { id: 'v1', vehicle_code: 'V-001', current_node_id: 'HUB_0' },
      assigned_tasks: [
        { id: 't1', tracking_number: 'TRK-1', from_location: 'LOC_A', to_location: 'LOC_B' }
      ],
      handoff_tasks: [],
      cargo: [],
      exception_count: 0,
      synced_at: new Date().toISOString(),
    })
    
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('TRK-1')
    expect(wrapper.text()).toContain('LOC_A')
    expect(wrapper.text()).toContain('LOC_B')
  })

  it('renders exceptions', async () => {
    apiMock.getDriverExceptionReports.mockResolvedValue({
      exceptions: [
        { id: 'ex1', tracking_number: 'EX-001', handled: false }
      ]
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('EX-001')
  })

  it('handles api error', async () => {
    apiMock.getDriverDashboard.mockRejectedValue(new Error('API Fail'))
    
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('API Fail')
  })
})
