
<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { usePackageStore, type PaymentMethod, type StoredPackage } from '../stores/packages'
import { useAuthStore } from '../stores/auth'
import { api, type BillingBillDetailResponse, type BillingPaymentRecord, type PackagePayableItem } from '../services/api'
import UiCard from '../components/ui/UiCard.vue'
import UiPageShell from '../components/ui/UiPageShell.vue'
import { toastFromApiError } from '../services/errorToast'
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

const packageStore = usePackageStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const methodLabel = (method: PaymentMethod) => t(`payment.method.${method}`)
const trackingLabel = (tracking?: string | null) => (tracking && tracking.trim() ? tracking.trim() : t('common.tracking.pending'))

const unpaidPackages = computed<StoredPackage[]>(() => packageStore.unpaidPackages)
const myUnpaidPackages = computed<StoredPackage[]>(() => unpaidPackages.value)
const expandedIds = ref<Set<string>>(new Set())
const paymentChoices = ref<Record<string, PaymentMethod>>({})
const feedbacks = ref<Record<string, string>>({})
const activeTab = ref<'list' | 'records'>('list')
const isLoading = computed(() => packageStore.isLoading)
const loadError = computed(() => packageStore.error)
const hasAutoFocused = ref(false)
const highlightedPackageId = ref('')
const focusNotice = ref('')

const isLoadingRecords = ref(false)
const recordsError = ref('')
const paidPackageRecords = ref<PackagePayableItem[]>([])
const paidBillRecords = ref<BillingPaymentRecord[]>([])
const expandedRecordIds = ref<Set<string>>(new Set())
const billDetails = ref<Record<string, BillingBillDetailResponse['bill'] | null>>({})
const billDetailLoading = ref<Record<string, boolean>>({})
const billDetailError = ref<Record<string, string>>({})

const focusedPackageId = computed(() => {
  const raw = route.query.package_id
  return typeof raw === 'string' ? raw : ''
})
const redirectTrackingNumber = computed(() => {
  const raw = route.query.tracking_number
  return typeof raw === 'string' ? raw.trim() : ''
})
const redirectPackageId = ref(focusedPackageId.value)
const isGuidedMode = ref(Boolean(redirectTrackingNumber.value && redirectPackageId.value))

onMounted(() => {
  packageStore.fetchUnpaid(auth.user?.id)
})

const loadPaymentRecords = async () => {
  recordsError.value = ''
  paidPackageRecords.value = []
  paidBillRecords.value = []
  expandedRecordIds.value = new Set()
  billDetails.value = {}
  billDetailLoading.value = {}
  billDetailError.value = {}

  if (!auth.user?.id) return

  isLoadingRecords.value = true
  try {
    const [pkgRes, billRes] = await Promise.all([
      api.getPackagePayables({ include_paid: true, limit: 200 }),
      auth.user.user_class === 'contract_customer' ? api.getBillingPayments() : Promise.resolve({ success: true, payments: [] } as any),
    ])

    paidPackageRecords.value = (pkgRes.items ?? []).filter((i) => Boolean(i.paid_at) && i.package?.payment_method !== 'monthly_billing')
    paidBillRecords.value = billRes.payments ?? []
  } catch (err: any) {
    recordsError.value = err?.message || t('payment.records.loadFailed')
    toastFromApiError(err, recordsError.value)
  } finally {
    isLoadingRecords.value = false
  }
}

watch(
  () => activeTab.value,
  (tab) => {
    if (tab === 'records') loadPaymentRecords()
  },
)

const resolveMethod = (method?: string | null): PaymentMethod => {
  const candidate = (method ?? '') as PaymentMethod
  return ['cash', 'credit_card', 'bank_transfer', 'monthly_billing', 'third_party_payment'].includes(candidate)
    ? candidate
    : 'cash'
}

const ensureChoice = (id: string, method?: string | null) => {
  if (!paymentChoices.value[id]) {
    paymentChoices.value[id] = resolveMethod(method)
  }
}

watch(
  myUnpaidPackages,
  (list) => {
    const currentIds = new Set(list.map((i) => i.id))
    expandedIds.value = new Set([...expandedIds.value].filter((id) => currentIds.has(id)))
  },
  { immediate: true },
)

const togglePackage = (pkg: StoredPackage) => {
  const next = new Set(expandedIds.value)
  if (next.has(pkg.id)) {
    next.delete(pkg.id)
  } else {
    next.add(pkg.id)
    ensureChoice(pkg.id, pkg.payment_method)
    feedbacks.value[pkg.id] = ''
  }
  expandedIds.value = next
}

const focusPackage = async (packageId: string) => {
  if (!packageId) return
  const target = myUnpaidPackages.value.find((pkg) => pkg.id === packageId)
  if (!target) return

  activeTab.value = 'list'
  if (!expandedIds.value.has(packageId)) {
    togglePackage(target)
  } else {
    ensureChoice(target.id, target.payment_method)
  }

  await nextTick()
  document.getElementById(`pkg-${packageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  highlightedPackageId.value = packageId
  focusNotice.value = t('payment.focusNotice')
  window.setTimeout(() => {
    if (highlightedPackageId.value === packageId) highlightedPackageId.value = ''
    if (focusNotice.value) focusNotice.value = ''
  }, 3500)
}

watch(
  () => [focusedPackageId.value, myUnpaidPackages.value.length, activeTab.value],
  async () => {
    if (hasAutoFocused.value) return
    if (!focusedPackageId.value) return
    if (myUnpaidPackages.value.length === 0) return

    redirectPackageId.value = focusedPackageId.value
    await focusPackage(focusedPackageId.value)
    hasAutoFocused.value = true

    const nextQuery = { ...route.query }
    delete (nextQuery as any).package_id
    await router.replace({ query: nextQuery })
  },
  { immediate: true },
)

const guidedPackage = computed<StoredPackage | null>(() => {
  if (!isGuidedMode.value) return null
  if (!redirectPackageId.value) return null
  return myUnpaidPackages.value.find((pkg) => pkg.id === redirectPackageId.value) ?? null
})

const otherPackages = computed<StoredPackage[]>(() => {
  const guided = guidedPackage.value
  if (!guided) return myUnpaidPackages.value
  return myUnpaidPackages.value.filter((pkg) => pkg.id !== guided.id)
})

watch(
  guidedPackage,
  (pkg) => {
    if (!pkg) return
    ensureChoice(pkg.id, pkg.payment_method)
    feedbacks.value[pkg.id] = ''
  },
  { immediate: true },
)

const savePaymentChoice = () => {
  // kept for backward compatibility if needed
}

const getPayableSnapshot = (pkg: StoredPackage) => packageStore.payableFor(pkg.id)

const amountFor = (pkg: StoredPackage) => getPayableSnapshot(pkg)?.amount ?? 0

const recordKeyForPackage = (packageId: string) => `pkg:${packageId}`
const recordKeyForBill = (billId: string) => `bill:${billId}`

const toggleRecord = async (key: string) => {
  const next = new Set(expandedRecordIds.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedRecordIds.value = next
}

const ensureBillDetail = async (billId: string) => {
  if (!billId) return
  if (billDetails.value[billId]) return
  if (billDetailLoading.value[billId]) return

  billDetailLoading.value = { ...billDetailLoading.value, [billId]: true }
  billDetailError.value = { ...billDetailError.value, [billId]: '' }
  try {
    const res = await api.getBillingBillDetail(billId)
    billDetails.value = { ...billDetails.value, [billId]: res.bill }
  } catch (err: any) {
    billDetailError.value = { ...billDetailError.value, [billId]: err?.message || '載入帳單明細失敗' }
    billDetails.value = { ...billDetails.value, [billId]: null }
    toastFromApiError(err, billDetailError.value[billId] ?? '載入帳單明細失敗')
  } finally {
    billDetailLoading.value = { ...billDetailLoading.value, [billId]: false }
  }
}

const toggleBillRecord = async (billId: string) => {
  const key = recordKeyForBill(billId)
  const willOpen = !expandedRecordIds.value.has(key)
  await toggleRecord(key)
  if (willOpen) await ensureBillDetail(billId)
}

const billPaymentMethodLabel = (value?: string | null) => {
  const key = String(value ?? '').trim().toLowerCase()
  if (key === 'credit_card') return methodLabel('credit_card')
  if (key === 'bank_transfer') return methodLabel('bank_transfer')
  return key || '--'
}

const updatePaymentMethodFor = async (pkg: StoredPackage) => {
  const choice = paymentChoices.value[pkg.id]
  if (choice === 'monthly_billing' && auth.user?.user_class !== 'contract_customer') {
    feedbacks.value[pkg.id] = t('payment.errors.monthlyContractOnly')
    return
  }
  if (isSystemMonthlyInvoice(pkg) && choice === 'monthly_billing') {
    feedbacks.value[pkg.id] = t('payment.errors.monthlyNotAllowedForInvoice')
    return
  }
  if (!choice) {
    feedbacks.value[pkg.id] = t('payment.errors.chooseMethod')
    return
  }

  const previous = resolveMethod(pkg.payment_method)
  packageStore.setPaymentMethod(pkg.id, choice)
  feedbacks.value[pkg.id] = t('payment.feedback.methodUpdated', { method: methodLabel(choice) })

  try {
    await api.setPackagePaymentMethod(pkg.id, { payment_method: choice as any })
    await packageStore.fetchUnpaid(auth.user?.id)
  } catch (err: any) {
    packageStore.setPaymentMethod(pkg.id, previous)
    feedbacks.value[pkg.id] = err?.message || t('payment.errors.updateMethodFailed')
    toastFromApiError(err, feedbacks.value[pkg.id] ?? t('payment.errors.updateMethodFailed'))
  }
}

const methodOptions: PaymentMethod[] = ['cash', 'credit_card', 'bank_transfer', 'monthly_billing', 'third_party_payment']

const formatCreatedAt = (value?: string | number | Date) => {
  if (!value) return t('payment.justCreated')
  let date: Date
  if (typeof value === 'string') {
    const normalized = value.includes('T') ? value : value.replace(' ', 'T')
    date = new Date(normalized)
  } else if (typeof value === 'number') {
    date = new Date(value)
  } else {
    date = value
  }
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : t('payment.justCreated')
  }
  return date.toLocaleString()
}

const resolveCreatedAt = (pkg: StoredPackage) => {
  const raw =
    (pkg as any).created_at ??
    (pkg as any).createdAt ??
    (pkg as any).created_on ??
    (pkg as any).created ??
    (pkg as any).timestamp ??
    (pkg.description_json as any)?.metadata?.created_at ??
    (pkg.description_json as any)?.created_at ??
    pkg.pickup_date ??
    decodeTrackingTimestamp(pkg.tracking_number) ??
    ''
  return raw
}

const decodeTrackingTimestamp = (tracking?: string) => {
  if (!tracking) return ''
  const parts = tracking.split('-')
  if (parts.length < 2) return ''
  const base36 = parts[1]
  if (!base36) return ''
  try {
    const ms = parseInt(base36, 36)
    if (!Number.isFinite(ms)) return ''
    return new Date(ms).toISOString()
  } catch {
    return ''
  }
}

const confirmPay = async (pkg: StoredPackage) => {
  feedbacks.value[pkg.id] = ''
  const choice = paymentChoices.value[pkg.id] ?? resolveMethod(pkg.payment_method)

  if (choice === 'monthly_billing' && auth.user?.user_class !== 'contract_customer') {
    feedbacks.value[pkg.id] = t('payment.errors.monthlyContractOnly')
    return
  }
  if (isSystemMonthlyInvoice(pkg) && choice === 'monthly_billing') {
    feedbacks.value[pkg.id] = t('payment.errors.monthlyNotAllowedForInvoice')
    return
  }
  if (!canPayNow(pkg)) {
    feedbacks.value[pkg.id] = payableReasonFor(pkg) ?? t('payment.errors.notPayableYet')
    return
  }
  try {
    await api.payPackage(pkg.id, { payment_method: choice as any })
    feedbacks.value[pkg.id] = t(
      choice === 'monthly_billing'
        ? 'payment.feedback.paidMonthly'
        : choice === 'cash'
          ? 'payment.feedback.paidCash'
          : 'payment.feedback.paid',
    )
    await packageStore.fetchUnpaid(auth.user?.id)

    if (redirectTrackingNumber.value && redirectPackageId.value && pkg.id === redirectPackageId.value) {
      await router.push({ name: 'customer-track', query: { tracking_number: redirectTrackingNumber.value } })
    }
  } catch (err: any) {
    feedbacks.value[pkg.id] = err?.message || t('payment.errors.payFailed')
    toastFromApiError(err, feedbacks.value[pkg.id] ?? t('payment.errors.payFailed'))
  }
}

const isSystemMonthlyInvoice = (pkg: StoredPackage) => {
  const fromMetadata =
    typeof pkg.description_json === 'object' && pkg.description_json !== null
      ? (pkg.description_json as Record<string, unknown>).bill_type
      : undefined
  return pkg.payment_type === 'monthly_invoice' || fromMetadata === 'monthly_invoice'
}

const billTypeLabel = (pkg: StoredPackage) =>
  isSystemMonthlyInvoice(pkg) ? t('payment.billType.monthly') : t('payment.billType.package')

const allowedMethodsFor = (pkg: StoredPackage) =>
  methodOptions.filter((m) => {
    if (m === 'monthly_billing') {
      const isContractCustomer = auth.user?.user_class === 'contract_customer'
      if (!isContractCustomer) return false
      if (isSystemMonthlyInvoice(pkg)) return false
    }
    return true
  })

const canPayNow = (pkg: StoredPackage) => {
  return getPayableSnapshot(pkg)?.payable_now ?? true
}

const payableReasonFor = (pkg: StoredPackage) => {
  return getPayableSnapshot(pkg)?.reason ?? null
}
</script>

<template>
  <UiPageShell :eyebrow="t('payment.page.eyebrow')" :title="t('payment.page.title')" :lede="t('payment.page.lede')">
    <div class="tab-switch">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'list' }"
        type="button"
        @click="activeTab = 'list'"
      >
        {{ t('payment.tabs.list') }}
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'records' }"
        type="button"
        @click="activeTab = 'records'"
      >
        {{ t('payment.tabs.records') }}
      </button>
    </div>

    <template v-if="activeTab === 'list'">
      <UiCard v-if="isGuidedMode && !isLoading" style="margin-bottom: 12px">
        <div class="legend legend-row">
          <div>
            <p class="eyebrow">{{ t('payment.guided.eyebrow') }}</p>
            <p class="hint">{{ t('payment.guided.hint') }}</p>
          </div>
          <button class="ghost-btn" type="button" @click="isGuidedMode = false">{{ t('payment.guided.showAll') }}</button>
        </div>

        <div v-if="!guidedPackage" class="empty-state">
          <p>{{ t('payment.guided.notFound') }}</p>
        </div>

        <template v-else>
          <div class="package-row active">
            <div class="row-btn row-static">
              <span class="tracking">{{ billTypeLabel(guidedPackage) }} | {{ trackingLabel(guidedPackage.tracking_number) }}</span>
              <span class="pill">{{ methodLabel(resolveMethod(guidedPackage.payment_method)) }}</span>
              <span class="pill">{{ t('payment.pills.amountDue', { amount: formatMoney(amountFor(guidedPackage)) }) }}</span>
              <span v-if="!canPayNow(guidedPackage)" class="pill danger">{{ t('payment.pills.notPayable') }}</span>
              <span class="meta">{{ t('payment.meta.createdAt', { at: formatCreatedAt(resolveCreatedAt(guidedPackage)) }) }}</span>
            </div>
            <div class="package-detail">
              <div class="detail-grid">
                <p class="meta">
                  {{ t('payment.detail.sender') }}：{{ senderDisplayName(guidedPackage, auth.user?.user_name) }}
                  <span v-if="guidedPackage.sender_phone">（{{ guidedPackage.sender_phone }}）</span>
                </p>
                <p class="meta">
                  {{ t('payment.detail.receiver') }}：{{ receiverDisplayName(guidedPackage, auth.user?.user_name) }}
                  <span v-if="guidedPackage.receiver_phone">（{{ guidedPackage.receiver_phone }}）</span>
                </p>
                <p class="meta">{{ t('payment.detail.senderAddress') }}：{{ guidedPackage.sender_address || '--' }}</p>
                <p class="meta">{{ t('payment.detail.receiverAddress') }}：{{ guidedPackage.receiver_address || '--' }}</p>
                <p class="meta">
                  {{ t('payment.detail.dimensions') }}：{{ dimensionsLabel(guidedPackage) }}
                  · {{ t('payment.detail.weight') }}：{{ guidedPackage.weight ?? '--' }} kg
                </p>
                <p class="meta">{{ t('payment.detail.delivery') }}：{{ resolveDeliveryLabel(guidedPackage.delivery_time) }}</p>
                <p class="meta">{{ t('payment.detail.amount') }}：{{ formatMoney(amountFor(guidedPackage)) }} {{ t('payment.currency') }}</p>
                <p class="meta">{{ t('payment.detail.methodCurrent') }}：{{ methodLabel(resolveMethod(guidedPackage.payment_method)) }}</p>
                <p v-if="resolveSpecialMarks(guidedPackage).length" class="meta">
                  {{ t('payment.detail.marks') }}：{{ resolveSpecialMarks(guidedPackage).join('、') }}
                </p>
                <p v-if="resolveNotes(guidedPackage)" class="meta">{{ t('payment.detail.notes') }}：{{ resolveNotes(guidedPackage) }}</p>
              </div>
              <p v-if="!canPayNow(guidedPackage) && payableReasonFor(guidedPackage)" class="chip danger">{{ payableReasonFor(guidedPackage) }}</p>
              <div class="actions">
                <div class="method-picker">
                  <span class="meta">{{ t('payment.detail.method') }}</span>
                  <select
                    v-model="paymentChoices[guidedPackage.id]"
                    class="method-select"
                    name="paymentChoice"
                    @change="updatePaymentMethodFor(guidedPackage)"
                  >
                    <option v-for="method in allowedMethodsFor(guidedPackage)" :key="method" :value="method">
                      {{ methodLabel(method) }}
                    </option>
                  </select>
                </div>
                <button
                  class="ghost-btn"
                  type="button"
                  :disabled="!canPayNow(guidedPackage)"
                  @click="confirmPay(guidedPackage)"
                >
                  {{ t('payment.confirmPay') }}
                </button>
              </div>
              <p v-if="feedbacks[guidedPackage.id]" class="hint">{{ feedbacks[guidedPackage.id] }}</p>
            </div>
          </div>
        </template>
      </UiCard>

      <UiCard>
        <div class="legend">
          <p class="eyebrow">
            {{ isGuidedMode ? t('payment.guided.othersEyebrow') : t('payment.list.eyebrow') }}
          </p>
          <p class="hint">
            {{ isGuidedMode ? t('payment.guided.othersHint') : t('payment.list.hint') }}
          </p>
        </div>

        <p v-if="focusNotice && !isGuidedMode" class="hint" style="margin-bottom: 10px">{{ focusNotice }}</p>

        <div v-if="isLoading" class="empty-state">
          <p>{{ t('payment.loading') }}</p>
        </div>
        <div v-else-if="loadError" class="empty-state">
          <p>{{ loadError }}</p>
        </div>
        <div v-else-if="!myUnpaidPackages.length" class="empty-state">
          <p>{{ t('payment.emptyUnpaid') }}</p>
          <RouterLink to="/customer/send" class="primary-btn ghost-btn">{{ t('payment.createNew') }}</RouterLink>
        </div>

        <template v-else>
          <div v-if="isGuidedMode && !otherPackages.length" class="empty-state">
            <p>{{ t('payment.guided.noOthers') }}</p>
          </div>

          <ul v-else-if="isGuidedMode" class="package-list">
            <li v-for="pkg in otherPackages" :key="pkg.id" class="package-row">
              <div class="row-btn row-static">
                <span class="tracking">{{ billTypeLabel(pkg) }} | {{ trackingLabel(pkg.tracking_number) }}</span>
                <span class="pill">{{ methodLabel(resolveMethod(pkg.payment_method)) }}</span>
                <span class="pill">{{ t('payment.pills.amountDue', { amount: formatMoney(amountFor(pkg)) }) }}</span>
                <span v-if="!canPayNow(pkg)" class="pill danger">{{ t('payment.pills.notPayable') }}</span>
                <span class="meta">{{ t('payment.meta.createdAt', { at: formatCreatedAt(resolveCreatedAt(pkg)) }) }}</span>
              </div>
            </li>
          </ul>

          <ul v-else class="package-list">
            <li
              v-for="pkg in myUnpaidPackages"
              :id="`pkg-${pkg.id}`"
              :key="pkg.id"
              class="package-row"
              :class="{ active: expandedIds.has(pkg.id), highlight: pkg.id === highlightedPackageId }"
            >
              <button type="button" class="row-btn" @click="togglePackage(pkg)">
                <span class="tracking">{{ billTypeLabel(pkg) }} | {{ trackingLabel(pkg.tracking_number) }}</span>
                <span class="pill">{{ methodLabel(resolveMethod(pkg.payment_method)) }}</span>
                <span class="pill">{{ t('payment.pills.amountDue', { amount: formatMoney(amountFor(pkg)) }) }}</span>
                <span v-if="!canPayNow(pkg)" class="pill danger">{{ t('payment.pills.notPayable') }}</span>
                <span class="meta">{{ t('payment.meta.createdAt', { at: formatCreatedAt(resolveCreatedAt(pkg)) }) }}</span>
              </button>
              <div v-if="expandedIds.has(pkg.id)" class="package-detail">
                <div class="detail-grid">
                  <p class="meta">
                    {{ t('payment.detail.sender') }}：{{ senderDisplayName(pkg, auth.user?.user_name) }}
                    <span v-if="pkg.sender_phone">（{{ pkg.sender_phone }}）</span>
                  </p>
                  <p class="meta">
                    {{ t('payment.detail.receiver') }}：{{ receiverDisplayName(pkg, auth.user?.user_name) }}
                    <span v-if="pkg.receiver_phone">（{{ pkg.receiver_phone }}）</span>
                  </p>
                  <p class="meta">{{ t('payment.detail.senderAddress') }}：{{ pkg.sender_address || '--' }}</p>
                  <p class="meta">{{ t('payment.detail.receiverAddress') }}：{{ pkg.receiver_address || '--' }}</p>
                  <p class="meta">
                    {{ t('payment.detail.dimensions') }}：{{ dimensionsLabel(pkg) }}
                    · {{ t('payment.detail.weight') }}：{{ pkg.weight ?? '--' }} kg
                  </p>
                  <p class="meta">{{ t('payment.detail.delivery') }}：{{ resolveDeliveryLabel(pkg.delivery_time) }}</p>
                  <p class="meta">{{ t('payment.detail.amount') }}：{{ formatMoney(amountFor(pkg)) }} {{ t('payment.currency') }}</p>
                  <p class="meta">{{ t('payment.detail.methodCurrent') }}：{{ methodLabel(resolveMethod(pkg.payment_method)) }}</p>
                  <p v-if="resolveSpecialMarks(pkg).length" class="meta">
                    {{ t('payment.detail.marks') }}：{{ resolveSpecialMarks(pkg).join('、') }}
                  </p>
                  <p v-if="resolveNotes(pkg)" class="meta">{{ t('payment.detail.notes') }}：{{ resolveNotes(pkg) }}</p>
                </div>
                <p v-if="!canPayNow(pkg) && payableReasonFor(pkg)" class="chip danger">{{ payableReasonFor(pkg) }}</p>
                <div class="actions">
                  <div class="method-picker">
                    <span class="meta">{{ t('payment.detail.method') }}</span>
                    <select
                      v-model="paymentChoices[pkg.id]"
                      class="method-select"
                      name="paymentChoice"
                      @change="updatePaymentMethodFor(pkg)"
                    >
                      <option v-for="method in allowedMethodsFor(pkg)" :key="method" :value="method">
                        {{ methodLabel(method) }}
                      </option>
                    </select>
                  </div>
                  <button class="ghost-btn" type="button" :disabled="!canPayNow(pkg)" @click="confirmPay(pkg)">
                    {{ t('payment.confirmPay') }}
                  </button>
                </div>
                <p v-if="feedbacks[pkg.id]" class="hint">{{ feedbacks[pkg.id] }}</p>
              </div>
            </li>
          </ul>
        </template>
      </UiCard>
    </template>

    <UiCard v-else class="records-card">
      <div class="legend">
        <p class="eyebrow">{{ t('payment.records.eyebrow') }}</p>
        <p class="hint">{{ t('payment.records.hint') }}</p>
      </div>

      <div v-if="isLoadingRecords" class="empty-state">
        <p>{{ t('payment.loading') }}</p>
      </div>
      <div v-else-if="recordsError" class="empty-state">
        <p>{{ recordsError }}</p>
        <button class="ghost-btn" type="button" @click="loadPaymentRecords">{{ t('payment.reload') }}</button>
      </div>
      <div v-else-if="!paidPackageRecords.length && !paidBillRecords.length" class="empty-state">
        <p>{{ t('payment.records.empty') }}</p>
      </div>
      <div v-else>
        <div v-if="paidPackageRecords.length" class="bill-block">
          <p class="eyebrow">{{ t('payment.records.packages') }}</p>
          <ul class="package-list">
            <li
              v-for="item in paidPackageRecords"
              :key="item.package.id"
              class="package-row"
              :class="{ active: expandedRecordIds.has(recordKeyForPackage(item.package.id)) }"
            >
              <button type="button" class="row-btn" @click="toggleRecord(recordKeyForPackage(item.package.id))">
                <span class="tracking">{{ t('payment.billType.package') }} | {{ trackingLabel(item.package.tracking_number) }}</span>
                <span class="meta">{{ item.paid_at ? formatCreatedAt(item.paid_at) : '--' }}</span>
              </button>

              <div v-if="expandedRecordIds.has(recordKeyForPackage(item.package.id))" class="package-detail">
                <div class="detail-grid">
                  <p class="meta">
                    {{ t('payment.detail.sender') }}：{{ senderDisplayName(item.package as any, auth.user?.user_name) }}
                    <span v-if="item.package.sender_phone">（{{ item.package.sender_phone }}）</span>
                  </p>
                  <p class="meta">
                    {{ t('payment.detail.receiver') }}：{{ receiverDisplayName(item.package as any, auth.user?.user_name) }}
                    <span v-if="item.package.receiver_phone">（{{ item.package.receiver_phone }}）</span>
                  </p>
                  <p class="meta">{{ t('payment.detail.senderAddress') }}：{{ item.package.sender_address || '--' }}</p>
                  <p class="meta">{{ t('payment.detail.receiverAddress') }}：{{ item.package.receiver_address || '--' }}</p>
                  <p class="meta">{{ t('payment.detail.dimensions') }}：{{ dimensionsLabel(item.package as any) }} · {{ t('payment.detail.weight') }}：{{ item.package.weight ?? '--' }} kg</p>
                  <p class="meta">{{ t('payment.detail.delivery') }}：{{ resolveDeliveryLabel(item.package.delivery_time) }}</p>
                  <p v-if="resolveSpecialMarks(item.package as any).length" class="meta">
                    {{ t('payment.detail.marks') }}：{{ resolveSpecialMarks(item.package as any).join('、') }}
                  </p>
                  <p v-if="resolveNotes(item.package as any)" class="meta">{{ t('payment.detail.notes') }}：{{ resolveNotes(item.package as any) }}</p>
                  <p class="meta">{{ t('payment.detail.method') }}：{{ methodLabel(resolveMethod(item.package.payment_method)) }}</p>
                  <p class="meta">{{ t('payment.records.amount') }}：{{ formatMoney(item.amount) }} {{ t('payment.currency') }}</p>
                  <p class="meta">{{ t('payment.records.paidAt') }}：{{ item.paid_at ? formatCreatedAt(item.paid_at) : '--' }}</p>
                </div>
              </div>
            </li>
          </ul>
        </div>

        <div v-if="paidBillRecords.length" class="bill-block">
          <p class="eyebrow">{{ t('payment.records.monthlyBills') }}</p>
          <ul class="package-list">
            <li
              v-for="item in paidBillRecords"
              :key="item.bill_id"
              class="package-row"
              :class="{ active: expandedRecordIds.has(recordKeyForBill(item.bill_id)) }"
            >
              <button type="button" class="row-btn" @click="toggleBillRecord(item.bill_id)">
                <span class="tracking">{{ t('payment.billType.monthly') }} | {{ item.period }}</span>
                <span class="pill">{{ billPaymentMethodLabel(item.payment_method) }}</span>
                <span class="pill">{{ t('payment.records.amount', { amount: formatMoney(item.amount) }) }}</span>
                <span class="meta">{{ t('payment.records.paidAt', { at: item.paid_at ? formatCreatedAt(item.paid_at) : '--' }) }}</span>
              </button>

              <div v-if="expandedRecordIds.has(recordKeyForBill(item.bill_id))" class="package-detail">
                <div class="detail-grid">
                  <p class="meta">{{ t('payment.records.billPeriod') }}：{{ item.period }}</p>
                  <p class="meta">{{ t('payment.detail.method') }}：{{ billPaymentMethodLabel(item.payment_method) }}</p>
                  <p class="meta">{{ t('payment.records.amount') }}：{{ formatMoney(item.amount) }} {{ t('payment.currency') }}</p>
                  <p class="meta">{{ t('payment.records.paidAt') }}：{{ item.paid_at ? formatCreatedAt(item.paid_at) : '--' }}</p>
                </div>

                <div v-if="billDetailLoading[item.bill_id]" class="empty-state">
                  <p>{{ t('payment.records.billDetailLoading') }}</p>
                </div>
                <div v-else-if="billDetailError[item.bill_id]" class="empty-state">
                  <p>{{ billDetailError[item.bill_id] }}</p>
                  <button class="ghost-btn" type="button" @click="ensureBillDetail(item.bill_id)">{{ t('payment.reload') }}</button>
                </div>
                <div v-else-if="billDetails[item.bill_id] && billDetails[item.bill_id]!.items?.length" class="detail-grid">
                  <p class="meta">{{ t('payment.records.billItems', { count: billDetails[item.bill_id]!.items.length }) }}</p>
                  <ul class="bill-list" style="gap: 6px">
                    <li v-for="b in billDetails[item.bill_id]!.items" :key="b.package_id" class="bill-row" style="padding: 10px">
                      <p class="tracking">{{ t('payment.billType.monthly') }} | {{ trackingLabel(b.tracking_number) }}</p>
                      <p class="meta">
                        {{ t('payment.records.costAndShipped', { cost: formatMoney(b.cost), shippedAt: b.shipped_at || '--' }) }}
                      </p>
                    </li>
                  </ul>
                </div>
                <div v-else class="empty-state">
                  <p>{{ t('payment.records.billDetailEmpty') }}</p>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </UiCard>
  </UiPageShell>
</template>

<style scoped>
.legend-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.tab-switch {
  display: inline-flex;
  border: 1px solid var(--surface-stroke);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 12px;
}

.tab-btn {
  padding: 10px 14px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: inherit;
}

.tab-btn + .tab-btn {
  border-left: 1px solid var(--surface-stroke);
}

.tab-btn.active {
  background: linear-gradient(135deg, rgba(255, 214, 214, 0.6), rgba(255, 164, 164, 0.6));
  font-weight: 700;
}

.legend {
  margin-bottom: 10px;
}

.records-card {
  margin-top: 8px;
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.bill-block {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed var(--surface-stroke);
}

.bill-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}

.bill-row {
  border: 1px solid var(--surface-stroke);
  border-radius: 12px;
  padding: 12px;
  background: #fff;
}

.bill-row-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.package-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}

.package-row {
  border: 1px solid var(--surface-stroke);
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.package-row.active {
  border-color: var(--accent);
}

.detail-grid {
  display: grid;
  gap: 6px;
  margin-bottom: 10px;
}

.method-picker {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.method-select {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--surface-stroke);
  background: rgba(255, 255, 255, 0.86);
  color: var(--text-main);
  min-width: 220px;
}

.package-row.highlight {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(165, 122, 99, 0.25);
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

.pill.danger {
  background: rgba(161, 60, 60, 0.1);
  color: #7a2e2e;
}

.package-detail {
  padding: 12px;
  border-top: 1px dashed var(--surface-stroke);
  display: grid;
  gap: 10px;
}

.chip {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: #f2f2f2;
  color: #444;
}

.chip.danger {
  background: #ffeceb;
  color: #a13c3c;
}

.meta {
  font-size: 14px;
  color: #4a4a4a;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.empty-state {
  border: 1px dashed var(--surface-stroke);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: space-between;
}

.ghost-btn {
  background: transparent;
  color: inherit;
  border: 1px solid currentColor;
  padding: 8px 12px;
  border-radius: 10px;
}

.ghost-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
