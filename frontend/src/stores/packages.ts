import { defineStore } from 'pinia'
import { api, type PackageRecord } from '../services/api'

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
    isLoading: false,
    error: '' as string | null,
  }),
  getters: {
    unpaidPackages: (state) =>
      state.packages.filter((pkg) => pkg.payment_type !== 'cod'),
  },
  actions: {
    async fetchUnpaid(customerId?: string) {
      this.isLoading = true
      this.error = null
      try {
        const res = await api.getPackages(customerId)
        this.packages = res.packages ?? []
      } catch (err: any) {
        this.error = err?.message || '無法取得待付貨件'
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
