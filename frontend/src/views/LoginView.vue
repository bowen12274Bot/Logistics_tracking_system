<script setup lang="ts">
import { reactive, ref, watch, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import type { User } from '../services/api'
import { useToasts } from '../components/ui/toast'
import { toastFromApiError } from '../services/errorToast'

type Mode = 'login' | 'register'
type TestAccount = { email: string; password: string; roleKey: string }

const mode = ref<Mode>('login')
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const toast = useToasts()
const statusMessage = ref('')
const loading = ref(false)
const { t } = useI18n()

const applyReasonHint = () => {
  if (statusMessage.value) return
  const reason = route.query.reason
  if (reason === 'unauthorized') {
    const message = t('login.reasonUnauthorized')
    toast.warning(message)
    statusMessage.value = message
  }
}

const syncModeFromRoute = () => {
  const q = (route.query.mode as string | undefined) ?? ''
  if (route.path === '/register' || q === 'register') mode.value = 'register'
  else mode.value = 'login'
}

onMounted(() => {
  syncModeFromRoute()
  applyReasonHint()
})
watch(() => [route.path, route.query.mode], syncModeFromRoute)
watch(() => route.query.reason, applyReasonHint)

const switchMode = (next: Mode) => {
  mode.value = next
  statusMessage.value = ''
  const redirect = route.query.redirect as string | undefined
  if (next === 'register') {
    router.replace({ path: '/register', query: redirect ? { redirect } : undefined })
  } else {
    router.replace({ path: '/login', query: redirect ? { redirect } : undefined })
  }
}

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

const quickAccounts = computed<TestAccount[]>(() => [
  { email: 'customer@example.com', password: 'customer123', roleKey: 'login.quickRoles.customer' },
  { email: 'driver_hub_0@example.com', password: 'driver123', roleKey: 'login.quickRoles.driver' },
  { email: 'warehouse_hub_0@example.com', password: 'warehouse123', roleKey: 'login.quickRoles.warehouse' },
  { email: 'cs@example.com', password: 'cs123', roleKey: 'login.quickRoles.cs' },
  { email: 'admin@example.com', password: 'admin123', roleKey: 'login.quickRoles.admin' },
])

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
  statusMessage.value = ''
  loading.value = true

  // clear stale state before new login attempt
  auth.logout()

  try {
    const loggedInUser = await auth.login({ ...loginForm })
    const redirect = route.query.redirect as string | undefined
    router.push(redirect ?? getDefaultRouteForUser(loggedInUser))
  } catch (err: any) {
    const status = Number(err?.status)
    const message = err?.message ?? (status === 401 ? t('login.error') : t('login.loginFailed'))
    if (status === 401) toast.warning(message)
    else toastFromApiError(err, message)
    statusMessage.value = message
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  statusMessage.value = ''
  loading.value = true

  // clear stale state before register attempt
  auth.logout()

  try {
    await auth.register({
      user_name: registerForm.user_name,
      email: registerForm.email,
      password: registerForm.password,
      phone_number: registerForm.phone_number || undefined,
      address: registerForm.address || undefined,
      user_type: 'customer',
      user_class: 'non_contract_customer',
    })

    const redirect = (route.query.redirect as string) ?? '/customer'
    await router.push(redirect)
  } catch (err: any) {
    const message = err?.message ?? t('login.registerError')
    toastFromApiError(err, message)
    statusMessage.value = message
  } finally {
    loading.value = false
  }
}

const testAccounts = computed<TestAccount[]>(() => [
  { email: 'cust@example.com', password: 'cust123', roleKey: 'login.testRoles.contract' },
  { email: 'noncontract@example.com', password: 'custnc123', roleKey: 'login.testRoles.nonContract' },
  { email: 'driver_hub_0@example.com', password: 'driver123', roleKey: 'login.testRoles.driver' },
  { email: 'warehouse_hub_0@example.com', password: 'warehouse123', roleKey: 'login.testRoles.warehouse' },
  { email: 'cs@example.com', password: 'cs123', roleKey: 'login.testRoles.cs' },
  { email: 'admin@example.com', password: 'admin123', roleKey: 'login.testRoles.admin' },
])

const fillTestAccount = (acct: TestAccount) => {
  switchMode('login')
  loginForm.identifier = acct.email
  loginForm.password = acct.password
  statusMessage.value = `${t('login.filled')}: ${t(acct.roleKey)}`
}
</script>

<template>
  <section class="auth-page">
    <div class="auth-card">
      <header class="page-header auth-header">
        <p class="eyebrow">{{ t('login.eyebrow') }}</p>
        <h1>{{ t('login.title') }}</h1>
        <p class="lede">{{ t('login.lede') }}</p>
      </header>

      <div class="auth-panel">
        <div class="tab-switch auth-tabs" role="tablist" :aria-label="t('login.tabAria')">
          <button :class="{ active: mode === 'login' }" type="button" role="tab" @click="switchMode('login')">
            {{ t('login.loginTab') }}
          </button>
          <button :class="{ active: mode === 'register' }" type="button" role="tab" @click="switchMode('register')">
            {{ t('login.registerTab') }}
          </button>
        </div>

        <form v-if="mode === 'login'" class="auth-login-grid" @submit.prevent="handleLogin">
          <label class="form-field">
            <span>{{ t('login.identifier') }}</span>
            <input
              v-model="loginForm.identifier"
              required
              name="identifier"
              type="text"
              :placeholder="t('login.identifierPlaceholder')"
              autocomplete="username"
            />
          </label>

          <label class="form-field">
            <span>{{ t('login.password') }}</span>
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
            {{ loading ? t('login.loggingIn') : t('login.loginTab') }}
          </button>
        </form>

        <form v-else class="auth-register-grid" @submit.prevent="handleRegister">
          <label class="form-field reg-name">
            <span>{{ t('login.register.name') }}</span>
            <input
              v-model="registerForm.user_name"
              required
              name="user_name"
              type="text"
              :placeholder="t('login.register.namePlaceholder')"
            />
          </label>

          <label class="form-field reg-email">
            <span>Email</span>
            <input v-model="registerForm.email" required name="email" type="email" placeholder="you@example.com" />
          </label>

          <label class="form-field reg-password">
            <span>{{ t('login.password') }}</span>
            <input v-model="registerForm.password" required name="password" type="password" placeholder="********" />
          </label>

          <label class="form-field reg-phone">
            <span>{{ t('login.register.phone') }}</span>
            <input
              v-model="registerForm.phone_number"
              name="phone_number"
              type="text"
              :placeholder="t('login.register.phonePlaceholder')"
            />
          </label>

          <label class="form-field reg-address">
            <span>{{ t('login.register.address') }}</span>
            <input
              v-model="registerForm.address"
              name="address"
              type="text"
              :placeholder="t('login.register.addressPlaceholder')"
            />
          </label>

          <button class="primary-btn auth-submit reg-submit" type="submit" :disabled="loading">
            {{ loading ? t('login.registering') : t('login.registerTab') }}
          </button>
        </form>

        <p v-if="statusMessage" class="hint auth-status" role="status" aria-live="polite">{{ statusMessage }}</p>
      </div>

      <div v-if="mode === 'login'" class="auth-panel auth-panel--test">
        <p class="hint auth-test-hint">{{ t('login.testHint') }}</p>
        <div class="test-account-actions" role="list">
          <button
            v-for="acct in testAccounts"
            :key="acct.email"
            type="button"
            class="ghost-btn test-account-btn"
            role="listitem"
            @click="fillTestAccount(acct)"
          >
            <strong>{{ t(acct.roleKey) }}</strong>
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
