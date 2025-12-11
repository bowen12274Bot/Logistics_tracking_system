import { defineStore } from 'pinia'
import type { PackageRecord } from '../services/api'

export type PaymentMethod =
  | 'cash'
  | 'credit_card'
  | 'online_bank'
  | 'monthly_billing'
  | 'third_party'

export type StoredPackage = PackageRecord & {
  status: 'unpaid' | 'paid'
  createdAt: string
}

const STORAGE_KEY = 'logisim-packages'

function loadPersisted(): StoredPackage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

export const usePackageStore = defineStore('packages', {
  state: () => ({
    packages: loadPersisted() as StoredPackage[],
  }),
  getters: {
    unpaidPackages: (state) =>
      state.packages.filter((pkg) => pkg.status === 'unpaid' && pkg.payment_type !== 'cod'),
  },
  actions: {
    persist() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.packages))
    },
    addUnpaidPackage(pkg: PackageRecord) {
      const record: StoredPackage = {
        ...pkg,
        status: 'unpaid',
        createdAt: new Date().toISOString(),
      }
      this.packages = this.packages.filter((item) => item.id !== record.id)
      this.packages.unshift(record)
      this.persist()
    },
    setPaymentMethod(id: string, method: PaymentMethod) {
      const target = this.packages.find((pkg) => pkg.id === id)
      if (target) {
        target.payment_method = method
        this.persist()
      }
    },
  },
})
