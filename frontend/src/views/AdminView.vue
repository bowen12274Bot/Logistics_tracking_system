
<script setup lang="ts">
const adminAreas = [
  '服務規則與計價（尺寸、時效、特殊標記）',
  '虛擬地圖設定（中心、站點、門市、住家、車輛）',
  '使用者角色與權限控管',
  '帳務維護，例如重新產生月結週期',
]
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">管理</p>
      <h1>平台設定</h1>
      <p class="lede">管理服務規則、地圖位置、使用者與維護任務。</p>
    </header>

    <div class="card">
      <ul class="task-list">
        <li v-for="item in adminAreas" :key="item">{{ item }}</li>
      </ul>
    </div>
  </section>
</template>
