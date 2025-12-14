<script setup lang="ts">
import { reactive, ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

type Mode = 'login' | 'register'

const mode = ref<Mode>('login')
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const statusMessage = ref('')
const loading = ref(false)

const syncModeFromRoute = () => {
  const q = (route.query.mode as string | undefined) ?? ''
  if (route.path === '/register' || q === 'register') mode.value = 'register'
  else mode.value = 'login'
}

onMounted(syncModeFromRoute)
watch(() => [route.path, route.query.mode], syncModeFromRoute)

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

const quickAccounts = [
  { email: 'customer@example.com', password: 'customer123', role: '客戶' },
  { email: 'driver@example.com', password: 'driver123', role: '司機' },
  { email: 'warehouse@example.com', password: 'warehouse123', role: '倉儲' },
  { email: 'cs@example.com', password: 'cs123', role: '客服' },
  { email: 'admin@example.com', password: 'admin123', role: '管理員' },
]

const roleHomeByCurrentUser = () => {
  const r = auth.user?.user_class
  if (r === 'admin') return '/admin'
  if (r === 'customer_service') return '/employee/customer-service'
  if (r === 'warehouse_staff') return '/employee/warehouse'
  if (r === 'driver') return '/employee/driver'
  return '/customer'
}

const handleLogin = async () => {
  statusMessage.value = ''
  loading.value = true

  // ✅ 強制清掉舊登入狀態（避免 admin 殘留）
  auth.logout()

  try {
    await auth.login({
      identifier: loginForm.identifier,
      password: loginForm.password,
    })

    const redirect = (route.query.redirect as string) ?? roleHomeByCurrentUser()
    await router.push(redirect)

  } catch (err: any) {
    statusMessage.value = err?.message ?? '帳號或密碼錯誤'
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  statusMessage.value = ''
  loading.value = true

  // ✅ 強制清掉舊登入狀態
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


    // ✅ 註冊完成後：若有 redirect 就回去，沒有就去客戶首頁
    const redirect = (route.query.redirect as string) ?? '/customer'
    await router.push(redirect)

  } catch (err: any) {
    statusMessage.value = err?.message ?? '註冊失敗，請稍後再試'
  } finally {
    loading.value = false
  }
}

const fillAccount = (email: string, password: string) => {

  // ✅ 點快速測試帳號時，先清掉錯誤訊息
  statusMessage.value = ''
  switchMode('login')
  loginForm.identifier = email
  loginForm.password = password
}
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">帳號</p>
      <h1>登入 / 註冊</h1>
      <p class="lede">以帳號登入取得對應角色權限，或立即註冊新客戶。</p>
    </header>

    <div class="card">
      <div class="tabs">
        <button :class="{ active: mode === 'login' }" type="button" @click="switchMode('login')">登入</button>
        <button :class="{ active: mode === 'register' }" type="button" @click="switchMode('register')">註冊</button>
      </div>

      <form v-if="mode === 'login'" class="form-grid" @submit.prevent="handleLogin">
        <label class="field">
          <span class="label">Email 或帳號</span>
          <input v-model="loginForm.identifier" required type="text" placeholder="customer@example.com" />
        </label>

        <label class="field">
          <span class="label">密碼</span>
          <input v-model="loginForm.password" required type="password" placeholder="customer123" />
        </label>

        <button class="primary" type="submit" :disabled="loading">
          {{ loading ? '登入中...' : '登入' }}
        </button>

        <p v-if="statusMessage" class="status">{{ statusMessage }}</p>

        <div class="quick">
          <p class="quick-title">快速測試帳號（會自動填入正確密碼）</p>
          <div class="quick-grid">
            <button
              v-for="acc in quickAccounts"
              :key="acc.email"
              class="quick-item"
              type="button"
              @click="fillAccount(acc.email, acc.password)"
            >
              <span class="quick-role">{{ acc.role }}</span>
              <span class="quick-email">{{ acc.email }}</span>
            </button>
          </div>
        </div>
      </form>

      <form v-else class="form-grid" @submit.prevent="handleRegister">
        <label class="field">
          <span class="label">姓名</span>
          <input v-model="registerForm.user_name" required type="text" placeholder="王小明" />
        </label>

        <label class="field">
          <span class="label">Email</span>
          <input v-model="registerForm.email" required type="email" placeholder="you@example.com" />
        </label>

        <label class="field">
          <span class="label">密碼</span>
          <input v-model="registerForm.password" required type="password" placeholder="至少 6 碼" />
        </label>

        <label class="field">
          <span class="label">手機（選填）</span>
          <input v-model="registerForm.phone_number" type="text" placeholder="09xxxxxxxx" />
        </label>

        <label class="field">
          <span class="label">地址（選填）</span>
          <input v-model="registerForm.address" type="text" placeholder="收件地址" />
        </label>

        <button class="primary" type="submit" :disabled="loading">
          {{ loading ? '註冊中...' : '註冊' }}
        </button>

        <p v-if="statusMessage" class="status">{{ statusMessage }}</p>
      </form>
    </div>
  </section>
</template>

<style scoped>
.page-shell { max-width: 980px; margin: 0 auto; padding: 24px 16px 60px; }
.page-header { margin-bottom: 18px; }
.eyebrow { margin: 0; font-size: 12px; opacity: 0.65; }
.lede { margin: 8px 0 0; opacity: 0.75; }

.card {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 18px;
  padding: 16px;
}

.tabs { display: flex; gap: 8px; margin-bottom: 14px; }
.tabs button {
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(233, 210, 180, 0.18);
  border-radius: 14px;
  padding: 10px 14px;
  cursor: pointer;
}
.tabs button.active { background: rgba(255, 182, 193, 0.45); }

.form-grid { display: grid; gap: 12px; }
.field { display: grid; gap: 6px; }
.label { font-size: 13px; opacity: 0.75; }

input {
  border: 1px solid rgba(0, 0, 0, 0.10);
  border-radius: 14px;
  padding: 10px 12px;
  outline: none;
  background: #fff;
}

.primary {
  border: 0;
  border-radius: 14px;
  padding: 12px 14px;
  cursor: pointer;
  background: rgba(255, 182, 193, 0.55);
  color: #2f2a24;
  font-weight: 700;
}
.primary:disabled { opacity: 0.6; cursor: not-allowed; }

.status {
  margin: 0;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 182, 193, 0.18);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.quick { margin-top: 10px; }
.quick-title { margin: 0 0 10px; font-size: 13px; opacity: 0.75; }
.quick-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.quick-item {
  text-align: left;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(233, 210, 180, 0.18);
  border-radius: 14px;
  padding: 10px 12px;
  cursor: pointer;
}
.quick-role { display: inline-block; font-weight: 800; margin-right: 8px; }
.quick-email { opacity: 0.75; }
</style>
