
<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { usePackageStore, type PaymentMethod, type StoredPackage } from '../stores/packages'
import { useAuthStore } from '../stores/auth'
import { api, type BillingBillDetailResponse, type BillingPaymentRecord, type PackagePayableItem } from '../services/api'
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

const paymentLabel: Record<PaymentMethod, string> = {
  cash: '現金支付',
  credit_card: '信用卡',
  bank_transfer: '網路銀行',
  monthly_billing: '月結訂單',
  third_party_payment: '第三方支付',
}

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
    recordsError.value = err?.message || '載入付款紀錄失敗'
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
  return paymentLabel[candidate] ? candidate : 'cash'
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
  focusNotice.value = '已定位到剛建立的待付費用，可直接確認付款。'
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

    await focusPackage(focusedPackageId.value)
    hasAutoFocused.value = true

    const nextQuery = { ...route.query }
    delete (nextQuery as any).package_id
    await router.replace({ query: nextQuery })
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
  if (key === 'credit_card') return '信用卡'
  if (key === 'bank_transfer') return '匯款'
  return key || '--'
}

const updatePaymentMethodFor = async (pkg: StoredPackage) => {
  const choice = paymentChoices.value[pkg.id]
  if (choice === 'monthly_billing' && auth.user?.user_class !== 'contract_customer') {
    feedbacks.value[pkg.id] = '非合約客戶不可選擇月結。'
    return
  }
  if (isSystemMonthlyInvoice(pkg) && choice === 'monthly_billing') {
    feedbacks.value[pkg.id] = '帳期費用不可再次選擇月結，請改用其他付款方式。'
    return
  }
  if (!choice) {
    feedbacks.value[pkg.id] = '請選擇付款方式。'
    return
  }

  const previous = resolveMethod(pkg.payment_method)
  packageStore.setPaymentMethod(pkg.id, choice)
  feedbacks.value[pkg.id] = `已更新付款方式：${paymentLabel[choice]}。`

  try {
    await api.setPackagePaymentMethod(pkg.id, { payment_method: choice as any })
    await packageStore.fetchUnpaid(auth.user?.id)
  } catch (err: any) {
    packageStore.setPaymentMethod(pkg.id, previous)
    feedbacks.value[pkg.id] = err?.message || '更新付款方式失敗'
  }
}

const methodOptions: PaymentMethod[] = ['cash', 'credit_card', 'bank_transfer', 'monthly_billing', 'third_party_payment']

const formatCreatedAt = (value?: string | number | Date) => {
  if (!value) return '剛建立'
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
    return typeof value === 'string' ? value : '剛建立'
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
    feedbacks.value[pkg.id] = '非合約客戶不可選擇月結。'
    return
  }
  if (isSystemMonthlyInvoice(pkg) && choice === 'monthly_billing') {
    feedbacks.value[pkg.id] = '帳期費用不可再次選擇月結，請改用其他付款方式。'
    return
  }
  if (!canPayNow(pkg)) {
    feedbacks.value[pkg.id] = payableReasonFor(pkg) ?? '尚未達付款條件。'
    return
  }
  try {
    await api.payPackage(pkg.id, { payment_method: choice as any })
    feedbacks.value[pkg.id] =
      choice === 'monthly_billing' ? '已確認月結支付（加入本期未出帳區，視為已付款）。' : choice === 'cash' ? '付款成功（現金）。' : '付款成功。'
    await packageStore.fetchUnpaid(auth.user?.id)
  } catch (err: any) {
    feedbacks.value[pkg.id] = err?.message || '付款失敗'
  }
}

const isSystemMonthlyInvoice = (pkg: StoredPackage) => {
  const fromMetadata =
    typeof pkg.description_json === 'object' && pkg.description_json !== null
      ? (pkg.description_json as Record<string, unknown>).bill_type
      : undefined
  return pkg.payment_type === 'monthly_invoice' || fromMetadata === 'monthly_invoice'
}

const billTypeLabel = (pkg: StoredPackage) => (isSystemMonthlyInvoice(pkg) ? '月結' : '貨物')

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
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">付款</p>
      <h1>包裹付款介面</h1>
      <p class="lede">顯示已建立但未付款的包裹，到付會由收件者處理。</p>
    </header>

    <div class="tab-switch">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'list' }"
        type="button"
        @click="activeTab = 'list'"
      >
        付款清單
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'records' }"
        type="button"
        @click="activeTab = 'records'"
      >
        付款紀錄
      </button>
    </div>

    <div v-if="activeTab === 'list'" class="card">
      <div class="legend">
        <p class="eyebrow">付款清單</p>
        <p class="hint">列出需要你付款的貨件，顯示編號與建立時間；點擊後選擇付款方式。</p>
      </div>

      <p v-if="focusNotice" class="hint" style="margin-bottom: 10px">{{ focusNotice }}</p>

      <div v-if="isLoading" class="empty-state">
        <p>讀取中，請稍候...</p>
      </div>
      <div v-else-if="loadError" class="empty-state">
        <p>{{ loadError }}</p>
      </div>
      <div v-else-if="!myUnpaidPackages.length" class="empty-state">
        <p>目前沒有等待付款的包裹。</p>
        <RouterLink to="/customer/send" class="primary-btn ghost-btn">建立新包裹</RouterLink>
      </div>

      <ul v-else class="package-list">
        <li
          v-for="pkg in myUnpaidPackages"
          :id="`pkg-${pkg.id}`"
          :key="pkg.id"
          class="package-row"
          :class="{ active: expandedIds.has(pkg.id), highlight: pkg.id === highlightedPackageId }"
        >
          <button type="button" class="row-btn" @click="togglePackage(pkg)">
            <span class="tracking">{{ billTypeLabel(pkg) }} | {{ pkg.tracking_number || pkg.id }}</span>
            <span class="pill">{{ paymentLabel[resolveMethod(pkg.payment_method)] }}</span>
            <span class="pill">應付：{{ formatMoney(amountFor(pkg)) }} 元</span>
            <span v-if="!canPayNow(pkg)" class="pill danger">未達付款條件</span>
            <span class="meta">建立：{{ formatCreatedAt(resolveCreatedAt(pkg)) }}</span>
          </button>
          <div v-if="expandedIds.has(pkg.id)" class="package-detail">
            <div class="detail-grid">
              <p class="meta">
                寄件者：{{ senderDisplayName(pkg, auth.user?.user_name) }}
                <span v-if="pkg.sender_phone">（{{ pkg.sender_phone }}）</span>
              </p>
              <p class="meta">
                收件者：{{ receiverDisplayName(pkg, auth.user?.user_name) }}
                <span v-if="pkg.receiver_phone">（{{ pkg.receiver_phone }}）</span>
              </p>
              <p class="meta">寄件地址：{{ pkg.sender_address || '--' }}</p>
              <p class="meta">收件地址：{{ pkg.receiver_address || '--' }}</p>
              <p class="meta">
                尺寸：{{ dimensionsLabel(pkg) }}
                · 重量：{{ pkg.weight ?? '--' }} kg
              </p>
              <p class="meta">配送時效：{{ resolveDeliveryLabel(pkg.delivery_time) }}</p>
              <p class="meta">應付金額：{{ formatMoney(amountFor(pkg)) }} 元</p>
              <p class="meta">目前付款方式：{{ paymentLabel[resolveMethod(pkg.payment_method)] }}</p>
              <p v-if="resolveSpecialMarks(pkg).length" class="meta">特殊標記：{{ resolveSpecialMarks(pkg).join('、') }}</p>
              <p v-if="resolveNotes(pkg)" class="meta">備註：{{ resolveNotes(pkg) }}</p>
            </div>
            <p v-if="!canPayNow(pkg) && payableReasonFor(pkg)" class="chip danger">{{ payableReasonFor(pkg) }}</p>
            <div class="actions">
              <div class="method-picker">
                <span class="meta">付款方式</span>
                <select
                  v-model="paymentChoices[pkg.id]"
                  class="method-select"
                  name="paymentChoice"
                  @change="updatePaymentMethodFor(pkg)"
                >
                  <option v-for="method in allowedMethodsFor(pkg)" :key="method" :value="method">
                    {{ paymentLabel[method] }}
                  </option>
                </select>
              </div>
              <button class="ghost-btn" type="button" :disabled="!canPayNow(pkg)" @click="confirmPay(pkg)">確認付款</button>
            </div>
            <p v-if="feedbacks[pkg.id]" class="hint">{{ feedbacks[pkg.id] }}</p>
          </div>
        </li>
      </ul>
    </div>

    <div v-else class="card records-card">
      <div class="legend">
        <p class="eyebrow">付款紀錄</p>
        <p class="hint">現金/信用卡/網銀/第三方的付款會出現在這裡；月結包裹不列入付款紀錄。</p>
      </div>

      <div v-if="isLoadingRecords" class="empty-state">
        <p>讀取中...</p>
      </div>
      <div v-else-if="recordsError" class="empty-state">
        <p>{{ recordsError }}</p>
        <button class="ghost-btn" type="button" @click="loadPaymentRecords">重新載入</button>
      </div>
      <div v-else-if="!paidPackageRecords.length && !paidBillRecords.length" class="empty-state">
        <p>目前沒有付款紀錄。</p>
      </div>
      <div v-else>
        <div v-if="paidPackageRecords.length" class="bill-block">
          <p class="eyebrow">包裹付款</p>
          <ul class="package-list">
            <li
              v-for="item in paidPackageRecords"
              :key="item.package.id"
              class="package-row"
              :class="{ active: expandedRecordIds.has(recordKeyForPackage(item.package.id)) }"
            >
              <button type="button" class="row-btn" @click="toggleRecord(recordKeyForPackage(item.package.id))">
                <span class="tracking">貨物 | {{ item.package.tracking_number || item.package.id }}</span>
                <span class="meta">{{ item.paid_at ? formatCreatedAt(item.paid_at) : '--' }}</span>
              </button>

              <div v-if="expandedRecordIds.has(recordKeyForPackage(item.package.id))" class="package-detail">
                <div class="detail-grid">
                  <p class="meta">
                    寄件者：{{ senderDisplayName(item.package as any, auth.user?.user_name) }}
                    <span v-if="item.package.sender_phone">（{{ item.package.sender_phone }}）</span>
                  </p>
                  <p class="meta">
                    收件者：{{ receiverDisplayName(item.package as any, auth.user?.user_name) }}
                    <span v-if="item.package.receiver_phone">（{{ item.package.receiver_phone }}）</span>
                  </p>
                  <p class="meta">寄件地址：{{ item.package.sender_address || '--' }}</p>
                  <p class="meta">收件地址：{{ item.package.receiver_address || '--' }}</p>
                  <p class="meta">尺寸：{{ dimensionsLabel(item.package as any) }} · 重量：{{ item.package.weight ?? '--' }} kg</p>
                  <p class="meta">配送時效：{{ resolveDeliveryLabel(item.package.delivery_time) }}</p>
                  <p v-if="resolveSpecialMarks(item.package as any).length" class="meta">
                    特殊標記：{{ resolveSpecialMarks(item.package as any).join('、') }}
                  </p>
                  <p v-if="resolveNotes(item.package as any)" class="meta">備註：{{ resolveNotes(item.package as any) }}</p>
                  <p class="meta">付款方式：{{ paymentLabel[resolveMethod(item.package.payment_method)] }}</p>
                  <p class="meta">付款金額：{{ formatMoney(item.amount) }} 元</p>
                  <p class="meta">付款時間：{{ item.paid_at ? formatCreatedAt(item.paid_at) : '--' }}</p>
                </div>
              </div>
            </li>
          </ul>
        </div>

        <div v-if="paidBillRecords.length" class="bill-block">
          <p class="eyebrow">月結帳單付款</p>
          <ul class="package-list">
            <li
              v-for="item in paidBillRecords"
              :key="item.bill_id"
              class="package-row"
              :class="{ active: expandedRecordIds.has(recordKeyForBill(item.bill_id)) }"
            >
              <button type="button" class="row-btn" @click="toggleBillRecord(item.bill_id)">
                <span class="tracking">月結 | {{ item.period }}</span>
                <span class="pill">{{ billPaymentMethodLabel(item.payment_method) }}</span>
                <span class="pill">金額：{{ formatMoney(item.amount) }} 元</span>
                <span class="meta">付款：{{ item.paid_at ? formatCreatedAt(item.paid_at) : '--' }}</span>
              </button>

              <div v-if="expandedRecordIds.has(recordKeyForBill(item.bill_id))" class="package-detail">
                <div class="detail-grid">
                  <p class="meta">帳單期間：{{ item.period }}</p>
                  <p class="meta">付款方式：{{ billPaymentMethodLabel(item.payment_method) }}</p>
                  <p class="meta">付款金額：{{ formatMoney(item.amount) }} 元</p>
                  <p class="meta">付款時間：{{ item.paid_at ? formatCreatedAt(item.paid_at) : '--' }}</p>
                </div>

                <div v-if="billDetailLoading[item.bill_id]" class="empty-state">
                  <p>載入帳單明細中...</p>
                </div>
                <div v-else-if="billDetailError[item.bill_id]" class="empty-state">
                  <p>{{ billDetailError[item.bill_id] }}</p>
                  <button class="ghost-btn" type="button" @click="ensureBillDetail(item.bill_id)">重新載入</button>
                </div>
                <div v-else-if="billDetails[item.bill_id] && billDetails[item.bill_id]!.items?.length" class="detail-grid">
                  <p class="meta">包裹明細（{{ billDetails[item.bill_id]!.items.length }} 筆）</p>
                  <ul class="bill-list" style="gap: 6px">
                    <li v-for="b in billDetails[item.bill_id]!.items" :key="b.package_id" class="bill-row" style="padding: 10px">
                      <p class="tracking">月結 | {{ b.tracking_number || b.package_id }}</p>
                      <p class="meta">費用：{{ formatMoney(b.cost) }} 元 · 寄出：{{ b.shipped_at || '--' }}</p>
                    </li>
                  </ul>
                </div>
                <div v-else class="empty-state">
                  <p>沒有帳單明細或本期無包裹。</p>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
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
