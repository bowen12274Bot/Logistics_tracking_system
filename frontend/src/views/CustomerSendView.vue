<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { api } from '../services/api'
import { useAuthStore } from '../stores/auth'
import UiModal from '../components/ui/UiModal.vue'
import { useToasts } from '../components/ui/toast'
import {
  addCommonRecipient,
  loadCustomerCommonRecipients,
  removeCommonRecipient,
  saveCustomerCommonRecipients,
  type CustomerCommonRecipients,
} from '../services/customerCommonRecipients'

type DeliveryTime = 'overnight' | 'two_day' | 'standard' | 'economy'
type PaymentType = 'prepaid' | 'cod'
type PickupType = '' | 'home' | 'store'
type DestinationType = '' | 'home' | 'store'

const { t, locale } = useI18n()

const deliveryLabel = computed<Record<DeliveryTime, string>>(() => ({
  overnight: t('send.deliveryTime.overnight'),
  two_day: t('send.deliveryTime.twoDay'),
  standard: t('send.deliveryTime.standard'),
  economy: t('send.deliveryTime.economy'),
}))

const paymentTypeLabel = computed<Record<PaymentType, string>>(() => ({
  prepaid: t('send.payment.prepaid'),
  cod: t('send.payment.cod'),
}))

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
const estimateRoutePath = ref<string[]>([])
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
const lastCreatedTrackingNumber = ref<string | null>(null)
const toasts = useToasts()

const senderNameReadonly = computed(() => !!auth.user?.user_name)
const numberFormatter = computed(
  () => new Intl.NumberFormat(locale.value === 'en-US' ? 'en-US' : 'zh-TW'),
)

const commonData = ref<CustomerCommonRecipients>(loadCustomerCommonRecipients(auth.user?.id))
watch(
  () => auth.user?.id,
  (id) => {
    commonData.value = loadCustomerCommonRecipients(id)
  },
)

const commonModalOpen = ref(false)
const openCommonRecipients = () => {
  commonModalOpen.value = true
}

const persistCommon = () => {
  saveCustomerCommonRecipients(auth.user?.id, commonData.value)
}

const canSaveRecipientCommon = computed(
  () => requiredTrimmed(form.receiverName) && requiredTrimmed(form.receiverPhone) && requiredTrimmed(form.receiverAddress),
)

const applyRecipientCommon = (index: number) => {
  const target = commonData.value.recipients[index]
  if (!target) return
  form.receiverName = target.name
  form.receiverPhone = target.phone
  form.receiverAddress = target.address
  const addr = normalizeAddress(target.address)
  if (addr.startsWith('END_STORE_')) form.destinationType = 'store'
  if (addr.startsWith('END_HOME_')) form.destinationType = 'home'
}

const saveRecipientCommon = () => {
  commonData.value = addCommonRecipient(commonData.value, {
    name: form.receiverName,
    phone: form.receiverPhone,
    address: normalizeAddress(form.receiverAddress),
  })
  persistCommon()
}

const deleteRecipientCommon = (index: number) => {
  commonData.value = removeCommonRecipient(commonData.value, index)
  persistCommon()
}

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

const estimateFingerprint = computed(() =>
  JSON.stringify({
    from: normalizeAddress(form.senderAddress),
    to: normalizeAddress(form.receiverAddress),
    weight: form.weight,
    length: form.length,
    width: form.width,
    height: form.height,
    delivery: form.deliveryTime,
    marks: buildSpecialMarks().slice().sort(),
  }),
)

const lastEstimatedFingerprint = ref<string | null>(null)
const isEstimateFresh = computed(
  () => !!lastEstimatedFingerprint.value && lastEstimatedFingerprint.value === estimateFingerprint.value && !estimateError.value,
)

watch(
  estimateFingerprint,
  (next) => {
    if (!lastEstimatedFingerprint.value) return
    if (next === lastEstimatedFingerprint.value) return
    lastEstimatedFingerprint.value = null
    estimateMessage.value = ''
    estimateRoutePath.value = []
  },
  { flush: 'sync' },
)

const requestEstimate = async () => {
  estimateMessage.value = ''
  estimateError.value = ''
  estimateRoutePath.value = []
  errorMessage.value = ''
  lastEstimatedFingerprint.value = null

  if (
    !requiredTrimmed(form.senderAddress) ||
    !requiredTrimmed(form.receiverAddress) ||
    !form.weight ||
    !form.length ||
    !form.width ||
    !form.height
  ) {
    estimateError.value = t('send.errors.estimateRequired')
    return
  }

  const fromNodeId = normalizeAddress(form.senderAddress)
  const toNodeId = normalizeAddress(form.receiverAddress)

  if (form.pickupType === 'home' && !isEndHomeAddress(fromNodeId)) {
    estimateError.value = t('send.errors.pickupHomeFormat')
    return
  }
  if (form.pickupType === 'store' && !isEndStoreAddress(fromNodeId)) {
    estimateError.value = t('send.errors.pickupStoreFormat')
    return
  }
  if (form.destinationType === 'home' && !isEndHomeAddress(toNodeId)) {
    estimateError.value = t('send.errors.destHomeFormat')
    return
  }
  if (form.destinationType === 'store' && !isEndStoreAddress(toNodeId)) {
    estimateError.value = t('send.errors.destStoreFormat')
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

    const estimate = res.estimate
    estimateMessage.value = t('send.estimate.success', {
      amount: numberFormatter.value.format(estimate.total_cost),
      box: estimate.box_type,
      routeCost: numberFormatter.value.format(estimate.route_cost),
    })
    estimateRoutePath.value = estimate.route_path ?? []
    lastEstimatedFingerprint.value = estimateFingerprint.value
  } catch (err: any) {
    estimateError.value = err?.message || t('send.errors.estimateFailed')
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
    receiverCustomerCheckError.value = err?.message || t('send.errors.receiverCheckFailed')
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
  lastCreatedPackageId.value = null
  lastCreatedTrackingNumber.value = null

  if (!form.pickupType) {
    errorMessage.value = t('send.errors.pickupType')
    return
  }
  if (!form.destinationType) {
    errorMessage.value = t('send.errors.destinationType')
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
    errorMessage.value = t('send.errors.requiredFields')
    return
  }

  const normalizedSenderAddress = normalizeAddress(form.senderAddress)
  const normalizedReceiverAddress = normalizeAddress(form.receiverAddress)

  if (form.pickupType === 'home' && !isEndHomeAddress(normalizedSenderAddress)) {
    errorMessage.value = t('send.errors.pickupHomeFormat')
    return
  }
  if (form.pickupType === 'store' && !isEndStoreAddress(normalizedSenderAddress)) {
    errorMessage.value = t('send.errors.pickupStoreFormat')
    return
  }
  if (form.destinationType === 'home' && !isEndHomeAddress(normalizedReceiverAddress)) {
    errorMessage.value = t('send.errors.destHomeFormat')
    return
  }
  if (form.destinationType === 'store' && !isEndStoreAddress(normalizedReceiverAddress)) {
    errorMessage.value = t('send.errors.destStoreFormat')
    return
  }

  if (!form.weight || !form.length || !form.width || !form.height) {
    errorMessage.value = t('send.errors.weightAndSize')
    return
  }

  if (form.pickupType === 'home' && (!form.pickupDate || !form.pickupTimeWindow)) {
    errorMessage.value = t('send.errors.pickupSchedule')
    return
  }

  if (!isEstimateFresh.value) {
    errorMessage.value = t('send.errors.mustEstimate')
    return
  }

  if (form.paymentType === 'cod') {
    await refreshReceiverCustomerStatus()
    if (!isCodAllowed.value) {
      errorMessage.value = t('send.errors.codNotAllowed')
      return
    }
  }

  isSubmitting.value = true
  try {
    let routePathToSend = estimateRoutePath.value
    if (!routePathToSend?.length) {
      try {
        const res = await api.estimatePackage({
          fromNodeId: normalizedSenderAddress,
          toNodeId: normalizedReceiverAddress,
          weightKg: form.weight,
          dimensionsCm: {
            length: form.length,
            width: form.width,
            height: form.height,
          },
          deliveryType: form.deliveryTime,
          specialMarks: buildSpecialMarks(),
        })
        routePathToSend = res.estimate.route_path ?? []
        estimateRoutePath.value = routePathToSend
      } catch {
        routePathToSend = []
      }
    }

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
      length: form.length,
      width: form.width,
      height: form.height,
      delivery_time: form.deliveryTime,
      payment_type: form.paymentType,
      declared_value: form.declaredValue ?? undefined,
      dangerous_materials: form.dangerousMaterials,
      fragile_items: form.fragileItems,
      international_shipments: form.internationalShipments,
      pickup_date: form.pickupType === 'home' ? form.pickupDate : undefined,
      pickup_time_window: form.pickupType === 'home' ? form.pickupTimeWindow : undefined,
      pickup_notes: form.pickupType === 'home' ? form.pickupNotes : undefined,
      route_path: routePathToSend.length ? JSON.stringify(routePathToSend) : undefined,
      metadata: {
        created_at: new Date().toISOString(),
        delivery_time_label: deliveryLabel.value[form.deliveryTime],
        pickup_type: form.pickupType,
        destination_type: form.destinationType,
        payment_type_label: paymentTypeLabel.value[form.paymentType],
      },
    })

    const tracking = response.package.tracking_number ?? response.package.id
    lastCreatedPackageId.value = response.package.id
    lastCreatedTrackingNumber.value = tracking
    const destLabel = form.destinationType === 'store' ? t('send.destination.store') : t('send.destination.home')
    confirmation.value =
      form.pickupType === 'home'
        ? t('send.confirmation.home', {
            tracking,
            dimensions: `${form.length}x${form.width}x${form.height} cm`,
            delivery: deliveryLabel.value[form.deliveryTime],
            weight: form.weight,
            payment: paymentTypeLabel.value[form.paymentType],
            date: form.pickupDate,
            window: form.pickupTimeWindow,
            destination: destLabel,
          })
        : t('send.confirmation.store', {
            tracking,
            dimensions: `${form.length}x${form.width}x${form.height} cm`,
            delivery: deliveryLabel.value[form.deliveryTime],
            weight: form.weight,
            payment: paymentTypeLabel.value[form.paymentType],
            destination: destLabel,
          })

    if (form.paymentType === 'prepaid') {
      await router.push({
        name: 'customer-payment',
        query: { package_id: response.package.id, tracking_number: tracking },
      })
    } else {
      await router.push({
        name: 'customer-track',
        query: { tracking_number: tracking },
      })
    }
  } catch (err: any) {
    errorMessage.value = err?.message || t('send.errors.createFailed')
  } finally {
    isSubmitting.value = false
  }
}

const goToPayment = async () => {
  if (!lastCreatedPackageId.value) return
  await router.push({
    name: 'customer-payment',
    query: { package_id: lastCreatedPackageId.value, tracking_number: lastCreatedTrackingNumber.value ?? undefined },
  })
}

const goToTrack = async () => {
  const tracking = lastCreatedTrackingNumber.value
  if (!tracking) return
  await router.push({ name: 'customer-track', query: { tracking_number: tracking } })
}

async function copyTracking() {
  const tracking = lastCreatedTrackingNumber.value
  if (!tracking) return

  try {
    await navigator.clipboard?.writeText?.(tracking)
    toasts.success(t('send.success.copied'))
    return
  } catch {
    // ignore and fallback
  }

  try {
    const el = document.createElement('textarea')
    el.value = tracking
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    if (ok) toasts.success(t('send.success.copied'))
    else toasts.warning(t('send.success.copyFailed'))
  } catch {
    toasts.warning(t('send.success.copyFailed'))
  }
}
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">{{ t('send.eyebrow') }}</p>
      <h1>{{ t('send.title') }}</h1>
      <p class="lede">{{ t('send.lede') }}</p>
    </header>

    <div class="card send-card">
      <form class="send-form" @submit.prevent="submitPackage">
        <div class="send-top">
          <div class="send-control">
            <div class="send-control-title">{{ t('send.pickup.title') }}</div>
            <div class="segmented" role="radiogroup" :aria-label="t('send.pickup.aria')">
              <label class="seg" :class="{ active: form.pickupType === 'home' }">
                <input v-model="form.pickupType" type="radio" name="pickupType" value="home" required />
                {{ t('send.pickup.home') }}
              </label>
              <label class="seg" :class="{ active: form.pickupType === 'store' }">
                <input v-model="form.pickupType" type="radio" name="pickupType" value="store" required />
                {{ t('send.pickup.store') }}
              </label>
            </div>
            <p class="hint send-control-hint">{{ t('send.pickup.hint') }}</p>
          </div>

          <div class="send-control">
            <div class="send-control-title">{{ t('send.destination.title') }}</div>
            <div class="segmented" role="radiogroup" :aria-label="t('send.destination.aria')">
              <label class="seg" :class="{ active: form.destinationType === 'home' }">
                <input v-model="form.destinationType" type="radio" name="destinationType" value="home" required />
                {{ t('send.destination.home') }}
              </label>
              <label class="seg" :class="{ active: form.destinationType === 'store' }">
                <input v-model="form.destinationType" type="radio" name="destinationType" value="store" required />
                {{ t('send.destination.store') }}
              </label>
            </div>
            <p class="hint send-control-hint" v-html="t('send.destination.hint')" />
          </div>
        </div>

        <section class="send-section">
          <header class="send-section-header">
            <h2 class="send-section-title">{{ t('send.sender.title') }}</h2>
          </header>
          <div class="form-grid">
            <label class="form-field">
              <span>{{ t('send.sender.name') }}</span>
              <input
                v-model="form.senderName"
                required
                name="senderName"
                type="text"
                :placeholder="t('send.sender.namePlaceholder')"
                :readonly="senderNameReadonly"
              />
            </label>
            <label class="form-field">
              <span>{{ t('send.sender.phone') }}</span>
              <input
                v-model="form.senderPhone"
                required
                name="senderPhone"
                type="tel"
                :placeholder="t('send.sender.phonePlaceholder')"
                @input="senderPhoneDirty = true"
              />
            </label>
            <label class="form-field span-2">
              <span>{{ form.pickupType === 'store' ? t('send.sender.storeAddress') : t('send.sender.address') }}</span>
              <input
                v-model="form.senderAddress"
                required
                name="senderAddress"
                type="text"
                :placeholder="
                  form.pickupType === 'store'
                    ? t('send.sender.storeAddressPlaceholder')
                    : t('send.sender.addressPlaceholder')
                "
                @input="senderAddressDirty = true"
              />
            </label>
          </div>
        </section>

        <section class="send-section">
          <header class="send-section-header">
            <h2 class="send-section-title">{{ t('send.receiver.title') }}</h2>
            <div class="send-section-actions">
              <button
                v-if="commonData.recipients.length"
                class="ghost-btn small-btn"
                type="button"
                data-testid="open-common-recipient"
                @click="openCommonRecipients"
              >
                {{ t('send.common.useRecipient') }}
              </button>
              <button
                class="ghost-btn small-btn"
                type="button"
                data-testid="save-common-recipient"
                :disabled="!canSaveRecipientCommon"
                @click="saveRecipientCommon"
              >
                {{ t('send.common.saveRecipient') }}
              </button>
            </div>
          </header>
          <div class="form-grid">
            <label class="form-field">
              <span>{{ t('send.receiver.name') }}</span>
              <input
                v-model="form.receiverName"
                required
                name="receiverName"
                type="text"
                :placeholder="t('send.receiver.namePlaceholder')"
              />
            </label>
            <label class="form-field">
              <span>{{ t('send.receiver.phone') }}</span>
              <input
                v-model="form.receiverPhone"
                required
                name="receiverPhone"
                type="tel"
                :placeholder="t('send.receiver.phonePlaceholder')"
              />
            </label>
            <label class="form-field span-2">
              <span>{{ form.destinationType === 'store' ? t('send.receiver.storeAddress') : t('send.receiver.address') }}</span>
              <input
                v-model="form.receiverAddress"
                required
                name="receiverAddress"
                type="text"
                :placeholder="
                  form.destinationType === 'store'
                  ? t('send.receiver.storeAddressPlaceholder')
                  : t('send.receiver.addressPlaceholder')
                "
              />
            </label>
          </div>
        </section>

        <section class="send-section">
          <header class="send-section-header">
            <h2 class="send-section-title">{{ t('send.package.title') }}</h2>
            <p class="hint send-section-hint">{{ t('send.package.hint') }}</p>
          </header>
          <div class="form-grid">
            <label class="form-field">
              <span>{{ t('send.package.weight') }}</span>
              <input
                v-model.number="form.weight"
                min="1"
                required
                name="weight"
                type="number"
                step="1"
                :placeholder="t('send.package.weightPlaceholder')"
              />
            </label>

            <div class="form-field">
              <span>{{ t('send.package.dimensions') }}</span>
              <div class="dimension-grid">
                <input
                  v-model.number="form.length"
                  min="1"
                  required
                  name="length"
                  type="number"
                  :placeholder="t('send.package.length')"
                />
                <input
                  v-model.number="form.width"
                  min="1"
                  required
                  name="width"
                  type="number"
                  :placeholder="t('send.package.width')"
                />
                <input
                  v-model.number="form.height"
                  min="1"
                  required
                  name="height"
                  type="number"
                  :placeholder="t('send.package.height')"
                />
              </div>
            </div>

            <label class="form-field">
              <span>{{ t('send.package.speed') }}</span>
              <select v-model="form.deliveryTime" name="deliveryTime">
                <option value="overnight">{{ deliveryLabel.overnight }}</option>
                <option value="two_day">{{ deliveryLabel.two_day }}</option>
                <option value="standard">{{ deliveryLabel.standard }}</option>
                <option value="economy">{{ deliveryLabel.economy }}</option>
              </select>
            </label>

            <label class="form-field">
              <span>{{ t('send.package.payment') }}</span>
              <select v-model="form.paymentType" name="paymentType">
                <option value="prepaid">{{ t('send.payment.prepaidFull') }}</option>
                <option value="cod" :disabled="!isCodAllowed">{{ t('send.payment.codFull') }}</option>
              </select>
            </label>

            <label class="form-field">
              <span>{{ t('send.package.declared') }}</span>
              <input
                v-model.number="form.declaredValue"
                name="declaredValue"
                type="number"
                min="0"
                step="1"
                :placeholder="t('send.package.declaredPlaceholder')"
              />
            </label>

            <div class="form-field span-2">
              <span>{{ t('send.package.marks') }}</span>
              <div class="check-stack hint">
                <label><input v-model="form.dangerousMaterials" type="checkbox" /> {{ t('send.package.dangerous') }}</label>
                <label><input v-model="form.fragileItems" type="checkbox" /> {{ t('send.package.fragile') }}</label>
                <label><input v-model="form.internationalShipments" type="checkbox" /> {{ t('send.package.international') }}</label>
              </div>
            </div>
          </div>
        </section>

        <section v-if="form.pickupType === 'home'" class="send-section">
          <header class="send-section-header">
            <h2 class="send-section-title">{{ t('send.pickupSchedule.title') }}</h2>
            <p class="hint send-section-hint">{{ t('send.pickupSchedule.hint') }}</p>
          </header>
          <div class="form-grid">
            <label class="form-field">
              <span>{{ t('send.pickupSchedule.date') }}</span>
              <input v-model="form.pickupDate" type="date" name="pickupDate" required />
            </label>

            <label class="form-field">
              <span>{{ t('send.pickupSchedule.window') }}</span>
              <select v-model="form.pickupTimeWindow" name="pickupTimeWindow" required>
                <option value="" disabled>{{ t('send.pickupSchedule.choose') }}</option>
                <option value="09:00-12:00">09:00 - 12:00</option>
                <option value="12:00-15:00">12:00 - 15:00</option>
                <option value="15:00-18:00">15:00 - 18:00</option>
                <option value="18:00-21:00">18:00 - 21:00</option>
              </select>
            </label>

            <label class="form-field span-2">
              <span>{{ t('send.pickupSchedule.notes') }}</span>
              <textarea
                v-model="form.pickupNotes"
                rows="3"
                name="pickupNotes"
                :placeholder="t('send.pickupSchedule.notesPlaceholder')"
              ></textarea>
            </label>
          </div>
        </section>

        <p v-if="errorMessage" class="hint send-message error">{{ errorMessage }}</p>
        <p v-if="estimateError" class="hint send-message error">{{ estimateError }}</p>
        <p v-if="estimateMessage" class="hint send-message success">{{ estimateMessage }}</p>
        <p v-if="confirmation" class="hint send-message success">{{ confirmation }}</p>

        <div v-if="lastCreatedTrackingNumber" class="send-success">
          <div class="send-success-header">
            <p class="eyebrow">{{ t('send.success.title') }}</p>
            <div class="send-success-actions">
              <button class="ghost-btn small-btn" type="button" @click="copyTracking">{{ t('send.success.copy') }}</button>
              <button class="ghost-btn small-btn" type="button" @click="goToTrack">{{ t('send.success.goTrack') }}</button>
            </div>
          </div>
          <div class="send-success-code">
            <span class="hint">{{ t('send.success.trackingLabel') }}</span>
            <code>{{ lastCreatedTrackingNumber }}</code>
          </div>
          <div v-if="lastCreatedPackageId" class="send-success-footer">
            <p class="hint" style="margin: 0">{{ t('send.payReminder') }}</p>
            <button class="primary-btn" type="button" @click="goToPayment">{{ t('send.success.goPayment') }}</button>
          </div>
        </div>

        <div v-if="!lastCreatedTrackingNumber" class="send-actions">
          <div class="send-actions-right">
            <button
              class="primary-btn"
              type="button"
              :disabled="isEstimating || isSubmitting"
              @click="isEstimateFresh ? submitPackage() : requestEstimate()"
            >
              <template v-if="isEstimateFresh">
                {{ isSubmitting ? t('send.submit.loading') : t('send.submit.cta') }}
              </template>
              <template v-else>
                {{ isEstimating ? t('send.estimate.loading') : t('send.estimate.cta') }}
              </template>
            </button>
          </div>
        </div>
      </form>
    </div>

    <UiModal v-model="commonModalOpen" :title="t('send.common.modalTitle')" :close-text="t('common.close')">
      <p class="hint" style="margin: 0 0 10px">{{ t('send.common.recipientHint') }}</p>
      <div v-if="!commonData.recipients.length" class="hint">{{ t('send.common.recipientEmpty') }}</div>
      <ul v-else class="common-list">
        <li v-for="(r, idx) in commonData.recipients" :key="`${r.name}-${r.phone}-${r.address}-${r.updatedAt}`" class="common-list-item">
          <button class="ghost-btn common-entry" type="button" :data-testid="`apply-common-recipient-${idx}`" @click="applyRecipientCommon(idx)">
            <span class="common-entry-text">{{ r.name }} / {{ r.phone }} /</span>
            <code class="common-entry-code">{{ r.address }}</code>
          </button>
          <button class="ghost-btn small-btn" type="button" @click="deleteRecipientCommon(idx)">{{ t('common.delete') }}</button>
        </li>
      </ul>
    </UiModal>
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

.send-section-actions {
  display: inline-flex;
  gap: 8px;
  flex-wrap: wrap;
}

.send-success {
  border-radius: 14px;
  border: 1px solid rgba(165, 122, 99, 0.22);
  background: rgba(255, 255, 255, 0.6);
  padding: 12px;
}

.send-success-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.send-success-actions {
  display: inline-flex;
  gap: 8px;
  flex-wrap: wrap;
}

.send-success-code {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.send-success-code code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.22);
  background: rgba(255, 255, 255, 0.7);
}

.send-success-footer {
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.common-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}

.common-list-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}

.common-entry {
  text-align: left;
  justify-content: flex-start;
  padding: 10px 12px;
  border-radius: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.common-entry-text {
  font-weight: 800;
}

.common-entry-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.95em;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid rgba(165, 122, 99, 0.22);
  background: rgba(255, 255, 255, 0.65);
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
