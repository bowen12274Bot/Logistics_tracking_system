
<script setup lang="ts">
import { reactive, ref } from 'vue'

type Size = 'envelope' | 'small' | 'medium' | 'large'
type DeliveryTime = 'overnight' | 'two_day' | 'standard' | 'economy'
type PaymentMethod = 'cash' | 'credit_card' | 'online_bank' | 'monthly_billing' | 'third_party'

type PaymentType = 'prepaid' | 'cod'

const sizeLabel: Record<Size, string> = {
  envelope: '文件',
  small: '小型',
  medium: '中型',
  large: '大型',
}

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
  size: 'medium' as Size,
  deliveryTime: 'standard' as DeliveryTime,
  paymentType: 'prepaid' as PaymentType,
  paymentMethod: 'credit_card' as PaymentMethod,
})

const confirmation = ref('')

const submitPackage = () => {
  confirmation.value = `草稿已建立：${sizeLabel[form.size]} / ${deliveryLabel[form.deliveryTime]}，付款：${paymentTypeLabel[form.paymentType]}（${paymentMethodLabel[form.paymentMethod]}）`
}
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">寄件</p>
      <h1>建立託運單</h1>
      <p class="lede">選擇服務級距、付款方式，填寫寄件/收件資訊以產生追蹤號。</p>
    </header>

    <div class="card">
      <form class="form-grid" @submit.prevent="submitPackage">
        <label class="form-field">
          <span>寄件人</span>
          <input v-model="form.sender" required name="sender" type="text" placeholder="寄件人姓名或 ID" />
        </label>

        <label class="form-field">
          <span>收件人</span>
          <input v-model="form.receiver" required name="receiver" type="text" placeholder="收件人姓名或 ID" />
        </label>

        <label class="form-field">
          <span>尺寸</span>
          <select v-model="form.size" name="size">
            <option value="envelope">文件</option>
            <option value="small">小型</option>
            <option value="medium">中型</option>
            <option value="large">大型</option>
          </select>
        </label>

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
            <option value="third_party">第三方</option>
          </select>
        </label>

        <button class="primary-btn" type="submit">產生草稿</button>
      </form>

      <p v-if="confirmation" class="hint">{{ confirmation }}</p>
    </div>
  </section>
</template>
