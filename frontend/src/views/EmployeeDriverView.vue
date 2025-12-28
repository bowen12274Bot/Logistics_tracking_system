<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import { api, type DeliveryTaskRecord, type DriverExceptionRecord, type VehicleRecord } from "../services/api";
import UiCard from "../components/ui/UiCard.vue";
import UiList from "../components/ui/UiList.vue";
import UiNotice from "../components/ui/UiNotice.vue";
import UiPageShell from "../components/ui/UiPageShell.vue";
import { toastFromApiError } from "../services/errorToast";
import { formatDateTime, formatMoney } from "../utils/packageDisplay";

const { t } = useI18n();

const loading = ref(true);
const error = ref<string | null>(null);

const assigned = ref<DeliveryTaskRecord[]>([]);
const vehicle = ref<VehicleRecord | null>(null);
const exceptionReports = ref<DriverExceptionRecord[]>([]);
const cargoList = ref<Array<{ package_id: string; tracking_number: string | null; package_status?: string | null; loaded_at: string | null }>>([]);

const tasks = computed(() =>
  assigned.value.filter((t) => String(t.package_status ?? "").trim().toLowerCase() !== "exception"),
);

const cargoExceptionCount = computed(
  () => cargoList.value.filter((c) => String(c.package_status ?? "").trim().toLowerCase() === "exception").length,
);

function focusNodeIdForTask(task: DeliveryTaskRecord) {
  const status = String(task.status ?? "").trim().toLowerCase();
  const nodeId = status === "in_progress" ? task.to_location : task.from_location;
  return String(nodeId ?? "").trim() || null;
}

function mapLinkForTask(task: DeliveryTaskRecord) {
  const focus = focusNodeIdForTask(task);
  const query: Record<string, string> = { taskId: String(task.id) };
  if (focus) query.focus = focus;
  return { path: "/driver/map", query };
}

function paymentTypeLabel(task: DeliveryTaskRecord) {
  const raw = String(task.payment_type ?? "").trim().toLowerCase();
  if (!raw) return "-";
  if (raw === "cod") return t("driver.payment.type.cod");
  if (raw === "prepaid") return t("driver.payment.type.prepaid");
  return raw;
}

function paymentSummary(task: DeliveryTaskRecord) {
  const hasAny = Boolean(task.payment_type) || Boolean(task.payment_amount != null) || Boolean(task.paid_at);
  if (!hasAny) return null;

  const paid = Boolean(task.paid_at);
  const amount = Number(task.payment_amount);
  const due =
    !paid && Number.isFinite(amount) && amount > 0 ? t("driver.payment.due", { amount: formatMoney(amount) }) : null;

  return `${t("driver.payment.label")}：${paymentTypeLabel(task)} · ${paid ? t("driver.payment.paid") : (due ?? t("driver.payment.unpaid"))}`;
}

function paymentPill(task: DeliveryTaskRecord): { text: string; danger: boolean } | null {
  const hasAny = Boolean(task.payment_type) || Boolean(task.payment_amount != null) || Boolean(task.paid_at);
  if (!hasAny) return null;

  const paid = Boolean(task.paid_at);
  if (paid) return { text: t("driver.payment.paid"), danger: false };

  const amount = Number(task.payment_amount);
  if (Number.isFinite(amount) && amount > 0) {
    return { text: t("driver.payment.due", { amount: formatMoney(amount) }), danger: true };
  }

  return { text: t("driver.payment.unpaid"), danger: true };
}

async function refresh() {
  loading.value = true;
  error.value = null;
  try {
    const [meRes, assignedRes, exceptionRes, cargoRes] = await Promise.all([
      api.getVehicleMe(),
      api.getDriverTasks("assigned"),
      api.getDriverExceptionReports(100),
      api.getVehicleCargoMe(),
    ]);
    vehicle.value = meRes.vehicle ?? null;
    assigned.value = assignedRes.tasks ?? [];
    exceptionReports.value = exceptionRes.exceptions ?? [];
    cargoList.value = cargoRes.cargo ?? [];
  } catch (e: any) {
    error.value = String(e?.message ?? e);
    toastFromApiError(e, error.value ?? t("driver.errors.loadFailed"));
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <UiPageShell :eyebrow="t('driver.eyebrow')" :title="t('driver.title')" :lede="t('driver.lede')">
    <UiNotice v-if="error" tone="error" role="alert" style="margin-top: 10px">{{ error }}</UiNotice>

    <UiCard class="driver-overview-card" style="margin-top: 16px">
      <div class="driver-overview-head">
        <div>
          <p class="eyebrow" style="margin: 0">{{ t("driver.dashboard.summary.title") }}</p>
          <p class="hint" style="margin: 6px 0 0">
            {{ t("driver.vehicle.code", { code: vehicle?.vehicle_code ?? "-" }) }}
            ·
            {{ t("driver.vehicle.node", { node: vehicle?.current_node_id ?? "-" }) }}
          </p>
        </div>

        <div class="driver-overview-actions">
          <button class="ghost-btn small-btn" type="button" :disabled="loading" @click="refresh">
            {{ t("driver.actions.refresh") }}
          </button>
          <RouterLink class="primary-btn small-btn" to="/driver/map">{{ t("driver.actions.map") }}</RouterLink>
        </div>
      </div>

      <div class="driver-mini-stats" :aria-label="t('driver.dashboard.summary.title')">
        <div>
          <p class="eyebrow">{{ t("driver.dashboard.summary.tasks") }}</p>
          <p class="stat-value">{{ loading ? "..." : tasks.length }}</p>
        </div>
        <div>
          <p class="eyebrow">{{ t("driver.dashboard.summary.cargo") }}</p>
          <p class="stat-value">{{ loading ? "..." : cargoList.length }}</p>
          <p v-if="!loading && cargoExceptionCount > 0" class="hint" style="margin: 4px 0 0">
            {{ t("driver.vehicle.cargoExceptions", { count: cargoExceptionCount }) }}
          </p>
        </div>
        <div>
          <p class="eyebrow">{{ t("driver.dashboard.summary.exceptions") }}</p>
          <p class="stat-value">{{ loading ? "..." : exceptionReports.length }}</p>
        </div>
      </div>
    </UiCard>

    <UiCard style="margin-top: 16px">
      <div class="driver-section-header">
        <h2 style="margin: 0">{{ t("driver.dashboard.tasks.title") }}</h2>
      </div>

      <p v-if="loading" class="hint" style="margin: 0">{{ t("driver.loading") }}</p>
      <p v-else-if="tasks.length === 0" class="hint" style="margin: 0">{{ t("driver.noTasks") }}</p>

      <UiList v-else variant="plain" as="ul" class="driver-task-list">
        <li v-for="task in tasks" :key="task.id" class="driver-task-item">
          <div class="driver-task-main">
            <div class="driver-task-top">
              <p class="driver-task-title">
                {{ task.tracking_number ?? task.package_id }}
                <span
                  v-if="paymentPill(task)"
                  class="status-pill"
                  :class="{ danger: paymentPill(task)?.danger }"
                >
                  {{ paymentPill(task)?.text }}
                </span>
              </p>
              <span class="hint">#{{ task.segment_index ?? "-" }} · {{ task.status }} · {{ task.task_type }}</span>
            </div>

            <p class="hint" style="margin: 0">
              {{ task.from_location ?? task.sender_address ?? "-" }}
              →
              {{ task.to_location ?? task.receiver_address ?? "-" }}
            </p>
            <p v-if="paymentSummary(task)" class="hint" style="margin: 0">{{ paymentSummary(task) }}</p>
            <p v-if="task.instructions" class="hint" style="margin: 0">{{ t("driver.instructions", { text: task.instructions }) }}</p>
          </div>

          <div class="driver-task-actions">
            <RouterLink class="ghost-btn small-btn" :to="mapLinkForTask(task)">
              {{ t("driver.actions.depart") }}
            </RouterLink>
          </div>
        </li>
      </UiList>
    </UiCard>

    <div class="driver-panels" style="margin-top: 16px">
      <UiCard>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
          <div>
            <p class="eyebrow" style="margin: 0">{{ t("driver.exceptions.title") }}</p>
            <p class="hint" style="margin: 6px 0 0">{{ t("driver.exceptions.hint") }}</p>
          </div>
          <span class="hint">{{ t("driver.count", { count: exceptionReports.length }) }}</span>
        </div>

        <div v-if="exceptionReports.length === 0" class="hint" style="margin-top: 12px">
          {{ t("driver.exceptions.empty") }}
        </div>
        <UiList v-else style="margin-top: 12px">
          <li v-for="r in exceptionReports" :key="r.id" style="display: grid; gap: 6px">
            <div style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap">
              <strong>{{ r.tracking_number ?? r.package_id }}</strong>
              <span class="hint">{{ r.handled ? t("driver.exceptions.handled") : t("driver.exceptions.pending") }}</span>
            </div>
            <div class="hint">
              {{ r.reason_code ?? t("driver.missing") }} · {{ r.description ?? "-" }}
            </div>
            <div class="hint">
              {{ t("driver.exceptions.reportedAt", { time: formatDateTime(r.reported_at) }) }}
              ·
              {{
                t("driver.exceptions.status", {
                  status: r.package_status === "exception" ? t("driver.exceptions.exception") : t("driver.exceptions.normal"),
                })
              }}
            </div>
          </li>
        </UiList>
      </UiCard>

      <UiCard>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
          <div>
            <p class="eyebrow" style="margin: 0">{{ t("driver.cargo.title") }}</p>
            <p class="hint" style="margin: 6px 0 0">{{ t("driver.cargo.hint") }}</p>
          </div>
          <span class="hint">{{ t("driver.countItems", { count: cargoList.length }) }}</span>
        </div>

        <div v-if="cargoList.length === 0" class="hint" style="margin-top: 12px">{{ t("driver.cargo.empty") }}</div>
        <UiList v-else style="margin-top: 12px">
          <li v-for="c in cargoList" :key="c.package_id" style="display: grid; gap: 6px">
            <div style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap">
              <strong>{{ c.tracking_number ?? c.package_id }}</strong>
              <span class="hint">
                {{ c.package_status === "exception" ? t("driver.exceptions.exception") : t("driver.cargo.inTransit") }}
              </span>
            </div>
            <div class="hint">{{ t("driver.cargo.loadedAt", { time: formatDateTime(c.loaded_at) }) }}</div>
          </li>
        </UiList>
      </UiCard>
    </div>
  </UiPageShell>
</template>

<style scoped>
.stat-value {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: #3f2620;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(72, 187, 120, 0.16);
  border: 1px solid rgba(72, 187, 120, 0.28);
  color: rgba(28, 79, 54, 0.95);
  font-weight: 800;
  font-size: 12px;
  white-space: nowrap;
}

.status-pill.danger {
  background: rgba(161, 60, 60, 0.12);
  border-color: rgba(161, 60, 60, 0.25);
  color: rgba(114, 34, 34, 0.95);
}

.driver-overview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.driver-overview-actions {
  display: inline-flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.driver-mini-stats {
  margin-top: 14px;
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.driver-mini-stats > div {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.16);
  background: rgba(255, 255, 255, 0.55);
}

.driver-section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.driver-task-list {
  margin-top: 10px;
}

.driver-task-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 8px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.16);
  background: rgba(255, 255, 255, 0.55);
}

.driver-task-main {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.driver-task-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.driver-task-title {
  margin: 0;
  font-weight: 800;
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.driver-task-actions {
  flex-shrink: 0;
}

.driver-panels {
  display: grid;
  gap: 12px;
}

@media (min-width: 980px) {
  .driver-panels {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}
</style>
