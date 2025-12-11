<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

type Mode = 'login' | 'register'

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

const handleLogin = async () => {
  loading.value = true
  statusMessage.value = ''
  try {
    await auth.login({ ...loginForm })
    const redirect = (route.query.redirect as string) ?? '/customer'
    router.push(redirect)
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

const testAccounts = [
  { email: 'cust@example.com', password: 'cust123', role: '合約客戶' },
  { email: 'noncontract@example.com', password: 'custnc123', role: '非合約客戶' },
  { email: 'driver@example.com', password: 'driver123', role: '司機' },
  { email: 'warehouse@example.com', password: 'warehouse123', role: '倉儲' },
  { email: 'cs@example.com', password: 'cs123', role: '客服' },
  { email: 'admin@example.com', password: 'admin123', role: '管理員' },
]
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">帳號</p>
      <h1>登入 / 註冊</h1>
      <p class="lede">
        以帳號登入取得對應角色權限，或立即註冊新客戶。
      </p>
    </header>

    <div class="card tabs">
      <div class="tab-switch">
        <button :class="{ active: mode === 'login' }" type="button" @click="switchMode('login')">登入</button>
        <button :class="{ active: mode === 'register' }" type="button" @click="switchMode('register')">註冊</button>
      </div>

      <form v-if="mode === 'login'" class="form-grid" @submit.prevent="handleLogin">
        <label class="form-field">
          <span>手機或 Email</span>
          <input
            v-model="loginForm.identifier"
            required
            name="identifier"
            type="text"
            placeholder="cust@example.com 或 0912xxxxxx"
          />
        </label>

        <label class="form-field">
          <span>密碼</span>
          <input v-model="loginForm.password" required name="password" type="password" placeholder="********" />
        </label>

        <button class="primary-btn" type="submit" :disabled="loading">
          {{ loading ? '登入中...' : '登入' }}
        </button>
      </form>

      <form v-else class="form-grid" @submit.prevent="handleRegister">
        <label class="form-field">
          <span>姓名</span>
          <input v-model="registerForm.user_name" required name="user_name" type="text" placeholder="姓名" />
        </label>

        <label class="form-field">
          <span>Email</span>
          <input v-model="registerForm.email" required name="email" type="email" placeholder="you@example.com" />
        </label>

        <label class="form-field">
          <span>密碼</span>
          <input v-model="registerForm.password" required name="password" type="password" placeholder="********" />
        </label>

        <label class="form-field">
          <span>手機（選填）</span>
          <input v-model="registerForm.phone_number" name="phone_number" type="text" placeholder="09xxxxxxxx" />
        </label>

        <label class="form-field span-2">
          <span>地址（選填）</span>
          <input v-model="registerForm.address" name="address" type="text" placeholder="收件地址" />
        </label>

        <button class="primary-btn" type="submit" :disabled="loading">
          {{ loading ? '註冊中...' : '註冊' }}
        </button>
      </form>

      <p v-if="statusMessage" class="hint">{{ statusMessage }}</p>
    </div>

    <div class="card">
      <p class="eyebrow">測試帳號</p>
      <div class="task-list">
        <div v-for="acct in testAccounts" :key="acct.email">
          <strong>{{ acct.role }}</strong> — {{ acct.email }} / {{ acct.password }}
        </div>
      </div>
    </div>
  </section>
</template>
