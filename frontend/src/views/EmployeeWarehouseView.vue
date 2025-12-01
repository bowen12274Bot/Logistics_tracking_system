
<script setup lang="ts">
const responsibilities = [
  '包裹抵達轉運站或物流中心時掃描建檔。',
  '紀錄分揀事件與發往目的站的出站時間。',
  '交給司機前核對貨到付款件。',
]
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">員工 · 倉儲</p>
      <h1>站點與中心作業</h1>
      <p class="lede">紀錄包裹經過轉運站與物流中心的動態。</p>
    </header>

    <div class="card">
      <ul class="task-list">
        <li v-for="item in responsibilities" :key="item">{{ item }}</li>
      </ul>
    </div>
  </section>
</template>
