/**
 * Packages Store Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePackageStore } from '../../stores/packages'

// Mock API
const getPackagePayablesSpy = vi.fn()
vi.mock('../../services/api', () => ({
  api: {
    getPackagePayables: (...args: any[]) => getPackagePayablesSpy(...args),
  },
}))

describe('Package Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial State', () => {
    it('starts with empty packages and payables', () => {
      const store = usePackageStore()
      expect(store.packages).toEqual([])
      expect(store.payableItems).toEqual([])
      expect(store.isLoading).toBe(false)
      expect(store.error).toBe('')
    })
  })

  describe('fetchUnpaid()', () => {
    it('loads payable items and updates state', async () => {
      const store = usePackageStore()
      const mockPayables = {
        success: true,
        items: [
          {
            package: { id: 'pkg1', amount: 100, payment_method: 'cash' },
            amount: 100,
            payable_now: true,
          },
        ],
      }
      getPackagePayablesSpy.mockResolvedValue(mockPayables)

      await store.fetchUnpaid()

      expect(getPackagePayablesSpy).toHaveBeenCalledWith({ include_paid: false, limit: 100 })
      expect(store.payableItems).toEqual(mockPayables.items)
      expect(store.packages).toEqual([mockPayables.items[0].package])
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('handles errors gracefully', async () => {
      const store = usePackageStore()
      getPackagePayablesSpy.mockRejectedValue(new Error('Network error'))

      await store.fetchUnpaid()

      expect(store.error).toBe('Network error')
      expect(store.isLoading).toBe(false)
      expect(store.packages).toEqual([])
    })
  })

  describe('Getters', () => {
    it('unpaidPackages returns list of packages from payableItems', () => {
      const store = usePackageStore()
      store.payableItems = [
        {
          package: { id: 'p1' },
          amount: 100,
        },
        {
          package: { id: 'p2' },
          amount: 200,
        },
      ] as any[]

      expect(store.unpaidPackages).toHaveLength(2)
      expect(store.unpaidPackages[0].id).toBe('p1')
    })

    it('payableFor finds item by package id', () => {
      const store = usePackageStore()
      store.payableItems = [
        {
          package: { id: 'p1' },
          amount: 100,
        },
      ] as any[]

      expect(store.payableFor('p1')).not.toBeNull()
      expect(store.payableFor('non-existent')).toBeNull()
    })
  })

  describe('setPaymentMethod()', () => {
    it('updates payment method for package and payable item', () => {
      const store = usePackageStore()
      store.payableItems = [
        {
          amount: 100,
          package: { id: 'p1', payment_method: 'cash' },
        },
      ] as any[]
      store.packages = [store.payableItems[0].package]

      store.setPaymentMethod('p1', 'credit_card')

      expect(store.packages[0].payment_method).toBe('credit_card')
      expect(store.payableItems[0].package.payment_method).toBe('credit_card')
    })
  })
})
