<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api, type DeliveryTaskRecord, type DriverExceptionRecord, type VehicleRecord } from "../services/api";

const loading = ref(true);
const error = ref<string | null>(null);

const assigned = ref<DeliveryTaskRecord[]>([]);
const handoff = ref<DeliveryTaskRecord[]>([]);
const vehicle = ref<VehicleRecord | null>(null);
const exceptionReports = ref<DriverExceptionRecord[]>([]);
const cargoList = ref<Array<{ package_id: string; tracking_number: string | null; package_status?: string | null; loaded_at: string | null }>>([]);
const tab = ref<"assigned" | "handoff">("assigned");

const normalAssigned = computed(() =>
  assigned.value.filter((t) => String(t.package_status ?? "").trim().toLowerCase() !== "exception"),
);
const list = computed(() => {
  if (tab.value === "handoff") return handoff.value;
  return normalAssigned.value;
});

async function refresh() {
  loading.value = true;
  error.value = null;
  try {
    const [meRes, assignedRes, handoffRes, exceptionRes, cargoRes] = await Promise.all([
      api.getVehicleMe(),
      api.getDriverTasks("assigned"),
      api.getDriverTasks("handoff"),
      api.getDriverExceptionReports(100),
      api.getVehicleCargoMe(),
    ]);
    vehicle.value = meRes.vehicle ?? null;
    assigned.value = assignedRes.tasks ?? [];
    handoff.value = handoffRes.tasks ?? [];
    exceptionReports.value = exceptionRes.exceptions ?? [];
    cargoList.value = cargoRes.cargo ?? [];
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
      <h1>司機工作看板</h1>
      <p class="lede">管理任務段清單，並在 HUB/REG 節點接手任務。</p>
    </header>

    <div class="card" style="margin-top: 16px">
      <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center">
        <button class="ghost-btn" type="button" @click="tab = 'assigned'">任務清單</button>
        <button class="ghost-btn" type="button" @click="tab = 'handoff'">可接手任務</button>
        <button class="ghost-btn" type="button" @click="refresh">重新整理</button>
        <RouterLink class="primary-btn" to="/driver/map">前往司機地圖</RouterLink>
      </div>

      <p v-if="error" class="hint" style="margin-top: 10px; color: #b91c1c">{{ error }}</p>
      <p v-else-if="loading" class="hint" style="margin-top: 10px">載入中…</p>

      <div v-else style="margin-top: 14px">
        <p v-if="vehicle?.current_node_id" class="hint" style="margin-bottom: 10px">
          目前位置：{{ vehicle.current_node_id }}（只有在 HUB/REG 節點會出現可接手任務）
        </p>

        <p class="hint" style="margin-bottom: 10px">
          <span v-if="tab === 'assigned'">指派給我的任務段：{{ normalAssigned.length }}</span>
          <span v-else>可接手任務段：{{ handoff.length }}</span>
        </p>

        <div v-if="list.length === 0" class="hint">目前沒有任務</div>

        <ul v-else class="task-list">
          <li v-for="t in list" :key="t.id" style="display: grid; gap: 6px">
            <div style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap">
              <strong>{{ t.tracking_number ?? t.package_id }}</strong>
              <span class="hint">{{ t.status }} · {{ t.task_type }}</span>
            </div>
            <div class="hint">
              #{{ t.segment_index ?? "-" }}
              {{ t.from_location ?? t.sender_address ?? "-" }}
              →
              {{ t.to_location ?? t.receiver_address ?? "-" }}
            </div>
            <div class="hint">
              {{ t.delivery_time ?? "-" }} · {{ t.payment_type ?? "-" }} · {{ t.estimated_delivery ?? "-" }}
            </div>
            <div v-if="t.instructions" class="hint">客服指示：{{ t.instructions }}</div>
            <div v-if="tab === 'handoff'" style="display: flex; gap: 10px; flex-wrap: wrap">
              <button class="primary-btn small-btn" type="button" @click="takeOver(t.id)">接手任務</button>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <div class="card" style="margin-top: 16px">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
        <div>
          <p class="eyebrow">異常任務申報紀錄</p>
          <p class="hint" style="margin: 6px 0 0">已申報異常的包裹會列在此處。</p>
        </div>
        <span class="hint">共 {{ exceptionReports.length }} 筆</span>
      </div>

      <div v-if="exceptionReports.length === 0" class="hint" style="margin-top: 12px">目前沒有異常紀錄。</div>
      <ul v-else class="task-list" style="margin-top: 12px">
        <li v-for="r in exceptionReports" :key="r.id" style="display: grid; gap: 6px">
          <div style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap">
            <strong>{{ r.tracking_number ?? r.package_id }}</strong>
            <span class="hint">{{ r.handled ? "已處理" : "待處理" }}</span>
          </div>
          <div class="hint">
            {{ r.reason_code ?? "未填原因" }} · {{ r.description ?? "-" }}
          </div>
          <div class="hint">
            申報時間：{{ r.reported_at ?? "-" }} · 狀態：{{ r.package_status === "exception" ? "異常" : "正常" }}
          </div>
        </li>
      </ul>
    </div>

    <div class="card" style="margin-top: 16px">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
        <div>
          <p class="eyebrow">查看貨車</p>
          <p class="hint" style="margin: 6px 0 0">顯示目前車上的所有包裹（含異常）。</p>
        </div>
        <span class="hint">共 {{ cargoList.length }} 件</span>
      </div>

      <div v-if="cargoList.length === 0" class="hint" style="margin-top: 12px">目前車上沒有包裹。</div>
      <ul v-else class="task-list" style="margin-top: 12px">
        <li v-for="c in cargoList" :key="c.package_id" style="display: grid; gap: 6px">
          <div style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap">
            <strong>{{ c.tracking_number ?? c.package_id }}</strong>
            <span class="hint">{{ c.package_status === "exception" ? "異常" : "配送中" }}</span>
          </div>
          <div class="hint">上車時間：{{ c.loaded_at ?? "-" }}</div>
        </li>
      </ul>
    </div>
  </section>
</template>
