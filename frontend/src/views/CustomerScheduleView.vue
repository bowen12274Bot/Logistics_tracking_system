
<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">排程</p>
      <h1>預約取件</h1>
      <p class="lede">已併入「建立託運單」流程，請在寄件時一併填寫取件日期/時段。</p>
    </header>

    <div class="card">
      <p class="hint">
        前往 <RouterLink to="/customer/send">建立託運單</RouterLink> 時即可同時填寫取件日期、時段與備註。
      </p>
    </div>
  </section>
</template>
