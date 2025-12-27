<script setup lang="ts">
import { reactive, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { api, type UpdateCustomerPayload } from '../services/api'

const { t } = useI18n()
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
    errorMessage.value = t('profile.errors.notLoggedIn')
    return
  }

  form.user_id = auth.user.id

  isSubmitting.value = true
  try {
    const res = await api.updateCustomerMe(form)
    auth.setUser(res.user)
    successMessage.value = t('profile.success')
  } catch (err: any) {
    errorMessage.value = err?.message || t('profile.errors.updateFailed')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">{{ t('profile.eyebrow') }}</p>
      <h1>{{ t('profile.title') }}</h1>
      <p class="lede">{{ t('profile.lede') }}</p>
    </header>

    <div class="card">
      <form class="form-grid" @submit.prevent="submitProfile">
        <label class="form-field">
          <span>{{ t('profile.fields.name') }}</span>
          <input v-model="form.user_name" name="user_name" type="text" required />
        </label>

        <label class="form-field">
          <span>{{ t('profile.fields.phone') }}</span>
          <input v-model="form.phone_number" name="phone_number" type="tel" required />
        </label>

        <label class="form-field span-2">
          <span>{{ t('profile.fields.address') }}</span>
          <input v-model="form.address" name="address" type="text" required />
        </label>

        <label class="form-field">
          <span>{{ t('profile.fields.billing') }}</span>
          <select v-model="form.billing_preference" name="billing_preference">
            <option value="cash">{{ t('profile.billing.cash') }}</option>
            <option value="credit_card">{{ t('profile.billing.credit') }}</option>
            <option value="bank_transfer">{{ t('profile.billing.bank') }}</option>
            <option value="monthly">{{ t('profile.billing.monthly') }}</option>
            <option value="third_party_payment">{{ t('profile.billing.third') }}</option>
          </select>
        </label>

        <button class="primary-btn" type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? t('profile.saving') : t('profile.save') }}
        </button>
      </form>

      <p v-if="errorMessage" class="hint" style="color: #b00020">{{ errorMessage }}</p>
      <p v-if="successMessage" class="hint">{{ successMessage }}</p>
    </div>
  </section>
</template>

