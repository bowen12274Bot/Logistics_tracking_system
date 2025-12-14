import { defineStore } from 'pinia'

export type UserClass =
  | 'contract_customer'
  | 'non_contract_customer'
  | 'driver'
  | 'warehouse_staff'
  | 'customer_service'
  | 'admin'

export interface AuthUser {
  user_id?: number
  user_name: string
  email?: string
  user_class: UserClass
}

export interface LoginPayload {
  identifier: string // email 或帳號
  password: string
}

export interface RegisterPayload {
  user_name: string
  email: string
  password: string
  phone_number?: string
  address?: string
  user_type?: string
  user_class?: UserClass
}

/**
 * ✅ 你現在的狀況：後端 API 可能還沒完全接好
 * 所以我做成「可直接先跑起來」的版本：
 * - 先提供 demo 帳號（customer/driver/warehouse/cs/admin）
 * - 之後你把 login/register 換成 fetch(你的後端) 即可
 */
const DEMO_ACCOUNTS: Array<{ email: string; password: string; user: AuthUser }> = [
  { email: 'customer@example.com', password: 'customer123', user: { user_name: '客戶', user_class: 'non_contract_customer', email: 'customer@example.com' } },
  { email: 'driver@example.com', password: 'driver123', user: { user_name: '司機', user_class: 'driver', email: 'driver@example.com' } },
  { email: 'warehouse@example.com', password: 'warehouse123', user: { user_name: '倉儲', user_class: 'warehouse_staff', email: 'warehouse@example.com' } },
  { email: 'cs@example.com', password: 'cs123', user: { user_name: '客服', user_class: 'customer_service', email: 'cs@example.com' } },
  { email: 'admin@example.com', password: 'admin123', user: { user_name: '系統管理員', user_class: 'admin', email: 'admin@example.com' } },
]

type PersistedAuth = {
  user: AuthUser | null
  token: string | null
}

const LS_KEY = 'logisim_auth'

function loadPersisted(): PersistedAuth {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { user: null, token: null }
    const parsed = JSON.parse(raw) as PersistedAuth
    return { user: parsed.user ?? null, token: parsed.token ?? null }
  } catch {
    return { user: null, token: null }
  }
}

function savePersisted(payload: PersistedAuth) {
  localStorage.setItem(LS_KEY, JSON.stringify(payload))
}

function clearPersisted() {
  localStorage.removeItem(LS_KEY)
}

export const useAuthStore = defineStore('auth', {
  state: () => {
    const persisted = loadPersisted()
    return {
      user: persisted.user as AuthUser | null,
      token: persisted.token as string | null,
    }
  },

  getters: {
    isLoggedIn: (s) => !!s.user,
  },

  actions: {
    logout() {
      this.user = null
      this.token = null
      clearPersisted()
    },

    /**
     * ✅ Demo 版登入（先讓你 UI/導覽流程正常）
     * 之後要接後端：把 DEMO_ACCOUNTS 那段換成 fetch API
     */
    async login(payload: LoginPayload) {
      // ✅ 強制清掉舊登入狀態（避免你截圖那種 admin 殘留）
      this.logout()

      const identifier = payload.identifier.trim().toLowerCase()
      const password = payload.password

      const hit = DEMO_ACCOUNTS.find(
        (a) => a.email.toLowerCase() === identifier && a.password === password
      )

      if (!hit) {
        throw new Error('帳號或密碼錯誤')
      }

      // token 先用 demo 字串，之後接後端再換成真正 JWT
      this.user = hit.user
      this.token = 'demo-token'
      savePersisted({ user: this.user, token: this.token })
    },

    /**
     * ✅ Demo 版註冊：直接把你註冊的資料當作新客戶登入
     * 之後接後端：改成 fetch POST /register
     */
    async register(payload: RegisterPayload) {
      this.logout()

      const newUser: AuthUser = {
        user_name: payload.user_name,
        email: payload.email,
        user_class: payload.user_class ?? 'non_contract_customer',
      }

      // demo：直接登入
      this.user = newUser
      this.token = 'demo-token'
      savePersisted({ user: this.user, token: this.token })
    },
    setUser(user: User) {
      this.user = user
      if (this.token) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token: this.token }))
      }
    },
  },
})
