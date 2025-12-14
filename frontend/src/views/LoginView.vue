<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import type { User } from '../services/api'

type Mode = 'login' | 'register'
type TestAccount = { email: string; password: string; role: string }

const mode = ref<Mode>('login')
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const statusMessage = ref('')
const loading = ref(false)

const loginForm = reactive({
  identifier: '',
  password: '',
})

const registerForm = reactive({
  user_name: '',
  email: '',
  password: '',
  phone_number: '',
  address: '',
})

const switchMode = (next: Mode) => {
  mode.value = next
  statusMessage.value = ''
}

const getDefaultRouteForUser = (user: User | null | undefined) => {
  const role = user?.user_class
  if (!role) return '/'

  if (role === 'contract_customer' || role === 'non_contract_customer') return '/customer'

  const map: Record<string, string> = {
    driver: '/employee/driver',
    warehouse_staff: '/employee/warehouse',
    customer_service: '/employee/customer-service',
    admin: '/admin',
  }

  return map[role] ?? '/'
}

const handleLogin = async () => {
  loading.value = true
  statusMessage.value = ''
  try {
    const loggedInUser = await auth.login({ ...loginForm })
    const redirect = route.query.redirect as string | undefined
    router.push(redirect ?? getDefaultRouteForUser(loggedInUser))
  } catch (err: any) {
    statusMessage.value = err.message || '登入失敗'
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  loading.value = true
  statusMessage.value = ''
  try {
    await auth.register({
      ...registerForm,
      user_type: 'customer',
      user_class: 'non_contract_customer',
    })
    router.push('/customer')
  } catch (err: any) {
    statusMessage.value = err.message || '註冊失敗'
  } finally {
    loading.value = false
  }
}

const testAccounts: TestAccount[] = [
  { email: 'cust@example.com', password: 'cust123', role: '合約客戶' },
  { email: 'noncontract@example.com', password: 'custnc123', role: '非合約客戶' },
  { email: 'driver@example.com', password: 'driver123', role: '司機' },
  { email: 'warehouse@example.com', password: 'warehouse123', role: '倉儲' },
  { email: 'cs@example.com', password: 'cs123', role: '客服' },
  { email: 'admin@example.com', password: 'admin123', role: '管理員' },
]

const fillTestAccount = (acct: TestAccount) => {
  switchMode('login')
  loginForm.identifier = acct.email
  loginForm.password = acct.password
  statusMessage.value = `已填入：${acct.role}`
}
</script>

<template>
  <section class="auth-page">
    <div class="auth-card">
      <header class="page-header auth-header">
        <p class="eyebrow">帳號</p>
        <h1>登入 / 註冊</h1>
        <p class="lede">以帳號登入取得對應角色權限，或立即註冊新客戶。</p>
      </header>

      <div class="auth-panel">
        <div class="tab-switch auth-tabs" role="tablist" aria-label="登入或註冊">
          <button :class="{ active: mode === 'login' }" type="button" role="tab" @click="switchMode('login')">登入</button>
          <button
            :class="{ active: mode === 'register' }"
            type="button"
            role="tab"
            @click="switchMode('register')"
          >
            註冊
          </button>
        </div>

        <form v-if="mode === 'login'" class="auth-login-grid" @submit.prevent="handleLogin">
          <label class="form-field">
            <span>Email 或帳號</span>
            <input
              v-model="loginForm.identifier"
              required
              name="identifier"
              type="text"
              placeholder="cust@example.com 或 0912xxxxxx"
              autocomplete="username"
            />
          </label>

          <label class="form-field">
            <span>密碼</span>
            <input
              v-model="loginForm.password"
              required
              name="password"
              type="password"
              placeholder="********"
              autocomplete="current-password"
            />
          </label>

          <button class="primary-btn auth-submit" type="submit" :disabled="loading">
            {{ loading ? '登入中...' : '登入' }}
          </button>
        </form>

        <form v-else class="auth-register-grid" @submit.prevent="handleRegister">
          <label class="form-field reg-name">
            <span>姓名</span>
            <input v-model="registerForm.user_name" required name="user_name" type="text" placeholder="姓名" />
          </label>

          <label class="form-field reg-email">
            <span>Email</span>
            <input v-model="registerForm.email" required name="email" type="email" placeholder="you@example.com" />
          </label>

          <label class="form-field reg-password">
            <span>密碼</span>
            <input v-model="registerForm.password" required name="password" type="password" placeholder="********" />
          </label>

          <label class="form-field reg-phone">
            <span>手機（選填）</span>
            <input v-model="registerForm.phone_number" name="phone_number" type="text" placeholder="09xxxxxxxx" />
          </label>

          <label class="form-field reg-address">
            <span>地址（選填）</span>
            <input v-model="registerForm.address" name="address" type="text" placeholder="收件地址" />
          </label>

          <button class="primary-btn auth-submit reg-submit" type="submit" :disabled="loading">
            {{ loading ? '註冊中...' : '註冊' }}
          </button>
        </form>

        <p v-if="statusMessage" class="hint auth-status" role="status" aria-live="polite">{{ statusMessage }}</p>
      </div>

      <div v-if="mode === 'login'" class="auth-panel auth-panel--test">
        <p class="hint auth-test-hint">快速測試帳號（會自動填入正確密碼）</p>
        <div class="test-account-actions" role="list">
          <button
            v-for="acct in testAccounts"
            :key="acct.email"
            type="button"
            class="ghost-btn test-account-btn"
            role="listitem"
            @click="fillTestAccount(acct)"
          >
            <strong>{{ acct.role }}</strong>
            <span class="test-account-meta">{{ acct.email }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.auth-page {
  padding: 44px 0 64px;
}

.auth-card {
  max-width: 980px;
  margin: 0 auto;
  padding: 28px 28px 26px;
  border-radius: 18px;
  border: 1px solid rgba(165, 122, 99, 0.22);
  background: rgba(255, 248, 241, 0.92);
  box-shadow: 0 22px 70px rgba(170, 124, 105, 0.18);
}

.auth-header {
  margin-bottom: 18px;
}

.auth-panel {
  border-radius: 18px;
  border: 1px solid rgba(165, 122, 99, 0.18);
  background: rgba(255, 255, 255, 0.62);
  padding: 18px;
}

.auth-panel + .auth-panel {
  margin-top: 14px;
}

.auth-panel--test {
  padding-top: 14px;
}

.auth-tabs {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-radius: 16px;
  background: rgba(248, 240, 235, 0.85);
}

.auth-tabs button {
  padding: 12px 14px;
  font-weight: 700;
}

.auth-tabs button.active {
  background: rgba(244, 182, 194, 0.55);
}

.auth-login-grid {
  margin-top: 14px;
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr 1fr 220px;
  align-items: end;
}

.auth-panel .form-field > span {
  font-weight: 700;
  color: #6b4a40;
}

.auth-panel .form-field input {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(165, 122, 99, 0.32);
  box-shadow: 0 10px 26px rgba(170, 124, 105, 0.12);
}

.auth-panel .form-field input::placeholder {
  color: rgba(106, 74, 64, 0.55);
}

.auth-panel .form-field input:focus {
  outline: 3px solid rgba(244, 182, 194, 0.55);
  border-color: rgba(225, 139, 139, 0.55);
}

.auth-panel .form-field input:hover {
  border-color: rgba(165, 122, 99, 0.42);
}

.auth-register-grid {
  margin-top: 14px;
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-areas:
    'name email password'
    'phone address submit';
  align-items: end;
}

.reg-name {
  grid-area: name;
}

.reg-email {
  grid-area: email;
}

.reg-password {
  grid-area: password;
}

.reg-phone {
  grid-area: phone;
}

.reg-address {
  grid-area: address;
}

.reg-submit {
  grid-area: submit;
}

.auth-submit {
  width: 100%;
  height: 44px;
  border-radius: 14px;
}

.auth-status {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(165, 122, 99, 0.18);
  background: rgba(244, 182, 194, 0.12);
}

.auth-test-hint {
  margin: 0 0 10px;
}

.test-account-actions {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.test-account-btn {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  text-align: left;
  background: rgba(255, 255, 255, 0.55);
  transition: background-color 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
}

.test-account-btn:hover {
  background: rgba(255, 255, 255, 0.75);
  transform: translateY(-1px);
  border-color: rgba(165, 122, 99, 0.35);
}

.test-account-meta {
  opacity: 0.8;
  font-size: 13px;
}

@media (max-width: 860px) {
  .auth-page {
    padding: 28px 0 56px;
  }

  .auth-card {
    padding: 20px;
  }

  .auth-login-grid {
    grid-template-columns: 1fr;
  }

  .auth-register-grid {
    grid-template-columns: 1fr;
    grid-template-areas: none;
    align-items: stretch;
  }

  .reg-submit {
    grid-area: auto;
  }
}
</style>
