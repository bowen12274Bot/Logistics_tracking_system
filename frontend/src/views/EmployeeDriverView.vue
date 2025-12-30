<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { api, type DeliveryTaskRecord, type DriverExceptionRecord, type VehicleRecord } from "../services/api";
import UiCard from "../components/ui/UiCard.vue";
import UiList from "../components/ui/UiList.vue";
import UiPageShell from "../components/ui/UiPageShell.vue";
import UiButton from "../components/ui/UiButton.vue";
import UiNotice from "../components/ui/UiNotice.vue";
import { selectableReasonsFor } from "../lib/exceptionReasons";
import { toastFromApiError } from "../services/errorToast";
import { formatDateTime, formatMoney } from "../utils/packageDisplay";

const { t, locale } = useI18n();
const router = useRouter();

const loading = ref(true);
const error = ref<string | null>(null);

const assigned = ref<DeliveryTaskRecord[]>([]);
const vehicle = ref<VehicleRecord | null>(null);
const exceptionReports = ref<DriverExceptionRecord[]>([]);
const cargoList = ref<Array<{ package_id: string; tracking_number: string | null; package_status?: string | null; loaded_at: string | null }>>([]);

const tasks = computed(() =>
  assigned.value.filter((t) => String(t.package_status ?? "").trim().toLowerCase() !== "exception"),
);

const sortedExceptionReports = computed(() =>
  exceptionReports.value
    .slice()
    .sort((a, b) => String(b.reported_at ?? "").localeCompare(String(a.reported_at ?? ""))),
);

const pendingExceptionReports = computed(() => sortedExceptionReports.value.filter((r) => !r.handled));
const handledExceptionReports = computed(() => sortedExceptionReports.value.filter((r) => Boolean(r.handled)));

const exceptionReasonKeyByCode = new Map(
  selectableReasonsFor("driver").map((r) => [String(r.code), String(r.i18nKey)] as const),
);

function exceptionReasonLabel(code: unknown) {
  const raw = String(code ?? "").trim();
  if (!raw) return t("driver.missing");
  const key = exceptionReasonKeyByCode.get(raw);
  if (key) return t(key);
  return t("exception.reason.unknownWithCode", { code: raw });
}

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
//${paymentTypeLabel(task)} ·
  return `${t("driver.payment.label")}： ${paid ? t("driver.payment.paid") : (due ?? t("driver.payment.unpaid"))}`;
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
    // 優化：使用聚合 Dashboard API，減少 4 個調用為 1 個 + 1 個
    const [dashboard, exceptionRes] = await Promise.all([
      api.getDriverDashboard(),
      api.getDriverExceptionReports(100),
    ]);
    vehicle.value = dashboard.vehicle ?? null;
    assigned.value = dashboard.assigned_tasks ?? [];
    cargoList.value = dashboard.cargo ?? [];
    exceptionReports.value = exceptionRes.exceptions ?? [];
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
    <UiCard class="driver-map-card" style="margin-top: 12px">
      <button class="driver-map-card__btn" type="button" @click="router.push('/driver/map')">
        <div class="driver-map-card__head">
          <div class="driver-map-card__main">
            <p class="eyebrow" style="margin: 0">{{ t("driver.mapCard.eyebrow") }}</p>
            <h2 class="driver-map-card__title">{{ t("driver.mapCard.title") }}</h2>
            <p class="hint" style="margin: 6px 0 0">{{ t("driver.mapCard.hint") }}</p>
          </div>

          <span class="driver-map-card__chevron" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path
                d="M8 5l5 5-5 5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
        </div>

        <div class="driver-map-card__bullets" aria-label="driver map highlights">
          <span class="driver-map-card__bullet">{{ t("driver.mapCard.bullet.move") }}</span>
          <span class="driver-map-card__bullet">{{ t("driver.mapCard.bullet.navigate") }}</span>
          <span class="driver-map-card__bullet">{{ t("driver.mapCard.bullet.actions") }}</span>
        </div>
      </button>
    </UiCard>

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
          <UiButton icon="refresh" variant="ghost" size="small" :disabled="loading" @click="refresh">
            {{ t("driver.actions.refresh") }}
          </UiButton>
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

    <UiCard class="driver-card driver-card--tasks" style="margin-top: 16px">
      <div class="driver-section-header">
        <h2 style="margin: 0">{{ t("driver.dashboard.tasks.title") }}</h2>
      </div>

      <p v-if="loading" class="hint" style="margin: 0">{{ t("driver.loading") }}</p>
      <div v-else-if="tasks.length === 0" class="driver-empty">
        <p class="driver-empty-title">{{ t("driver.noTasks") }}</p>
        <p class="hint" style="margin: 6px 0 0">{{ t("driver.emptyTasks.hint") }}</p>
        <ul class="driver-empty-list">
          <li class="hint">{{ t("driver.emptyTasks.tip.refresh") }}</li>
          <li class="hint">{{ t("driver.emptyTasks.tip.map") }}</li>
          <li class="hint">{{ t("driver.emptyTasks.tip.handoff") }}</li>
        </ul>
      </div>

      <div v-else class="driver-scroll driver-scroll--tasks">
        <UiList variant="plain" as="ul" class="driver-task-list">
          <li v-for="task in tasks" :key="task.id" class="driver-task-item">
            <div class="driver-task-main">
              <div class="driver-task-top">
                <p class="driver-task-title">
                  {{ task.tracking_number ?? task.package_id }}
                  <span v-if="paymentPill(task)" class="status-pill" :class="{ danger: paymentPill(task)?.danger }">
                    {{ paymentPill(task)?.text }}
                  </span>
                </p>
              </div>

              <p class="hint" style="margin: 0">
                {{ task.from_location ?? task.sender_address ?? "-" }}
                →
                {{ task.to_location ?? task.receiver_address ?? "-" }}
              </p>
              <p v-if="paymentSummary(task)" class="hint" style="margin: 0">{{ paymentSummary(task) }}</p>
              <p v-if="task.instructions" class="hint driver-wrap" style="margin: 0">
                {{ t("driver.instructions", { text: task.instructions }) }}
              </p>
            </div>

            <div class="driver-task-actions">
              <RouterLink class="ghost-btn small-btn" :to="mapLinkForTask(task)">
                {{ t("driver.actions.depart") }}
              </RouterLink>
            </div>
          </li>
        </UiList>
      </div>
    </UiCard>

    <div class="driver-panels" style="margin-top: 16px">
      <UiCard class="driver-card driver-card--exceptions">
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
        <div v-else class="driver-scroll driver-scroll--exceptions" style="margin-top: 12px">
          <div v-if="pendingExceptionReports.length > 0" class="driver-subsection">
            <div class="driver-subhead">
              <strong>{{ t("driver.exceptions.pending") }}</strong>
              <span class="hint">{{ t("driver.count", { count: pendingExceptionReports.length }) }}</span>
            </div>
            <UiList variant="plain" class="driver-exception-list">
              <li v-for="r in pendingExceptionReports" :key="r.id" class="driver-exception-item">
                <div class="driver-exception-top">
                  <strong class="driver-exception-title">{{ r.tracking_number ?? r.package_id }}</strong>
                  <span class="status-pill danger">{{ t("driver.exceptions.pending") }}</span>
                </div>
                <div class="hint driver-wrap">
                  {{ exceptionReasonLabel(r.reason_code) }}
                  <template v-if="r.description"> · {{ r.description }}</template>
                </div>
                <div class="hint">
                  {{ t("driver.exceptions.reportedAt", { time: formatDateTime(r.reported_at, locale) }) }}
                  ·
                  {{
                    t("driver.exceptions.status", {
                      status: r.package_status === "exception" ? t("driver.exceptions.exception") : t("driver.exceptions.normal"),
                    })
                  }}
                </div>
              </li>
            </UiList>
          </div>

          <div v-if="handledExceptionReports.length > 0" class="driver-subsection">
            <div class="driver-subhead">
              <strong>{{ t("driver.exceptions.handled") }}</strong>
              <span class="hint">{{ t("driver.count", { count: handledExceptionReports.length }) }}</span>
            </div>
            <UiList variant="plain" class="driver-exception-list">
              <li v-for="r in handledExceptionReports" :key="r.id" class="driver-exception-item">
                <div class="driver-exception-top">
                  <strong class="driver-exception-title">{{ r.tracking_number ?? r.package_id }}</strong>
                  <span class="status-pill">{{ t("driver.exceptions.handled") }}</span>
                </div>
                <div class="hint driver-wrap">
                  {{ exceptionReasonLabel(r.reason_code) }}
                  <template v-if="r.description"> · {{ r.description }}</template>
                </div>
                <div class="hint">
                  {{ t("driver.exceptions.reportedAt", { time: formatDateTime(r.reported_at, locale) }) }}
                  ·
                  {{
                    t("driver.exceptions.status", {
                      status: r.package_status === "exception" ? t("driver.exceptions.exception") : t("driver.exceptions.normal"),
                    })
                  }}
                </div>
              </li>
            </UiList>
          </div>
        </div>
      </UiCard>

      <UiCard class="driver-card driver-card--cargo">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
          <div>
            <p class="eyebrow" style="margin: 0">{{ t("driver.cargo.title") }}</p>
            <p class="hint" style="margin: 6px 0 0">{{ t("driver.cargo.hint") }}</p>
          </div>
          <span class="hint">{{ t("driver.countItems", { count: cargoList.length }) }}</span>
        </div>

        <div v-if="cargoList.length === 0" class="hint" style="margin-top: 12px">{{ t("driver.cargo.empty") }}</div>
        <div v-else class="driver-scroll driver-scroll--cargo" style="margin-top: 12px">
          <UiList variant="plain" class="driver-cargo-list">
            <li v-for="c in cargoList" :key="c.package_id" class="driver-cargo-item">
              <div class="driver-exception-top">
                <strong class="driver-exception-title">{{ c.tracking_number ?? c.package_id }}</strong>
                <span class="hint">
                  {{ c.package_status === "exception" ? t("driver.exceptions.exception") : t("driver.cargo.inTransit") }}
                </span>
              </div>
              <div class="hint">{{ t("driver.cargo.loadedAt", { time: formatDateTime(c.loaded_at, locale) }) }}</div>
            </li>
          </UiList>
        </div>
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

.driver-map-card {
  position: relative;
  overflow: hidden;
  transition: border-color 140ms ease, transform 140ms ease;
  border-color: rgba(165, 122, 99, 0.28);
  background: rgba(255, 255, 255, 0.55);
}

.driver-map-card::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: rgba(165, 122, 99, 0.28);
}

.driver-map-card__btn {
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  display: grid;
  gap: 10px;
  position: relative;
}

.driver-map-card:hover {
  border-color: rgba(165, 122, 99, 0.32);
  transform: translateY(-1px);
}

.driver-map-card:focus-within {
  outline: 2px solid rgba(165, 122, 99, 0.35);
  outline-offset: 2px;
}

.driver-map-card__head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.driver-map-card__main {
  flex: 1;
  min-width: 0;
}

.driver-map-card__chevron {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(165, 122, 99, 0.16);
  color: rgba(63, 38, 32, 0.62);
}

.driver-map-card__chevron svg {
  width: 18px;
  height: 18px;
}

.driver-map-card__title {
  margin: 2px 0 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.driver-map-card__bullets {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.driver-map-card__bullet {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(165, 122, 99, 0.16);
  font-weight: 700;
  font-size: 12px;
  color: rgba(63, 38, 32, 0.92);
  white-space: nowrap;
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

.driver-section-header h2 {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
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
  letter-spacing: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.driver-task-actions {
  flex-shrink: 0;
}

.driver-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.driver-scroll {
  overflow: auto;
  min-height: 0;
}

.driver-scroll--tasks {
  margin-top: 10px;
  max-height: clamp(240px, 44vh, 560px);
}

.driver-empty {
  margin-top: 12px;
  border: 1px dashed rgba(165, 122, 99, 0.22);
  background: rgba(255, 255, 255, 0.45);
  border-radius: 14px;
  padding: 12px;
}

.driver-empty-title {
  margin: 0;
  font-weight: 800;
  font-size: 14px;
  color: rgba(63, 38, 32, 0.92);
}

.driver-empty-list {
  margin: 10px 0 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
}

.driver-scroll--exceptions,
.driver-scroll--cargo {
  max-height: clamp(220px, 38vh, 460px);
}

.driver-subsection + .driver-subsection {
  margin-top: 12px;
}

.driver-subhead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 2px 2px 6px;
}

.driver-exception-list,
.driver-cargo-list {
  display: grid;
  gap: 10px;
}

.driver-exception-item,
.driver-cargo-item {
  display: grid;
  gap: 6px;
  padding: 10px 8px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.16);
  background: rgba(255, 255, 255, 0.55);
  min-width: 0;
}

.driver-exception-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  align-items: baseline;
  min-width: 0;
}

.driver-exception-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.driver-wrap {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.driver-panels {
  display: grid;
  gap: 12px;
}

@media (min-width: 980px) {
  .driver-panels {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
  }

  .driver-panels > .driver-card {
    height: 100%;
  }
}
</style>
