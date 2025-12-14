<script setup lang="ts">
import { RouterLink } from 'vue-router'

type Parcel = {
  id: string
  status: string
  desc: string
}

type QuickAction = {
  label: string
  to: string
}

const recentParcels: Parcel[] = [
  { id: 'P20241201', status: '配送中', desc: '高雄 → 台北，常溫宅配' },
  { id: 'P20241128', status: '已送達', desc: '高雄 → 台南，門市取件' },
]

const quickActions: QuickAction[] = [
  { label: '排程取件', to: '/customer/schedule' },
  { label: '寄件 / 建立訂單', to: '/customer/send' },
  { label: '追蹤包裹', to: '/customer/track' },
  { label: '查看帳務與付款', to: '/customer/payment' },
]
</script>

<template>
  <section class="page-shell">
    <header class="section-header">
      <h2>客戶總覽</h2>
      <p class="hint">快速查看最近包裹、帳務與常用操作。</p>
    </header>

    <div class="card-grid">
      <!-- 快速操作 -->

      <div class="card">
        <p class="eyebrow">快速操作</p>
        <div class="hero-actions">
          <RouterLink
            v-for="act in quickActions"
            :key="act.to"
            :to="act.to"
            class="primary-btn small-btn"
          >
            {{ act.label }}
          </RouterLink>
        </div>
      </div>

      <!-- 近期包裹 -->

      <div class="card">
        <p class="eyebrow">近期包裹</p>
        <ul class="task-list">
          <li v-for="p in recentParcels" :key="p.id">
            <strong>{{ p.id }}</strong>
            — {{ p.desc }}（{{ p.status }}）

          </li>
        </ul>
      </div>


      <!-- 帳務摘要 -->

      <div class="card">
        <p class="eyebrow">帳務摘要</p>
        <p>本期預估月結金額：$ 12,300</p>
        <p>待付款貨到付款件數：3 件</p>
        <p class="hint">實際金額與資料串接後可由後端計算填入。</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.task-list {
  margin-top: 8px;
  padding-left: 18px;
  font-size: 13px;
}
</style>
