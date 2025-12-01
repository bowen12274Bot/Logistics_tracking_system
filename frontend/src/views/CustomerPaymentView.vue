
<script setup lang="ts">
import { ref } from 'vue'

type PaymentMode = 'prepaid' | 'cod' | 'monthly_billing'

const selectedMode = ref<PaymentMode>('prepaid')
const note = ref('請選擇付款模式以查看說明。')

const updateNote = () => {
  if (selectedMode.value === 'prepaid') {
    note.value = '預付：先付款即可安排取件與路線。'
  } else if (selectedMode.value === 'cod') {
    note.value = '貨到付款：司機於派送時收款，請通知收件人準備。'
  } else {
    note.value = '月結：合約客戶的貨件在周期內累計收費。'
  }
}

updateNote()
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">付款</p>
      <h1>貨件付款</h1>
      <p class="lede">依合約選擇預付、貨到付款或月結。</p>
    </header>

    <div class="card">
      <div class="form-grid">
        <label class="form-field span-2">
          <span>付款模式</span>
          <select v-model="selectedMode" name="paymentMode" @change="updateNote">
            <option value="prepaid">預付</option>
            <option value="cod">貨到付款</option>
            <option value="monthly_billing">月結（限合約客戶）</option>
          </select>
        </label>
      </div>

      <p class="hint">{{ note }}</p>
    </div>
  </section>
</template>
