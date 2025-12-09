
<script setup lang="ts">
import { RouterLink } from 'vue-router'

const quickLinks = [
  { title: '建立寄件', to: '/customer/send', description: '設定寄件人/收件人、配送速度與付款方式。' },
  { title: '包裹追蹤', to: '/customer/track', description: '查看站點、車輛、物流中心的即時狀態。' },
  { title: '合約 / 月結', to: '/customer/contract', description: '申請或管理月結合約。' },
  { title: '付款', to: '/customer/payment', description: '支付預付、貨到付款或月結帳單。' },
]
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">客戶</p>
      <h1>你的包裹主控台</h1>
      <p class="lede">監控每件貨態、快速寄件，並以月結讓帳務更可預期。</p>
    </header>

    <div class="card-grid">
      <RouterLink v-for="link in quickLinks" :key="link.to" :to="link.to" class="card link-card">
        <div>
          <p class="eyebrow">{{ link.title }}</p>
          <p class="hint">{{ link.description }}</p>
        </div>
        <span aria-hidden="true">&rarr;</span>
      </RouterLink>
    </div>
  </section>
</template>
