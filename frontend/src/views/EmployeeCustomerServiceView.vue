
<script setup lang="ts">
const tasks = [
  '審核與核准合約申請',
  '協助客戶追蹤或付款問題',
  '調整月結週期或重發對帳單',
]
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">員工 · 客服</p>
      <h1>客服作業台</h1>
      <p class="lede">搜尋客戶、核准合約、處理帳務與追蹤問題。</p>
    </header>

    <div class="card">
      <ul class="task-list">
        <li v-for="task in tasks" :key="task">{{ task }}</li>
      </ul>
    </div>
  </section>
</template>
