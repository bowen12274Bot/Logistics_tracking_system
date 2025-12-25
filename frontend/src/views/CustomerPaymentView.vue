
<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted, nextTick } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { usePackageStore, type PaymentMethod, type StoredPackage } from '../stores/packages'
import { useAuthStore } from '../stores/auth'
import { api, type BillingBillListItem } from '../services/api'

const packageStore = usePackageStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const paymentLabel: Record<PaymentMethod, string> = {
  cash: '現金支付',
  credit_card: '信用卡',
  online_bank: '網路銀行',
  monthly_billing: '月結訂單',
  third_party: '第三方支付',
}

const unpaidPackages = computed<StoredPackage[]>(() => packageStore.unpaidPackages)
const myUnpaidPackages = computed<StoredPackage[]>(() =>
  unpaidPackages.value.filter((pkg) => !auth.user || pkg.customer_id === auth.user.id),
)
const expandedIds = ref<Set<string>>(new Set())
const paymentChoices = ref<Record<string, PaymentMethod>>({})
const feedbacks = ref<Record<string, string>>({})
const recordFilters = reactive({
  type: 'all' as 'all' | 'package' | 'monthly',
  keyword: '',
})
const activeTab = ref<'list' | 'records'>('list')
const isLoading = computed(() => packageStore.isLoading)
const loadError = computed(() => packageStore.error)
const hasAutoFocused = ref(false)
const highlightedPackageId = ref('')
const focusNotice = ref('')
const isLoadingBills = ref(false)
const billsError = ref('')
const pendingBills = ref<BillingBillListItem[]>([])
const billPaymentMethods = ref<Record<string, 'credit_card' | 'bank_transfer'>>({})
const billFeedbacks = ref<Record<string, string>>({})

const focusedPackageId = computed(() => {
  const raw = route.query.package_id
  return typeof raw === 'string' ? raw : ''
})

onMounted(() => {
  packageStore.fetchUnpaid(auth.user?.id)
  loadPendingBills()
})

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

const savePaymentChoiceFor = (pkg: StoredPackage) => {
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
  packageStore.setPaymentMethod(pkg.id, choice)
  feedbacks.value[pkg.id] = `已為包裹設定付款方式：${paymentLabel[choice]}。`
}

const methodOptions: PaymentMethod[] = ['cash', 'credit_card', 'online_bank', 'monthly_billing', 'third_party']

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

const confirmPay = (pkg: StoredPackage) => {
  feedbacks.value[pkg.id] = '已按下確認付款（功能尚待串接）。'
}

const loadPendingBills = async () => {
  billsError.value = ''
  pendingBills.value = []
  billFeedbacks.value = {}

  if (auth.user?.user_class !== 'contract_customer') return

  isLoadingBills.value = true
  try {
    const res = await api.getBillingBills({ status: 'pending' })
    const ready = (res.bills ?? []).filter((b) => Boolean(b.due_date))
    pendingBills.value = ready
    for (const bill of ready) {
      if (!billPaymentMethods.value[bill.id]) {
        billPaymentMethods.value[bill.id] = 'credit_card'
      }
    }
  } catch (err: any) {
    billsError.value = err?.message || '載入待付款帳單失敗'
  } finally {
    isLoadingBills.value = false
  }
}

const confirmPayBill = async (bill: BillingBillListItem) => {
  billFeedbacks.value[bill.id] = ''
  const method = billPaymentMethods.value[bill.id] ?? 'credit_card'
  try {
    const res = await api.payBillingBill({
      bill_id: bill.id,
      payment_method: method,
      amount: bill.total_amount,
    })
    billFeedbacks.value[bill.id] = res.message || '付款成功'
    await loadPendingBills()
  } catch (err: any) {
    billFeedbacks.value[bill.id] = err?.message || '付款失敗'
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

      <div v-if="auth.user?.user_class === 'contract_customer'" class="bill-block">
        <div class="legend" style="margin-bottom: 6px">
          <p class="eyebrow">待付款帳單</p>
          <p class="hint">月底結算後，月結帳單會出現在此清單。</p>
        </div>

        <div v-if="isLoadingBills" class="empty-state">
          <p>讀取帳單中，請稍候...</p>
        </div>
        <div v-else-if="billsError" class="empty-state">
          <p>{{ billsError }}</p>
          <button class="ghost-btn" type="button" @click="loadPendingBills">重新載入</button>
        </div>
        <div v-else-if="!pendingBills.length" class="empty-state">
          <p>目前沒有待付款帳單。</p>
        </div>
        <ul v-else class="bill-list">
          <li v-for="bill in pendingBills" :key="bill.id" class="bill-row">
            <div class="bill-row-main">
              <strong>帳單 | {{ bill.period }}</strong>
              <span class="pill">金額：{{ bill.total_amount }} 元</span>
            </div>
            <p class="meta">繳費期限：{{ bill.due_date || '--' }} · 包裹數：{{ bill.package_count ?? 0 }}</p>
            <div class="actions">
              <label class="form-field" style="margin: 0; min-width: 220px">
                <span>付款方式</span>
                <select v-model="billPaymentMethods[bill.id]" name="billPaymentMethod">
                  <option value="credit_card">信用卡</option>
                  <option value="bank_transfer">匯款</option>
                </select>
              </label>
              <button class="primary-btn" type="button" @click="confirmPayBill(bill)">繳費</button>
            </div>
            <p v-if="billFeedbacks[bill.id]" class="hint">{{ billFeedbacks[bill.id] }}</p>
          </li>
        </ul>
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
            <span class="meta">建立：{{ formatCreatedAt(resolveCreatedAt(pkg)) }}</span>
          </button>
          <div v-if="expandedIds.has(pkg.id)" class="package-detail">
            <p class="meta">
              寄件者：{{ pkg.sender || '未填寫' }} · 收件者：{{ pkg.receiver || '未填寫' }} · 重量 {{ pkg.weight ?? '--' }} kg ·
              配送 {{ pkg.delivery_time || '未選擇' }}
            </p>
            <p class="meta">目前付款方式：{{ paymentLabel[resolveMethod(pkg.payment_method)] }}</p>
            <label class="form-field">
              <span>付款方式</span>
                <select v-model="paymentChoices[pkg.id]" name="paymentChoice">
                  <option v-for="method in allowedMethodsFor(pkg)" :key="method" :value="method">
                    {{ paymentLabel[method] }}
                  </option>
                </select>
            </label>
            <div class="actions">
              <button class="primary-btn" type="button" @click="savePaymentChoiceFor(pkg)">更新付款方式</button>
              <button class="ghost-btn" type="button" @click="confirmPay(pkg)">確認付款</button>
            </div>
            <p v-if="feedbacks[pkg.id]" class="hint">{{ feedbacks[pkg.id] }}</p>
          </div>
        </li>
      </ul>
    </div>

    <div v-else class="card records-card">
      <div class="legend">
        <p class="eyebrow">付款紀錄</p>
        <p class="hint">查看已付款或月結紀錄，支援篩選（目前為占位）。</p>
      </div>
      <div class="filters">
        <label class="form-field">
          <span>類型</span>
          <select v-model="recordFilters.type">
            <option value="all">全部</option>
            <option value="package">貨物</option>
            <option value="monthly">月結</option>
          </select>
        </label>
        <label class="form-field">
          <span>搜尋關鍵字</span>
          <input v-model="recordFilters.keyword" type="text" placeholder="輸入編號或收件人..." />
        </label>
      </div>
      <div class="empty-state">
        <p>目前沒有付款紀錄。</p>
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
</style>
