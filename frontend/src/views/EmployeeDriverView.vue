
<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">員工 · 司機</p>
      <h1>司機工作面板</h1>
      <p class="lede">查看配送任務清單、決定配送路徑、紀錄上下車事件、收取到付款。</p>
    </header>

    <div class="card" style="margin-top: 16px">
      <RouterLink class="primary-btn" to="/driver/map">開啟司機地圖</RouterLink>
    </div>
  </section>
</template>
