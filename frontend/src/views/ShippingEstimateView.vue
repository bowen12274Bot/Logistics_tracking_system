<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../services/api'
import type { PackageEstimatePayload, PackageEstimateResponse, SpecialMark } from '../services/api'
import UiCard from '../components/ui/UiCard.vue'
import UiPageShell from '../components/ui/UiPageShell.vue'
import { useToasts } from '../components/ui/toast'
import { toastFromApiError } from '../services/errorToast'

type DeliveryType = PackageEstimatePayload['deliveryType']
type BoxType = PackageEstimateResponse['estimate']['box_type']

// 用於 fallback（API 失敗時）保持與客戶端相同邏輯的計算常數
const K = 5200
const INTERNATIONAL_MULTIPLIER = 1.8
const baseFee: Record<BoxType, number> = { envelope: 30, S: 70, M: 110, L: 160 }
const ratePerCost: Record<BoxType, number> = { envelope: 90, S: 170, M: 260, L: 380 }
const serviceMultiplier: Record<DeliveryType, number> = {
  economy: 1,
  standard: 1.25,
  two_day: 1.55,
  overnight: 2,
}
const minPrice: Record<BoxType, Record<DeliveryType, number>> = {
  envelope: { economy: 50, standard: 70, two_day: 90, overnight: 120 },
  S: { economy: 120, standard: 160, two_day: 210, overnight: 280 },
  M: { economy: 200, standard: 260, two_day: 340, overnight: 450 },
  L: { economy: 320, standard: 420, two_day: 550, overnight: 750 },
}
const maxPrice: Record<BoxType, Record<DeliveryType, number>> = {
  envelope: { economy: 400, standard: 550, two_day: 700, overnight: 950 },
  S: { economy: 900, standard: 1200, two_day: 1500, overnight: 1900 },
  M: { economy: 1400, standard: 1850, two_day: 2350, overnight: 2900 },
  L: { economy: 2200, standard: 2900, two_day: 3700, overnight: 4600 },
}
const includedWeightKg: Record<BoxType, number> = { envelope: 0.5, S: 3, M: 10, L: 25 }
const perKgFee: Record<BoxType, number> = { envelope: 0, S: 18, M: 15, L: 12 }

const form = reactive({
  fromNodeId: '',
  toNodeId: '',
  weightKg: 1,
  lengthCm: 30,
  widthCm: 20,
  heightCm: 10,
  deliveryType: 'standard' as DeliveryType,
  specialMarks: {
    dangerous: false,
    fragile: false,
    international: false,
  },
})

const loading = ref(false)
const error = ref('')
const routeCost = ref<number | null>(null)
const fallbackUsed = ref(false)
const result = ref<PackageEstimateResponse['estimate'] | null>(null)
const lastSpecialMarks = ref<SpecialMark[]>([])
const toast = useToasts()
const lastSnapshot = reactive<{
  billableWeightKg: number
  volumetricWeightKg: number
  boxType: BoxType | null
}>({
  billableWeightKg: 0,
  volumetricWeightKg: 0,
  boxType: null,
})

const volumetricWeightKg = computed(() => {
  const vol = (form.lengthCm || 0) * (form.widthCm || 0) * (form.heightCm || 0)
  return vol / 6000
})

const billableWeightKg = computed(() => Math.max(form.weightKg || 0, volumetricWeightKg.value))

const boxType = computed<BoxType | null>(() => pickBoxType(form.lengthCm, form.widthCm, form.heightCm, billableWeightKg.value))
const { t } = useI18n()

function boxTypeLabel(type: BoxType | null): string {
  if (!type) return ''
  const labels: Record<BoxType, string> = {
    envelope: '信封',
    S: '小型',
    M: '中型',
    L: '大型',
  }
  return labels[type] || type
}

function deliveryTypeLabel(type: DeliveryType): string {
  const labels: Record<DeliveryType, string> = {
    economy: '經濟',
    standard: '標準',
    two_day: '兩日',
    overnight: '隔日',
  }
  return labels[type] || type
}

function pickBoxType(l: number, w: number, h: number, billableWeight: number): BoxType | null {
  const dims = [l, w, h].sort((a, b) => b - a) // d1 >= d2 >= d3
  const d1 = dims[0] ?? 0
  const d2 = dims[1] ?? 0
  const d3 = dims[2] ?? 0
  if (d1 <= 30 && d3 <= 2 && billableWeight <= 0.5) return 'envelope'
  if (d1 <= 40 && d2 <= 30 && d3 <= 20 && billableWeight <= 5) return 'S'
  if (d1 <= 60 && d2 <= 40 && d3 <= 40 && billableWeight <= 20) return 'M'
  if (d1 <= 90 && d2 <= 60 && d3 <= 60 && billableWeight <= 50) return 'L'
  return null
}

async function fetchRouteCost(fromId: string, toId: string): Promise<{ cost: number; fallback: boolean }> {
  try {
    const res = await fetch(`/api/map/route?from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(toId)}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const cost = data?.route?.total_cost ?? data?.total_cost
    if (typeof cost === 'number') return { cost, fallback: false }
    throw new Error('missing total_cost')
  } catch (_e) {
    return { cost: 5200, fallback: true }
  }
}

function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max)
}

function calculatePrice({
  routeCost,
  deliveryType,
  boxType,
  billableWeightKg,
  specialMarks,
  fromNodeId,
  toNodeId,
}: {
  routeCost: number
  deliveryType: DeliveryType
  boxType: BoxType
  billableWeightKg: number
  specialMarks: SpecialMark[]
  fromNodeId: string
  toNodeId: string
}): PackageEstimateResponse['estimate'] {
  const routeCostNorm = clamp(routeCost / K, 0.3, 1.6)
  const base = baseFee[boxType] + routeCostNorm * ratePerCost[boxType]
  const shippingBase = Math.ceil(base * serviceMultiplier[deliveryType])

  const weightSurcharge = Math.max(0, Math.ceil(billableWeightKg - includedWeightKg[boxType])) * perKgFee[boxType]

  let subtotal = shippingBase + weightSurcharge
  const internationalApplied = specialMarks.includes('international')
  if (internationalApplied) {
    subtotal = Math.ceil(subtotal * INTERNATIONAL_MULTIPLIER)
  }

  const markFee = (specialMarks.includes('dangerous') ? 120 : 0) + (specialMarks.includes('fragile') ? 60 : 0)
  const calculatedPrice = subtotal + markFee
  const floor = minPrice[boxType][deliveryType]
  const cap = maxPrice[boxType][deliveryType]
  const finalPrice = Math.min(Math.max(calculatedPrice, floor), cap)

  return {
    fromNodeId,
    toNodeId,
    route_cost: routeCost,
    route_path: [],
    route_cost_norm: routeCostNorm,
    box_type: boxType,
    base,
    shipping: shippingBase,
    weight_surcharge: weightSurcharge,
    international_multiplier_applied: internationalApplied ? INTERNATIONAL_MULTIPLIER : 1,
    mark_fee: markFee,
    calculated_price: calculatedPrice,
    min_price: floor,
    max_price: cap,
    total_cost: finalPrice,
    estimated_delivery_date: '',
  }
}

async function handleSubmit() {
  error.value = ''
  result.value = null
  routeCost.value = null
  fallbackUsed.value = false
  lastSpecialMarks.value = []
  lastSnapshot.billableWeightKg = billableWeightKg.value
  lastSnapshot.volumetricWeightKg = volumetricWeightKg.value
  lastSnapshot.boxType = boxType.value

  if (!form.fromNodeId || !form.toNodeId) {
    error.value = t('estimate.error.missingNodes')
    toast.warning(error.value)
    return
  }
  if (form.fromNodeId === form.toNodeId) {
    error.value = '起點和終點不能相同，請選擇不同的地點。'
    toast.warning(error.value)
    return
  }
  if (!boxType.value) {
    error.value = t('estimate.error.boxType')
    toast.warning(error.value)
    return
  }

  loading.value = true
  try {
    const payload: PackageEstimatePayload = {
      fromNodeId: form.fromNodeId,
      toNodeId: form.toNodeId,
      weightKg: form.weightKg,
      dimensionsCm: { length: form.lengthCm, width: form.widthCm, height: form.heightCm },
      deliveryType: form.deliveryType,
      specialMarks: Object.entries(form.specialMarks)
        .filter(([, v]) => v)
        .map(([k]) => k as SpecialMark),
    }

    const res = await api.estimatePackage(payload)
    routeCost.value = res.estimate.route_cost
    result.value = res.estimate
    lastSpecialMarks.value = payload.specialMarks ?? []
  } catch (e: any) {
    error.value = e?.message ?? t('estimate.error.failed')
    try {
      const { cost, fallback } = await fetchRouteCost(form.fromNodeId, form.toNodeId)
      routeCost.value = cost
      fallbackUsed.value = fallback
      const specialMarks = Object.entries(form.specialMarks)
        .filter(([, v]) => v)
        .map(([k]) => k as SpecialMark)
      lastSpecialMarks.value = specialMarks
      result.value = calculatePrice({
        routeCost: cost,
        deliveryType: form.deliveryType,
        boxType: boxType.value!,
        billableWeightKg: billableWeightKg.value,
        specialMarks,
        fromNodeId: form.fromNodeId,
        toNodeId: form.toNodeId,
      })
      if (fallbackUsed.value) {
        error.value = t('estimate.fallback')
      }
    } catch (_fallbackErr) {
      toastFromApiError(e, error.value)
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UiPageShell
    :eyebrow="t('estimate.title')"
    :title="t('estimate.title')"
    :lede="t('estimate.lede')"
  >
    <UiCard class="estimator">
      <!-- Location Section -->
      <div class="form-section">
        <h3 class="section-title">{{ t('estimate.from') }} / {{ t('estimate.to') }}</h3>
        <div class="section-grid two-col">
          <div class="field">
            <label>{{ t('estimate.from') }}</label>
            <input v-model="form.fromNodeId" :placeholder="t('estimate.fromPlaceholder')" />
          </div>
          <div class="field">
            <label>{{ t('estimate.to') }}</label>
            <input v-model="form.toNodeId" :placeholder="t('estimate.toPlaceholder')" />
          </div>
        </div>
      </div>

      <!-- Package Details Section -->
      <div class="form-section">
        <h3 class="section-title">{{ t('estimate.weight') }} / {{ t('estimate.dimensions') }}</h3>
        <div class="section-grid">
          <div class="field">
            <label>{{ t('estimate.weight') }}</label>
            <input v-model.number="form.weightKg" type="number" min="0" step="0.1" />
            <p class="info-text">
              <span class="label">計費重量：</span>
              <span class="result-value">{{ billableWeightKg.toFixed(2) }} kg</span>
            </p>
          </div>
          
          <div class="field">
            <label>{{ t('estimate.dimensions') }}</label>
            <div class="triple">
              <input v-model.number="form.lengthCm" type="number" min="0" step="1" :placeholder="t('estimate.lengthPlaceholder')" />
              <input v-model.number="form.widthCm" type="number" min="0" step="1" :placeholder="t('estimate.widthPlaceholder')" />
              <input v-model.number="form.heightCm" type="number" min="0" step="1" :placeholder="t('estimate.heightPlaceholder')" />
            </div>
            <p class="info-text">
              <span class="label">材積重量：</span>
              <span class="result-value">{{ volumetricWeightKg.toFixed(2) }} kg</span>
            </p>
          </div>
        </div>
        
        <div class="box-type-display" :class="{ invalid: !boxType }">
          <span class="label">箱型：</span>
          <span class="box-value" v-if="boxType">{{ boxTypeLabel(boxType) }}</span>
          <span class="box-value invalid" v-else>{{ t('estimate.boxOutOfRange') }}</span>
          <span v-if="!boxType" class="hint">{{ t('estimate.boxAdjustHint') }}</span>
        </div>
      </div>

      <!-- Delivery Options Section -->
      <div class="form-section">
        <h3 class="section-title">{{ t('estimate.deliveryType') }} / {{ t('estimate.marks') }}</h3>
        <div class="section-grid two-col">
          <div class="field">
            <label>{{ t('estimate.deliveryType') }}</label>
            <select v-model="form.deliveryType">
              <option value="economy">{{ t('estimate.deliveryTypeOptions.economy') }}</option>
              <option value="standard">{{ t('estimate.deliveryTypeOptions.standard') }}</option>
              <option value="two_day">{{ t('estimate.deliveryTypeOptions.twoDay') }}</option>
              <option value="overnight">{{ t('estimate.deliveryTypeOptions.overnight') }}</option>
            </select>
          </div>

          <div class="field">
            <label>{{ t('estimate.marks') }}</label>
            <div class="chips">
              <label class="chip">
                <input v-model="form.specialMarks.dangerous" type="checkbox" />
                <span>{{ t('estimate.mark.dangerous') }}</span>
              </label>
              <label class="chip">
                <input v-model="form.specialMarks.fragile" type="checkbox" />
                <span>{{ t('estimate.mark.fragile') }}</span>
              </label>
              <label class="chip">
                <input v-model="form.specialMarks.international" type="checkbox" />
                <span>{{ t('estimate.mark.international') }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="actions">
        <button class="primary-btn" type="button" :disabled="loading" @click="handleSubmit">
          {{ loading ? t('estimate.loading') : t('estimate.cta') }}
        </button>
        <span v-if="fallbackUsed" class="hint">{{ t('estimate.error.apiFallback') }}</span>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <!-- Result Section -->
      <div v-if="result" class="result card">
        <header class="result-head">
          <h3>{{ t('estimate.result.title') }}</h3>
          <span class="pill total-pill">{{ t('estimate.result.total', { amount: result.total_cost }) }}</span>
        </header>
        <div class="grid">
          <div>
            <p class="eyebrow">{{ t('estimate.section.route') }}</p>
            <p>{{ t('estimate.routeCost', { cost: result.route_cost }) }}</p>
            <p>{{ t('estimate.routeCostNorm', { value: result.route_cost_norm.toFixed(2) }) }}</p>
          </div>
          <div>
            <p class="eyebrow">{{ t('estimate.section.box') }}</p>
            <p>箱型：{{ boxTypeLabel(lastSnapshot.boxType ?? result.box_type) }}</p>
            <p>
              {{ t('estimate.billableLabel', { billable: lastSnapshot.billableWeightKg.toFixed(2), volumetric: lastSnapshot.volumetricWeightKg.toFixed(2) }) }}
            </p>
          </div>
          <div>
            <p class="eyebrow">{{ t('estimate.section.service') }}</p>
            <p>{{ t('estimate.base', { value: result.base.toFixed(2) }) }}</p>
            <p>配送型態：{{ deliveryTypeLabel(form.deliveryType) }}</p>
            <p>{{ t('estimate.shippingBase', { value: result.shipping }) }}</p>
          </div>
          <div>
            <p class="eyebrow">{{ t('estimate.section.surcharge') }}</p>
            <p>{{ t('estimate.weightSurcharge', { value: result.weight_surcharge }) }}</p>
            <p>{{ t('estimate.international', { value: result.international_multiplier_applied > 1 ? t('estimate.boolean.yes') : t('estimate.boolean.no') }) }}</p>
            <p>{{ t('estimate.markFee', { value: result.mark_fee }) }}</p>
          </div>
          <div>
            <p class="eyebrow">{{ t('estimate.section.floorcap') }}</p>
            <p>{{ t('estimate.subtotal', { value: result.calculated_price }) }}</p>
            <p>{{ t('estimate.floorcapValues', { floor: result.min_price, cap: result.max_price }) }}</p>
            <p>{{ t('estimate.final', { value: result.total_cost }) }}</p>
          </div>
          <div>
            <p class="eyebrow">{{ t('estimate.section.marks') }}</p>
            <p>{{ lastSpecialMarks.length ? lastSpecialMarks.join(', ') : t('estimate.marksNone') }}</p>
          </div>
        </div>
      </div>
    </UiCard>
  </UiPageShell>
</template>

<style scoped>
.estimator {
  display: grid;
  gap: 20px;
  padding: 20px;
  max-width: auto;
  margin: 0 auto;
}

/* Form Sections */
.form-section {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(165, 122, 99, 0.15);
}

.section-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 700;
  color: rgba(165, 122, 99, 0.9);
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(165, 122, 99, 0.12);
}

.section-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: 1fr;
}

.section-grid.two-col {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

/* Fields */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-weight: 700;
  font-size: 14px;
  color: var(--text-main);
}

.field input,
.field select {
  padding: 11px 14px;
  border: 1px solid var(--surface-stroke);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  font-size: 14px;
  transition: all 0.2s ease;
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: rgba(244, 182, 194, 0.6);
  box-shadow: 0 0 0 3px rgba(244, 182, 194, 0.15);
}

.triple {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

/* Info Text (inline calculations) */
.info-text {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin: 4px 0 0 0;
  padding: 8px 12px;
  background: rgba(244, 182, 194, 0.1);
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.4;
}

.info-text .label {
  font-weight: 600;
  color: rgba(165, 122, 99, 0.8);
}

.info-text .value {
  color: #666;
  font-style: italic;
}

.info-text .result-value {
  margin-left: auto;
  font-weight: 700;
  color: rgba(165, 122, 99, 1);
  padding: 3px 10px;
  background: rgba(244, 182, 194, 0.25);
  border-radius: 6px;
}

/* Box Type Display */
.box-type-display {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(244, 182, 194, 0.15);
  border: 1px solid rgba(244, 182, 194, 0.3);
  border-radius: 12px;
  margin-top: 8px;
}

.box-type-display.invalid {
  background: rgba(255, 200, 200, 0.15);
  border-color: rgba(200, 100, 100, 0.3);
}

.box-type-display .label {
  font-weight: 600;
  font-size: 14px;
  color: rgba(165, 122, 99, 0.8);
}

.box-type-display .box-value {
  font-weight: 800;
  font-size: 16px;
  color: rgba(165, 122, 99, 1);
  padding: 4px 12px;
  background: rgba(244, 182, 194, 0.3);
  border-radius: 8px;
}

.box-type-display .box-value.invalid {
  color: #a13c3c;
  background: rgba(255, 200, 200, 0.3);
}

.box-type-display .hint {
  margin-left: auto;
  font-size: 12px;
  color: #a13c3c;
  font-style: italic;
}

/* Chips (checkboxes) */
.chips {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.25);
  background: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
}

.chip:hover {
  background: rgba(244, 182, 194, 0.15);
  border-color: rgba(244, 182, 194, 0.4);
}

.chip input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.chip span {
  font-size: 14px;
  font-weight: 500;
}

/* Actions */
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 8px;
}

.primary-btn {
  padding: 12px 24px;
  border-radius: 12px;
  border: 1px solid rgba(244, 182, 194, 0.4);
  background: linear-gradient(135deg, rgba(244, 182, 194, 0.5), rgba(255, 164, 164, 0.4));
  cursor: pointer;
  font-weight: 700;
  font-size: 15px;
  transition: all 0.2s ease;
}

.primary-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(244, 182, 194, 0.7), rgba(255, 164, 164, 0.6));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(244, 182, 194, 0.3);
}

.primary-btn:active:not(:disabled) {
  transform: translateY(0);
}

.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint {
  font-size: 13px;
  color: #666;
  font-style: italic;
}

.error {
  color: #c0392b;
  font-weight: 700;
  padding: 12px 16px;
  background: rgba(255, 200, 200, 0.2);
  border-radius: 10px;
  border: 1px solid rgba(200, 100, 100, 0.3);
}

/* Result Section */
.result {
  border: 1px solid rgba(165, 122, 99, 0.2);
  padding: 18px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.9);
  margin-top: 8px;
}

.result-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(165, 122, 99, 0.15);
  flex-wrap: wrap;
}

.result-head h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(244, 182, 194, 0.28);
  border: 1px solid rgba(244, 182, 194, 0.4);
  font-size: 14px;
  font-weight: 600;
}

.total-pill {
  background: linear-gradient(135deg, rgba(244, 182, 194, 0.5), rgba(255, 164, 164, 0.4));
  border-color: rgba(244, 182, 194, 0.6);
  font-weight: 700;
  font-size: 15px;
}

.grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.grid > div {
  padding: 14px;
  border-radius: 12px;
  background: rgba(244, 182, 194, 0.08);
  border: 1px solid rgba(244, 182, 194, 0.2);
}

.grid > div p {
  margin: 6px 0;
  line-height: 1.5;
  font-size: 14px;
}

.grid > div p.eyebrow {
  margin-top: 0;
  margin-bottom: 10px;
  font-weight: 700;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(165, 122, 99, 0.8);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .section-grid.two-col {
    grid-template-columns: 1fr;
  }
  
  .triple {
    grid-template-columns: 1fr;
  }
  
  .result-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
