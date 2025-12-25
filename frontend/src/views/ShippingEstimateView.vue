<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { api } from '../services/api'
import type { PackageEstimatePayload, PackageEstimateResponse, SpecialMark } from '../services/api'

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

const volumetricWeightKg = computed(() => {
  const vol = (form.lengthCm || 0) * (form.widthCm || 0) * (form.heightCm || 0)
  return vol / 6000
})

const billableWeightKg = computed(() => Math.max(form.weightKg || 0, volumetricWeightKg.value))

const boxType = computed<BoxType | null>(() => pickBoxType(form.lengthCm, form.widthCm, form.heightCm, billableWeightKg.value))

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

  if (!form.fromNodeId || !form.toNodeId) {
    error.value = '請輸入起訖節點 ID（fromNodeId / toNodeId）。'
    return
  }
  if (!boxType.value) {
    error.value = '尺寸或重量超出可服務範圍，無法判定箱型。'
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
    error.value = e?.message ?? '試算失敗，請稍後再試。改用 fallback 試算。'
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
        error.value = 'API 失敗，已暫用 mock 5200 試算。'
      }
    } catch (_fallbackErr) {
      // 保持 error 訊息
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="page-shell">
    <header class="section-header">
      <h2>計算運費</h2>
      <p class="hint">依地圖 routeCost 估價，含箱型判定、時效係數、重量加價、特殊標記、floor/cap。</p>
    </header>

    <div class="card estimator">
      <div class="form-grid">
        <div class="field">
          <label>起點 fromNodeId</label>
          <input v-model="form.fromNodeId" placeholder="例：HUB_0" />
        </div>
        <div class="field">
          <label>終點 toNodeId</label>
          <input v-model="form.toNodeId" placeholder="例：END_12" />
        </div>

        <div class="field">
          <label>實重 (kg)</label>
          <input v-model.number="form.weightKg" type="number" min="0" step="0.1" />
          <p class="hint">billable = max(實重, 材積重)</p>
        </div>
        <div class="field">
          <label>長 × 寬 × 高 (cm)</label>
          <div class="triple">
            <input v-model.number="form.lengthCm" type="number" min="0" step="1" placeholder="長" />
            <input v-model.number="form.widthCm" type="number" min="0" step="1" placeholder="寬" />
            <input v-model.number="form.heightCm" type="number" min="0" step="1" placeholder="高" />
          </div>
          <p class="hint">材積重 = L×W×H / 6000</p>
        </div>

        <div class="field">
          <label>配送型態</label>
          <select v-model="form.deliveryType">
            <option value="economy">economy (1.00)</option>
            <option value="standard">standard (1.25)</option>
            <option value="two_day">two_day (1.55)</option>
            <option value="overnight">overnight (2.00)</option>
          </select>
        </div>

        <div class="field">
          <label>特殊標記（可複選）</label>
          <div class="chips">
            <label class="chip">
              <input v-model="form.specialMarks.dangerous" type="checkbox" />
              <span>dangerous +120</span>
            </label>
            <label class="chip">
              <input v-model="form.specialMarks.fragile" type="checkbox" />
              <span>fragile +60</span>
            </label>
            <label class="chip">
              <input v-model="form.specialMarks.international" type="checkbox" />
              <span>international ×1.8</span>
            </label>
          </div>
        </div>
      </div>

      <div class="derived">
        <div class="pill">材積重：{{ volumetricWeightKg.toFixed(2) }} kg</div>
        <div class="pill">計費重量：{{ billableWeightKg.toFixed(2) }} kg</div>
        <div class="pill">
          箱型：{{ boxType || '超出規格' }}
          <span v-if="!boxType" class="hint">請調整尺寸/重量</span>
        </div>
      </div>

      <div class="actions">
        <button class="primary-btn" type="button" :disabled="loading" @click="handleSubmit">
          {{ loading ? '計算中…' : '估算運費' }}
        </button>
        <span v-if="fallbackUsed" class="hint">連線失敗，暫用 routeCost=5200 mock。</span>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div v-if="result" class="result card">
        <header class="result-head">
          <h3>試算結果</h3>
          <span class="pill">應收：{{ result.total_cost }} 元</span>
        </header>
        <div class="grid">
          <div>
            <p class="eyebrow">路線成本</p>
            <p>routeCost: {{ result.route_cost }}</p>
            <p>routeCostNorm (clamp 0.3~1.6): {{ result.route_cost_norm.toFixed(2) }}</p>
          </div>
          <div>
            <p class="eyebrow">箱型與重量</p>
            <p>箱型: {{ result.box_type }}</p>
            <p>billable 重量: {{ billableWeightKg.toFixed(2) }} kg (材積 {{ volumetricWeightKg.toFixed(2) }} kg)</p>
          </div>
          <div>
            <p class="eyebrow">基礎與時效</p>
            <p>base: {{ result.base.toFixed(2) }}</p>
            <p>配送型態: {{ form.deliveryType }}</p>
            <p>shipping 基礎: {{ result.shipping }}</p>
          </div>
          <div>
            <p class="eyebrow">加價</p>
            <p>重量加價: {{ result.weight_surcharge }}</p>
            <p>國際件×1.8: {{ result.international_multiplier_applied > 1 ? '是' : '否' }}</p>
            <p>標記加價 (危/碎): {{ result.mark_fee }}</p>
          </div>
          <div>
            <p class="eyebrow">floor / cap</p>
            <p>subtotal: {{ result.calculated_price }}</p>
            <p>floor: {{ result.min_price }}，cap: {{ result.max_price }}</p>
            <p>final: {{ result.total_cost }}</p>
          </div>
          <div>
            <p class="eyebrow">特殊標記</p>
            <p>{{ lastSpecialMarks.length ? lastSpecialMarks.join(', ') : '無' }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.estimator {
  display: grid;
  gap: 16px;
  padding: 18px;
  max-width: 1100px;
  margin: 0 auto;
}

.form-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-weight: 700;
}

.field input,
.field select {
  padding: 10px 12px;
  border: 1px solid var(--surface-stroke);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
}

.triple {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.chips {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.25);
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.derived {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  max-width: 1100px;
  margin: 0 auto;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(244, 182, 194, 0.28);
  border: 1px solid rgba(244, 182, 194, 0.4);
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  max-width: 1100px;
  margin: 0 auto;
}

.primary-btn {
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(244, 182, 194, 0.55);
  cursor: pointer;
}

.error {
  color: #c0392b;
  font-weight: 700;
}

.result {
  border: 1px solid rgba(165, 122, 99, 0.2);
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.9);
  max-width: 1100px;
  margin: 0 auto;
}

.result-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}
</style>
