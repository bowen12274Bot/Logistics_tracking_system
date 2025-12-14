<script setup lang="ts">
import { reactive, ref, watchEffect } from 'vue'
import { useAuthStore } from '../stores/auth'
import { api, type UpdateCustomerPayload } from '../services/api'

const auth = useAuthStore()

const form = reactive<UpdateCustomerPayload>({
  user_id: auth.user?.id ?? '',
  user_name: auth.user?.user_name ?? '',
  phone_number: auth.user?.phone_number ?? '',
  address: auth.user?.address ?? '',
  billing_preference: auth.user?.billing_preference ?? 'cash',
})

watchEffect(() => {
  if (auth.user) {
    form.user_id = auth.user.id
    form.user_name = auth.user.user_name
    form.phone_number = auth.user.phone_number ?? ''
    form.address = auth.user.address ?? ''
    form.billing_preference = auth.user.billing_preference ?? 'cash'
  }
})

const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const submitProfile = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!auth.user) {
    errorMessage.value = '請先登入後再修改資料。'
    return
  }

  form.user_id = auth.user.id

  isSubmitting.value = true
  try {
    const res = await api.updateCustomerMe(form)
    auth.setUser(res.user)
    successMessage.value = '個人資料已更新。'
  } catch (err: any) {
    errorMessage.value = err?.message || '更新失敗，請稍後再試。'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">客戶</p>
      <h1>更新個人資料</h1>
      <p class="lede">修改你的姓名、電話、地址與支付偏好。</p>
    </header>

    <div class="card">
      <form class="form-grid" @submit.prevent="submitProfile">
        <label class="form-field">
          <span>姓名</span>
          <input v-model="form.user_name" name="user_name" type="text" required />
        </label>

        <label class="form-field">
          <span>電話</span>
          <input v-model="form.phone_number" name="phone_number" type="tel" required />
        </label>

        <label class="form-field span-2">
          <span>地址</span>
          <input v-model="form.address" name="address" type="text" required />
        </label>

        <label class="form-field">
          <span>支付偏好</span>
          <select v-model="form.billing_preference" name="billing_preference">
            <option value="cash">現金支付</option>
            <option value="credit_card">信用卡</option>
            <option value="bank_transfer">網路銀行</option>
            <option value="monthly">月結帳單（合約客戶）</option>
            <option value="third_party_payment">第三方支付</option>
          </select>
        </label>

        <button class="primary-btn" type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? '儲存中…' : '儲存變更' }}
        </button>
      </form>

      <p v-if="errorMessage" class="hint" style="color: #b00020">{{ errorMessage }}</p>
      <p v-if="successMessage" class="hint">{{ successMessage }}</p>
    </div>
  </section>
</template>

