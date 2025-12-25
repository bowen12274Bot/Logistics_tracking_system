import { defineStore } from 'pinia'
import { api, type PackagePayableItem, type PackageRecord } from '../services/api'

export type PaymentMethod =
  | 'cash'
  | 'credit_card'
  | 'online_bank'
  | 'monthly_billing'
  | 'third_party'

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
        this.error = err?.message || '載入待付款項目失敗'
      } finally {
        this.isLoading = false
      }
    },
    setPaymentMethod(id: string, method: PaymentMethod) {
      const target = this.packages.find((pkg) => pkg.id === id)
      if (target) {
        target.payment_method = method
      }
    },
  },
})

