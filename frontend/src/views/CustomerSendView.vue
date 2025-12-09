
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { api } from '../services/api'

type DeliveryTime = 'overnight' | 'two_day' | 'standard' | 'economy'
type PaymentMethod = 'cash' | 'credit_card' | 'online_bank' | 'monthly_billing' | 'third_party'

type PaymentType = 'prepaid' | 'cod'

const deliveryLabel: Record<DeliveryTime, string> = {
  overnight: '隔夜',
  two_day: '兩日',
  standard: '標準',
  economy: '經濟',
}

const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash: '現金',
  credit_card: '信用卡',
  online_bank: '網銀',
  monthly_billing: '月結',
  third_party: '第三方',
}

const paymentTypeLabel: Record<PaymentType, string> = {
  prepaid: '預付',
  cod: '到付',
}

const form = reactive({
  sender: '',
  receiver: '',
  weight: null as number | null,
  length: null as number | null,
  width: null as number | null,
  height: null as number | null,
  deliveryTime: 'standard' as DeliveryTime,
  paymentType: 'prepaid' as PaymentType,
  paymentMethod: 'credit_card' as PaymentMethod,
  dangerousMaterials: false,
  fragileItems: false,
  internationalShipments: false,
  pickupDate: '',
  pickupTimeWindow: '09:00-12:00',
  pickupNotes: '',
})

const confirmation = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

const submitPackage = async () => {
  confirmation.value = ''
  errorMessage.value = ''

  if (!form.weight || !form.length || !form.width || !form.height) {
    errorMessage.value = '請填寫重量與長寬高（需為正數）。'
    return
  }

  isSubmitting.value = true
  try {
    const response = await api.createPackage({
      sender: form.sender,
      receiver: form.receiver,
      weight: form.weight,
      size: `${form.length}x${form.width}x${form.height} cm`,
      delivery_time: form.deliveryTime,
      payment_type: form.paymentType,
      payment_method: form.paymentMethod,
      dangerous_materials: form.dangerousMaterials,
      fragile_items: form.fragileItems,
      international_shipments: form.internationalShipments,
      pickup_date: form.pickupDate,
      pickup_time_window: form.pickupTimeWindow,
      pickup_notes: form.pickupNotes,
      metadata: {
        delivery_time_label: deliveryLabel[form.deliveryTime],
        payment_type_label: paymentTypeLabel[form.paymentType],
        payment_method_label: paymentMethodLabel[form.paymentMethod],
        pickup_notes: form.pickupNotes,
      },
    })
    const tracking = response.package.tracking_number ?? response.package.id
    confirmation.value = `託運單已建立：追蹤號 ${tracking}｜體積 ${form.length}x${form.width}x${form.height} cm / ${deliveryLabel[form.deliveryTime]}，重量 ${form.weight} kg，付款：${paymentTypeLabel[form.paymentType]}（${paymentMethodLabel[form.paymentMethod]}），到府收件時間：${form.pickupDate || '未填日期'} ${form.pickupTimeWindow}`
  } catch (err: any) {
    errorMessage.value = err?.message || '建立寄件失敗，請稍後再試。'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">寄件</p>
      <h1>建立取件</h1>
      <p class="lede">一次填好寄件/收件、尺寸重量、付款與到府取件時間，就能產生追蹤號。</p>
    </header>

    <div class="card">
      <form class="form-grid" @submit.prevent="submitPackage">
        <label class="form-field">
          <span>寄件人</span>
          <input v-model="form.sender" required name="sender" type="text" placeholder="寄件人 user_id 或姓名" />
        </label>

        <label class="form-field">
          <span>收件人</span>
          <input v-model="form.receiver" required name="receiver" type="text" placeholder="收件人姓名或 ID" />
        </label>

        <label class="form-field">
          <span>重量 (kg)</span>
          <input v-model.number="form.weight" min="1" required name="weight" type="number" step="1" placeholder="請輸入重量" />
        </label>

        <div class="form-field">
          <span>尺寸 (cm)</span>
          <div class="inline" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">
            <input v-model.number="form.length" min="1" required name="length" type="number" placeholder="長" />
            <input v-model.number="form.width" min="1" required name="width" type="number" placeholder="寬" />
            <input v-model.number="form.height" min="1" required name="height" type="number" placeholder="高" />
          </div>
        </div>

        <label class="form-field">
          <span>配送時效</span>
          <select v-model="form.deliveryTime" name="deliveryTime">
            <option value="overnight">隔夜</option>
            <option value="two_day">兩日</option>
            <option value="standard">標準</option>
            <option value="economy">經濟</option>
          </select>
        </label>

        <label class="form-field">
          <span>付款類型</span>
          <select v-model="form.paymentType" name="paymentType">
            <option value="prepaid">預付</option>
            <option value="cod">到付</option>
          </select>
        </label>

        <label class="form-field">
          <span>付款方式</span>
          <select v-model="form.paymentMethod" name="paymentMethod">
            <option value="cash">現金</option>
            <option value="credit_card">信用卡</option>
            <option value="online_bank">網銀</option>
            <option value="monthly_billing">月結</option>
            <option value="third_party">第三方支付</option>
          </select>
        </label>

        <div class="form-field">
          <span>特殊標記選項</span>
          <div class="hint" style="display: flex; flex-direction: column; gap: 4px">
            <label><input v-model="form.dangerousMaterials" type="checkbox" /> 含危險品</label>
            <label><input v-model="form.fragileItems" type="checkbox" /> 易碎品</label>
            <label><input v-model="form.internationalShipments" type="checkbox" /> 國際件</label>
          </div>
        </div>

        <label class="form-field">
          <span>取件日期</span>
          <input v-model="form.pickupDate" type="date" name="pickupDate" />
        </label>

        <label class="form-field">
          <span>取件時段</span>
          <select v-model="form.pickupTimeWindow" name="pickupTimeWindow">
            <option value="09:00-12:00">09:00 - 12:00</option>
            <option value="12:00-15:00">12:00 - 15:00</option>
            <option value="15:00-18:00">15:00 - 18:00</option>
            <option value="18:00-21:00">18:00 - 21:00</option>
          </select>
        </label>

        <label class="form-field span-2">
          <span>取件備註</span>
          <textarea
            v-model="form.pickupNotes"
            rows="3"
            name="pickupNotes"
            placeholder="門禁、停車指引或易碎提醒"
          ></textarea>
        </label>

        <button class="primary-btn" type="button" style="background: transparent; color: inherit; border: 1px solid currentColor">
          查詢價格
        </button>
        <button class="primary-btn" type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? '建立中…' : '建立並排程' }}
        </button>
      </form>

      <p v-if="errorMessage" class="hint" style="color: #b00020">{{ errorMessage }}</p>
      <p v-if="confirmation" class="hint">{{ confirmation }}</p>
    </div>
  </section>
</template>
