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
    <div class="profile-container">
      <!-- Logout Warning Notice -->
      <UiNotice tone="warning" class="logout-notice">
        <strong>{{ t('profile.notice.logoutWarning.title') }}</strong>
        <p>{{ t('profile.notice.logoutWarning.message') }}</p>
      </UiNotice>

      <!-- Personal Information Card -->
      <UiCard class="profile-card">
        <div class="card-header">
          <div class="header-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div>
            <h3 class="card-title">{{ t('profile.sections.personal') }}</h3>
            <p class="card-subtitle">{{ t('profile.sections.personalHint') }}</p>
          </div>
        </div>

        <form @submit.prevent="submitProfile">
          <div class="form-section">
            <label class="form-field-enhanced">
              <div class="field-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div class="field-content">
                <span class="field-label">{{ t('profile.fields.name') }}</span>
                <input 
                  v-model="form.user_name" 
                  name="user_name" 
                  type="text" 
                  required 
                  class="field-input"
                  :placeholder="t('profile.placeholders.name')"
                />
              </div>
            </label>

            <label class="form-field-enhanced">
              <div class="field-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </div>
              <div class="field-content">
                <span class="field-label">{{ t('profile.fields.phone') }}</span>
                <input 
                  v-model="form.phone_number" 
                  name="phone_number" 
                  type="tel" 
                  required 
                  class="field-input"
                  :placeholder="t('profile.placeholders.phone')"
                />
              </div>
            </label>

            <label class="form-field-enhanced full-width">
              <div class="field-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
              <div class="field-content">
                <span class="field-label">{{ t('profile.fields.address') }}</span>
                <input 
                  v-model="form.address" 
                  name="address" 
                  type="text" 
                  required 
                  class="field-input"
                  :placeholder="t('profile.placeholders.address')"
                />
              </div>
            </label>
          </div>
        </form>
      </UiCard>

      <!-- Payment Preference Card -->
      <UiCard class="profile-card">
        <div class="card-header">
          <div class="header-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
              <line x1="1" y1="10" x2="23" y2="10"></line>
            </svg>
          </div>
          <div>
            <h3 class="card-title">{{ t('profile.sections.payment') }}</h3>
            <p class="card-subtitle">{{ t('profile.sections.paymentHint') }}</p>
          </div>
        </div>

        <form @submit.prevent="submitProfile">
          <div class="form-section">
            <label class="form-field-enhanced full-width">
              <div class="field-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <div class="field-content">
                <span class="field-label">{{ t('profile.fields.billing') }}</span>
                <select v-model="form.billing_preference" name="billing_preference" class="field-input">
                  <option value="cash">{{ t('profile.billing.cash') }}</option>
                  <option value="credit_card">{{ t('profile.billing.credit') }}</option>
                  <option value="bank_transfer">{{ t('profile.billing.bank') }}</option>
                  <option value="monthly">{{ t('profile.billing.monthly') }}</option>
                  <option value="third_party_payment">{{ t('profile.billing.third') }}</option>
                </select>
              </div>
            </label>
          </div>
        </form>
      </UiCard>

      <!-- Save Button Section -->
      <div class="save-section">
        <button class="primary-btn save-btn" type="submit" :disabled="isSubmitting" @click="submitProfile">
          <svg v-if="!isSubmitting" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          <span v-if="isSubmitting" class="loading-spinner"></span>
          {{ isSubmitting ? t('profile.saving') : t('profile.save') }}
        </button>
      </div>

      <!-- Feedback Messages -->
      <div v-if="errorMessage || successMessage" class="feedback-container">
        <UiNotice v-if="errorMessage" tone="error" role="alert">{{ errorMessage }}</UiNotice>
        <UiNotice v-if="successMessage" tone="success">{{ successMessage }}</UiNotice>
      </div>
    </div>
  </UiPageShell>
</template>

<style scoped>
/* Remove the outer frame from page shell */
:deep(.page-shell) {
  border: none;
  background: transparent;
  box-shadow: none;
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.profile-container {
  display: grid;
  gap: 16px;
  max-width: 900px;
  margin: 0 auto;
}

.logout-notice {
  margin-bottom: 4px;
}

.profile-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.profile-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(165, 122, 99, 0.15);
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--surface-stroke);
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(244, 182, 194, 0.2), rgba(225, 139, 139, 0.15));
  color: var(--accent-strong);
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.profile-card:hover .header-icon {
  transform: scale(1.05);
  background: linear-gradient(135deg, rgba(244, 182, 194, 0.3), rgba(225, 139, 139, 0.25));
}

.card-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 4px 0;
  letter-spacing: -0.01em;
}

.card-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.5;
}

.form-section {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, 1fr);
}

@media (max-width: 768px) {
  .form-section {
    grid-template-columns: 1fr;
  }
}

.form-field-enhanced {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid var(--surface-stroke);
  background: rgba(255, 255, 255, 0.5);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: text;
}

.form-field-enhanced:hover {
  border-color: rgba(165, 122, 99, 0.4);
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 0 2px 8px rgba(165, 122, 99, 0.08);
}

.form-field-enhanced:focus-within {
  border-color: var(--accent-strong);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 3px rgba(225, 139, 139, 0.15), 0 4px 12px rgba(165, 122, 99, 0.12);
  transform: translateY(-1px);
}

.form-field-enhanced.full-width {
  grid-column: 1 / -1;
}

.field-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(244, 182, 194, 0.15), rgba(225, 139, 139, 0.1));
  color: var(--accent-strong);
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.form-field-enhanced:focus-within .field-icon {
  background: linear-gradient(135deg, rgba(244, 182, 194, 0.25), rgba(225, 139, 139, 0.2));
  transform: scale(1.05);
}

.field-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
  letter-spacing: 0.01em;
}

.field-input {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text-main);
  font-size: 15px;
  padding: 4px 0;
  outline: none;
  transition: all 0.2s ease;
}

.field-input::placeholder {
  color: var(--text-muted);
  opacity: 0.6;
}

.field-input:focus {
  color: var(--text-main);
}

select.field-input {
  cursor: pointer;
  padding: 6px 0;
}

.save-section {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.save-btn {
  min-width: 160px;
  font-size: 15px;
  padding: 14px 24px;
  position: relative;
  overflow: hidden;
}

.save-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.save-btn:hover::before {
  width: 300px;
  height: 300px;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.save-btn:disabled:hover {
  transform: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(74, 38, 35, 0.3);
  border-top-color: #4a2623;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.feedback-container {
  display: grid;
  gap: 10px;
}

@media (max-width: 640px) {
  .form-section {
    grid-template-columns: 1fr;
  }
  
  .card-header {
    flex-direction: column;
    gap: 12px;
  }
  
  .form-actions {
    justify-content: stretch;
  }
  
  .save-btn {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .form-field-enhanced {
    flex-direction: column;
    gap: 10px;
  }
  
  .field-icon {
    align-self: flex-start;
  }
}
</style>

