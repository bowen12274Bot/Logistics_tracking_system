/**
 * Frontend Test Helpers
 * 提供測試用的工具函式與 mock 設定
 */

import { vi } from 'vitest'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import type { User, AuthResponse } from '../services/api'

// ============================================================================
// Mock User Data
// ============================================================================

export const mockCustomerUser: User = {
  id: 'test-customer-001',
  user_name: '測試客戶',
  phone_number: '0912345678',
  address: 'END_HOME_0',
  email: 'customer@test.com',
  user_type: 'customer',
  user_class: 'contract_customer',
  billing_preference: 'monthly',
}

export const mockNonContractCustomer: User = {
  id: 'test-customer-002',
  user_name: '非合約客戶',
  phone_number: '0987654321',
  address: 'END_HOME_1',
  email: 'noncontract@test.com',
  user_type: 'customer',
  user_class: 'non_contract_customer',
  billing_preference: 'cash',
}

export const mockDriverUser: User = {
  id: 'test-driver-001',
  user_name: '測試司機',
  phone_number: '0911222333',
  address: 'HUB_0',
  email: 'driver@test.com',
  user_type: 'employee',
  user_class: 'driver',
}

export const mockWarehouseUser: User = {
  id: 'test-warehouse-001',
  user_name: '倉儲人員',
  phone_number: '0922333444',
  address: 'HUB_0',
  email: 'warehouse@test.com',
  user_type: 'employee',
  user_class: 'warehouse_staff',
}

export const mockCSUser: User = {
  id: 'test-cs-001',
  user_name: '客服專員',
  phone_number: '0933444555',
  address: 'HEAD_OFFICE',
  email: 'cs@test.com',
  user_type: 'employee',
  user_class: 'customer_service',
}

export const mockAdminUser: User = {
  id: 'test-admin-001',
  user_name: '系統管理員',
  phone_number: '0944555666',
  address: 'HEAD_OFFICE',
  email: 'admin@test.com',
  user_type: 'employee',
  user_class: 'admin',
}

// ============================================================================
// Auth Response Builders
// ============================================================================

export function createMockAuthResponse(user: User): AuthResponse {
  return {
    user,
    token: `mock-token-${user.id}-${Date.now()}`,
  }
}

// ============================================================================
// Pinia Setup
// ============================================================================

export function setupTestPinia(): Pinia {
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}

// ============================================================================
// LocalStorage Mock
// ============================================================================

export function mockLocalStorage() {
  const store: Record<string, string> = {}

  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key])
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    _store: store,
  }
}

// ============================================================================
// API Mock Helpers
// ============================================================================

export function createMockApi() {
  return {
    login: vi.fn(),
    register: vi.fn(),
    getMe: vi.fn(),
    getPackages: vi.fn(),
    createPackage: vi.fn(),
    estimatePackage: vi.fn(),
    getPackageStatus: vi.fn(),
    getTrackingPublic: vi.fn(),
    searchTracking: vi.fn(),
    getMap: vi.fn(),
    getMapRoute: vi.fn(),
    getDriverTasks: vi.fn(),
    acceptDriverTask: vi.fn(),
    completeDriverTask: vi.fn(),
    pickupDriverTask: vi.fn(),
    dropoffDriverTask: vi.fn(),
    enrouteDriverTask: vi.fn(),
    getWarehousePackages: vi.fn(),
    receiveWarehousePackages: vi.fn(),
    dispatchWarehouseNext: vi.fn(),
    getCustomerServiceExceptions: vi.fn(),
    handleCustomerServiceException: vi.fn(),
    getCustomerServiceContractApplications: vi.fn(),
    reviewCustomerServiceContractApplication: vi.fn(),
    updateCustomerMe: vi.fn(),
    applyForContract: vi.fn(),
    getContractApplicationStatus: vi.fn(),
    getVehicleMe: vi.fn(),
    getVehicleCargoMe: vi.fn(),
    moveVehicleMe: vi.fn(),
    driverReportPackageException: vi.fn(),
    customerExists: vi.fn(),
  }
}

// ============================================================================
// Router Mock
// ============================================================================

export function createMockRouter() {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    currentRoute: {
      value: {
        path: '/',
        name: 'home',
        query: {},
        params: {},
        meta: {},
      },
    },
  }
}
