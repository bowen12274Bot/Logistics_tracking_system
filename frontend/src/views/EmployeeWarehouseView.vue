
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch, watchEffect } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import { api, type WarehouseExceptionRecord, type WarehousePackageRecord } from "../services/api";
import { useFullscreen } from "../composables/useFullscreen";
import { exceptionReasonLabel, selectableReasonsFor } from "../lib/exceptionReasons";
import UiCard from "../components/ui/UiCard.vue";
import UiList from "../components/ui/UiList.vue";
import UiModal from "../components/ui/UiModal.vue";
import UiNotice from "../components/ui/UiNotice.vue";
import UiPageShell from "../components/ui/UiPageShell.vue";
import { useToasts } from "../components/ui/toast";
import { toastFromApiError } from "../services/errorToast";

type WarehouseTab = "await_receive" | "sorting" | "dispatched";

const loading = ref(true);
const busy = ref(false);
const error = ref<string | null>(null);
const toast = useToasts();
const { t } = useI18n();

const activeTab = ref<WarehouseTab>("await_receive");

const mainStageEl = ref<HTMLElement | null>(null);
const {
  isSupported: mainFullscreenSupported,
  isFullscreen: mainIsFullscreen,
  toggle: toggleMainFullscreen,
} = useFullscreen(mainStageEl);

const warehouseNodeId = ref<string | null>(null);
const neighbors = ref<string[]>([]);
const packages = ref<WarehousePackageRecord[]>([]);
const exceptionReports = ref<WarehouseExceptionRecord[]>([]);

const receiveSelection = reactive<Record<string, boolean>>({});
const nextHopByPackageId = reactive<Record<string, string>>({});

const awaitingReceive = computed(() => packages.value.filter((p) => p.ui_state === "await_receive"));
const sorting = computed(() => packages.value.filter((p) => p.ui_state === "sorting"));
const dispatched = computed(() => packages.value.filter((p) => p.ui_state === "dispatched"));
const warehouseTotalCount = computed(() => awaitingReceive.value.length + sorting.value.length + dispatched.value.length);

const tabContext = computed(() => {
  if (activeTab.value === "await_receive") {
    return {
      title: t("warehouse.section.receive.title"),
      hint: t("warehouse.section.receive.hint"),
    };
  }
  if (activeTab.value === "sorting") {
    return {
      title: t("warehouse.section.sorting.title"),
      hint: t("warehouse.section.sorting.hint"),
    };
  }
  return {
    title: t("warehouse.section.dispatched.title"),
    hint: t("warehouse.section.dispatched.hint"),
  };
});

const exceptionModalOpen = ref(false);
const exceptionTarget = ref<WarehousePackageRecord | null>(null);
const exceptionReasons = computed(() =>
  selectableReasonsFor("warehouse_staff").map((r) => ({ code: r.code, label: exceptionReasonLabel(r.code, t) })),
);
const exceptionForm = reactive({ reason_code: "", description: "" });
const exceptionSubmitError = ref<string | null>(null);

const selectedReceiveIds = computed(() =>
  awaitingReceive.value.map((p) => p.id).filter((id) => receiveSelection[id]),
);

const allReceiveChecked = computed(() => {
  const list = awaitingReceive.value;
  if (list.length === 0) return false;
  return list.every((p) => Boolean(receiveSelection[p.id]));
});

function toggleReceiveAll() {
  const value = !allReceiveChecked.value;
  for (const p of awaitingReceive.value) receiveSelection[p.id] = value;
}

function ensureNextHopDefaults(pkgs: WarehousePackageRecord[], neighborIds: string[]) {
  const keep = new Set(pkgs.map((p) => p.id));
  for (const id of Object.keys(nextHopByPackageId)) {
    if (!keep.has(id)) delete nextHopByPackageId[id];
  }
}

function groupPackagesByNextHop(list: WarehousePackageRecord[]) {
  const groups = new Map<string, WarehousePackageRecord[]>();
  for (const n of neighbors.value) groups.set(n, []);
  for (const p of list) {
    const hop = nextHopByPackageId[p.id];
    if (!hop) continue;
    if (!groups.has(hop)) groups.set(hop, []);
    groups.get(hop)!.push(p);
  }
  return groups;
}

const sortingGroups = computed(() => groupPackagesByNextHop(sorting.value));

function currentHopForPackageId(id: string) {
  return String(nextHopByPackageId[id] ?? "").trim();
}

function isValidNeighbor(id: string) {
  const key = String(id ?? "").trim();
  if (!key) return false;
  return neighbors.value.includes(key);
}

const unassignedSelection = reactive<Record<string, boolean>>({});

const unassignedSortingPackages = computed(() =>
  sorting.value.filter((p) => !isValidNeighbor(currentHopForPackageId(p.id))),
);

const selectedUnassignedIds = computed(() =>
  unassignedSortingPackages.value.map((p) => p.id).filter((id) => unassignedSelection[id]),
);

const selectedUnassignedPackages = computed(() => {
  const set = new Set(selectedUnassignedIds.value);
  if (set.size === 0) return [];
  return unassignedSortingPackages.value.filter((p) => set.has(p.id));
});

const singleSelectedUnassignedPackage = computed(() => {
  const list = selectedUnassignedPackages.value;
  if (list.length !== 1) return null;
  return list[0] ?? null;
});

const assignHintText = computed(() => {
  const count = selectedUnassignedIds.value.length;
  if (count === 0) return t("warehouse.sorting.hints.dragToAssign.noneSelected");
  return t("warehouse.sorting.hints.dragToAssign.selected", { count });
});

const suggestedDistribution = computed(() => {
  const counts = new Map<string, number>();
  for (const p of selectedUnassignedPackages.value) {
    const suggested = String(p.suggested_to_node_id ?? "").trim();
    if (!suggested) continue;
    counts.set(suggested, (counts.get(suggested) ?? 0) + 1);
  }
  const items = Array.from(counts.entries())
    .map(([id, count]) => ({ id, count, valid: isValidNeighbor(id) }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  const primary = items.find((i) => i.valid) ?? null;
  return { items, primary };
});

const allUnassignedChecked = computed(() => {
  const list = unassignedSortingPackages.value;
  if (list.length === 0) return false;
  return list.every((p) => Boolean(unassignedSelection[p.id]));
});

function toggleUnassignedAll() {
  const next = !allUnassignedChecked.value;
  for (const p of unassignedSortingPackages.value) unassignedSelection[p.id] = next;
}

const activeDispatchTabId = ref<string>("");

watchEffect(() => {
  const list = neighbors.value;
  if (list.length === 0) {
    activeDispatchTabId.value = "";
    return;
  }
  const current = String(activeDispatchTabId.value ?? "").trim();
  if (current && list.includes(current)) return;
  activeDispatchTabId.value = list[0] ?? "";
});

const assignedByNeighbor = computed(() => {
  const map = new Map<string, WarehousePackageRecord[]>();
  for (const n of neighbors.value) map.set(n, []);
  for (const p of sorting.value) {
    const hop = currentHopForPackageId(p.id);
    if (!isValidNeighbor(hop)) continue;
    if (!map.has(hop)) map.set(hop, []);
    map.get(hop)!.push(p);
  }
  return map;
});

const activeAssignedPackages = computed(() => {
  const id = String(activeDispatchTabId.value ?? "").trim();
  if (!id) return [];
  return assignedByNeighbor.value.get(id) ?? [];
});

const dispatchSwitchMode = ref<"tabs" | "select">("tabs");
const dispatchTabsEl = ref<HTMLElement | null>(null);
const isMobileViewport = ref(false);
let dispatchTabsResizeObserver: ResizeObserver | null = null;
let mobileMediaQuery: MediaQueryList | null = null;
let mobileMediaQueryHandler: ((event: MediaQueryListEvent) => void) | null = null;

const openUnassignedMenuId = ref<string | null>(null);
const openBucketMenuId = ref<string | null>(null);

function recomputeDispatchSwitchMode() {
  const el = dispatchTabsEl.value;
  const neighborCount = neighbors.value.length;
  const countLimit = mainIsFullscreen.value ? 6 : 4;
  const shouldSelectByCount = neighborCount > countLimit;

  let shouldSelectByOverflow = false;
  if (el) shouldSelectByOverflow = el.scrollWidth > el.clientWidth + 1;

  dispatchSwitchMode.value = isMobileViewport.value || shouldSelectByCount || shouldSelectByOverflow ? "select" : "tabs";
}

function closeAllActionMenus() {
  openUnassignedMenuId.value = null;
  openBucketMenuId.value = null;
}

function toggleUnassignedMenu(packageId: string) {
  openBucketMenuId.value = null;
  openUnassignedMenuId.value = openUnassignedMenuId.value === packageId ? null : packageId;
}

function toggleBucketMenu(packageId: string) {
  openUnassignedMenuId.value = null;
  openBucketMenuId.value = openBucketMenuId.value === packageId ? null : packageId;
}

function onDispatchTabsWheel(e: WheelEvent) {
  const el = dispatchTabsEl.value;
  if (!el) return;
  const dx = e.deltaX;
  const dy = e.deltaY;
  el.scrollLeft += Math.abs(dx) > Math.abs(dy) ? dx : dy;
}

function assignSelectedToActiveTab() {
  const tab = String(activeDispatchTabId.value ?? "").trim();
  if (!tab) {
    toast.warning(t("warehouse.sorting.hints.selectDispatchTab"));
    return;
  }
  const ids = selectedUnassignedIds.value;
  if (ids.length === 0) {
    toast.warning(t("warehouse.sorting.hints.selectUnassignedToAssign"));
    return;
  }
  for (const id of ids) {
    nextHopByPackageId[id] = tab;
    delete unassignedSelection[id];
  }
}

function assignSelectedToDestination(dest: string) {
  const tab = String(dest ?? "").trim();
  if (!tab) return;
  const ids = selectedUnassignedIds.value;
  if (ids.length === 0) {
    activeDispatchTabId.value = tab;
    return;
  }
  for (const id of ids) {
    nextHopByPackageId[id] = tab;
    delete unassignedSelection[id];
  }
  activeDispatchTabId.value = tab;
}

function assignSelectedToPrimarySuggestion() {
  const primary = suggestedDistribution.value.primary?.id;
  if (!primary) {
    toast.info(t("warehouse.sorting.hints.noSuggestion"));
    return;
  }
  assignSelectedToDestination(primary);
}

function assignIdsToDestination(dest: string, ids: string[]) {
  const tab = String(dest ?? "").trim();
  if (!tab || ids.length === 0) return;
  for (const id of ids) {
    nextHopByPackageId[id] = tab;
    delete unassignedSelection[id];
  }
  activeDispatchTabId.value = tab;
}

const draggingIds = ref<string[]>([]);
const dragOverDestination = ref<string | null>(null);

function startDragFromUnassigned(packageId: string, e: DragEvent) {
  const selected = selectedUnassignedIds.value;
  const useSelected = selected.length > 0 && selected.includes(packageId);
  const ids = useSelected ? selected.slice() : [packageId];
  draggingIds.value = ids;
  dragOverDestination.value = null;
  try {
    e.dataTransfer?.setData("application/json", JSON.stringify({ ids }));
    e.dataTransfer?.setData("text/plain", ids.join(","));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  } catch {
    // ignore
  }
}

function endDrag() {
  draggingIds.value = [];
  dragOverDestination.value = null;
}

function onDestDragOver(dest: string, e: DragEvent) {
  if (!dest) return;
  e.preventDefault();
  dragOverDestination.value = dest;
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
}

function onDestDrop(dest: string, e: DragEvent) {
  e.preventDefault();
  const fallback = draggingIds.value;
  let ids: string[] = [];
  try {
    const raw = e.dataTransfer?.getData("application/json") ?? "";
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.ids)) ids = parsed.ids.map((x: any) => String(x));
  } catch {
    // ignore
  }
  if (ids.length === 0) ids = fallback;
  assignIdsToDestination(dest, ids);
  endDrag();
}

function onBucketDragOver(e: DragEvent) {
  const dest = String(activeDispatchTabId.value ?? "").trim();
  if (!dest) return;
  onDestDragOver(dest, e);
}

function onBucketDrop(e: DragEvent) {
  const dest = String(activeDispatchTabId.value ?? "").trim();
  if (!dest) return;
  onDestDrop(dest, e);
}

function unassignOne(packageId: string) {
  delete nextHopByPackageId[packageId];
}

function unassignAllForActiveTab() {
  const tab = String(activeDispatchTabId.value ?? "").trim();
  if (!tab) {
    toast.warning(t("warehouse.sorting.hints.selectDispatchTab"));
    return;
  }
  const list = activeAssignedPackages.value;
  if (list.length === 0) {
    toast.info(t("warehouse.sorting.hints.emptyUnassign"));
    return;
  }
  for (const p of list) {
    delete nextHopByPackageId[p.id];
    delete unassignedSelection[p.id];
  }
  toast.success(t("warehouse.sorting.unassignAll.done", { count: list.length }));
}

function isAssignedFollowingSuggestion(p: WarehousePackageRecord) {
  const dest = String(activeDispatchTabId.value ?? "").trim();
  const suggested = String(p.suggested_to_node_id ?? "").trim();
  if (!dest || !suggested) return false;
  return dest === suggested;
}

function hasSuggestion(p: WarehousePackageRecord) {
  return Boolean(String(p.suggested_to_node_id ?? "").trim());
}

function autoAssignUnassigned() {
  const selected = selectedUnassignedIds.value;
  if (selected.length === 0) {
    toast.info(t("warehouse.sorting.autoAssign.hints.selectPackages"));
    return;
  }
  const list = selectedUnassignedPackages.value;
  if (list.length === 0) {
    toast.info(t("warehouse.sorting.autoAssign.hints.nothingToAssign"));
    return;
  }
  const counts = new Map<string, number>();
  for (const n of neighbors.value) counts.set(n, (assignedByNeighbor.value.get(n)?.length ?? 0));

  for (const p of list) {
    const suggested = String(p.suggested_to_node_id ?? "").trim();
    if (suggested && isValidNeighbor(suggested)) {
      nextHopByPackageId[p.id] = suggested;
      counts.set(suggested, (counts.get(suggested) ?? 0) + 1);
      continue;
    }
    let best = neighbors.value[0] ?? "";
    for (const n of neighbors.value) {
      if ((counts.get(n) ?? 0) < (counts.get(best) ?? 0)) best = n;
    }
    if (best) {
      nextHopByPackageId[p.id] = best;
      counts.set(best, (counts.get(best) ?? 0) + 1);
    }
  }

  for (const p of list) delete unassignedSelection[p.id];
  toast.success(t("warehouse.sorting.autoAssign.done", { count: list.length }));
}

async function refresh() {
  loading.value = true;
  error.value = null;
  try {
    const [res, exceptionRes] = await Promise.all([api.getWarehousePackages(300), api.getWarehouseExceptionReports(100)]);
    warehouseNodeId.value = res.warehouse_node_id ?? null;
    neighbors.value = res.neighbors ?? [];
    packages.value = res.packages ?? [];
    ensureNextHopDefaults(res.packages ?? [], res.neighbors ?? []);
    exceptionReports.value = exceptionRes.exceptions ?? [];
  } catch (e: any) {
    error.value = String(e?.message ?? e);
    toastFromApiError(e, error.value);
  } finally {
    loading.value = false;
  }
}

async function receiveSelected() {
  const ids = selectedReceiveIds.value;
  if (ids.length === 0) {
    toast.warning(t("warehouse.hints.selectToReceive"));
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    const res = await api.receiveWarehousePackages(ids);
    const failed = res.details?.failed?.length ?? 0;
    toast.success(
      failed > 0
        ? t("warehouse.receive.doneWithFailed", { success: res.processed, failed })
        : t("warehouse.receive.done", { count: res.processed }),
    );
    for (const id of ids) delete receiveSelection[id];
    await refresh();
  } catch (e: any) {
    error.value = String(e?.message ?? e);
    toastFromApiError(e, error.value);
  } finally {
    busy.value = false;
  }
}

async function dispatchOne(p: WarehousePackageRecord) {
  const toNodeId = String(nextHopByPackageId[p.id] ?? "").trim();
  if (!toNodeId) {
    toast.warning(t("warehouse.hints.selectNextHop"));
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    await api.dispatchWarehouseNext(p.id, { toNodeId });
    toast.success(t("warehouse.dispatch.done", { tracking: p.tracking_number ?? p.id }));
    await refresh();
  } catch (e: any) {
    error.value = String(e?.message ?? e);
    toastFromApiError(e, error.value);
  } finally {
    busy.value = false;
  }
}

async function dispatchAllForActiveTab() {
  const tab = String(activeDispatchTabId.value ?? "").trim();
  if (!tab) {
    toast.warning(t("warehouse.sorting.hints.selectDispatchTab"));
    return;
  }
  const list = activeAssignedPackages.value;
  if (list.length === 0) {
    toast.info(t("warehouse.sorting.hints.emptyDispatch"));
    return;
  }

  busy.value = true;
  error.value = null;
  let ok = 0;
  let failed = 0;
  try {
    for (const p of list) {
      try {
        await api.dispatchWarehouseNext(p.id, { toNodeId: tab });
        ok += 1;
      } catch (e: any) {
        failed += 1;
        toastFromApiError(e, String(e?.message ?? e));
      }
    }
    if (failed === 0) toast.success(t("warehouse.dispatch.doneCount", { count: ok }));
    else toast.warning(t("warehouse.dispatch.doneWithFailed", { ok, failed }));
    await refresh();
  } finally {
    busy.value = false;
  }
}

function startException(p: WarehousePackageRecord) {
  exceptionTarget.value = p;
  exceptionForm.reason_code = "";
  exceptionForm.description = "";
  exceptionSubmitError.value = null;
  exceptionModalOpen.value = true;
}

async function submitException() {
  const target = exceptionTarget.value;
  if (!target) return;

  const reason = String(exceptionForm.reason_code ?? "").trim();
  const description = String(exceptionForm.description ?? "").trim();
  if (!reason) {
    exceptionSubmitError.value = t("warehouse.errors.exceptionReasonRequired");
    return;
  }
  if (!description) {
    exceptionSubmitError.value = t("warehouse.errors.exceptionNoteRequired");
    return;
  }

  busy.value = true;
  exceptionSubmitError.value = null;
  error.value = null;
  try {
    await api.reportWarehouseException(target.id, { reason_code: reason, description });
    toast.success(t("warehouse.exception.done", { tracking: target.tracking_number ?? target.id }));
    exceptionModalOpen.value = false;
    exceptionTarget.value = null;
    await refresh();
  } catch (e: any) {
    exceptionSubmitError.value = String(e?.message ?? e);
    toastFromApiError(e, exceptionSubmitError.value);
  } finally {
    busy.value = false;
  }
}

function closeExceptionModal() {
  exceptionModalOpen.value = false;
  exceptionTarget.value = null;
  exceptionSubmitError.value = null;
}

onMounted(() => {
  void refresh();
  document.addEventListener("click", closeAllActionMenus);

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    mobileMediaQuery = window.matchMedia("(max-width: 640px)");
    isMobileViewport.value = mobileMediaQuery.matches;
    mobileMediaQueryHandler = () => {
      isMobileViewport.value = mobileMediaQuery?.matches ?? false;
      recomputeDispatchSwitchMode();
    };
    if (typeof mobileMediaQuery.addEventListener === "function") {
      mobileMediaQuery.addEventListener("change", mobileMediaQueryHandler);
    } else {
      mobileMediaQuery.addListener(mobileMediaQueryHandler);
    }
  }

  if (typeof ResizeObserver !== "undefined") {
    dispatchTabsResizeObserver = new ResizeObserver(() => {
      recomputeDispatchSwitchMode();
    });
    if (dispatchTabsEl.value) dispatchTabsResizeObserver.observe(dispatchTabsEl.value);
  }
});

onUnmounted(() => {
  dispatchTabsResizeObserver?.disconnect();
  dispatchTabsResizeObserver = null;

  document.removeEventListener("click", closeAllActionMenus);

  if (mobileMediaQuery) {
    if (mobileMediaQueryHandler) {
      if (typeof mobileMediaQuery.removeEventListener === "function") {
        mobileMediaQuery.removeEventListener("change", mobileMediaQueryHandler);
      } else {
        mobileMediaQuery.removeListener(mobileMediaQueryHandler);
      }
    }
  }
  mobileMediaQuery = null;
  mobileMediaQueryHandler = null;
});

watchEffect(() => {
  neighbors.value.length;
  assignedByNeighbor.value.size;
  mainIsFullscreen.value;
  void nextTick(() => recomputeDispatchSwitchMode());
});

watch(
  () => busy.value,
  (next) => {
    if (next) closeAllActionMenus();
  },
);
</script>

<template>
  <UiPageShell :eyebrow="t('warehouse.page.eyebrow')" :title="t('warehouse.page.title')" :lede="t('warehouse.page.lede')">
    <div>
      <UiCard class="station-bar" style="margin-top: 16px">
        <div class="wh-bar">
          <div class="wh-bar__main">
            <div class="wh-summary">
              <p class="eyebrow">{{ t("warehouse.overview.title") }}</p>
              <div class="wh-summary-row">
                <div class="wh-station-chip" aria-label="station">
                  <span class="wh-station-chip__label">{{ t("warehouse.overview.stationLabel") }}</span>
                  <strong class="wh-station-chip__id">{{ warehouseNodeId ?? "-" }}</strong>
                </div>
                <span v-if="busy" class="wh-summary-pill">{{ t("warehouse.overview.processing") }}</span>
              </div>
            </div>
          </div>
          <div class="wh-bar__actions">
            <RouterLink class="ghost-btn" to="/map">
              <span class="wh-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M15 4 9 2 3 4v17l6-2 6 2 6-2V2l-6 2ZM9 4.1l6 2v13.8l-6-2V4.1Z" />
                </svg>
              </span>
              {{ t("warehouse.actions.map") }}
            </RouterLink>
          </div>
        </div>

        <div class="mini-stats wh-mini-stats" aria-label="倉儲工作量總覽">
          <div class="wh-mini-card">
            <div class="wh-mini-btn wh-mini-btn--static" aria-label="await receive">
              <p class="eyebrow">{{ t("warehouse.stats.awaitReceive") }}</p>
              <p class="wh-mini-value">{{ loading ? "..." : awaitingReceive.length }}</p>
            </div>
          </div>
          <div class="wh-mini-card">
            <div class="wh-mini-btn wh-mini-btn--static" aria-label="sorting">
              <p class="eyebrow">{{ t("warehouse.stats.sorting") }}</p>
              <p class="wh-mini-value">{{ loading ? "..." : sorting.length }}</p>
            </div>
          </div>
          <div class="wh-mini-card">
            <div class="wh-mini-btn wh-mini-btn--static" aria-label="dispatched">
              <p class="eyebrow">{{ t("warehouse.stats.dispatched") }}</p>
              <p class="wh-mini-value">{{ loading ? "..." : dispatched.length }}</p>
            </div>
          </div>
          <div class="wh-mini-card">
            <div class="wh-mini-btn wh-mini-btn--static" aria-label="warehouse total">
              <p class="eyebrow">{{ t("warehouse.stats.total") }}</p>
              <p class="wh-mini-value">{{ loading ? "..." : warehouseTotalCount }}</p>
            </div>
          </div>
        </div>

        <UiNotice v-if="error" class="wh-gap-top-sm" tone="error" role="alert">{{ error }}</UiNotice>
        <p v-else-if="loading" class="hint wh-gap-top-sm">{{ t("common.loading") }}</p>
      </UiCard>

      <div ref="mainStageEl" class="wh-main-stage" :class="{ fullscreen: mainIsFullscreen }">
      <UiCard class="wh-main-card" style="margin-top: 16px">
        <div class="wh-layout-header">
          <div class="wh-layout-header-row">
            <div class="wh-view-switch" role="tablist" aria-label="warehouse-tabs">
              <button
                class="wh-view-btn"
                :class="{ active: activeTab === 'await_receive' }"
                type="button"
                :disabled="busy"
                role="tab"
                :aria-selected="activeTab === 'await_receive'"
                @click="activeTab = 'await_receive'"
              >
                <span class="wh-view-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path
                      d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linejoin="round"
                    />
                    <path d="M3.5 7.5 12 12l8.5-4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
                    <path d="M12 12v9.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                  </svg>
                </span>
                <span>{{ t("warehouse.stats.awaitReceive") }}</span>
                <span class="wh-view-count">({{ awaitingReceive.length }})</span>
              </button>
              <button
                class="wh-view-btn"
                :class="{ active: activeTab === 'sorting' }"
                type="button"
                :disabled="busy"
                role="tab"
                :aria-selected="activeTab === 'sorting'"
                @click="activeTab = 'sorting'"
              >
                <span class="wh-view-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path
                      d="M7 6h14v2H7V6Zm0 5h14v2H7v-2Zm0 5h14v2H7v-2ZM3 7a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm0 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm0 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
                    />
                  </svg>
                </span>
                <span>{{ t("warehouse.stats.sorting") }}</span>
                <span class="wh-view-count">({{ sorting.length }})</span>
              </button>
              <button
                class="wh-view-btn"
                :class="{ active: activeTab === 'dispatched' }"
                type="button"
                :disabled="busy"
                role="tab"
                :aria-selected="activeTab === 'dispatched'"
                @click="activeTab = 'dispatched'"
              >
                <span class="wh-view-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path
                      d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm-1.1-6.2 7.2-7.2-1.4-1.4-5.8 5.8-2.5-2.5-1.4 1.4 3.9 3.9Z"
                    />
                  </svg>
                </span>
                <span>{{ t("warehouse.stats.dispatched") }}</span>
                <span class="wh-view-count">({{ dispatched.length }})</span>
              </button>
            </div>

            <div class="wh-header-actions">
              <button class="ghost-btn small-btn wh-refresh-btn" type="button" :disabled="loading || busy" @click="refresh">
                <span class="wh-btn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path
                      d="M12 6V3L8 7l4 4V8a4 4 0 1 1-3.9 5H6a6 6 0 1 0 6-7Z"
                    />
                  </svg>
                </span>
                {{ t("warehouse.actions.refresh") }}
              </button>
              <button
                v-if="mainFullscreenSupported"
                class="ghost-btn small-btn"
                type="button"
                :disabled="busy"
                @click="toggleMainFullscreen"
              >
                <span class="wh-btn-icon" aria-hidden="true">
                  <svg v-if="!mainIsFullscreen" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path
                      d="M4 4h6v2H6v4H4V4Zm14 0h2v6h-2V6h-4V4h4ZM4 14h2v4h4v2H4v-6Zm14 0h2v6h-6v-2h4v-4Z"
                    />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path
                      d="M10 4v2H6v4H4V4h6Zm10 0v6h-2V6h-4V4h6ZM4 14h2v4h4v2H4v-6Zm16 0v6h-6v-2h4v-4h2Z"
                    />
                  </svg>
                </span>
                {{ mainIsFullscreen ? t("warehouse.actions.fullscreen.exit") : t("warehouse.actions.fullscreen.enter") }}
              </button>
            </div>
          </div>

          <p class="hint wh-layout-hint">{{ tabContext.hint }}</p>
        </div>

      <div class="wh-main-body">
      <div v-show="activeTab === 'await_receive'" class="wh-panel" role="tabpanel">
        <UiCard class="wh-receive-workspace">
          <div class="wh-receive-toolbar">
            <p class="hint wh-receive-selected">{{ t("warehouse.common.selectedCount", { count: selectedReceiveIds.length }) }}</p>
            <div class="wh-inline-actions">
              <button
                class="ghost-btn"
                type="button"
                :disabled="busy || awaitingReceive.length === 0"
                @click="toggleReceiveAll"
              >
                {{ allReceiveChecked ? t("warehouse.receive.uncheckAll") : t("warehouse.receive.checkAll") }}
              </button>
              <button
                class="primary-btn"
                type="button"
                :disabled="busy || selectedReceiveIds.length === 0"
                @click="receiveSelected"
              >
                {{ t("warehouse.receive.cta", { count: selectedReceiveIds.length }) }}
              </button>
            </div>
          </div>

          <div v-if="loading" class="hint wh-gap-top-sm">{{ t("common.loading") }}</div>
          <div v-else-if="awaitingReceive.length === 0" class="wh-empty wh-gap-top-sm" style="margin-top: 10px">
            <p class="wh-empty-title">{{ t("warehouse.section.receive.empty") }}</p>
            <p class="hint wh-empty-hint">{{ t("warehouse.section.receive.emptyHint") }}</p>
            <ul class="wh-empty-list">
              <li class="hint">{{ t("warehouse.section.receive.emptyBullets.refresh", { action: t("warehouse.actions.refresh") }) }}</li>
              <li class="hint">{{ t("warehouse.section.receive.emptyBullets.goSorting", { view: t("warehouse.stats.sorting") }) }}</li>
            </ul>
          </div>

          <UiList v-else class="wh-list wh-receive-list">
            <li v-for="p in awaitingReceive" :key="p.id" class="wh-row">
              <div class="wh-row__top">
                <label class="wh-row__select">
                  <input v-model="receiveSelection[p.id]" type="checkbox" :disabled="busy" />
                  <span class="wh-tracking">
                    <svg class="wh-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linejoin="round"
                      />
                      <path
                        d="M3.5 7.5 12 12l8.5-4.5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linejoin="round"
                      />
                      <path d="M12 12v9.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                    </svg>
                    <strong>{{ p.tracking_number ?? p.id }}</strong>
                  </span>
                </label>
                <div class="wh-row__actions">
                  <div class="wh-receive-badges" aria-label="package meta">
                    <span class="wh-receive-pill muted">
                      <svg class="wh-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 6a1 1 0 0 1 1 1v3.6l2.2 1.3a1 1 0 0 1-1 1.7l-2.7-1.6A1 1 0 0 1 11 13V9a1 1 0 0 1 1-1Z"
                        />
                      </svg>
                      {{ p.latest_event.events_at ?? "-" }}
                    </span>
                  </div>
                  <button class="ghost-btn small-btn" type="button" :disabled="busy" @click="startException(p)">{{ t("warehouse.actions.exception") }}</button>
                </div>
              </div>
              <div class="hint wh-wrap wh-receive-route">
                <svg class="wh-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 7h9a4 4 0 0 1 0 8H10"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                  <path
                    d="M8 9 5 7l3-2"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M19 17H10a4 4 0 0 1 0-8h4"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                  <path
                    d="M16 19l3-2-3-2"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                {{
                  p.latest_event.delivery_details ??
                  `${p.sender_address ?? "-"} → ${p.receiver_address ?? "-"}`
                }}
              </div>
            </li>
          </UiList>
        </UiCard>
      </div>

      <div v-show="activeTab === 'sorting'" class="wh-panel" role="tabpanel">
        <UiCard class="wh-sort-workspace">
          <div class="wh-workspace-toolbar">
            <p class="hint" style="margin: 0">{{ t("warehouse.section.sorting.pendingCount", { count: sorting.length }) }}</p>
          </div>

          <div class="wh-workspace-body">
            <div v-if="neighbors.length === 0" class="hint wh-gap-top-sm">
              {{ t("warehouse.section.sorting.noAdjacent") }}
            </div>

            <div v-else-if="sorting.length === 0" class="wh-empty wh-gap-top-sm" style="margin-top: 10px">
              <p class="wh-empty-title">{{ t("warehouse.section.sorting.empty") }}</p>
              <p class="hint wh-empty-hint">{{ t("warehouse.section.sorting.emptyHint") }}</p>
              <ul class="wh-empty-list">
                <li class="hint">{{ t("warehouse.section.sorting.emptyBullets.goReceive", { view: t("warehouse.stats.awaitReceive") }) }}</li>
                <li class="hint">{{ t("warehouse.section.sorting.emptyBullets.refresh", { action: t("warehouse.actions.refresh") }) }}</li>
              </ul>
            </div>

            <div v-else class="wh-gap-top wh-sort-layout">
            <UiCard class="wh-sort-list">
              <div class="wh-sort-list-fixed">
                <div class="wh-sort-filters">
                  <div class="wh-filter-row">
                    <p class="eyebrow" style="margin: 0">{{ t("warehouse.sorting.unassigned.title") }}</p>
                    <span class="hint">{{ t("warehouse.common.items", { count: unassignedSortingPackages.length }) }}</span>
                  </div>

                  <div class="wh-filter-actions">
                    <button class="ghost-btn small-btn" type="button" :disabled="busy" @click="toggleUnassignedAll">
                      {{ allUnassignedChecked ? t("warehouse.receive.uncheckAll") : t("warehouse.receive.checkAll") }}
                    </button>
                    <button
                      class="ghost-btn small-btn"
                      type="button"
                      :disabled="busy || selectedUnassignedIds.length === 0"
                      @click="autoAssignUnassigned"
                    >
                      {{ t("warehouse.sorting.autoAssign.cta", { count: selectedUnassignedIds.length }) }}
                    </button>
                    <span class="hint wh-assign-hint" :class="{ muted: selectedUnassignedIds.length === 0 }">
                      {{ assignHintText }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="wh-sort-list-scroll">
                <div v-if="unassignedSortingPackages.length === 0" class="wh-empty">
                  <p class="wh-empty-title">{{ t("warehouse.sorting.unassigned.emptyTitle") }}</p>
                  <p class="hint wh-empty-hint">{{ t("warehouse.sorting.unassigned.emptyHint") }}</p>
                </div>

                <ul v-else class="wh-unassigned-list">
                  <li v-for="p in unassignedSortingPackages" :key="p.id" class="wh-unassigned-row">
                    <label class="wh-unassigned-left">
                      <input v-model="unassignedSelection[p.id]" type="checkbox" :disabled="busy" />
                      <span
                        class="wh-drag-handle"
                        draggable="true"
                        :title="t('warehouse.sorting.hints.dragHandleTitle')"
                        @mousedown.stop
                        @click.stop
                        @dragstart.stop="(e) => startDragFromUnassigned(p.id, e)"
                        @dragend="endDrag"
                      >
                        ⋮⋮
                      </span>
                      <span class="wh-unassigned-main">
                        <span class="wh-unassigned-title">{{ p.tracking_number ?? p.id }}</span>
                        <span class="hint wh-unassigned-meta">{{ t("warehouse.sorting.suggested", { node: p.suggested_to_node_id ?? '-' }) }}</span>
                      </span>
                    </label>
                    <div class="wh-unassigned-actions">
                      <div class="wh-action-menu" @click.stop>
                        <button
                          class="wh-icon-btn"
                          type="button"
                          :disabled="busy"
                          aria-haspopup="menu"
                          :aria-expanded="openUnassignedMenuId === p.id"
                          @click.stop="toggleUnassignedMenu(p.id)"
                          :aria-label="t('common.moreActions')"
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                            <path
                              d="M12 5.25a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5ZM12 10.25a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5ZM12 15.25a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Z"
                            />
                          </svg>
                        </button>
                        <div v-if="openUnassignedMenuId === p.id" class="wh-menu" role="menu" @keydown.esc.stop="closeAllActionMenus">
                          <button
                            class="wh-menu-item"
                            type="button"
                            role="menuitem"
                            :disabled="busy"
                            @click="
                              closeAllActionMenus();
                              startException(p);
                            "
                          >
                            <span class="wh-menu-item__icon" aria-hidden="true">
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path
                                  d="M12 2a1 1 0 0 1 .87.5l9 16A1 1 0 0 1 21 20H3a1 1 0 0 1-.87-1.5l9-16A1 1 0 0 1 12 2Zm0 6a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1Zm0 9a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 12 17Z"
                                />
                              </svg>
                            </span>
                            <span>{{ t("warehouse.actions.exception") }}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </UiCard>

            <UiCard class="wh-sort-detail">
              <div class="wh-sort-detail-fixed">
                <div class="wh-detail-head">
                  <div class="wh-detail-head__main">
                    <p class="wh-detail-title">{{ t("warehouse.sorting.dispatchBuckets.title") }}</p>
                    <p class="hint wh-detail-sub">{{ t("warehouse.sorting.dispatchBuckets.hint") }}</p>
                  </div>
                  <div class="wh-detail-actions">
                    <button
                      class="ghost-btn small-btn"
                      type="button"
                      :disabled="busy || activeAssignedPackages.length === 0"
                      @click="unassignAllForActiveTab"
                      :title="t('warehouse.sorting.unassignAll.title')"
                    >
                      {{ t("warehouse.sorting.unassignAll.title") }}
                    </button>
                    <button
                      class="primary-btn small-btn"
                      type="button"
                      :disabled="busy || activeAssignedPackages.length === 0"
                      @click="dispatchAllForActiveTab"
                      :title="t('warehouse.sorting.dispatchAll.title', { count: activeAssignedPackages.length })"
                    >
                      {{ t("warehouse.sorting.dispatchAll.title", { count: activeAssignedPackages.length }) }}
                    </button>
                  </div>
                </div>

                <div class="wh-dispatch-switch" :data-mode="dispatchSwitchMode" aria-label="dispatch destination switch">
                  <label class="wh-dispatch-select" aria-label="dispatch destination select">
                    <span class="hint">{{ t("warehouse.sorting.dispatchDestination") }}</span>
                    <select v-model="activeDispatchTabId" :disabled="busy || neighbors.length === 0">
                      <option v-for="n in neighbors" :key="n" :value="n">
                        {{ n }}（{{ assignedByNeighbor.get(n)?.length ?? 0 }}）
                      </option>
                    </select>
                  </label>

                  <div
                    ref="dispatchTabsEl"
                    class="wh-dispatch-tabs"
                    role="tablist"
                    aria-label="dispatch-tabs"
                    @wheel.prevent="onDispatchTabsWheel"
                  >
                    <button
                      v-for="n in neighbors"
                      :key="n"
                      type="button"
                      :class="{ active: activeDispatchTabId === n }"
                      :disabled="busy"
                      @click="activeDispatchTabId = n"
                      :title="`${n}（${assignedByNeighbor.get(n)?.length ?? 0}）`"
                    >
                      <span class="wh-dispatch-tab-label">{{ n }}</span>
                      <span class="wh-dispatch-tab-count">（{{ assignedByNeighbor.get(n)?.length ?? 0 }}）</span>
                    </button>
                  </div>
                </div>

                <div v-if="selectedUnassignedIds.length > 0" class="wh-selected-preview">
                  <template v-if="singleSelectedUnassignedPackage">
                    <p class="wh-selected-title">
                      {{ singleSelectedUnassignedPackage.tracking_number ?? singleSelectedUnassignedPackage.id }}
                    </p>
                    <p class="hint" style="margin: 6px 0 0">
                      {{ t("warehouse.sorting.suggested", { node: singleSelectedUnassignedPackage.suggested_to_node_id ?? "-" }) }}
                    </p>
                    <p class="hint wh-wrap" style="margin: 6px 0 0">
                      {{ t("warehouse.sorting.receiver", { address: singleSelectedUnassignedPackage.receiver_address ?? "-" }) }}
                    </p>
                  </template>

                  <template v-else>
                    <p class="wh-selected-title">{{ t("warehouse.common.selectedCount", { count: selectedUnassignedIds.length }) }}</p>
                    <p class="hint" style="margin: 6px 0 0">
                      {{ t("warehouse.sorting.suggestedDistribution") }}
                      <span v-if="suggestedDistribution.items.length === 0">{{ t("warehouse.sorting.noSuggestionShort") }}</span>
                      <span v-else>
                        <span v-for="(it, idx) in suggestedDistribution.items.slice(0, 4)" :key="it.id">
                          {{ idx === 0 ? "" : "、" }}{{ it.id }} × {{ it.count
                          }}<span v-if="!it.valid">{{ t("warehouse.sorting.notAdjacent") }}</span>
                        </span>
                        <span v-if="suggestedDistribution.items.length > 4">…</span>
                      </span>
                    </p>

                    <div class="wh-selected-actions">
                      <button
                        class="ghost-btn small-btn"
                        type="button"
                        :disabled="busy || !suggestedDistribution.primary"
                        @click="assignSelectedToPrimarySuggestion"
                      >
                        {{ t("warehouse.sorting.assignToPrimary") }}
                      </button>
                    </div>
                  </template>
                </div>
              </div>

              <div class="wh-sort-detail-scroll">
                <div
                  class="wh-bucket-dropzone"
                  :data-drop="dragOverDestination === activeDispatchTabId"
                  @dragover="onBucketDragOver"
                  @dragleave="dragOverDestination = null"
                  @drop="onBucketDrop"
                >
                  <div v-if="activeAssignedPackages.length === 0" class="wh-empty" style="margin-top: 0">
                    <p class="wh-empty-title">{{ t("warehouse.sorting.bucket.emptyTitle") }}</p>
                    <p class="hint wh-empty-hint">{{ t("warehouse.sorting.bucket.emptyHint", { dest: activeDispatchTabId }) }}</p>
                  </div>

                  <ul v-else class="wh-bucket-list" aria-label="bucket packages">
                    <li v-for="p in activeAssignedPackages" :key="p.id" class="wh-bucket-item">
                      <div class="wh-bucket-meta">
                        <span class="wh-bucket-chip">{{ p.tracking_number ?? p.id }}</span>
                        <span
                          v-if="hasSuggestion(p)"
                          class="wh-bucket-tag"
                          :class="isAssignedFollowingSuggestion(p) ? 'safe' : 'warn'"
                          :title="
                            isAssignedFollowingSuggestion(p)
                              ? t('warehouse.sorting.bucketTag.safe')
                              : t('warehouse.sorting.bucketTag.warn', { node: p.suggested_to_node_id ?? '-' })
                          "
                          :aria-label="
                            isAssignedFollowingSuggestion(p)
                              ? t('warehouse.sorting.bucketTag.safe')
                              : t('warehouse.sorting.bucketTag.warnAria', { node: p.suggested_to_node_id ?? '-' })
                          "
                        >
                          <svg
                            v-if="isAssignedFollowingSuggestion(p)"
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.2 7.4-5 7a1 1 0 0 1-1.53.16l-2.5-2.5a1 1 0 1 1 1.42-1.42l1.65 1.65 4.22-5.9a1 1 0 1 1 1.74 1Z"
                            />
                          </svg>
                          <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                            <path
                              d="M12 2a1 1 0 0 1 .87.5l9 16A1 1 0 0 1 21 20H3a1 1 0 0 1-.87-1.5l9-16A1 1 0 0 1 12 2Zm0 5a1 1 0 0 0-1 1v5a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1Zm0 10a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 12 17Z"
                            />
                          </svg>
                        </span>
                      </div>
                      <div class="wh-bucket-actions">
                        <div class="wh-action-menu" @click.stop>
                          <button
                            class="wh-icon-btn"
                            type="button"
                            :disabled="busy"
                            aria-haspopup="menu"
                            :aria-expanded="openBucketMenuId === p.id"
                            @click.stop="toggleBucketMenu(p.id)"
                            :aria-label="t('common.moreActions')"
                          >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                              <path
                                d="M12 5.25a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5ZM12 10.25a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5ZM12 15.25a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Z"
                              />
                            </svg>
                          </button>
                          <div v-if="openBucketMenuId === p.id" class="wh-menu" role="menu" @keydown.esc.stop="closeAllActionMenus">
                            <button
                              class="wh-menu-item"
                              type="button"
                              role="menuitem"
                              :disabled="busy"
                              data-tone="primary"
                              @click="
                                closeAllActionMenus();
                                dispatchOne(p);
                              "
                            >
                              <span class="wh-menu-item__icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                  <path
                                    d="M2.5 12 21 3.5l-4.7 17-6-6-4.8 3.3.8-6.7L2.5 12Zm7.7 1.3 6 6 2.5-9.1-8.5 1.8Z"
                                  />
                                </svg>
                              </span>
                              <span>{{ t("warehouse.actions.dispatch") }}</span>
                            </button>
                            <button
                              class="wh-menu-item"
                              type="button"
                              role="menuitem"
                              :disabled="busy"
                              data-tone="danger"
                              @click="
                                closeAllActionMenus();
                                startException(p);
                              "
                            >
                              <span class="wh-menu-item__icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                  <path
                                    d="M12 2a1 1 0 0 1 .87.5l9 16A1 1 0 0 1 21 20H3a1 1 0 0 1-.87-1.5l9-16A1 1 0 0 1 12 2Zm0 6a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1Zm0 9a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 12 17Z"
                                  />
                                </svg>
                              </span>
                              <span>{{ t("warehouse.actions.exception") }}</span>
                            </button>
                            <button
                              class="wh-menu-item"
                              type="button"
                              role="menuitem"
                              :disabled="busy"
                              @click="
                                closeAllActionMenus();
                                unassignOne(p.id);
                              "
                            >
                              <span class="wh-menu-item__icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                  <path
                                    d="M12 5a7 7 0 1 1-6.9 8H3.1A9 9 0 1 0 12 3V1L7 6l5 5V5Z"
                                  />
                                </svg>
                              </span>
                              <span>{{ t("warehouse.actions.unassign") }}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </UiCard>
            </div>
          </div>
        </UiCard>
      </div>

      <div v-show="activeTab === 'dispatched'" class="wh-panel" role="tabpanel">
        <UiCard class="wh-dispatch-workspace">
          <div class="wh-workspace-toolbar">
            <p class="hint" style="margin: 0">{{ t("warehouse.common.totalItems", { count: dispatched.length }) }}</p>
          </div>

          <div v-if="loading" class="hint wh-gap-top-sm">{{ t("common.loading") }}</div>
          <div v-else-if="dispatched.length === 0" class="wh-empty wh-gap-top-sm" style="margin-top: 10px">
            <p class="wh-empty-title">{{ t("warehouse.section.dispatched.empty") }}</p>
            <p class="hint wh-empty-hint">{{ t("warehouse.section.dispatched.emptyHint", { action: t('warehouse.actions.dispatch') }) }}</p>
            <ul class="wh-empty-list">
              <li class="hint">{{ t("warehouse.section.dispatched.emptyBullets.goSorting", { view: t("warehouse.stats.sorting") }) }}</li>
              <li class="hint">{{ t("warehouse.section.dispatched.emptyBullets.refresh", { action: t("warehouse.actions.refresh") }) }}</li>
            </ul>
          </div>

          <UiList v-else class="wh-list wh-dispatch-list">
            <li v-for="p in dispatched" :key="p.id" class="wh-row">
              <div class="wh-row__top">
                <span class="wh-tracking">
                  <svg class="wh-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm-1.1-6.2 7.2-7.2-1.4-1.4-5.8 5.8-2.5-2.5-1.4 1.4 3.9 3.9Z"
                    />
                  </svg>
                  <strong>{{ p.tracking_number ?? p.id }}</strong>
                </span>
                <div class="wh-row__actions">
                  <span class="wh-receive-pill muted">
                    <svg class="wh-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 6a1 1 0 0 1 1 1v3.6l2.2 1.3a1 1 0 0 1-1 1.7l-2.7-1.6A1 1 0 0 1 11 13V9a1 1 0 0 1 1-1Z"
                      />
                    </svg>
                    {{ p.latest_event.events_at ?? "-" }}
                  </span>
                  <button class="ghost-btn small-btn" type="button" :disabled="busy" @click="startException(p)">{{ t("warehouse.actions.exception") }}</button>
                </div>
              </div>
              <div class="hint wh-wrap">{{ p.latest_event.delivery_details ?? "-" }}</div>
            </li>
          </UiList>
        </UiCard>
      </div>
      </div>
      </UiCard>
      </div>

      <UiCard style="margin-top: 16px">
        <div class="wh-section-head">
          <div>
            <p class="eyebrow">{{ t("warehouse.section.exceptions.title") }}</p>
            <p class="hint wh-section-head__hint">{{ t("warehouse.section.exceptions.hint") }}</p>
          </div>
          <span class="hint">{{ t("warehouse.section.exceptions.count", { count: exceptionReports.length }) }}</span>
        </div>

        <div v-if="loading" class="hint wh-gap-top">{{ t("common.loading") }}</div>
        <div v-else-if="exceptionReports.length === 0" class="hint wh-gap-top">{{ t("warehouse.section.exceptions.empty") }}</div>
        <UiList v-else class="wh-list">
          <li v-for="r in exceptionReports" :key="r.id" class="wh-row">
            <div class="wh-row__top wh-row__top--baseline">
              <strong>{{ r.tracking_number ?? r.package_id }}</strong>
              <span class="hint">
                {{ (r.handled ?? 0) === 1 ? t("warehouse.exceptions.handled") : t("warehouse.exceptions.unhandled") }} ·
                {{ r.reported_at ?? "-" }}
              </span>
            </div>
            <div class="hint">{{ exceptionReasonLabel(r.reason_code, t) }}</div>
            <div class="hint wh-wrap">{{ r.description ?? "-" }}</div>
          </li>
        </UiList>
      </UiCard>
    </div>

    <UiModal v-model="exceptionModalOpen" :title="t('warehouse.modal.title')" aria-label="report exception" @close="closeExceptionModal">
      <template #subtitle>
        <p class="hint wh-modal-subtitle">
          {{ t("warehouse.modal.tracking", { tracking: exceptionTarget?.tracking_number ?? exceptionTarget?.id ?? "-" }) }}
        </p>
      </template>

      <div class="form-grid wh-modal-form">
        <label class="form-field">
          <span>{{ t("warehouse.modal.reasonLabel") }}</span>
          <select v-model="exceptionForm.reason_code" :disabled="busy">
            <option value="" disabled>{{ t("warehouse.modal.reasonPlaceholder") }}</option>
            <option v-for="r in exceptionReasons" :key="r.code" :value="r.code">{{ r.label }}</option>
          </select>
        </label>

        <label class="form-field">
          <span>{{ t("warehouse.modal.noteLabel") }}</span>
          <textarea
            v-model="exceptionForm.description"
            rows="3"
            :disabled="busy"
            :placeholder="t('warehouse.modal.notePlaceholder')"
          />
        </label>

        <UiNotice v-if="exceptionSubmitError" tone="error" role="alert">{{ exceptionSubmitError }}</UiNotice>
      </div>

      <template #actions>
        <button class="primary-btn" type="button" :disabled="busy" @click="submitException">{{ t("warehouse.modal.submit") }}</button>
        <button class="ghost-btn" type="button" :disabled="busy" @click="closeExceptionModal">{{ t("common.close") }}</button>
      </template>
    </UiModal>
  </UiPageShell>
</template>

<style scoped>
.station-bar {
  position: static;
}

.wh-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: start;
}

.wh-bar__main {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.wh-summary {
  display: grid;
  gap: 8px;
}

.wh-summary-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.wh-station-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.18);
  background: rgba(255, 255, 255, 0.55);
}

.wh-station-chip__label {
  font-size: 12px;
  font-weight: 900;
  color: rgba(63, 38, 32, 0.62);
}

.wh-station-chip__id {
  font-size: 14px;
  font-weight: 900;
  color: rgba(63, 38, 32, 0.94);
  white-space: nowrap;
}

.wh-summary-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 221, 170, 0.92);
  background: rgba(255, 221, 170, 0.3);
  font-size: 11px;
  font-weight: 900;
  color: rgba(92, 55, 24, 0.92);
  white-space: nowrap;
}

.wh-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 6px;
  vertical-align: middle;
}

.wh-bar__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
}

.wh-mini-stats {
  margin-top: 12px;
}

.wh-receive-workspace {
  margin-top: 12px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.wh-receive-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.wh-receive-selected {
  margin: 0;
}

.wh-receive-list {
  margin-top: 10px;
}

.wh-dispatch-workspace {
  margin-top: 12px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.wh-sort-workspace {
  margin-top: 12px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}

.wh-workspace-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.wh-workspace-body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.wh-dispatch-list {
  margin-top: 10px;
}

@media (max-width: 900px) {
  .wh-bar {
    grid-template-columns: 1fr;
  }
  .wh-bar__actions {
    justify-content: flex-start;
  }
}

.wh-mini-btn {
  width: 100%;
  height: 100%;
  text-align: inherit;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  color: inherit;
}

.wh-mini-btn--static {
  cursor: default;
}

.wh-mini-btn:disabled {
  cursor: default;
}

.wh-mini-btn:focus-visible {
  outline: 2px solid rgba(225, 139, 139, 0.35);
  outline-offset: 2px;
  border-radius: 10px;
}

.wh-mini-value {
  margin: 2px 0 0;
  font-size: 20px;
  font-weight: 800;
  color: #3f2620;
}

.wh-layout-header {
  display: grid;
  gap: 6px;
}

.wh-layout-hint {
  margin: 0;
}

.wh-layout-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.wh-view-switch {
  display: inline-flex;
  border: 1px solid rgba(165, 122, 99, 0.18);
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 248, 241, 0.65);
}

.wh-view-btn {
  border: 0;
  background: transparent;
  color: var(--text-main);
  padding: 10px 14px;
  height: 44px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
}

.wh-view-btn.active {
  background: rgba(244, 182, 194, 0.28);
}

.wh-view-btn:disabled {
  opacity: 0.75;
  cursor: not-allowed;
}

.wh-view-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(165, 122, 99, 0.18);
  color: rgba(91, 58, 44, 0.9);
  flex-shrink: 0;
}

.wh-view-count {
  opacity: 0.85;
  font-weight: 800;
}

.wh-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.wh-header-actions button {
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 900px) {
  .wh-layout-header-row {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .wh-view-switch {
    max-width: 100%;
    overflow-x: auto;
  }

  .wh-view-btn {
    white-space: nowrap;
  }
}

.wh-panel {
  margin-top: 12px;
}

.wh-main-card {
  max-height: clamp(560px, 74vh, 880px);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-x: hidden;
}

.wh-main-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

.wh-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.wh-panel-summary {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.wh-main-stage.fullscreen {
  height: 100vh;
  padding: 12px;
  box-sizing: border-box;
  background: rgba(255, 248, 241, 0.92);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.wh-main-stage.fullscreen .wh-main-card {
  margin-top: 0 !important;
  flex: 1;
  min-height: 0;
  max-height: none;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.wh-main-stage.fullscreen .wh-main-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.wh-main-stage.fullscreen .wh-sort-layout {
  flex: 1;
  height: auto;
}

.wh-sort-layout {
  flex: 1;
  height: 100%;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.wh-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.wh-section-head__hint {
  margin: 6px 0 0;
}

.wh-section-head__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.wh-gap-top {
  margin-top: 12px;
}

.wh-gap-top-sm {
  margin-top: 10px;
}

.wh-list {
  margin-top: 12px;
}

.wh-list-sm {
  margin-top: 10px;
}

.wh-stack {
  display: grid;
  gap: 14px;
}

.wh-row {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.16);
  background: rgba(255, 255, 255, 0.55);
  transition: background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.wh-row:hover {
  background: rgba(255, 255, 255, 0.72);
  border-color: rgba(165, 122, 99, 0.22);
}

.wh-row:focus-within {
  outline: 2px solid rgba(225, 139, 139, 0.35);
  outline-offset: 2px;
}

.wh-row--compact {
  gap: 8px;
  padding: 10px 10px;
}

.wh-row__top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
}

.wh-row__top--baseline {
  align-items: baseline;
}

.wh-row__select {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wh-row__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
}

.wh-tracking {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.wh-inline-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  color: rgba(63, 38, 32, 0.62);
}

.wh-receive-badges {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.wh-receive-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid rgba(165, 122, 99, 0.16);
  background: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  font-weight: 800;
  color: rgba(63, 38, 32, 0.88);
  white-space: nowrap;
}

.wh-receive-pill.muted {
  color: rgba(63, 38, 32, 0.62);
}

.wh-receive-route {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wh-inline-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.wh-select {
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--surface-stroke);
  background: rgba(255, 255, 255, 0.86);
  color: var(--text-main);
}

.wh-wrap {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.wh-empty {
  margin-top: 12px;
  border: 1px dashed rgba(165, 122, 99, 0.22);
  background: rgba(255, 255, 255, 0.45);
  border-radius: 14px;
  padding: 12px;
}

.wh-empty-title {
  margin: 0;
  font-weight: 800;
  font-size: 14px;
  color: rgba(63, 38, 32, 0.92);
}

.wh-empty-hint {
  margin: 6px 0 0;
}

.wh-empty-list {
  margin: 10px 0 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
}


.wh-modal-subtitle {
  margin: 0;
}

.wh-modal-form {
  grid-template-columns: 1fr;
  gap: 10px;
}

.wh-sort-layout {
  display: grid;
  grid-template-columns: minmax(0, 380px) minmax(0, 1fr);
  gap: 12px;
  height: clamp(560px, 66vh, 820px);
  min-height: 0;
  overflow-x: hidden;
}

.wh-sort-list,
.wh-sort-detail {
  min-height: 0;
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 12px;
}

.wh-sort-list-scroll {
  min-height: 0;
  overflow: auto;
  padding-right: 6px;
}

.wh-sort-detail-fixed {
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgba(255, 248, 241, 0.92);
  border-radius: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(165, 122, 99, 0.12);
}

.wh-sort-detail-scroll {
  min-height: 0;
  overflow: auto;
  padding-right: 6px;
  display: flex;
  flex-direction: column;
}

.wh-sort-filters {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  align-items: start;
}

.wh-filter-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.wh-filter-field select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--surface-stroke);
  background: rgba(255, 255, 255, 0.86);
  color: var(--text-main);
}

.wh-overview-card {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.18);
  background: rgba(255, 255, 255, 0.55);
  min-width: 110px;
  text-align: center;
}

.wh-overview-value {
  margin: 2px 0 0;
  font-size: 18px;
  font-weight: 900;
  color: #3f2620;
}

.wh-status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(244, 182, 194, 0.35);
  border: 1px solid rgba(244, 182, 194, 0.55);
  color: #3f2620;
  font-weight: 800;
  font-size: 12px;
  white-space: nowrap;
}

.wh-detail-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
  min-width: 0;
}

.wh-detail-head__main {
  min-width: 0;
  flex: 1 1 320px;
}

.wh-detail-title {
  margin: 0;
  font-weight: 900;
  font-size: 18px;
}

.wh-detail-sub {
  margin: 6px 0 0;
}

.wh-detail-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  margin-left: auto;
  flex: 0 1 auto;
  max-width: 100%;
}

.wh-detail-actions button {
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wh-filter-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.wh-filter-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.wh-assign-hint {
  flex-basis: 100%;
}

.wh-unassigned-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}

.wh-unassigned-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.18);
  background: rgba(255, 255, 255, 0.55);
}

.wh-unassigned-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.wh-unassigned-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.wh-unassigned-title {
  font-weight: 800;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wh-unassigned-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wh-unassigned-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  flex-shrink: 0;
}

.wh-action-menu {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.wh-icon-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: rgba(63, 38, 32, 0.78);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  outline: none;
}

.wh-icon-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.wh-icon-btn:not(:disabled):hover {
  background: rgba(63, 38, 32, 0.06);
}

.wh-icon-btn:focus-visible {
  outline: 2px solid rgba(225, 139, 139, 0.42);
  outline-offset: 2px;
}

.wh-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  min-width: 132px;
  padding: 8px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.18);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 10px 28px rgba(63, 38, 32, 0.14);
  display: grid;
  gap: 4px;
}

.wh-menu-item {
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 10px 10px;
  border-radius: 10px;
  font-weight: 800;
  color: rgba(63, 38, 32, 0.92);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.wh-menu-item__icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  opacity: 0.9;
}

.wh-menu-item span:last-child {
  min-width: 0;
}

.wh-menu-item:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.wh-menu-item:not(:disabled):hover {
  background: rgba(63, 38, 32, 0.06);
}

.wh-menu-item[data-tone="primary"] {
  color: rgba(92, 39, 39, 0.95);
}

.wh-menu-item[data-tone="danger"] {
  color: rgba(124, 54, 54, 0.95);
}

.wh-drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid rgba(165, 122, 99, 0.16);
  background: rgba(255, 255, 255, 0.65);
  color: rgba(63, 38, 32, 0.75);
  cursor: grab;
  user-select: none;
  flex: 0 0 auto;
  -webkit-user-drag: element;
}

.wh-drag-handle:active {
  cursor: grabbing;
}

.wh-dispatch-tabs {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  display: flex;
  border: 1px solid var(--surface-stroke);
  border-radius: 12px;
  background: rgba(255, 248, 241, 0.65);
  padding-bottom: 6px;
  scrollbar-gutter: stable;
}

.wh-dispatch-tabs button {
  border: none;
  background: transparent;
  color: var(--text-main);
  padding: 10px 14px;
  cursor: pointer;
  font-weight: 600;
  flex: 0 0 auto;
  min-width: 0;
  max-width: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
}

.wh-dispatch-tabs button.active {
  background: rgba(225, 139, 139, 0.16);
}

.wh-dispatch-tabs button:disabled {
  opacity: 0.75;
  cursor: not-allowed;
}

.wh-dispatch-tab-label {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wh-dispatch-tab-count {
  flex: 0 0 auto;
  opacity: 0.85;
}

.wh-dispatch-switch {
  margin-top: 10px;
  position: relative;
}

.wh-dispatch-select {
  display: none;
  gap: 6px;
  margin-top: 10px;
}

.wh-dispatch-select select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--surface-stroke);
  background: rgba(255, 255, 255, 0.86);
  color: var(--text-main);
}

.wh-dispatch-switch[data-mode="tabs"] .wh-dispatch-tabs {
  margin-top: 10px;
}

.wh-dispatch-switch[data-mode="select"] .wh-dispatch-select {
  display: grid;
}

.wh-dispatch-switch[data-mode="select"] .wh-dispatch-tabs {
  position: absolute;
  inset: 0;
  visibility: hidden;
  pointer-events: none;
}

.wh-bucket-dropzone {
  flex: 1;
  min-height: 320px;
  border-radius: 14px;
  border: 1px dashed transparent;
  padding: 10px;
  display: flex;
  flex-direction: column;
}

.wh-bucket-dropzone[data-drop="true"] {
  border-color: rgba(244, 182, 194, 0.9);
  background: rgba(255, 255, 255, 0.72);
}

.wh-selected-preview {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.18);
  background: rgba(255, 255, 255, 0.55);
}

.wh-selected-title {
  margin: 0;
  font-weight: 900;
}

.wh-selected-actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.wh-bucket-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
  width: 100%;
}

.wh-bucket-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.18);
  background: rgba(255, 255, 255, 0.55);
}

.wh-bucket-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.wh-bucket-chip {
  font-weight: 800;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wh-bucket-tag {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 999px;
  font-weight: 800;
  font-size: 12px;
  border: 1px solid transparent;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.wh-bucket-tag.safe {
  color: rgba(30, 66, 42, 0.92);
  background: rgba(177, 226, 197, 0.55);
  border-color: rgba(177, 226, 197, 0.8);
}

.wh-bucket-tag.warn {
  color: rgba(92, 55, 24, 0.92);
  background: rgba(255, 221, 170, 0.55);
  border-color: rgba(255, 221, 170, 0.85);
}

.wh-bucket-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  flex-shrink: 0;
}

@media (max-width: 980px) {
  .wh-sort-layout {
    grid-template-columns: 1fr;
    height: auto;
    flex: 0 0 auto;
  }

  .wh-sort-list-scroll,
  .wh-sort-detail-scroll {
    overflow: visible;
    padding-right: 0;
  }

  .wh-bucket-dropzone {
    min-height: 220px;
    flex: 0 0 auto;
  }

  .wh-dispatch-tabs {
    padding-bottom: 6px;
  }
}
</style>
