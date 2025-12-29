<script setup lang="ts">
import { reactive, ref, watch, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import type { User } from '../services/api'
import { useToasts } from '../components/ui/toast'
import { toastFromApiError } from '../services/errorToast'
import UiIcon from '../components/ui/UiIcon.vue'
import UiModal from '../components/ui/UiModal.vue'
import {
  loadLoginCredentials,
  saveLoginCredentials,
  addCredential,
  removeCredential,
  type LoginCredentialStorage,
} from '../services/loginCredentialStorage'

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
const showLoginPassword = ref(false)
const showRegisterPassword = ref(false)

// Credential management
const showCredentialModal = ref(false)
const credentialStorage = ref<LoginCredentialStorage>(loadLoginCredentials())
const credentialTab = ref<'custom' | 'default' | 'demo'>('custom')
const credentialLabel = ref('')

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

// 暫時演示帳號，在此修改
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

// Credential management functions
const openCredentialModal = () => {
  showCredentialModal.value = true
}

const closeCredentialModal = () => {
  showCredentialModal.value = false
  credentialLabel.value = ''
}

const fillCredential = (email: string, password: string, label?: string) => {
  switchMode('login')
  loginForm.identifier = email
  loginForm.password = password
  closeCredentialModal()
  statusMessage.value = label ? `${t('login.filled')}: ${label}` : t('login.filled')
}

const saveCurrentCredential = () => {
  if (!loginForm.identifier || !loginForm.password) return
  
  const updated = addCredential(credentialStorage.value, {
    email: loginForm.identifier,
    password: loginForm.password,
    label: credentialLabel.value || loginForm.identifier,
  })
  
  credentialStorage.value = updated
  saveLoginCredentials(updated)
  credentialLabel.value = ''
  toast.success(t('login.credentials.saveSuccess'))
}

const deleteCredential = (index: number) => {
  const updated = removeCredential(credentialStorage.value, index)
  credentialStorage.value = updated
  saveLoginCredentials(updated)
  toast.success(t('login.credentials.deleteSuccess'))
}

onMounted(() => {
  credentialStorage.value = loadLoginCredentials()
})
</script>

<template>
  <section class="auth-page">
    <div class="auth-card">
      <header class="page-header auth-header">
        <p class="eyebrow">{{ t('login.eyebrow') }}</p>
        <h1>{{ t('login.title') }}</h1>
        <p class="lede">{{ t('login.lede') }}</p>
      </header>

      <div class="auth-panel" :class="{ 'auth-panel--register': mode === 'register' }">
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

          <label class="form-field password-field">
            <span>{{ t('login.password') }}</span>
            <div class="password-input-wrapper">
              <input
                v-model="loginForm.password"
                required
                name="password"
                :type="showLoginPassword ? 'text' : 'password'"
                placeholder="********"
                autocomplete="current-password"
              />
              <button
                type="button"
                class="password-toggle-btn"
                :aria-label="showLoginPassword ? t('login.hidePassword') : t('login.showPassword')"
                @click="showLoginPassword = !showLoginPassword"
              >
                <UiIcon :name="showLoginPassword ? 'eye-off' : 'eye'" />
              </button>
            </div>
          </label>

          <button class="primary-btn auth-submit" type="submit" :disabled="loading">
            {{ loading ? t('login.loggingIn') : t('login.loginTab') }}
          </button>
        </form>

        <div v-else class="auth-register-region">
          <form class="auth-register-grid" @submit.prevent="handleRegister">
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
              <span>{{ t('login.email') }}</span>
              <input v-model="registerForm.email" required name="email" type="email" placeholder="you@example.com" />
            </label>

            <label class="form-field reg-password password-field">
              <span>{{ t('login.password') }}</span>
              <div class="password-input-wrapper">
                <input
                  v-model="registerForm.password"
                  required
                  name="password"
                  :type="showRegisterPassword ? 'text' : 'password'"
                  placeholder="********"
                />
                <button
                  type="button"
                  class="password-toggle-btn"
                  :aria-label="showRegisterPassword ? t('login.hidePassword') : t('login.showPassword')"
                  @click="showRegisterPassword = !showRegisterPassword"
                >
                  <UiIcon :name="showRegisterPassword ? 'eye-off' : 'eye'" />
                </button>
              </div>
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
        </div>

        <p v-if="statusMessage" class="hint auth-status" role="status" aria-live="polite">{{ statusMessage }}</p>
      </div>

      <div v-if="mode === 'login'" class="auth-panel auth-panel--test">
        <div class="test-hint-row">
          <p class="hint auth-test-hint">{{ t('login.testHint') }}</p>
          <button type="button" class="ghost-btn small-btn credential-link-btn" @click="openCredentialModal">
            {{ t('login.credentials.openModal') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Credential Management Modal -->
    <UiModal
      v-model="showCredentialModal"
      :title="t('login.credentials.modalTitle')"
      @close="closeCredentialModal"
    >
      <div class="credential-modal-content">
        <div class="tab-switch credential-tabs" role="tablist">
          <button
            :class="{ active: credentialTab === 'custom' }"
            type="button"
            role="tab"
            @click="credentialTab = 'custom'"
          >
            {{ t('login.credentials.tabs.custom') }}
          </button>
          <button
            :class="{ active: credentialTab === 'default' }"
            type="button"
            role="tab"
            @click="credentialTab = 'default'"
          >
            {{ t('login.credentials.tabs.default') }}
          </button>
          <button
            :class="{ active: credentialTab === 'demo' }"
            type="button"
            role="tab"
            @click="credentialTab = 'demo'"
          >
            {{ t('login.credentials.tabs.demo') }}
          </button>
        </div>

        <!-- Custom Saved Tab -->
        <div v-if="credentialTab === 'custom'" class="credential-tab-content">
          <div class="credential-save-section">
            <input
              v-model="credentialLabel"
              type="text"
              class="credential-label-input"
              :placeholder="t('login.credentials.labelPlaceholder')"
            />
            <button
              type="button"
              class="primary-btn"
              :disabled="!loginForm.identifier || !loginForm.password"
              @click="saveCurrentCredential"
            >
              {{ t('login.credentials.saveCurrent') }}
            </button>
          </div>

          <div v-if="credentialStorage.credentials.length === 0" class="credential-empty">
            <p class="hint">{{ t('login.credentials.emptyCustom') }}</p>
          </div>
          <div v-else class="credential-list">
            <button
              v-for="(cred, index) in credentialStorage.credentials"
              :key="index"
              type="button"
              class="credential-item"
              @click="fillCredential(cred.email, cred.password, cred.label)"
            >
              <div class="credential-item-main">
                <strong>{{ cred.label || cred.email }}</strong>
                <span class="credential-item-email">{{ cred.email }}</span>
              </div>
              <button
                type="button"
                class="ghost-btn small-btn credential-delete-btn"
                @click.stop="deleteCredential(index)"
              >
                {{ t('login.credentials.delete') }}
              </button>
            </button>
          </div>
        </div>

        <!-- Default Accounts Tab -->
        <div v-if="credentialTab === 'default'" class="credential-tab-content">
          <div v-if="testAccounts.length === 0" class="credential-empty">
            <p class="hint">{{ t('login.credentials.emptyDefault') }}</p>
          </div>
          <div v-else class="credential-list">
            <button
              v-for="acct in testAccounts"
              :key="acct.email"
              type="button"
              class="credential-item"
              @click="fillCredential(acct.email, acct.password, t(acct.roleKey))"
            >
              <div class="credential-item-main">
                <strong>{{ t(acct.roleKey) }}</strong>
                <span class="credential-item-email">{{ acct.email }}</span>
              </div>
            </button>
          </div>
        </div>

        <!-- Demo Accounts Tab -->
        <div v-if="credentialTab === 'demo'" class="credential-tab-content">
          <div v-if="quickAccounts.length === 0" class="credential-empty">
            <p class="hint">{{ t('login.credentials.emptyDemo') }}</p>
          </div>
          <div v-else class="credential-list">
            <button
              v-for="acct in quickAccounts"
              :key="acct.email"
              type="button"
              class="credential-item"
              @click="fillCredential(acct.email, acct.password, t(acct.roleKey))"
            >
              <div class="credential-item-main">
                <strong>{{ t(acct.roleKey) }}</strong>
                <span class="credential-item-email">{{ acct.email }}</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </UiModal>
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

.password-field {
  position: relative;
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-wrapper input {
  flex: 1;
  padding-right: 44px;
}

.password-toggle-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  padding: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(106, 74, 64, 0.65);
  transition: color 0.2s ease, transform 0.15s ease;
  border-radius: 6px;
}

.password-toggle-btn:hover {
  color: rgba(106, 74, 64, 0.9);
  background: rgba(165, 122, 99, 0.08);
}

.password-toggle-btn:active {
  transform: translateY(-50%) scale(0.95);
}

.password-toggle-btn:focus-visible {
  outline: 2px solid rgba(244, 182, 194, 0.55);
  outline-offset: 2px;
}

.auth-register-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
  align-items: stretch;
}

.auth-register-region {
  margin-top: 16px;
  max-width: auto;
  margin-left: auto;
  margin-right: auto;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(165, 122, 99, 0.18);
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 16px 44px rgba(170, 124, 105, 0.12);
}

.auth-panel--register .auth-register-region {
  margin-top: 28px;
}

.auth-submit {
  width: 100%;
  height: 44px;
  border-radius: 14px;
}

.reg-submit {
  margin-top: 18px;
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

.test-hint-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.auth-test-hint {
  flex: 1;
  margin: 0;
}

.credential-link-btn {
  flex-shrink: 0;
  font-size: 13px;
  padding: 6px 12px;
  opacity: 0.85;
  transition: all 0.2s ease;
}

.credential-link-btn:hover {
  opacity: 1;
  background: rgba(244, 182, 194, 0.2);
}

.credential-modal-content {
  min-height: 320px;
}

.credential-tabs {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border-radius: 14px;
  background: rgba(248, 240, 235, 0.85);
  margin-bottom: 20px;
  padding: 4px;
  gap: 4px;
}

.credential-tabs button {
  padding: 11px 14px;
  font-weight: 600;
  font-size: 14px;
  border-radius: 10px;
  transition: all 0.2s ease;
  color: rgba(107, 74, 64, 0.7);
}

.credential-tabs button:hover {
  color: rgba(107, 74, 64, 0.9);
  background: rgba(255, 255, 255, 0.4);
}

.credential-tabs button.active {
  background: rgba(244, 182, 194, 0.55);
  color: #6b4a40;
  box-shadow: 0 2px 8px rgba(170, 124, 105, 0.15);
}

.credential-tab-content {
  min-height: 260px;
}

.credential-save-section {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 248, 241, 0.6);
  border: 1px solid rgba(165, 122, 99, 0.15);
}

.credential-label-input {
  flex: 1;
  padding: 11px 14px;
  border-radius: 11px;
  border: 1px solid rgba(165, 122, 99, 0.28);
  background: rgba(255, 255, 255, 0.95);
  font-size: 14px;
  transition: all 0.2s ease;
}

.credential-label-input:hover {
  border-color: rgba(165, 122, 99, 0.38);
}

.credential-label-input:focus {
  outline: 2px solid rgba(244, 182, 194, 0.5);
  border-color: rgba(225, 139, 139, 0.5);
  background: #fff;
}

.credential-save-section .primary-btn {
  padding: 11px 20px;
  font-size: 14px;
  white-space: nowrap;
}

.credential-empty {
  padding: 50px 20px;
  text-align: center;
}

.credential-empty .hint {
  color: rgba(107, 74, 64, 0.6);
  font-size: 14px;
}

.credential-list {
  display: grid;
  gap: 8px;
}

.credential-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 13px;
  text-align: left;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(165, 122, 99, 0.2);
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
}

.credential-item::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 13px;
  background: linear-gradient(135deg, rgba(244, 182, 194, 0.08) 0%, rgba(255, 248, 241, 0.08) 100%);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.credential-item:hover {
  background: rgba(255, 255, 255, 0.85);
  transform: translateY(-2px);
  border-color: rgba(165, 122, 99, 0.35);
  box-shadow: 0 4px 12px rgba(170, 124, 105, 0.12);
}

.credential-item:hover::before {
  opacity: 1;
}

.credential-item:active {
  transform: translateY(-1px);
}

.credential-item-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
  position: relative;
  z-index: 1;
}

.credential-item-main strong {
  color: #6b4a40;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}

.credential-item-email {
  opacity: 0.7;
  font-size: 13px;
  color: #6b4a40;
  line-height: 1.3;
}

.credential-delete-btn {
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  font-size: 13px;
  padding: 6px 12px;
  opacity: 0.8;
  transition: all 0.2s ease;
}

.credential-delete-btn:hover {
  opacity: 1;
  background: rgba(244, 182, 194, 0.25);
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
}
</style>
