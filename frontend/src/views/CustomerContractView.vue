<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api, type ContractApplicationPayload } from '../services/api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

const form = reactive<ContractApplicationPayload>({
  customer_id: auth.user?.id ?? '',
  company_name: '',
  tax_id: '',
  contact_person: '',
  contact_phone: '',
  billing_address: '',
  notes: '',
})

const applicationStatus = ref<string>('not_submitted')
const applicationId = ref<string>('')
const message = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)
const isLoadingStatus = ref(false)

const statusLabel = computed(() => {
  switch (applicationStatus.value) {
    case 'pending':
      return '審核中'
    case 'approved':
      return '已核准'
    case 'rejected':
      return '已拒絕'
    case 'error':
      return '載入失敗'
    default:
      return '尚未申請'
  }
})

const headerTitle = computed(() =>
  applicationStatus.value === 'approved' ? '月結資訊管理' : '申請成為合約客戶',
)

const headerLede = computed(() =>
  applicationStatus.value === 'approved'
    ? '查看當期月結資訊與本期帳期貨物。'
    : '填寫公司基本資料並送出申請，客服會審核後開通月結付款資格。',
)

const fillTestData = () => {
  form.company_name = '測試物流股份有限公司'
  form.tax_id = '12345678'
  form.contact_person = '王小明'
  form.contact_phone = '0912-345-678'
  form.billing_address = '台北市中正區仁愛路一段 1 號'
  form.notes = '這是測試資料，用於開發環境測試。'
}

const loadStatus = async () => {
  if (!auth.user) return
  isLoadingStatus.value = true
  errorMessage.value = ''
  try {
    const res = await api.getContractApplicationStatus(auth.user.id)
    if (res.has_application && res.status) {
      applicationStatus.value = res.status
      applicationId.value = res.application_id ?? ''
    } else {
      applicationStatus.value = 'not_submitted'
      applicationId.value = ''
    }
  } catch (err: any) {
    errorMessage.value = err?.message || '載入申請狀態失敗'
    applicationStatus.value = 'error'
  } finally {
    isLoadingStatus.value = false
  }
}

const submitApplication = async () => {
  errorMessage.value = ''
  message.value = ''

  if (!auth.user) {
    errorMessage.value = '請先登入後再提出申請'
    applicationStatus.value = 'error'
    return
  }

  form.customer_id = auth.user.id
  isSubmitting.value = true

  try {
    const res = await api.applyForContract(form)
    applicationId.value = res.application_id
    applicationStatus.value = res.status
    message.value = res.message
  } catch (err: any) {
    errorMessage.value = err?.message || '送出申請失敗，請稍後再試'
    applicationStatus.value = 'error'
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  if (auth.user) {
    form.customer_id = auth.user.id
    loadStatus()
  }
})
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">合約</p>
      <h1>{{ headerTitle }}</h1>
      <p class="lede">
        {{ headerLede }}
      </p>
    </header>

    <div class="card" style="background: linear-gradient(135deg, #fff7f0, #fffdf9)">
      <div class="status-banner" :class="applicationStatus">
        <span class="status-dot" :class="applicationStatus"></span>
        <div class="status-text">
          <div class="status-title">
            <strong>{{ statusLabel }}</strong>
            <span v-if="applicationId" class="muted">申請單號：{{ applicationId }}</span>
          </div>
          <p v-if="message">{{ message }}</p>
          <p v-if="isLoadingStatus" class="muted">正在載入申請狀態…</p>
        </div>
      </div>

      <!-- 非審核中 / 已核准時，顯示申請表單 -->
      <form
        v-if="applicationStatus !== 'pending' && applicationStatus !== 'approved'"
        class="form-grid"
        @submit.prevent="submitApplication"
      >
        <label class="form-field">
          <span>公司名稱</span>
          <input v-model="form.company_name" name="company_name" type="text" required />
        </label>

        <label class="form-field">
          <span>統一編號</span>
          <input v-model="form.tax_id" name="tax_id" type="text" required />
        </label>

        <label class="form-field">
          <span>聯絡人</span>
          <input v-model="form.contact_person" name="contact_person" type="text" required />
        </label>

        <label class="form-field">
          <span>聯絡電話</span>
          <input v-model="form.contact_phone" name="contact_phone" type="tel" required />
        </label>

        <label class="form-field span-2">
          <span>開票地址</span>
          <input v-model="form.billing_address" name="billing_address" type="text" required />
        </label>

        <label class="form-field span-2">
          <span>備註 / 特殊需求（選填）</span>
          <textarea
            v-model="form.notes"
            name="notes"
            rows="3"
            placeholder="例：請在平日下午聯絡、需要客製合約條款等"
          ></textarea>
        </label>

        <div class="form-field span-2" style="display: flex; gap: 0.75rem; align-items: center">
          <button class="secondary-btn" type="button" @click="fillTestData">填入測試資料</button>
          <button class="primary-btn" type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? '送出中…' : '送出申請' }}
          </button>
        </div>
      </form>

      <!-- 審核中：保留原本申請狀態說明 -->
      <div v-else-if="applicationStatus === 'pending'" class="status-panel">
        <p class="status-heading">你的合約申請已送出</p>
        <p class="muted">
          目前狀態：<strong>{{ statusLabel }}</strong>
          <span v-if="applicationId">（單號：{{ applicationId }}）</span>
        </p>
        <p class="muted">客服正在審核，通過後會開通月結付款。</p>
      </div>

      <!-- 已核准：改為顯示當期月結資訊骨架 -->
      <div v-else-if="applicationStatus === 'approved'" class="billing-section">
        <h2 class="section-title">當期月結資訊</h2>
        <div class="billing-summary">
          <div class="summary-item">
            <span class="label">帳單期間</span>
            <span class="value placeholder">2025-01-01 ~ 2025-01-31</span>
          </div>
          <div class="summary-item">
            <span class="label">本期件數</span>
            <span class="value placeholder">-- 件</span>
          </div>
          <div class="summary-item">
            <span class="label">預估金額</span>
            <span class="value placeholder">-- 元</span>
          </div>
        </div>

        <h3 class="section-subtitle">本期出貨明細（帳期貨物）</h3>
        <div class="billing-items-placeholder">
          <p class="muted">
            日後會串接 <code>monthly_billing</code> 與 <code>monthly_billing_items</code>
            ，顯示本期月結期間的所有出貨資料。
          </p>
        </div>
      </div>

      <p v-if="errorMessage" class="hint" style="color: #b00020">{{ errorMessage }}</p>
    </div>
  </section>
</template>

<style scoped>
.status-banner {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: 1px solid #f0e7df;
  background: #fffbf7;
  margin-bottom: 1rem;
}
.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #cbd5e0;
  flex-shrink: 0;
}
.status-dot.pending {
  background: #f6ad55;
}
.status-dot.approved {
  background: #48bb78;
}
.status-dot.rejected {
  background: #e53e3e;
}
.status-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}
.status-title {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  font-size: 15px;
}
.muted {
  color: #6b7280;
}
.status-panel {
  border: 1px dashed #e2e8f0;
  background: #fffefc;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  margin-top: 0.5rem;
}
.status-heading {
  font-weight: 700;
  margin-bottom: 0.25rem;
}
.billing-section {
  border-radius: 12px;
  border: 1px dashed #e2e8f0;
  background: #fffefc;
  padding: 1rem 1.25rem;
  margin-top: 0.75rem;
}
.section-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 0.5rem;
}
.section-subtitle {
  font-size: 14px;
  font-weight: 600;
  margin: 0.75rem 0 0.25rem;
}
.billing-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.5rem 1rem;
  padding: 0.5rem 0.25rem;
}
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}
.summary-item .label {
  font-size: 12px;
  color: #9ca3af;
}
.summary-item .value {
  font-size: 14px;
}
.placeholder {
  color: #d1d5db;
}
.billing-items-placeholder {
  border-radius: 8px;
  border: 1px dashed #e5e7eb;
  padding: 0.75rem;
  background: #fdfdfc;
}
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
  font-size: 12px;
  background: #f3f4f6;
  padding: 0.05rem 0.25rem;
  border-radius: 4px;
}
@media (max-width: 640px) {
  .status-banner,
  .status-panel,
  .billing-section {
    padding: 0.75rem;
  }
  .status-title {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

