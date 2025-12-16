
<script setup lang="ts">
import { RouterLink } from "vue-router";

const routeHighlights = [
  '每台貨車固定在自己的區域與覆蓋環。',
  '取件路線：住家/門市 -> 轉運站 -> 物流中心。',
  '派送路線：物流中心 -> 轉運站 -> 住家/門市。',
  '紀錄事件：取件、上/下車、送達、異常。',
]
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">員工 · 司機</p>
      <h1>司機路線面板</h1>
      <p class="lede">查看指派路線、紀錄上下車與貨到付款。</p>
    </header>

    <div class="card">
      <ul class="task-list">
        <li v-for="item in routeHighlights" :key="item">{{ item }}</li>
      </ul>
    </div>

    <div class="card" style="margin-top: 16px">
      <RouterLink class="primary-btn" to="/driver/map">開啟司機地圖</RouterLink>
    </div>
  </section>
</template>
