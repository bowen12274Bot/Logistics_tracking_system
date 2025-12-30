<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  api,
  type BillingBillDetailResponse,
  type BillingBillListItem,
  type BillingBillStatus,
  type ContractApplicationPayload,
  type PackageRecord,
} from '../services/api'
import { useAuthStore } from '../stores/auth'
import {
  dimensionsLabel,
  formatDateTime,
  formatMoney,
  receiverDisplayName,
  resolveDeliveryLabel,
  resolveNotes,
  resolveSpecialMarks,
  senderDisplayName,
} from '../utils/packageDisplay'
import UiCard from '../components/ui/UiCard.vue'
import UiNotice from '../components/ui/UiNotice.vue'
import UiPageShell from '../components/ui/UiPageShell.vue'
import { useToasts } from '../components/ui/toast'
import { toastFromApiError } from '../services/errorToast'

const auth = useAuthStore()
const toast = useToasts()
const { t, locale } = useI18n()

const listSeparator = computed(() => (locale.value === 'zh-TW' ? '、' : ', '))
const trackingLabel = (tracking?: string | null) => (tracking && tracking.trim() ? tracking.trim() : t('common.tracking.pending'))

// 格式化日期範圍字串 "2025-12-01T00:00:00.000Z - 2025-12-31T23:59:59.999Z" -> "2025/12/1 - 2025/12/31"
const formatPeriodRange = (period: string) => {
  if (!period || !period.includes(' - ')) return period
  
  const [start, end] = period.split(' - ').map(s => s.trim())
  if (!start || !end) return period
  
  try {
    const startDate = new Date(start)
    const endDate = new Date(end)
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return period
    
    const targetLocale = locale.value === 'en-US' ? 'en-US' : 'zh-TW'
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' }
    
    const formattedStart = startDate.toLocaleDateString(targetLocale, options)
    const formattedEnd = endDate.toLocaleDateString(targetLocale, options)
    
    return `${formattedStart} - ${formattedEnd}`
  } catch {
    return period
  }
}

const props = defineProps<{
  embedded?: boolean
}>()

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
const currentBillMeta = ref<BillingBillListItem | null>(null)
const expandedItemIds = ref<Set<string>>(new Set())
const packageDetails = ref<Record<string, PackageRecord | null>>({})
const packageDetailLoading = ref<Record<string, boolean>>({})
const packageDetailError = ref<Record<string, string>>({})

const statusLabel = computed(() => {
  switch (applicationStatus.value) {
    case 'pending':
      return t('contract.status.pending')
    case 'approved':
      return t('contract.status.approved')
    case 'rejected':
      return t('contract.status.rejected')
    case 'error':
      return t('contract.status.error')
    default:
      return t('contract.status.notSubmitted')
  }
})

const headerTitle = computed(() =>
  applicationStatus.value === 'approved' ? t('contract.title.manage') : t('contract.title.apply'),
)

const headerLede = computed(() =>
  applicationStatus.value === 'approved'
    ? t('contract.lede.manage')
    : t('contract.lede.apply'),
)

const fillTestData = () => {
  form.company_name = t('contract.testData.company')
  form.tax_id = '12345678'
  form.contact_person = t('contract.testData.contact')
  form.contact_phone = '0912-345-678'
  form.billing_address = t('contract.testData.address')
  form.notes = t('contract.testData.notes')
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
    errorMessage.value = err?.message || t('contract.errors.loadStatusFailed')
    toastFromApiError(err, errorMessage.value)
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
  currentBillMeta.value = null
  expandedItemIds.value = new Set()
  packageDetails.value = {}
  packageDetailLoading.value = {}
  packageDetailError.value = {}

  try {
    const { start, end } = getCurrentCycleUtcRange()
    const billsRes = await api.getBillingBills({ period_from: start, period_to: end })
    const bills = billsRes.bills ?? []
    const selected = bills.find((b) => !b.due_date) ?? bills[0]
    if (!selected?.id) {
      currentBill.value = null
      currentBillMeta.value = null
      return
    }

    currentBillMeta.value = selected
    const detail = await api.getBillingBillDetail(selected.id)
    currentBill.value = detail.bill
  } catch (err: any) {
    billErrorMessage.value = err?.message || t('contract.errors.loadBillFailed')
    toastFromApiError(err, billErrorMessage.value)
    currentBill.value = null
    currentBillMeta.value = null
  } finally {
    isLoadingBill.value = false
  }
}

const ensurePackageDetail = async (packageId: string) => {
  if (!packageId) return
  if (packageDetails.value[packageId]) return
  if (packageDetailLoading.value[packageId]) return

  packageDetailLoading.value = { ...packageDetailLoading.value, [packageId]: true }
  packageDetailError.value = { ...packageDetailError.value, [packageId]: '' }

  try {
    const res = await api.getPackageStatus(packageId)
    packageDetails.value = { ...packageDetails.value, [packageId]: res.package }
  } catch (err: any) {
    packageDetailError.value = { ...packageDetailError.value, [packageId]: err?.message || t('contract.errors.loadPackageFailed') }
    toastFromApiError(err, t('contract.errors.loadPackageStatusFailed'))
    packageDetails.value = { ...packageDetails.value, [packageId]: null }
  } finally {
    packageDetailLoading.value = { ...packageDetailLoading.value, [packageId]: false }
  }
}

const toggleItem = async (packageId: string) => {
  const next = new Set(expandedItemIds.value)
  const willOpen = !next.has(packageId)
  if (!willOpen) next.delete(packageId)
  else next.add(packageId)
  expandedItemIds.value = next
  if (willOpen) await ensurePackageDetail(packageId)
}

const billStatusLabel = (status?: BillingBillStatus | null) => {
  switch (status) {
    case 'paid':
      return t('contract.billStatus.paid')
    case 'overdue':
      return t('contract.billStatus.overdue')
    case 'pending':
    default:
      return t('contract.billStatus.pending')
  }
}

const submitApplication = async () => {
  errorMessage.value = ''
  message.value = ''

  if (!auth.user) {
    errorMessage.value = t('contract.errors.loginRequired')
    applicationStatus.value = 'error'
    toast.warning(errorMessage.value)
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
    errorMessage.value = err?.message || t('contract.errors.submitFailed')
    toastFromApiError(err, errorMessage.value)
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
  <UiPageShell
    :eyebrow="props.embedded ? undefined : t('contract.eyebrow')"
    :title="props.embedded ? undefined : headerTitle"
    :lede="props.embedded ? undefined : headerLede"
    :class="{ 'embedded-shell': props.embedded }"
  >
    <UiCard style="background: linear-gradient(135deg, #fff7f0, #fffdf9)">
      <div class="status-banner" :class="applicationStatus">
        <span class="status-dot" :class="applicationStatus"></span>
        <div class="status-text">
          <div class="status-title">
            <strong>{{ statusLabel }}</strong>
            <span v-if="applicationId" class="muted">{{ t('contract.applicationId') }}：{{ applicationId }}</span>
          </div>
          <p v-if="message">{{ message }}</p>
          <p v-if="isLoadingStatus" class="muted">{{ t('contract.loadingStatus') }}</p>
        </div>
      </div>

      <form
        v-if="applicationStatus !== 'pending' && applicationStatus !== 'approved'"
        class="form-grid"
        @submit.prevent="submitApplication"
      >
        <label class="form-field">
          <span>{{ t('contract.form.companyName') }}</span>
          <input v-model="form.company_name" name="company_name" type="text" required />
        </label>

        <label class="form-field">
          <span>{{ t('contract.form.taxId') }}</span>
          <input v-model="form.tax_id" name="tax_id" type="text" required />
        </label>

        <label class="form-field">
          <span>{{ t('contract.form.contactPerson') }}</span>
          <input v-model="form.contact_person" name="contact_person" type="text" required />
        </label>

        <label class="form-field">
          <span>{{ t('contract.form.contactPhone') }}</span>
          <input v-model="form.contact_phone" name="contact_phone" type="text" required />
        </label>

        <label class="form-field span-2">
          <span>{{ t('contract.form.billingAddress') }}</span>
          <input v-model="form.billing_address" name="billing_address" type="text" required />
        </label>

        <label class="form-field span-2">
          <span>{{ t('contract.form.notesLabel') }}</span>
          <textarea
            v-model="form.notes"
            name="notes"
            rows="3"
            :placeholder="t('contract.form.notesPlaceholder')"
          ></textarea>
        </label>

        <!--<button class="secondary-btn" type="button" @click="fillTestData">{{ t('contract.form.fillTestData') }}</button>-->
        <button class="primary-btn" type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? t('contract.form.submitting') : t('contract.form.submit') }}
        </button>
      </form>

      <div v-else-if="applicationStatus === 'pending'" class="status-panel">
        <p class="status-heading">{{ t('contract.statusPanel.submittedTitle') }}</p>
        <p class="muted">
          {{ t('contract.statusPanel.currentStatus') }}：<strong>{{ statusLabel }}</strong>
          <span v-if="applicationId">（{{ applicationId }}）</span>
        </p>
        <p class="muted">{{ t('contract.statusPanel.pendingHint') }}</p>
      </div>

      <div v-else-if="applicationStatus === 'approved'" class="billing-section">
        <h2 class="section-title">{{ t('contract.bill.title') }}</h2>

        <div v-if="isLoadingBill" class="billing-items-placeholder">
          <p class="muted">{{ t('contract.bill.loading') }}</p>
        </div>
        <div v-else-if="billErrorMessage" class="billing-items-placeholder">
          <UiNotice tone="error" role="alert">{{ billErrorMessage }}</UiNotice>
          <button class="secondary-btn" type="button" style="margin-top: 10px" @click="loadCurrentBill">{{ t('contract.bill.reload') }}</button>
        </div>
        <div v-else-if="!currentBill" class="billing-items-placeholder">
          <p class="muted">{{ t('contract.bill.empty') }}</p>
          <button class="secondary-btn" type="button" style="margin-top: 10px" @click="loadCurrentBill">{{ t('contract.bill.refresh') }}</button>
        </div>
        <template v-else>
          <div class="billing-summary">
            <div class="summary-item">
              <span class="label">{{ t('contract.bill.summary.period') }}</span>
              <span class="value">{{ formatPeriodRange(currentBill.period) }}</span>
            </div>
            <div class="summary-item">
              <span class="label">{{ t('contract.bill.summary.settlement') }}</span>
              <span class="value">{{ currentBillMeta?.due_date ? t('contract.bill.summary.settled') : t('contract.bill.summary.unsettled') }}</span>
            </div>
            <div class="summary-item">
              <span class="label">{{ t('contract.bill.summary.status') }}</span>
              <span class="value">{{ billStatusLabel(currentBill.status) }}</span>
            </div>
            <div class="summary-item">
              <span class="label">{{ t('contract.bill.summary.count') }}</span>
              <span class="value">{{ t('contract.bill.summary.countValue', { count: currentBill.items?.length ?? 0 }) }}</span>
            </div>
            <div class="summary-item">
              <span class="label">{{ t('contract.bill.summary.total') }}</span>
              <span class="value">{{ formatMoney(currentBill.total_amount) }} {{ t('payment.currency') }}</span>
            </div>
            <div v-if="currentBill.due_date" class="summary-item">
              <span class="label">{{ t('contract.bill.summary.dueDate') }}</span>
              <span class="value">{{ formatDateTime(currentBill.due_date, locale) }}</span>
            </div>
          </div>

          <h3 class="section-subtitle">{{ currentBillMeta?.due_date ? t('contract.bill.packages.settledTitle') : t('contract.bill.packages.unsettledTitle') }}</h3>
          <div class="billing-items-placeholder" style="border-style: solid">
            <p v-if="!currentBill.items?.length" class="muted">{{ t('contract.bill.packages.empty') }}</p>
            <ul v-else class="package-list">
              <li
                v-for="item in currentBill.items"
                :key="item.package_id"
                class="package-row"
                :class="{ active: expandedItemIds.has(item.package_id) }"
              >
                <button type="button" class="row-btn" @click="toggleItem(item.package_id)">
                  <span class="tracking">{{ t('contract.bill.packages.prefix') }} | {{ trackingLabel(item.tracking_number) }}</span>
                  <span class="meta">{{ item.shipped_at ? formatDateTime(item.shipped_at, locale) : '--' }}</span>
                </button>

                <div v-if="expandedItemIds.has(item.package_id)" class="package-detail">
                  <div v-if="packageDetailLoading[item.package_id]" class="empty-state">
                    <p>{{ t('contract.bill.packages.loadingPackage') }}</p>
                  </div>
                  <div v-else-if="packageDetailError[item.package_id]" class="empty-state">
                    <p>{{ packageDetailError[item.package_id] }}</p>
                    <button class="secondary-btn" type="button" @click="ensurePackageDetail(item.package_id)">{{ t('contract.bill.packages.reload') }}</button>
                  </div>
                  <template v-else>
                    <div class="detail-grid">
                      <template v-if="packageDetails[item.package_id]">
                        <p class="meta">
                          {{ t('contract.bill.packages.sender') }}：{{ senderDisplayName(packageDetails[item.package_id]!, auth.user?.user_name, t) }}
                          <span v-if="packageDetails[item.package_id]!.sender_phone"
                            >（{{ packageDetails[item.package_id]!.sender_phone }}）</span
                          >
                        </p>
                        <p class="meta">
                          {{ t('contract.bill.packages.receiver') }}：{{ receiverDisplayName(packageDetails[item.package_id]!, auth.user?.user_name, t) }}
                          <span v-if="packageDetails[item.package_id]!.receiver_phone"
                            >（{{ packageDetails[item.package_id]!.receiver_phone }}）</span
                          >
                        </p>
                        <p class="meta">{{ t('contract.bill.packages.senderAddress') }}：{{ packageDetails[item.package_id]!.sender_address || '--' }}</p>
                        <p class="meta">{{ t('contract.bill.packages.receiverAddress') }}：{{ packageDetails[item.package_id]!.receiver_address || '--' }}</p>
                        <p class="meta">
                          {{ t('contract.bill.packages.dimensions') }}：{{ dimensionsLabel(packageDetails[item.package_id]!) }}
                          · {{ t('contract.bill.packages.weight') }}：{{ packageDetails[item.package_id]!.weight ?? '--' }} kg
                        </p>
                        <p class="meta">{{ t('contract.bill.packages.delivery') }}：{{ resolveDeliveryLabel(packageDetails[item.package_id]!.delivery_time, t) }}</p>
                        <p v-if="resolveSpecialMarks(packageDetails[item.package_id]!, t).length" class="meta">
                          {{ t('contract.bill.packages.marks') }}：{{ resolveSpecialMarks(packageDetails[item.package_id]!, t).join(listSeparator) }}
                        </p>
                        <p v-if="resolveNotes(packageDetails[item.package_id]!)" class="meta">
                          {{ t('contract.bill.packages.notes') }}：{{ resolveNotes(packageDetails[item.package_id]!) }}
                        </p>
                        <p class="meta">{{ t('contract.bill.packages.cost') }}：{{ formatMoney(item.cost) }} {{ t('payment.currency') }}</p>
                        <p class="meta">{{ t('contract.bill.packages.shippedAt') }}：{{ item.shipped_at ? formatDateTime(item.shipped_at, locale) : '--' }}</p>
                      </template>
                    </div>
                  </template>
                </div>
              </li>
            </ul>
          </div>
        </template>
      </div>

      <UiNotice v-if="errorMessage" tone="error" role="alert">{{ errorMessage }}</UiNotice>
    </UiCard>
  </UiPageShell>
</template>

<style scoped>
.embedded-shell.page-shell {
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  margin-bottom: 0;
}

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
.package-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}

.package-row {
  border: 1px solid #eee;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.package-row.active {
  border-color: var(--accent);
}

.row-btn {
  width: 100%;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: space-between;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  color: inherit;
}

.row-btn:hover {
  background: rgba(244, 182, 194, 0.08);
}

.row-btn:active {
  background: rgba(244, 182, 194, 0.15);
}

.tracking {
  font-weight: 700;
}

.pill {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.05);
  font-size: 13px;
}

.meta {
  font-size: 14px;
  color: #4a4a4a;
}

.package-detail {
  padding: 12px;
  border-top: 1px dashed #e5e7eb;
  display: grid;
  gap: 10px;
  animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.detail-grid {
  display: grid;
  gap: 6px;
}

.empty-state {
  border: 1px dashed #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: rgba(255, 255, 255, 0.7);
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
  .row-btn {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
