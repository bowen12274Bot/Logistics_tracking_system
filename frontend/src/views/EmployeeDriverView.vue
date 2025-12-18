<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api, type DeliveryTaskRecord, type VehicleRecord } from "../services/api";

const loading = ref(true);
const error = ref<string | null>(null);

const assigned = ref<DeliveryTaskRecord[]>([]);
const handoff = ref<DeliveryTaskRecord[]>([]);
const vehicle = ref<VehicleRecord | null>(null);
const tab = ref<"assigned" | "handoff">("assigned");

const list = computed(() => (tab.value === "assigned" ? assigned.value : handoff.value));

async function refresh() {
  loading.value = true;
  error.value = null;
  try {
    const [meRes, assignedRes, handoffRes] = await Promise.all([
      api.getVehicleMe(),
      api.getDriverTasks("assigned"),
      api.getDriverTasks("handoff"),
    ]);
    vehicle.value = meRes.vehicle ?? null;
    assigned.value = assignedRes.tasks ?? [];
    handoff.value = handoffRes.tasks ?? [];
  } catch (e: any) {
    error.value = String(e?.message ?? e);
  } finally {
    loading.value = false;
  }
}

async function takeOver(taskId: string) {
  try {
    await api.acceptDriverTask(taskId);
    await refresh();
    tab.value = "assigned";
  } catch (e: any) {
    error.value = String(e?.message ?? e);
  }
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">員工 · 司機</p>
      <h1>司機工作面板</h1>
      <p class="lede">查看分段任務清單，並在 HUB/REG 節點接手任務。</p>
    </header>

    <div class="card" style="margin-top: 16px">
      <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center">
        <button class="ghost-btn" type="button" @click="tab = 'assigned'">任務清單</button>
        <button class="ghost-btn" type="button" @click="tab = 'handoff'">可接手任務</button>
        <button class="ghost-btn" type="button" @click="refresh">重新整理</button>
        <RouterLink class="primary-btn" to="/driver/map">開啟司機地圖</RouterLink>
      </div>

      <p v-if="error" class="hint" style="margin-top: 10px; color: #b91c1c">{{ error }}</p>
      <p v-else-if="loading" class="hint" style="margin-top: 10px">載入中…</p>

      <div v-else style="margin-top: 14px">
        <p v-if="vehicle?.current_node_id" class="hint" style="margin-bottom: 10px">
          目前位置：{{ vehicle.current_node_id }}（只有在 HUB/REG 才會出現可接手任務）
        </p>
        <p class="hint" style="margin-bottom: 10px">
          <span v-if="tab === 'assigned'">指派給我的任務段：{{ assigned.length }}</span>
          <span v-else>可接手任務段：{{ handoff.length }}</span>
        </p>

        <div v-if="list.length === 0" class="hint">目前沒有任務。</div>

        <ul v-else class="task-list">
          <li v-for="t in list" :key="t.id" style="display: grid; gap: 6px">
            <div style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap">
              <strong>{{ t.tracking_number ?? t.package_id }}</strong>
              <span class="hint">{{ t.status }} · {{ t.task_type }}</span>
            </div>
            <div class="hint">
              #{{ t.segment_index ?? "-" }} {{ t.from_location ?? t.sender_address ?? "-" }} →
              {{ t.to_location ?? t.receiver_address ?? "-" }}
            </div>
            <div class="hint">
              {{ t.delivery_time ?? "-" }} · {{ t.payment_type ?? "-" }} · {{ t.estimated_delivery ?? "-" }}
            </div>
            <div v-if="tab === 'handoff'" style="display: flex; gap: 10px; flex-wrap: wrap">
              <button class="primary-btn small-btn" type="button" @click="takeOver(t.id)">接手任務</button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
