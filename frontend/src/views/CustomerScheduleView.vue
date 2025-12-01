
<script setup lang="ts">
import { reactive, ref } from 'vue'

const form = reactive({
  pickupType: 'home',
  date: '',
  timeWindow: '09:00-12:00',
  notes: '',
})

const confirmation = ref('')

const submitSchedule = () => {
  const typeLabel = form.pickupType === 'home' ? '到府取件' : '門市寄件'
  confirmation.value = `已預約 ${form.date} (${form.timeWindow})，方式：${typeLabel}`
}
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">排程</p>
      <h1>預約取件</h1>
      <p class="lede">預訂到府收件或告知會在合作門市寄件。</p>
    </header>

    <div class="card">
      <form class="form-grid" @submit.prevent="submitSchedule">
        <label class="form-field">
          <span>取件類型</span>
          <select v-model="form.pickupType" name="pickupType">
            <option value="home">到府取件</option>
            <option value="store">門市寄件</option>
          </select>
        </label>

        <label class="form-field">
          <span>日期</span>
          <input v-model="form.date" type="date" name="date" required />
        </label>

        <label class="form-field">
          <span>時間區間</span>
          <select v-model="form.timeWindow" name="timeWindow">
            <option value="09:00-12:00">09:00 - 12:00</option>
            <option value="12:00-15:00">12:00 - 15:00</option>
            <option value="15:00-18:00">15:00 - 18:00</option>
            <option value="18:00-21:00">18:00 - 21:00</option>
          </select>
        </label>

        <label class="form-field span-2">
          <span>給司機的備註</span>
          <textarea
            v-model="form.notes"
            rows="3"
            name="notes"
            placeholder="門禁、停車指引或易碎提醒"
          ></textarea>
        </label>

        <button class="primary-btn" type="submit">確認預約</button>
      </form>

      <p v-if="confirmation" class="hint">{{ confirmation }}</p>
    </div>
  </section>
</template>
