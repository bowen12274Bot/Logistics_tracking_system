<script setup lang="ts">
import { reactive, ref } from 'vue'

const form = reactive({
  date: '',
  timeSlot: '',
  address: '',
  contactName: '',
  contactPhone: '',
  note: '',
})

const submittedMessage = ref('')

const handleSubmit = () => {
  submittedMessage.value = `已收到取件排程，日期：${form.date || '未填寫'}，時段：${form.timeSlot || '未選擇'}。`
}
</script>

<template>
  <section class="page-shell">
    <header class="section-header">
      <h2>排程取件</h2>
      <p class="hint">建立取件預約，司機會在指定時段前往收件地址。</p>
    </header>

    <div class="card">
      <form class="form-grid" @submit.prevent="handleSubmit">
        <label>
          取件日期
          <input v-model="form.date" type="date" />
        </label>

        <label>
          時段
          <select v-model="form.timeSlot">
            <option value="">請選擇時段</option>
            <option value="morning">上午 09:00–12:00</option>
            <option value="afternoon">下午 13:00–17:00</option>
            <option value="night">晚上 18:00–21:00</option>
          </select>
        </label>

        <label>
          取件地址
          <input v-model="form.address" type="text" placeholder="例：高雄市 XX 區 XX 路 XX 號" />
        </label>

        <label>
          聯絡人姓名
          <input v-model="form.contactName" type="text" />
        </label>

        <label>
          聯絡電話
          <input v-model="form.contactPhone" type="tel" />
        </label>

        <label class="full-width">
          備註說明
          <textarea
            v-model="form.note"
            rows="3"
            placeholder="例如：有電梯 / 重物需協助搬運…"
          />
        </label>

        <div class="form-actions">
          <button type="submit" class="primary-btn">送出排程（尚未串接）</button>
        </div>
      </form>
      <p class="hint">※ 目前為畫面骨架，未連接後端 API。</p>
      <p v-if="submittedMessage" class="hint">{{ submittedMessage }}</p>
    </div>
  </section>
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px 20px;
}

label {
  font-size: 14px;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

input,
select,
textarea {
  border-radius: 10px;
  border: 1px solid var(--border-color);
  padding: 8px 10px;
  font-size: 14px;
  font-family: inherit;
}

.full-width {
  grid-column: 1 / -1;
}

.form-actions {
  grid-column: 1 / -1;
  margin-top: 8px;
}
</style>
