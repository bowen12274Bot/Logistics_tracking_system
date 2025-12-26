import { defineStore } from 'pinia'
import { api, type PackagePayableItem, type PackageRecord } from '../services/api'

export type PaymentMethod =
  | 'cash'
  | 'credit_card'
  | 'bank_transfer'
  | 'monthly_billing'
  | 'third_party_payment'

export type StoredPackage = PackageRecord

export const usePackageStore = defineStore('packages', {
  state: () => ({
    packages: [] as StoredPackage[],
    payableItems: [] as PackagePayableItem[],
    isLoading: false,
    error: '' as string | null,
  }),
  getters: {
    unpaidPackages: (state) => state.payableItems.map((i) => i.package),
    payableFor:
      (state) =>
      (packageId: string): PackagePayableItem | null =>
        state.payableItems.find((i) => i.package.id === packageId) ?? null,
  },
  actions: {
    async fetchUnpaid(_customerId?: string) {
      this.isLoading = true
      this.error = null
      try {
        const res = await api.getPackagePayables({ include_paid: false, limit: 100 })
        this.payableItems = res.items ?? []
        this.packages = this.payableItems.map((i) => i.package)
      } catch (err: any) {
        this.error = err?.message || '載入待付款項失敗'
      } finally {
        this.isLoading = false
      }
    },
    setPaymentMethod(id: string, method: PaymentMethod) {
      const target = this.packages.find((pkg) => pkg.id === id)
      if (target) target.payment_method = method
      const payable = this.payableItems.find((i) => i.package.id === id)
      if (payable) payable.package.payment_method = method
    },
  },
})
