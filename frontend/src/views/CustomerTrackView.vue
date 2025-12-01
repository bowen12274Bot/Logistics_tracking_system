
<script setup lang="ts">
import { ref } from 'vue'

const trackingNumber = ref('')
const status = ref<string | null>(null)

const lookup = () => {
  status.value = trackingNumber.value
    ? `追蹤 ${trackingNumber.value}：模擬中，位於轉運站與物流中心之間。`
    : null
}
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">追蹤</p>
      <h1>包裹追蹤</h1>
      <p class="lede">從取件到簽收的事件都可查詢。</p>
    </header>

    <div class="card">
      <form class="form-grid" @submit.prevent="lookup">
        <label class="form-field span-2">
          <span>追蹤號碼</span>
          <input
            v-model="trackingNumber"
            required
            name="trackingNumber"
            type="text"
            placeholder="例如 LOGI-2024-000123"
          />
        </label>

        <button class="primary-btn" type="submit">查詢包裹</button>
      </form>

      <p v-if="status" class="hint">{{ status }}</p>
    </div>
  </section>
</template>
