<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { api, type DeliveryTaskRecord, type DriverExceptionRecord, type VehicleRecord } from '../services/api'

const { t, locale } = useI18n()

const loading = ref(true)
const error = ref<string | null>(null)

const assigned = ref<DeliveryTaskRecord[]>([])
const handoff = ref<DeliveryTaskRecord[]>([])
const vehicle = ref<VehicleRecord | null>(null)
const exceptionReports = ref<DriverExceptionRecord[]>([])
const cargoList = ref<Array<{ package_id: string; tracking_number: string | null; package_status?: string | null; loaded_at: string | null }>>([])
const tab = ref<'assigned' | 'handoff'>('assigned')

const normalAssigned = computed(() =>
  assigned.value.filter((t) => String(t.package_status ?? '').trim().toLowerCase() !== 'exception'),
)
const list = computed(() => (tab.value === 'handoff' ? handoff.value : normalAssigned.value))

const fmtDate = (value?: string | number | Date | null) => {
  if (!value) return '--'
  const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : '--'
  return date.toLocaleString(locale.value === 'zh-TW' ? 'zh-TW' : 'en-US')
}

async function refresh() {
  loading.value = true
  error.value = null
  try {
    const [meRes, assignedRes, handoffRes, exceptionRes, cargoRes] = await Promise.all([
      api.getVehicleMe(),
      api.getDriverTasks('assigned'),
      api.getDriverTasks('handoff'),
      api.getDriverExceptionReports(100),
      api.getVehicleCargoMe(),
    ])
    vehicle.value = meRes.vehicle ?? null
    assigned.value = assignedRes.tasks ?? []
    handoff.value = handoffRes.tasks ?? []
    exceptionReports.value = exceptionRes.exceptions ?? []
    cargoList.value = cargoRes.cargo ?? []
  } catch (e: any) {
    error.value = String(e?.message ?? e)
  } finally {
    loading.value = false
  }
}

async function takeOver(taskId: string) {
  try {
    await api.acceptDriverTask(taskId)
    await refresh()
    tab.value = 'assigned'
  } catch (e: any) {
    error.value = String(e?.message ?? e)
  }
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">{{ t('driver.eyebrow') }}</p>
      <h1>{{ t('driver.title') }}</h1>
      <p class="lede" v-html="t('driver.lede')" />
    </header>

    <div class="card" style="margin-top: 16px">
      <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center">
        <button class="ghost-btn" type="button" @click="tab = 'assigned'">{{ t('driver.tabs.assigned') }}</button>
        <button class="ghost-btn" type="button" @click="tab = 'handoff'">{{ t('driver.tabs.handoff') }}</button>
        <button class="ghost-btn" type="button" @click="refresh">{{ t('driver.actions.refresh') }}</button>
        <RouterLink class="primary-btn" to="/driver/map">{{ t('driver.actions.map') }}</RouterLink>
      </div>

      <p v-if="error" class="hint" style="margin-top: 10px; color: #b91c1c">{{ error }}</p>
      <p v-else-if="loading" class="hint" style="margin-top: 10px">{{ t('driver.loading') }}</p>

      <div v-else style="margin-top: 14px">
        <p v-if="vehicle?.current_node_id" class="hint" style="margin-bottom: 10px">
          {{ t('driver.currentLocation', { node: vehicle.current_node_id }) }}
        </p>

        <p class="hint" style="margin-bottom: 10px">
          <span v-if="tab === 'assigned'">{{ t('driver.assignedCount', { count: normalAssigned.length }) }}</span>
          <span v-else>{{ t('driver.handoffCount', { count: handoff.length }) }}</span>
        </p>

        <div v-if="list.length === 0" class="hint">{{ t('driver.noTasks') }}</div>

        <ul v-else class="task-list">
          <li v-for="t in list" :key="t.id" style="display: grid; gap: 6px">
            <div style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap">
              <strong>{{ t.tracking_number ?? t.package_id }}</strong>
              <span class="hint">{{ t.status }} · {{ t.task_type }}</span>
            </div>
            <div class="hint">
              #{{ t.segment_index ?? '-' }}
              {{ t.from_location ?? t.sender_address ?? '-' }}
              ->
              {{ t.to_location ?? t.receiver_address ?? '-' }}
            </div>
            <div class="hint">
              {{ t.delivery_time ?? '-' }} · {{ t.payment_type ?? '-' }} · {{ t.estimated_delivery ?? '-' }}
            </div>
            <div v-if="t.instructions" class="hint">{{ t('driver.instructions', { text: t.instructions }) }}</div>
            <div v-if="tab === 'handoff'" style="display: flex; gap: 10px; flex-wrap: wrap">
              <button class="primary-btn small-btn" type="button" @click="takeOver(t.id)">{{ t('driver.takeOver') }}</button>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <div class="card" style="margin-top: 16px">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
        <div>
          <p class="eyebrow">{{ t('driver.exceptions.title') }}</p>
          <p class="hint" style="margin: 6px 0 0">{{ t('driver.exceptions.hint') }}</p>
        </div>
        <span class="hint">{{ t('driver.count', { count: exceptionReports.length }) }}</span>
      </div>

      <div v-if="exceptionReports.length === 0" class="hint" style="margin-top: 12px">{{ t('driver.exceptions.empty') }}</div>
      <ul v-else class="task-list" style="margin-top: 12px">
        <li v-for="r in exceptionReports" :key="r.id" style="display: grid; gap: 6px">
          <div style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap">
            <strong>{{ r.tracking_number ?? r.package_id }}</strong>
            <span class="hint">{{ r.handled ? t('driver.exceptions.handled') : t('driver.exceptions.pending') }}</span>
          </div>
          <div class="hint">
            {{ r.reason_code ?? t('driver.missing') }} · {{ r.description ?? '-' }}
          </div>
          <div class="hint">
            {{ t('driver.exceptions.reportedAt', { time: fmtDate(r.reported_at) }) }} ·
            {{ t('driver.exceptions.status', { status: r.package_status === 'exception' ? t('driver.exceptions.exception') : t('driver.exceptions.normal') }) }}
          </div>
        </li>
      </ul>
    </div>

    <div class="card" style="margin-top: 16px">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
        <div>
          <p class="eyebrow">{{ t('driver.cargo.title') }}</p>
          <p class="hint" style="margin: 6px 0 0">{{ t('driver.cargo.hint') }}</p>
        </div>
        <span class="hint">{{ t('driver.countItems', { count: cargoList.length }) }}</span>
      </div>

      <div v-if="cargoList.length === 0" class="hint" style="margin-top: 12px">{{ t('driver.cargo.empty') }}</div>
      <ul v-else class="task-list" style="margin-top: 12px">
        <li v-for="c in cargoList" :key="c.package_id" style="display: grid; gap: 6px">
          <div style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap">
            <strong>{{ c.tracking_number ?? c.package_id }}</strong>
            <span class="hint">{{ c.package_status === 'exception' ? t('driver.exceptions.exception') : t('driver.cargo.inTransit') }}</span>
          </div>
          <div class="hint">{{ t('driver.cargo.loadedAt', { time: fmtDate(c.loaded_at) }) }}</div>
        </li>
      </ul>
    </div>
  </section>
</template>
