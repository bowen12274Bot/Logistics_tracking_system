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

// Mock API
const apiMock = vi.hoisted(() => ({
  getVehicleMe: vi.fn(),
  getDriverTasks: vi.fn(),
  getDriverExceptionReports: vi.fn(),
  getVehicleCargoMe: vi.fn(),
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
    
    // Default mocks
    apiMock.getVehicleMe.mockResolvedValue({ vehicle: { id: 'v1', vehicle_code: 'V-001', current_node_id: 'HUB_0' } })
    apiMock.getDriverTasks.mockResolvedValue({ tasks: [] })
    apiMock.getDriverExceptionReports.mockResolvedValue({ exceptions: [] })
    apiMock.getVehicleCargoMe.mockResolvedValue({ cargo: [] })

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
    apiMock.getVehicleMe.mockImplementation(() => new Promise(() => {}))
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
    apiMock.getDriverTasks.mockResolvedValue({ 
      tasks: [
        { id: 't1', tracking_number: 'TRK-1', from_location: 'LOC_A', to_location: 'LOC_B' }
      ] 
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
    apiMock.getVehicleMe.mockRejectedValue(new Error('API Fail'))
    
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('API Fail')
  })
})
