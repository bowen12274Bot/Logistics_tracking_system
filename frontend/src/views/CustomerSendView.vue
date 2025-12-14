<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../services/api'
import { useAuthStore } from '../stores/auth'

type DeliveryTime = 'overnight' | 'two_day' | 'standard' | 'economy'
type PaymentType = 'prepaid' | 'cod'
type PickupType = '' | 'home' | 'store'
type DestinationType = '' | 'home' | 'store'

const deliveryLabel: Record<DeliveryTime, string> = {
  overnight: '隔日',
  two_day: '兩日',
  standard: '標準',
  economy: '經濟',
}

const paymentTypeLabel: Record<PaymentType, string> = {
  prepaid: '預付',
  cod: '到付',
}

const form = reactive({
  pickupType: 'home' as PickupType,
  destinationType: 'home' as DestinationType,

  senderName: '',
  senderPhone: '',
  senderAddress: '',
  receiverName: '',
  receiverPhone: '',
  receiverAddress: '',

  weight: null as number | null,
  length: null as number | null,
  width: null as number | null,
  height: null as number | null,
  declaredValue: null as number | null,
  deliveryTime: 'standard' as DeliveryTime,
  paymentType: 'prepaid' as PaymentType,
  dangerousMaterials: false,
  fragileItems: false,
  internationalShipments: false,

  pickupDate: '',
  pickupTimeWindow: '',
  pickupNotes: '',
})

const confirmation = ref('')
const errorMessage = ref('')
const estimateMessage = ref('')
const estimateError = ref('')
const isEstimating = ref(false)
const isSubmitting = ref(false)
const auth = useAuthStore()
const router = useRouter()
const senderPhoneDirty = ref(false)
const senderAddressDirty = ref(false)
const receiverCustomerStatus = ref<'unknown' | 'checking' | 'exists' | 'not_exists'>('unknown')
const receiverCustomerCheckError = ref('')
const isCodAllowed = computed(() => receiverCustomerStatus.value === 'exists')
const lastCreatedPackageId = ref<string | null>(null)

const senderNameReadonly = computed(() => !!auth.user?.user_name)

const requiredTrimmed = (value: string) => value.trim().length > 0

function normalizeAddress(value: string) {
  return value.trim().toUpperCase()
}

function isEndHomeAddress(value: string) {
  return /^END_HOME_\d+$/.test(normalizeAddress(value))
}

function isEndStoreAddress(value: string) {
  return /^END_STORE_\d+$/.test(normalizeAddress(value))
}

function buildSpecialMarks() {
  const marks: Array<'dangerous' | 'fragile' | 'international'> = []
  if (form.dangerousMaterials) marks.push('dangerous')
  if (form.fragileItems) marks.push('fragile')
  if (form.internationalShipments) marks.push('international')
  return marks
}

const requestEstimate = async () => {
  estimateMessage.value = ''
  estimateError.value = ''
  errorMessage.value = ''

  if (
    !requiredTrimmed(form.senderAddress) ||
    !requiredTrimmed(form.receiverAddress) ||
    !form.weight ||
    !form.length ||
    !form.width ||
    !form.height
  ) {
    estimateError.value = '請先填入起點/目的地、重量、長寬高後再進行運費試算。'
    return
  }

  const fromNodeId = normalizeAddress(form.senderAddress)
  const toNodeId = normalizeAddress(form.receiverAddress)

  if (form.pickupType === 'home' && !isEndHomeAddress(fromNodeId)) {
    estimateError.value = '起點（寄件地址）需為 END_HOME_x 格式。'
    return
  }
  if (form.pickupType === 'store' && !isEndStoreAddress(fromNodeId)) {
    estimateError.value = '起點（寄件門市）需為 END_STORE_x 格式。'
    return
  }
  if (form.destinationType === 'home' && !isEndHomeAddress(toNodeId)) {
    estimateError.value = '目的地（收件地址）需為 END_HOME_x 格式。'
    return
  }
  if (form.destinationType === 'store' && !isEndStoreAddress(toNodeId)) {
    estimateError.value = '目的地（收件門市）需為 END_STORE_x 格式。'
    return
  }

  isEstimating.value = true
  try {
    const res = await api.estimatePackage({
      fromNodeId,
      toNodeId,
      weightKg: form.weight,
      dimensionsCm: {
        length: form.length,
        width: form.width,
        height: form.height,
      },
      deliveryType: form.deliveryTime,
      specialMarks: buildSpecialMarks(),
    })

    const formatter = new Intl.NumberFormat('zh-TW')
    estimateMessage.value = `預估運費：${formatter.format(res.estimate.total_cost)} 元（箱型 ${res.estimate.box_type}、routeCost ${formatter.format(res.estimate.route_cost)}）`
  } catch (err: any) {
    estimateError.value = err?.message || '運費試算失敗，請稍後再試。'
  } finally {
    isEstimating.value = false
  }
}

watch(
  () => auth.user,
  (user) => {
    if (!user) return

    form.senderName = user.user_name ?? ''

    if (!senderPhoneDirty.value && !form.senderPhone) form.senderPhone = user.phone_number ?? ''
    if (!senderAddressDirty.value && !form.senderAddress) form.senderAddress = user.address ?? ''
  },
  { immediate: true },
)

watch(
  () => form.pickupType,
  (nextValue, prevValue) => {
    if (nextValue === prevValue) return

    form.senderAddress = ''
    senderAddressDirty.value = true

    if (nextValue !== 'home') {
      form.pickupDate = ''
      form.pickupTimeWindow = ''
      form.pickupNotes = ''
    }
  },
)

watch(
  () => form.destinationType,
  (nextValue, prevValue) => {
    if (nextValue === prevValue) return
    form.receiverAddress = ''
  },
)

watch(
  () => auth.token,
  async (token) => {
    if (!token) return
    try {
      const res = await api.getMe()
      if (res?.user) auth.setUser(res.user)
    } catch {
      // ignore refresh failure; fallback to persisted user
    }
  },
  { immediate: true },
)

let receiverCustomerTimer: number | null = null
async function refreshReceiverCustomerStatus() {
  receiverCustomerCheckError.value = ''

  const phone = form.receiverPhone.trim()
  const name = form.receiverName.trim()
  if (!phone && !name) {
    receiverCustomerStatus.value = 'unknown'
    return
  }

  receiverCustomerStatus.value = 'checking'
  try {
    const res = await api.customerExists({ phone: phone || undefined, name: name || undefined })
    receiverCustomerStatus.value = res.exists ? 'exists' : 'not_exists'
    if (!res.exists && form.paymentType === 'cod') {
      form.paymentType = 'prepaid'
    }
  } catch (err: any) {
    receiverCustomerStatus.value = 'unknown'
    receiverCustomerCheckError.value = err?.message || '無法確認收件人是否為系統客戶'
    if (form.paymentType === 'cod') form.paymentType = 'prepaid'
  }
}

watch(
  () => [form.receiverPhone, form.receiverName],
  () => {
    if (receiverCustomerTimer) window.clearTimeout(receiverCustomerTimer)
    receiverCustomerTimer = window.setTimeout(() => {
      refreshReceiverCustomerStatus()
    }, 300)
  },
)

watch(
  () => form.paymentType,
  (value) => {
    if (value === 'cod' && !isCodAllowed.value) {
      form.paymentType = 'prepaid'
    }
  },
)

const submitPackage = async () => {
  confirmation.value = ''
  errorMessage.value = ''
  estimateMessage.value = ''
  estimateError.value = ''
  lastCreatedPackageId.value = null

  if (!form.pickupType) {
    errorMessage.value = '請選擇寄件方式（超商寄件 / 預約到府取件）。'
    return
  }
  if (!form.destinationType) {
    errorMessage.value = '請選擇取件方式（超商 / 住家）。'
    return
  }

  if (
    !requiredTrimmed(form.senderName) ||
    !requiredTrimmed(form.senderPhone) ||
    !requiredTrimmed(form.senderAddress) ||
    !requiredTrimmed(form.receiverName) ||
    !requiredTrimmed(form.receiverPhone) ||
    !requiredTrimmed(form.receiverAddress)
  ) {
    errorMessage.value = '請完整填寫寄件/收件者的姓名、電話、地址。'
    return
  }

  const normalizedSenderAddress = normalizeAddress(form.senderAddress)
  const normalizedReceiverAddress = normalizeAddress(form.receiverAddress)

  if (form.pickupType === 'home' && !isEndHomeAddress(normalizedSenderAddress)) {
    errorMessage.value = '寄件者地址需為住家節點（例如 END_HOME_0）。'
    return
  }
  if (form.pickupType === 'store' && !isEndStoreAddress(normalizedSenderAddress)) {
    errorMessage.value = '寄件超商名稱需為超商節點（例如 END_STORE_0）。'
    return
  }
  if (form.destinationType === 'home' && !isEndHomeAddress(normalizedReceiverAddress)) {
    errorMessage.value = '收件者地址需為住家節點（例如 END_HOME_0）。'
    return
  }
  if (form.destinationType === 'store' && !isEndStoreAddress(normalizedReceiverAddress)) {
    errorMessage.value = '目的地超商名稱需為超商節點（例如 END_STORE_0）。'
    return
  }

  if (!form.weight || !form.length || !form.width || !form.height) {
    errorMessage.value = '請填寫重量、長寬高（需為正整數）。'
    return
  }

  if (form.pickupType === 'home' && (!form.pickupDate || !form.pickupTimeWindow)) {
    errorMessage.value = '到府取件需填寫取件日期與時段。'
    return
  }

  if (form.paymentType === 'cod') {
    await refreshReceiverCustomerStatus()
    if (!isCodAllowed.value) {
      errorMessage.value = '收件人不是系統內客戶，僅能選擇預付。'
      return
    }
  }

  isSubmitting.value = true
  try {
    const response = await api.createPackage({
      customer_id: auth.user?.id,
      sender: form.senderName,
      receiver: form.receiverName,
      sender_name: form.senderName,
      sender_phone: form.senderPhone,
      sender_address: normalizedSenderAddress,
      receiver_name: form.receiverName,
      receiver_phone: form.receiverPhone,
      receiver_address: normalizedReceiverAddress,
      weight: form.weight,
      size: `${form.length}x${form.width}x${form.height} cm`,
      delivery_time: form.deliveryTime,
      payment_type: form.paymentType,
      declared_value: form.declaredValue ?? undefined,
      dangerous_materials: form.dangerousMaterials,
      fragile_items: form.fragileItems,
      international_shipments: form.internationalShipments,
      pickup_date: form.pickupType === 'home' ? form.pickupDate : undefined,
      pickup_time_window: form.pickupType === 'home' ? form.pickupTimeWindow : undefined,
      pickup_notes: form.pickupType === 'home' ? form.pickupNotes : undefined,
      metadata: {
        created_at: new Date().toISOString(),
        delivery_time_label: deliveryLabel[form.deliveryTime],
        pickup_type: form.pickupType,
        destination_type: form.destinationType,
        payment_type_label: paymentTypeLabel[form.paymentType],
      },
    })

    const tracking = response.package.tracking_number ?? response.package.id
    lastCreatedPackageId.value = response.package.id
    confirmation.value =
      form.pickupType === 'home'
        ? `託運單已建立：追蹤碼 ${tracking}｜尺寸 ${form.length}x${form.width}x${form.height} cm / ${deliveryLabel[form.deliveryTime]}，重量 ${form.weight} kg｜付款：${paymentTypeLabel[form.paymentType]}｜寄件：到府取件 ${form.pickupDate} ${form.pickupTimeWindow}｜取件：${form.destinationType === 'store' ? '超商' : '府上'}。`
        : `託運單已建立：追蹤碼 ${tracking}｜尺寸 ${form.length}x${form.width}x${form.height} cm / ${deliveryLabel[form.deliveryTime]}，重量 ${form.weight} kg｜付款：${paymentTypeLabel[form.paymentType]}｜寄件：超商寄件｜取件：${form.destinationType === 'store' ? '超商' : '住宅'}。`
  } catch (err: any) {
    errorMessage.value = err?.message || '建立寄件失敗，請稍後再試。'
  } finally {
    isSubmitting.value = false
  }
}

const goToPayment = async () => {
  if (!lastCreatedPackageId.value) return
  await router.push({ name: 'customer-payment', query: { package_id: lastCreatedPackageId.value } })
}
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">寄件</p>
      <h1>建立託運單</h1>
      <p class="lede">請填寫寄收件資訊與包裹資料</p>
    </header>

    <div class="card send-card">
      <form class="send-form" @submit.prevent="submitPackage">
        <div class="send-top">
          <div class="send-control">
            <div class="send-control-title">取件地點</div>
            <div class="segmented" role="radiogroup" aria-label="pickup type">
              <label class="seg" :class="{ active: form.pickupType === 'home' }">
                <input v-model="form.pickupType" type="radio" name="pickupType" value="home" required />
                府上
              </label>
              <label class="seg" :class="{ active: form.pickupType === 'store' }">
                <input v-model="form.pickupType" type="radio" name="pickupType" value="store" required />
                超商
              </label>
            </div>
            <p class="hint send-control-hint">到府取件需填日期與時段，超商寄件免填。</p>
          </div>

          <div class="send-control">
            <div class="send-control-title">配送目的地</div>
            <div class="segmented" role="radiogroup" aria-label="destination type">
              <label class="seg" :class="{ active: form.destinationType === 'home' }">
                <input v-model="form.destinationType" type="radio" name="destinationType" value="home" required />
                住宅
              </label>
              <label class="seg" :class="{ active: form.destinationType === 'store' }">
                <input v-model="form.destinationType" type="radio" name="destinationType" value="store" required />
                超商
              </label>
            </div>
            <p class="hint send-control-hint">地址格式：<code>END_HOME_0</code> / <code>END_STORE_0</code>。</p>
          </div>
        </div>

        <section class="send-section">
          <header class="send-section-header">
            <h2 class="send-section-title">寄件人資訊</h2>
          </header>
          <div class="form-grid">
            <label class="form-field">
              <span>寄件者姓名</span>
              <input
                v-model="form.senderName"
                required
                name="senderName"
                type="text"
                placeholder="請輸入姓名"
                :readonly="senderNameReadonly"
              />
            </label>
            <label class="form-field">
              <span>寄件者電話</span>
              <input
                v-model="form.senderPhone"
                required
                name="senderPhone"
                type="tel"
                placeholder="請輸入電話"
                @input="senderPhoneDirty = true"
              />
            </label>
            <label class="form-field span-2">
              <span>{{ form.pickupType === 'store' ? '寄件超商名稱' : '寄件者地址' }}</span>
              <input
                v-model="form.senderAddress"
                required
                name="senderAddress"
                type="text"
                :placeholder="form.pickupType === 'store' ? '請輸入超商節點（例如 END_STORE_0）' : '請輸入住家節點（例如 END_HOME_0）'"
                @input="senderAddressDirty = true"
              />
            </label>
          </div>
        </section>

        <section class="send-section">
          <header class="send-section-header">
            <h2 class="send-section-title">收件人資訊</h2>
          </header>
          <div class="form-grid">
            <label class="form-field">
              <span>收件者姓名</span>
              <input v-model="form.receiverName" required name="receiverName" type="text" placeholder="請輸入姓名" />
            </label>
            <label class="form-field">
              <span>收件者電話</span>
              <input v-model="form.receiverPhone" required name="receiverPhone" type="tel" placeholder="請輸入電話" />
            </label>
            <label class="form-field span-2">
              <span>{{ form.destinationType === 'store' ? '目的地超商名稱' : '收件者地址' }}</span>
              <input
                v-model="form.receiverAddress"
                required
                name="receiverAddress"
                type="text"
                :placeholder="form.destinationType === 'store' ? '請輸入超商節點（例如 END_STORE_0）' : '請輸入住家節點（例如 END_HOME_0）'"
              />
            </label>
          </div>
        </section>

        <section class="send-section">
          <header class="send-section-header">
            <h2 class="send-section-title">包裹資訊</h2>
            <p class="hint send-section-hint">重量與尺寸為必填。</p>
          </header>
          <div class="form-grid">
            <label class="form-field">
              <span>重量 (kg)</span>
              <input
                v-model.number="form.weight"
                min="1"
                required
                name="weight"
                type="number"
                step="1"
                placeholder="請輸入重量"
              />
            </label>

            <div class="form-field">
              <span>尺寸 (cm)</span>
              <div class="dimension-grid">
                <input v-model.number="form.length" min="1" required name="length" type="number" placeholder="長" />
                <input v-model.number="form.width" min="1" required name="width" type="number" placeholder="寬" />
                <input v-model.number="form.height" min="1" required name="height" type="number" placeholder="高" />
              </div>
            </div>

            <label class="form-field">
              <span>配送速度</span>
              <select v-model="form.deliveryTime" name="deliveryTime">
                <option value="overnight">隔日</option>
                <option value="two_day">兩日</option>
                <option value="standard">標準</option>
                <option value="economy">經濟</option>
              </select>
            </label>

            <label class="form-field">
              <span>付款方式</span>
              <select v-model="form.paymentType" name="paymentType">
                <option value="prepaid">預付（寄件者付款）</option>
                <option value="cod" :disabled="!isCodAllowed">到付（收件者付款）</option>
              </select>
              <!--<small v-if="receiverCustomerCheckError" class="hint" style="color: #b00020">
                {{ receiverCustomerCheckError }}
              </small>
              <small v-else-if="receiverCustomerStatus === 'checking'" class="hint">正在確認收件人是否為系統客戶…</small>
              <small v-else-if="receiverCustomerStatus === 'not_exists'" class="hint"
                >收件人非系統客戶，僅能預付（請填寫正確收件人姓名/電話）。</small
              >-->
            </label>

            <label class="form-field">
              <span>申報價值（選填）</span>
              <input
                v-model.number="form.declaredValue"
                name="declaredValue"
                type="number"
                min="0"
                step="1"
                placeholder="可填，可作為保價參考"
              />
            </label>

            <div class="form-field span-2">
              <span>特殊標記</span>
              <div class="check-stack hint">
                <label><input v-model="form.dangerousMaterials" type="checkbox" /> 含危險物</label>
                <label><input v-model="form.fragileItems" type="checkbox" /> 易碎品</label>
                <label><input v-model="form.internationalShipments" type="checkbox" /> 國際貨件</label>
              </div>
            </div>
          </div>
        </section>

        <section v-if="form.pickupType === 'home'" class="send-section">
          <header class="send-section-header">
            <h2 class="send-section-title">到府取件</h2>
            <p class="hint send-section-hint">請選擇可聯絡的日期與時段。</p>
          </header>
          <div class="form-grid">
            <label class="form-field">
              <span>取件日期</span>
              <input v-model="form.pickupDate" type="date" name="pickupDate" required />
            </label>

            <label class="form-field">
              <span>取件時段</span>
              <select v-model="form.pickupTimeWindow" name="pickupTimeWindow" required>
                <option value="" disabled>請選擇</option>
                <option value="09:00-12:00">09:00 - 12:00</option>
                <option value="12:00-15:00">12:00 - 15:00</option>
                <option value="15:00-18:00">15:00 - 18:00</option>
                <option value="18:00-21:00">18:00 - 21:00</option>
              </select>
            </label>

            <label class="form-field span-2">
              <span>取件備註（選填）</span>
              <textarea v-model="form.pickupNotes" rows="3" name="pickupNotes" placeholder="例如：需先聯絡、門禁、停車資訊"></textarea>
            </label>
          </div>
        </section>

        <p v-if="errorMessage" class="hint send-message error">{{ errorMessage }}</p>
        <p v-if="estimateError" class="hint send-message error">{{ estimateError }}</p>
        <p v-if="estimateMessage" class="hint send-message success">{{ estimateMessage }}</p>
        <p v-if="confirmation" class="hint send-message success">{{ confirmation }}</p>

        <div class="send-actions">
          <div v-if="lastCreatedPackageId" class="send-actions-left">
            <button class="primary-btn" type="button" @click="goToPayment">前往付款</button>
          </div>
          <p v-if="lastCreatedPackageId" style="color:brown;">用戶尚未付款，請盡快前往付款。</p>
          <div class="send-actions-right">
            <button class="ghost-btn" type="button" :disabled="isEstimating" @click="requestEstimate">
              {{ isEstimating ? '試算中…' : '運費試算' }}
            </button>
            <button class="primary-btn" type="submit" :disabled="isSubmitting">
              {{ isSubmitting ? '建立中…' : '建立託運單' }}
            </button>
          </div>
        </div>
        
      </form>
    </div>
  </section>
</template>

<style scoped>
.send-card {
  background: linear-gradient(135deg, rgba(255, 247, 240, 0.9), rgba(255, 253, 249, 0.9));
}

.send-form {
  display: grid;
  gap: 14px;
}

.send-top {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--surface-stroke);
  background: rgba(255, 255, 255, 0.55);
}

.send-control-title {
  font-weight: 800;
  letter-spacing: -0.01em;
  margin-bottom: 8px;
}

.send-control-hint {
  margin: 8px 0 0;
}

.segmented {
  display: inline-flex;
  gap: 6px;
  padding: 6px;
  border-radius: 14px;
  border: 1px solid var(--surface-stroke);
  background: rgba(255, 255, 255, 0.7);
  flex-wrap: wrap;
}

.segmented input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.seg {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  padding: 10px 12px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-main);
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
  user-select: none;
}

.seg:hover {
  border-color: rgba(165, 122, 99, 0.35);
  transform: translateY(-1px);
}

.seg.active {
  background: linear-gradient(135deg, rgba(244, 182, 194, 0.55), rgba(225, 139, 139, 0.45));
  border-color: rgba(165, 122, 99, 0.28);
}

.send-section {
  border: 1px solid var(--surface-stroke);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.45);
  padding: 14px;
}

.send-section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.send-section-title {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.01em;
  margin: 0;
}

.send-section-hint {
  margin: 0;
}

.dimension-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.check-stack {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 10px 20px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px dashed rgba(165, 122, 99, 0.25);
  background: rgba(255, 255, 255, 0.6);
  align-items: center;
}

.check-stack > label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 10px;
  border: 1px solid rgba(165, 122, 99, 0.18);
  background: rgba(255, 255, 255, 0.55);
}

.send-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.send-actions-right {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-left: auto;
}

.primary-btn:disabled,
.ghost-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.send-message {
  margin-top: 12px;
}

.send-message.error {
  color: #b00020;
}

.send-message.success {
  color: var(--text-muted);
}

.send-card code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.95em;
  padding: 2px 6px;
  border-radius: 8px;
  border: 1px solid rgba(165, 122, 99, 0.22);
  background: rgba(255, 255, 255, 0.65);
}
</style>
