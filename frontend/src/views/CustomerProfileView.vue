<script setup lang="ts">
import { reactive, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { api, type UpdateCustomerPayload } from '../services/api'
import UiCard from '../components/ui/UiCard.vue'
import UiNotice from '../components/ui/UiNotice.vue'
import UiPageShell from '../components/ui/UiPageShell.vue'
import { useToasts } from '../components/ui/toast'
import { toastFromApiError } from '../services/errorToast'

const auth = useAuthStore()
const toast = useToasts()
const { t } = useI18n()

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
    toast.warning(errorMessage.value)
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
    toastFromApiError(err, errorMessage.value)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UiPageShell :eyebrow="t('profile.eyebrow')" :title="t('profile.title')" :lede="t('profile.lede')">
    <UiCard>
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

      <UiNotice v-if="errorMessage" tone="error" role="alert">{{ errorMessage }}</UiNotice>
      <UiNotice v-if="successMessage" tone="success">{{ successMessage }}</UiNotice>
    </UiCard>
  </UiPageShell>
</template>

