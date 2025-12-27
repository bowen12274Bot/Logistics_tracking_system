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

const { t } = useI18n()
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
  applicationStatus.value === 'approved' ? t('contract.header.titleApproved') : t('contract.header.titleApply'),
)

const headerLede = computed(() =>
  applicationStatus.value === 'approved' ? t('contract.header.ledeApproved') : t('contract.header.ledeApply'),
)

const fillTestData = () => {
  form.company_name = t('contract.test.company')
  form.tax_id = '12345678'
  form.contact_person = t('contract.test.contact')
  form.contact_phone = '0912-345-678'
  form.billing_address = t('contract.test.address')
  form.notes = t('contract.test.notes')
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
    errorMessage.value = err?.message || t('contract.errors.loadStatus')
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
    billErrorMessage.value = err?.message || t('contract.errors.loadBill')
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
    packageDetailError.value = { ...packageDetailError.value, [packageId]: err?.message || t('contract.errors.loadPackage') }
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
      return t('contract.bill.status.paid')
    case 'overdue':
      return t('contract.bill.status.overdue')
    case 'pending':
    default:
      return t('contract.bill.status.pending')
  }
}

const submitApplication = async () => {
  errorMessage.value = ''
  message.value = ''

  if (!auth.user) {
    errorMessage.value = t('contract.errors.notLoggedIn')
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
    errorMessage.value = err?.message || t('contract.errors.submitFailed')
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
      <p class="eyebrow">{{ t('contract.eyebrow') }}</p>
      <h1>{{ headerTitle }}</h1>
      <p class="lede">{{ headerLede }}</p>
    </header>

    <div class="card" style="background: linear-gradient(135deg, #fff7f0, #fffdf9)">
      <div class="status-banner" :class="applicationStatus">
        <span class="status-dot" :class="applicationStatus"></span>
        <div class="status-text">
          <div class="status-title">
            <strong>{{ statusLabel }}</strong>
            <span v-if="applicationId" class="muted">{{ t('contract.status.applicationId', { id: applicationId }) }}</span>
          </div>
          <p v-if="message">{{ message }}</p>
          <p v-if="isLoadingStatus" class="muted">{{ t('contract.loading.status') }}</p>
        </div>
      </div>

      <form
        v-if="applicationStatus !== 'pending' && applicationStatus !== 'approved'"
        class="form-grid"
        @submit.prevent="submitApplication"
      >
        <label class="form-field">
          <span>{{ t('contract.form.company') }}</span>
          <input v-model="form.company_name" name="company_name" type="text" required />
        </label>

        <label class="form-field">
          <span>{{ t('contract.form.taxId') }}</span>
          <input v-model="form.tax_id" name="tax_id" type="text" required />
        </label>

        <label class="form-field">
          <span>{{ t('contract.form.contact') }}</span>
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
          <span>{{ t('contract.form.notes') }}</span>
          <textarea
            v-model="form.notes"
            name="notes"
            rows="3"
            :placeholder="t('contract.form.notesPlaceholder')"
          ></textarea>
        </label>

        <button class="secondary-btn" type="button" @click="fillTestData">{{ t('contract.form.fillTest') }}</button>
        <button class="primary-btn" type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? t('contract.form.submitting') : t('contract.form.submit') }}
        </button>
      </form>

      <div v-else-if="applicationStatus === 'pending'" class="status-panel">
        <p class="status-heading">{{ t('contract.pending.title') }}</p>
        <p class="muted">
          {{ t('contract.pending.status', { status: statusLabel }) }}
          <span v-if="applicationId">（{{ applicationId }}）</span>
        </p>
        <p class="muted">{{ t('contract.pending.lede') }}</p>
      </div>

      <div v-else-if="applicationStatus === 'approved'" class="billing-section">
        <h2 class="section-title">{{ t('contract.bill.title') }}</h2>

        <div v-if="isLoadingBill" class="billing-items-placeholder">
          <p class="muted">{{ t('contract.loading.bill') }}</p>
        </div>
        <div v-else-if="billErrorMessage" class="billing-items-placeholder">
          <p class="muted" style="color: #b00020">{{ billErrorMessage }}</p>
          <button class="secondary-btn" type="button" style="margin-top: 10px" @click="loadCurrentBill">
            {{ t('contract.actions.reload') }}
          </button>
        </div>
        <div v-else-if="!currentBill" class="billing-items-placeholder">
          <p class="muted">{{ t('contract.bill.empty') }}</p>
          <button class="secondary-btn" type="button" style="margin-top: 10px" @click="loadCurrentBill">
            {{ t('contract.actions.refresh') }}
          </button>
        </div>
        <template v-else>
          <div class="billing-summary">
            <div class="summary-item">
              <span class="label">{{ t('contract.bill.period') }}</span>
              <span class="value">{{ currentBill.period }}</span>
            </div>
            <div class="summary-item">
              <span class="label">{{ t('contract.bill.dueStatus') }}</span>
              <span class="value">{{ currentBillMeta?.due_date ? t('contract.bill.dueReleased') : t('contract.bill.dueUnreleased') }}</span>
            </div>
            <div class="summary-item">
              <span class="label">{{ t('contract.bill.statusLabel') }}</span>
              <span class="value">{{ billStatusLabel(currentBill.status) }}</span>
            </div>
            <div class="summary-item">
              <span class="label">{{ t('contract.bill.items') }}</span>
              <span class="value">{{ currentBill.items?.length ?? 0 }} {{ t('contract.bill.itemsUnit') }}</span>
            </div>
            <div class="summary-item">
              <span class="label">{{ t('contract.bill.total') }}</span>
              <span class="value">{{ formatMoney(currentBill.total_amount) }} {{ t('contract.bill.currency') }}</span>
            </div>
            <div v-if="currentBill.due_date" class="summary-item">
              <span class="label">{{ t('contract.bill.dueDate') }}</span>
              <span class="value">{{ currentBill.due_date }}</span>
            </div>
          </div>

          <h3 class="section-subtitle">
            {{ currentBillMeta?.due_date ? t('contract.bill.listTitleReleased') : t('contract.bill.listTitlePending') }}
          </h3>
          <div class="billing-items-placeholder" style="border-style: solid">
            <p v-if="!currentBill.items?.length" class="muted">{{ t('contract.bill.noPackages') }}</p>
            <ul v-else class="package-list">
              <li
                v-for="item in currentBill.items"
                :key="item.package_id"
                class="package-row"
                :class="{ active: expandedItemIds.has(item.package_id) }"
              >
                <button type="button" class="row-btn" @click="toggleItem(item.package_id)">
                  <span class="tracking">{{ t('contract.bill.packageLabel') }} | {{ item.tracking_number || item.package_id }}</span>
                  <span class="meta">{{ item.shipped_at ? formatDateTime(item.shipped_at) : '--' }}</span>
                </button>

                <div v-if="expandedItemIds.has(item.package_id)" class="package-detail">
                  <div v-if="packageDetailLoading[item.package_id]" class="empty-state">
                    <p>{{ t('contract.loading.package') }}</p>
                  </div>
                  <div v-else-if="packageDetailError[item.package_id]" class="empty-state">
                    <p>{{ packageDetailError[item.package_id] }}</p>
                    <button class="secondary-btn" type="button" @click="ensurePackageDetail(item.package_id)">
                      {{ t('contract.actions.reload') }}
                    </button>
                  </div>
                  <template v-else>
                    <div class="detail-grid">
                      <template v-if="packageDetails[item.package_id]">
                        <p class="meta">
                          {{ t('contract.package.sender') }}{{ senderDisplayName(packageDetails[item.package_id]!, auth.user?.user_name) }}
                          <span v-if="packageDetails[item.package_id]!.sender_phone">（{{ packageDetails[item.package_id]!.sender_phone }}）</span>
                        </p>
                        <p class="meta">
                          {{ t('contract.package.receiver') }}{{ receiverDisplayName(packageDetails[item.package_id]!, auth.user?.user_name) }}
                          <span v-if="packageDetails[item.package_id]!.receiver_phone">（{{ packageDetails[item.package_id]!.receiver_phone }}）</span>
                        </p>
                        <p class="meta">{{ t('contract.package.senderAddress') }}{{ packageDetails[item.package_id]!.sender_address || '--' }}</p>
                        <p class="meta">{{ t('contract.package.receiverAddress') }}{{ packageDetails[item.package_id]!.receiver_address || '--' }}</p>
                        <p class="meta">
                          {{ t('contract.package.size') }}{{ dimensionsLabel(packageDetails[item.package_id]!) }}
                          · {{ t('contract.package.weight') }}{{ packageDetails[item.package_id]!.weight ?? '--' }} kg
                        </p>
                        <p class="meta">{{ t('contract.package.delivery') }}{{ resolveDeliveryLabel(packageDetails[item.package_id]!.delivery_time) }}</p>
                        <p v-if="resolveSpecialMarks(packageDetails[item.package_id]!).length" class="meta">
                          {{ t('contract.package.marks') }}{{ resolveSpecialMarks(packageDetails[item.package_id]!).join('、') }}
                        </p>
                        <p v-if="resolveNotes(packageDetails[item.package_id]!)" class="meta">
                          {{ t('contract.package.notes') }}{{ resolveNotes(packageDetails[item.package_id]!) }}
                        </p>
                        <p class="meta">{{ t('contract.package.cost') }}{{ formatMoney(item.cost) }} {{ t('contract.bill.currency') }}</p>
                        <p class="meta">{{ t('contract.package.shippedAt') }}{{ item.shipped_at ? formatDateTime(item.shipped_at) : '--' }}</p>
                      </template>
                    </div>
                  </template>
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

