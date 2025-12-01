
<script setup lang="ts">
import { ref } from 'vue'

const status = ref('審核中')
const message = ref('申請月結後，由客服審核並啟用。')

const applyForContract = () => {
  status.value = '已送出'
  message.value = '合約申請已送出，客服即將審核。'
}
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">合約</p>
      <h1>月結資格</h1>
      <p class="lede">只有合約客戶可以使用月結付款。</p>
    </header>

    <div class="card">
      <div class="stack">
        <p class="hint">
          狀態：<strong>{{ status }}</strong>
        </p>
        <p>{{ message }}</p>
      </div>

      <button class="primary-btn" type="button" @click="applyForContract">
        提出申請
      </button>
    </div>
  </section>
</template>
