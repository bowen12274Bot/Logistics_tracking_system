<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  api,
  type BillingBillDetailResponse,
  type BillingBillStatus,
  type ContractApplicationPayload,
} from '../services/api'
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

const isLoadingBill = ref(false)
const billErrorMessage = ref('')
const currentBill = ref<BillingBillDetailResponse['bill'] | null>(null)

const statusLabel = computed(() => {
  switch (applicationStatus.value) {
    case 'pending':
      return '審核中'
    case 'approved':
      return '已核准'
    case 'rejected':
      return '已退回'
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
    ? '查看本期帳單與包裹明細，並在帳期結算後於付款清單完成繳費。'
    : '填寫公司基本資料並送出申請，客服審核通過後即可使用月結付款資格。',
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

const getCurrentCycleUtcRange = () => {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)).toISOString()
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)).toISOString()
  return { start, end }
}

const loadCurrentBill = async () => {
  if (!auth.user) return
  if (applicationStatus.value !== 'approved') return

  isLoadingBill.value = true
  billErrorMessage.value = ''
  currentBill.value = null

  try {
    const { start, end } = getCurrentCycleUtcRange()
    const billsRes = await api.getBillingBills({ period_from: start, period_to: end })
    const first = billsRes.bills?.[0]
    if (!first?.id) {
      currentBill.value = null
      return
    }

    const detail = await api.getBillingBillDetail(first.id)
    currentBill.value = detail.bill
  } catch (err: any) {
    billErrorMessage.value = err?.message || '載入本期帳單失敗'
    currentBill.value = null
  } finally {
    isLoadingBill.value = false
  }
}

const formatMoney = (value?: number | null) => {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat('zh-TW').format(Number.isFinite(amount) ? amount : 0)
}

const billStatusLabel = (status?: BillingBillStatus | null) => {
  switch (status) {
    case 'paid':
      return '已付款'
    case 'overdue':
      return '逾期'
    case 'pending':
    default:
      return '待付款'
  }
}

const submitApplication = async () => {
  errorMessage.value = ''
  message.value = ''

  if (!auth.user) {
    errorMessage.value = '請先登入後再送出申請'
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

watch(
  () => applicationStatus.value,
  (status) => {
    if (status === 'approved') loadCurrentBill()
  },
)

onMounted(() => {
  if (!auth.user) return
  form.customer_id = auth.user.id
  loadStatus().then(() => {
    if (applicationStatus.value === 'approved') loadCurrentBill()
  })
})
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">合約 / 月結</p>
      <h1>{{ headerTitle }}</h1>
      <p class="lede">{{ headerLede }}</p>
    </header>

    <div class="card" style="background: linear-gradient(135deg, #fff7f0, #fffdf9)">
      <div class="status-banner" :class="applicationStatus">
        <span class="status-dot" :class="applicationStatus"></span>
        <div class="status-text">
          <div class="status-title">
            <strong>{{ statusLabel }}</strong>
            <span v-if="applicationId" class="muted">申請編號：{{ applicationId }}</span>
          </div>
          <p v-if="message">{{ message }}</p>
          <p v-if="isLoadingStatus" class="muted">正在載入申請狀態...</p>
        </div>
      </div>

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
          <input v-model="form.contact_phone" name="contact_phone" type="text" required />
        </label>

        <label class="form-field span-2">
          <span>帳單地址</span>
          <input v-model="form.billing_address" name="billing_address" type="text" required />
        </label>

        <label class="form-field span-2">
          <span>備註（選填）</span>
          <textarea
            v-model="form.notes"
            name="notes"
            rows="3"
            placeholder="例：請在平日下午聯絡、需要客製合約條款等"
          ></textarea>
        </label>

        <button class="secondary-btn" type="button" @click="fillTestData">填入測試資料</button>
        <button class="primary-btn" type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? '送出中…' : '送出申請' }}
        </button>
      </form>

      <div v-else-if="applicationStatus === 'pending'" class="status-panel">
        <p class="status-heading">你的申請已送出</p>
        <p class="muted">
          目前狀態：<strong>{{ statusLabel }}</strong>
          <span v-if="applicationId">（{{ applicationId }}）</span>
        </p>
        <p class="muted">客服正在審核，通過後即可使用月結付款。</p>
      </div>

      <div v-else-if="applicationStatus === 'approved'" class="billing-section">
        <h2 class="section-title">本期月結帳單</h2>

        <div v-if="isLoadingBill" class="billing-items-placeholder">
          <p class="muted">載入本期帳單中...</p>
        </div>
        <div v-else-if="billErrorMessage" class="billing-items-placeholder">
          <p class="muted" style="color: #b00020">{{ billErrorMessage }}</p>
          <button class="secondary-btn" type="button" style="margin-top: 10px" @click="loadCurrentBill">重新載入</button>
        </div>
        <div v-else-if="!currentBill" class="billing-items-placeholder">
          <p class="muted">本月尚未產生帳單（可能本期尚未有月結包裹完成配送）。</p>
          <button class="secondary-btn" type="button" style="margin-top: 10px" @click="loadCurrentBill">刷新</button>
        </div>
        <template v-else>
          <div class="billing-summary">
            <div class="summary-item">
              <span class="label">帳單期間</span>
              <span class="value">{{ currentBill.period }}</span>
            </div>
            <div class="summary-item">
              <span class="label">帳單狀態</span>
              <span class="value">{{ billStatusLabel(currentBill.status) }}</span>
            </div>
            <div class="summary-item">
              <span class="label">包裹數</span>
              <span class="value">{{ currentBill.items?.length ?? 0 }} 件</span>
            </div>
            <div class="summary-item">
              <span class="label">總金額</span>
              <span class="value">{{ formatMoney(currentBill.total_amount) }} 元</span>
            </div>
            <div v-if="currentBill.due_date" class="summary-item">
              <span class="label">繳費期限</span>
              <span class="value">{{ currentBill.due_date }}</span>
            </div>
          </div>

          <h3 class="section-subtitle">本期包裹明細</h3>
          <div class="billing-items-placeholder" style="border-style: solid">
            <p v-if="!currentBill.items?.length" class="muted">本期帳單目前沒有包裹。</p>
            <ul v-else class="bill-items">
              <li v-for="item in currentBill.items" :key="item.package_id" class="bill-item">
                <div class="bill-item-main">
                  <strong class="bill-item-id">{{ item.tracking_number || item.package_id }}</strong>
                  <span class="muted">{{ item.service_level || 'standard' }}</span>
                </div>
                <div class="bill-item-meta">
                  <span class="muted">寄件時間：{{ item.shipped_at || '--' }}</span>
                  <span class="muted">費用：{{ formatMoney(item.cost) }} 元</span>
                </div>
              </li>
            </ul>
          </div>
        </template>
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
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
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
.billing-items-placeholder {
  border-radius: 8px;
  border: 1px dashed #e5e7eb;
  padding: 0.75rem;
  background: #fdfdfc;
}
.bill-items {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}
.bill-item {
  border: 1px solid #eee;
  border-radius: 10px;
  padding: 10px;
  background: #fff;
}
.bill-item-main {
  display: flex;
  gap: 10px;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 4px;
}
.bill-item-id {
  font-weight: 700;
}
.bill-item-meta {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  flex-wrap: wrap;
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
  .bill-item-main {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
