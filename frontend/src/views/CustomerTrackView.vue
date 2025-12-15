<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { api, type MapNode, type PackageEventRecord, type TrackingSearchResponse } from "../services/api";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();

const TRUCK_ORIGIN_NODE_ID = "TRUCK_ORIGIN";

type Filters = {
  tracking_number: string;
  date_from: string;
  date_to: string;
  vehicle_id: string;
  location_id: string;
};

const filters = reactive<Filters>({
  tracking_number: "",
  date_from: "",
  date_to: "",
  vehicle_id: "",
  location_id: "",
});

const activeTab = ref<"in_transit" | "history">("in_transit");
const expandedIds = ref<Set<string>>(new Set());
const filtersOpen = ref(false);

const hubAndRegionNodes = ref<MapNode[]>([]);
const nodeNameById = ref<Record<string, string>>({});

const isLoading = ref(false);
const error = ref<string | null>(null);

const inTransitResult = ref<TrackingSearchResponse | null>(null);
const historyResult = ref<TrackingSearchResponse | null>(null);

const inTransitPackages = computed(() => inTransitResult.value?.packages ?? []);
const historyPackages = computed(() => historyResult.value?.packages ?? []);

const packagesForActiveTab = computed(() =>
  activeTab.value === "in_transit" ? inTransitPackages.value : historyPackages.value,
);

const totalForActiveTab = computed(() =>
  activeTab.value === "in_transit" ? inTransitResult.value?.total ?? 0 : historyResult.value?.total ?? 0,
);

const detailByPackageId = ref<
  Record<string, { isLoading: boolean; error: string | null; events: PackageEventRecord[]; latestDetails: string | null }>
>({});

const resolveNodeLabel = (nodeId: string) => {
  if (nodeId === TRUCK_ORIGIN_NODE_ID) return "貨車出發地";
  return nodeNameById.value[nodeId] ?? nodeId;
};

const nodeStageLabel = (nodeId: string) => {
  if (nodeId === TRUCK_ORIGIN_NODE_ID) return "貨車";
  if (nodeId.startsWith("HUB_")) return "物流中心";
  if (nodeId.startsWith("REG_")) return "配送站";
  if (nodeId.startsWith("END_HOME_")) return "住家";
  if (nodeId.startsWith("END_STORE_")) return "超商門市";
  return "未知";
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const formatEventTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const datePart = date.toLocaleDateString("zh-TW");
  const timePart = date.toLocaleTimeString("zh-TW", { hour12: false });
  return `${datePart}\n${timePart}`;
};

const addDays = (iso: string, days: number) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

const estimateDaysForDeliveryTime = (deliveryTime?: string | null) => {
  const dt = String(deliveryTime ?? "");
  if (dt === "overnight") return 1;
  if (dt === "two_day") return 2;
  if (dt === "standard") return 3;
  if (dt === "economy") return 5;
  return null;
};

const estimatedDeliveryFallback = (pkg: any) => {
  if (pkg.estimated_delivery) return pkg.estimated_delivery as string;
  const days = estimateDaysForDeliveryTime(pkg.delivery_time);
  if (!days || !pkg.created_at) return null;
  return addDays(pkg.created_at, days);
};

const statusBadge = (status?: string | null) => (status === "exception" ? "異常" : "正常");

const statusKeyForPackage = (pkg: any): "ok" | "exception" => {
  const details = detailByPackageId.value[pkg.id];
  const latest = details?.events?.length ? details.events[details.events.length - 1] : null;
  const latestStatus = String(latest?.delivery_status ?? "").trim().toLowerCase();
  if (["exception", "abnormal", "error", "failed"].includes(latestStatus)) return "exception";
  return String(pkg.status ?? "").trim().toLowerCase() === "exception" ? "exception" : "ok";
};

const statusLabel = (key: "ok" | "exception") => (key === "exception" ? "異常" : "正常");

const displayNodeText = (nodeId?: string | null) => {
  if (!nodeId) return "-";
  if (nodeId === TRUCK_ORIGIN_NODE_ID) return "貨車出發地";
  return nodeId;
};

const isPrePickupEvent = (evt: PackageEventRecord, firstNodeId: string) => {
  const loc = String(evt.location ?? "").trim();
  if (!firstNodeId || loc !== firstNodeId) return false;

  const status = String(evt.delivery_status ?? "").trim().toLowerCase();
  if (["created", "task_created", "queued", "pending_pickup", "waiting_pickup"].includes(status)) return true;

  const details = String(evt.delivery_details ?? "").trim();
  return ["託運單已建立", "任務池", "等待司機", "等待司機取件", "等待司機接單", "等待取件"].some((k) => details.includes(k));
};

const parseRoutePath = (routePath?: string | null): string[] => {
  if (!routePath) return [];
  const raw = String(routePath).trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
    } catch {
      return [];
    }
  }
  return raw.split(",").map((v) => v.trim()).filter(Boolean);
};

const tooltip = reactive<{ open: boolean; text: string; x: number; y: number }>({
  open: false,
  text: "",
  x: 0,
  y: 0,
});

const tooltipEl = ref<HTMLDivElement | null>(null);

const tooltipStyle = computed(() => {
  if (!tooltip.open) return {};
  return { left: `${tooltip.x}px`, top: `${tooltip.y}px` };
});

const showTooltipFromTarget = (e: Event, text: string) => {
  const el = e.currentTarget as HTMLElement | null;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  tooltip.text = text;
  tooltip.open = true;

  void nextTick(() => {
    const pad = 12;
    const tipWidth = tooltipEl.value?.offsetWidth ?? 0;
    const tipHeight = tooltipEl.value?.offsetHeight ?? 0;
    const half = tipWidth / 2;

    const cx = rect.left + rect.width / 2;
    const maxX = typeof window !== "undefined" ? window.innerWidth - pad - half : cx;
    const minX = pad + half;
    tooltip.x = Math.min(Math.max(cx, minX), maxX);

    const rawY = rect.top - 10;
    const minY = pad + tipHeight + 8;
    tooltip.y = Math.max(rawY, minY);
  });
};

const hideTooltip = () => {
  tooltip.open = false;
};

const ensurePackageDetails = async (pkgId: string) => {
  if (detailByPackageId.value[pkgId]) return;
  detailByPackageId.value = {
    ...detailByPackageId.value,
    [pkgId]: { isLoading: true, error: null, events: [], latestDetails: null },
  };

  try {
    const res = await api.getPackageStatus(pkgId);
    const events = Array.isArray(res.events) ? res.events : [];
    const sorted = [...events].sort((a, b) => new Date(a.events_at).getTime() - new Date(b.events_at).getTime());
    const latest = sorted.length ? sorted[sorted.length - 1] : null;
    detailByPackageId.value = {
      ...detailByPackageId.value,
      [pkgId]: {
        isLoading: false,
        error: null,
        events: sorted,
        latestDetails: latest?.delivery_details ?? null,
      },
    };
  } catch (err) {
    detailByPackageId.value = {
      ...detailByPackageId.value,
      [pkgId]: {
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
        events: [],
        latestDetails: null,
      },
    };
  }
};

watch(
  expandedIds,
  (set) => {
    for (const pkgId of set) void ensurePackageDetails(pkgId);
  },
  { deep: true },
);

watch(
  () => [
    ...(inTransitResult.value?.packages?.map((p) => p.id) ?? []),
    ...(historyResult.value?.packages?.map((p) => p.id) ?? []),
  ],
  (ids) => {
    const currentIds = new Set(ids);
    expandedIds.value = new Set([...expandedIds.value].filter((id) => currentIds.has(id)));
  },
);

const routeModel = (pkg: any) => {
  const baseNodes = parseRoutePath(pkg.route_path ?? null);
  const nodes =
    baseNodes.length && baseNodes[0] !== TRUCK_ORIGIN_NODE_ID ? [TRUCK_ORIGIN_NODE_ID, ...baseNodes] : [...baseNodes];
  const details = detailByPackageId.value[pkg.id];
  const events = details?.events ?? [];

  const nodeTimeById = new Map<string, string>();
  let originAtFromEvent: string | null = null;
  for (const evt of events) {
    const loc = String(evt.location ?? "").trim();
    if (!loc) continue;
    if (!baseNodes.includes(loc)) continue;
    if (baseNodes.length && loc === baseNodes[0] && isPrePickupEvent(evt, baseNodes[0])) {
      if (!originAtFromEvent) originAtFromEvent = evt.events_at;
      else {
        const cur = new Date(originAtFromEvent).getTime();
        const nxt = new Date(evt.events_at).getTime();
        if (Number.isFinite(nxt) && (!Number.isFinite(cur) || nxt < cur)) originAtFromEvent = evt.events_at;
      }
      continue;
    }
    nodeTimeById.set(loc, evt.events_at);
  }

  const baseNodeTimes = baseNodes.map((node) => nodeTimeById.get(node) ?? null);
  const startTime = (() => {
    if (originAtFromEvent) return originAtFromEvent;
    const createdAt = String(pkg.created_at ?? "").trim();
    if (createdAt) return createdAt;
    if (events.length) return events[0]?.events_at ?? null;
    return null;
  })();

  const nodeTimes = nodes.length && nodes[0] === TRUCK_ORIGIN_NODE_ID ? [startTime, ...baseNodeTimes] : baseNodeTimes;

  const currentIndexFromEvents = (() => {
    for (let i = nodeTimes.length - 1; i >= 0; i -= 1) {
      if (nodeTimes[i]) return i;
    }
    return -1;
  })();

  const currentLocation = String(pkg.current_location ?? "").trim();
  const currentIndexFromLocation = currentLocation ? nodes.findIndex((n) => n === currentLocation) : -1;

  const hasRealNodeEvent = baseNodeTimes.some((t) => Boolean(t));
  const shouldTrustCurrentLocation =
    currentIndexFromLocation >= 0 &&
    (hasRealNodeEvent || (baseNodes.length > 0 && currentLocation !== baseNodes[0]));

  const currentIndex = Math.max(currentIndexFromEvents, 0, shouldTrustCurrentLocation ? currentIndexFromLocation : 0);
  const progressNode = nodes.length ? nodes[Math.min(currentIndex, nodes.length - 1)] : null;
  const progressStage = progressNode ? nodeStageLabel(progressNode) : null;
  const displayNode =
    !hasRealNodeEvent && baseNodes.length > 0 && currentLocation === baseNodes[0]
      ? TRUCK_ORIGIN_NODE_ID
      : currentIndexFromLocation >= 0
        ? nodes[currentIndexFromLocation]
        : progressNode;
  const displayStage = displayNode ? nodeStageLabel(displayNode) : null;

  const segmentTruckIds = nodes.length > 1 ? nodes.slice(0, -1).map(() => null as string | null) : [];

  if (events.length && nodes.length > 1) {
    const nodeSet = new Set(baseNodes);
    const truckEvents = events
      .map((e) => ({ at: e.events_at, loc: String(e.location ?? "").trim() }))
      .filter((e) => e.loc && !nodeSet.has(e.loc));

    const firstRealNodeAt = nodeTimes[nodes[0] === TRUCK_ORIGIN_NODE_ID ? 1 : 0] ?? null;
    const startNodeAt = nodeTimes[0] ?? null;
    if (firstRealNodeAt) {
      const endT = new Date(firstRealNodeAt).getTime();
      const startT = startNodeAt ? new Date(startNodeAt).getTime() : Number.NEGATIVE_INFINITY;
      const candidates = truckEvents.filter((t) => {
        const tAt = new Date(t.at).getTime();
        return Number.isFinite(tAt) && tAt >= startT && tAt < endT;
      });
      const last = candidates.length ? candidates[candidates.length - 1] : undefined;
      if (last) segmentTruckIds[0] = last.loc;
    }

    const nodeTime = (idx: number) => nodeTimes[idx];
    for (let i = 0; i < segmentTruckIds.length; i += 1) {
      if (i === 0 && nodes[0] === TRUCK_ORIGIN_NODE_ID) continue;
      const fromAt = nodeTime(i);
      const toAt = nodeTime(i + 1);
      const candidates = truckEvents.filter((t) => {
        const tAt = new Date(t.at).getTime();
        if (!Number.isFinite(tAt)) return false;
        if (fromAt) {
          const fromT = new Date(fromAt).getTime();
          if (tAt < fromT) return false;
        }
        if (toAt) {
          const toT = new Date(toAt).getTime();
          if (tAt >= toT) return false;
        }
        return true;
      });
      const last = candidates.length ? candidates[candidates.length - 1] : undefined;
      if (last) segmentTruckIds[i] = last.loc;
    }
  }

  return {
    nodes,
    nodeTimes,
    currentIndex,
    currentNode: progressNode,
    stage: progressStage,
    displayNode,
    displayStage,
    segmentTruckIds,
  };
};

const routeNodeState = (pkg: any, index: number) => {
  const model = routeModel(pkg);
  if (index <= model.currentIndex) return pkg.status === "exception" ? "exception" : "ok";
  return "pending";
};

const routeSegState = (pkg: any, segmentIndex: number) => {
  const model = routeModel(pkg);
  if (model.segmentTruckIds[segmentIndex]) return pkg.status === "exception" ? "exception" : "ok";
  if (segmentIndex < model.currentIndex) return pkg.status === "exception" ? "exception" : "ok";
  return "pending";
};

const togglePackage = (pkgId: string) => {
  const next = new Set(expandedIds.value);
  if (next.has(pkgId)) next.delete(pkgId);
  else next.add(pkgId);
  expandedIds.value = next;
};

const clearFilters = () => {
  filters.tracking_number = "";
  filters.date_from = "";
  filters.date_to = "";
  filters.vehicle_id = "";
  filters.location_id = "";
  void lookup();
};

const goToMapNode = async (nodeId: string) => {
  if (nodeId === TRUCK_ORIGIN_NODE_ID) return;
  await router.push({ name: "virtual-map", query: { node: nodeId } });
};

const nodeTooltipText = (nodeId: string) => {
  if (nodeId === TRUCK_ORIGIN_NODE_ID) return "貨車出發地（預留節點）";
  return `住址編號：${nodeId}`;
};

const segmentTooltipText = (pkg: any, segmentIndex: number) => {
  const model = routeModel(pkg);
  const truckId = model.segmentTruckIds[segmentIndex];
  if (truckId) return `貨車編號：${truckId}`;
  if (segmentIndex === 0) return "司機已接到任務，尚未出發";
  return "尚無貨車資訊";
};

const lookup = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    const baseQuery = {
      tracking_number: filters.tracking_number,
      date_from: filters.date_from,
      date_to: filters.date_to,
      vehicle_id: filters.location_id ? "" : filters.vehicle_id,
      location_id: filters.location_id,
    };

    const [inTransit, history] = await Promise.all([
      api.searchTracking({ ...baseQuery, status_group: "in_transit" }),
      api.searchTracking({ ...baseQuery, status_group: "history" }),
    ]);

    inTransitResult.value = inTransit;
    historyResult.value = history;
  } catch (err) {
    inTransitResult.value = null;
    historyResult.value = null;
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(async () => {
  if (!auth.isLoggedIn) return;

  try {
    const map = await api.getMap();
    nodeNameById.value = Object.fromEntries(map.nodes.map((n) => [n.id, n.name]));
    hubAndRegionNodes.value = map.nodes.filter((node) => /^HUB_|^REG_/.test(node.id));
  } catch {
    nodeNameById.value = {};
    hubAndRegionNodes.value = [];
  }

  await lookup();
});
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">客戶</p>
      <h1>包裹追蹤</h1>
      <p class="lede">直接列出所有與你相關的包裹，點擊可展開查看配送流程與預計送達。</p>
    </header>

    <div class="tab-switch">
      <button class="tab-btn" :class="{ active: activeTab === 'in_transit' }" type="button" @click="activeTab = 'in_transit'">
        配送中（{{ inTransitPackages.length }}）
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'history' }" type="button" @click="activeTab = 'history'">
        配送紀錄（{{ historyPackages.length }}）
      </button>
    </div>

    <div class="card filters-card">
      <div class="legend">
        <p class="eyebrow">篩選</p>
      </div>

      <button type="button" class="filters-toggle" @click="filtersOpen = !filtersOpen">
        <span>{{ filtersOpen ? "收合篩選" : "展開篩選" }}</span>
        <span aria-hidden="true">{{ filtersOpen ? "▴" : "▾" }}</span>
      </button>

      <form v-if="filtersOpen" class="form-grid" @submit.prevent="lookup">
        <label class="form-field span-2">
          <span>追蹤編號</span>
          <input v-model="filters.tracking_number" name="tracking_number" type="text" placeholder="例如 TRK-xxxx" />
        </label>

        <label class="form-field">
          <span>運送日期（起）</span>
          <input v-model="filters.date_from" name="date_from" type="date" />
        </label>

        <label class="form-field">
          <span>運送日期（迄）</span>
          <input v-model="filters.date_to" name="date_to" type="date" />
        </label>

        <label class="form-field span-2">
          <span>運輸載具識別碼（貨車編號）</span>
          <input v-model="filters.vehicle_id" name="vehicle_id" type="text" placeholder="例如 TRUCK-001 / ABC-1234" />
        </label>

        <label class="form-field span-2">
          <span>倉儲地點</span>
          <select v-model="filters.location_id" name="location_id">
            <option value="">全部</option>
            <option v-for="node in hubAndRegionNodes" :key="node.id" :value="node.id">{{ node.name }} ({{ node.id }})</option>
          </select>
        </label>

        <button class="primary-btn" type="submit" :disabled="isLoading">{{ isLoading ? "套用中..." : "套用篩選" }}</button>
        <button class="ghost-btn" type="button" @click="clearFilters" :disabled="isLoading">清除篩選</button>
      </form>
    </div>

    <div class="card">
      <div class="legend">
        <p class="eyebrow">{{ activeTab === "in_transit" ? "配送中" : "配送紀錄" }}</p>
      </div>

      <p v-if="error" class="hint">{{ error }}</p>

      <div v-if="isLoading" class="empty-state">
        <p>讀取中，請稍候...</p>
      </div>

      <div v-else-if="inTransitResult && historyResult" class="results">
        <p class="hint">
          <span v-if="activeTab === 'in_transit'">配送中顯示 {{ inTransitPackages.length }} 筆（最多顯示 100 筆）</span>
          <span v-else>配送紀錄顯示 {{ historyPackages.length }} 筆（最多顯示 100 筆）</span>
          <span v-if="totalForActiveTab !== packagesForActiveTab.length"> · 共 {{ totalForActiveTab }} 筆</span>
        </p>

        <div v-if="packagesForActiveTab.length === 0" class="empty-state">
          <p v-if="activeTab === 'in_transit'">目前沒有配送中的包裹。</p>
          <p v-else>目前沒有配送紀錄。</p>
        </div>

        <ul v-else class="package-list">
          <li
            v-for="pkg in packagesForActiveTab"
            :id="`pkg-${pkg.id}`"
            :key="pkg.id"
            class="package-row"
            :class="{ active: expandedIds.has(pkg.id) }"
          >
            <button type="button" class="row-btn" @click="togglePackage(pkg.id)">
              <span class="tracking">包裹編號 | {{ pkg.tracking_number || pkg.id }}</span>
              <span
                class="pill"
                :class="{ ok: statusKeyForPackage(pkg) === 'ok', warning: statusKeyForPackage(pkg) === 'exception' }"
              >
                {{ statusLabel(statusKeyForPackage(pkg)) }}
              </span>
              <span class="meta">更新：{{ formatDateTime(pkg.current_updated_at) }}</span>
            </button>

            <div v-if="expandedIds.has(pkg.id)" class="package-detail">
              <div class="detail-grid">
                <div class="detail-item">
                  <p class="detail-label">建立時間</p>
                  <p class="detail-value">{{ formatDateTime(pkg.created_at) }}</p>
                </div>
                <div class="detail-item">
                  <p class="detail-label">預計送達</p>
                  <p class="detail-value">{{ formatDate(estimatedDeliveryFallback(pkg)) }}</p>
                </div>
              </div>

              <div class="progress-wrap">
                <div class="progress-head">
                  <span class="detail-label">配送路徑</span>
                  <div class="route-legend">
                    <span class="legend-pill ok">正常</span>
                    <span class="legend-pill exception">異常</span>
                    <span class="legend-pill pending">未發生</span>
                  </div>
                </div>

                <div v-if="routeModel(pkg).nodes.length > 1" class="route-stepper" aria-label="配送流程">
                  <template v-for="(node, idx) in routeModel(pkg).nodes" :key="`${pkg.id}-node-${idx}`">
                    <div class="route-step" :class="[routeNodeState(pkg, idx), { current: node === routeModel(pkg).displayNode }]">
                      <div class="route-stage">{{ nodeStageLabel(node) }}</div>
                      <button
                        type="button"
                        class="route-circle route-hit"
                        @mouseenter="showTooltipFromTarget($event, nodeTooltipText(node))"
                        @mouseleave="hideTooltip"
                        @focus="showTooltipFromTarget($event, nodeTooltipText(node))"
                        @blur="hideTooltip"
                        @click="goToMapNode(node)"
                        aria-label="前往地圖節點"
                      >
                      </button>
                      <div class="route-time" :class="routeNodeState(pkg, idx)">{{ formatEventTime(routeModel(pkg).nodeTimes[idx]) }}</div>
                    </div>

                    <button
                      v-if="idx < routeModel(pkg).nodes.length - 1"
                      :key="`${pkg.id}-seg-${idx}`"
                      type="button"
                      class="route-seg route-hit"
                      :class="routeSegState(pkg, idx)"
                      @mouseenter="showTooltipFromTarget($event, segmentTooltipText(pkg, idx))"
                      @mouseleave="hideTooltip"
                      @focus="showTooltipFromTarget($event, segmentTooltipText(pkg, idx))"
                      @blur="hideTooltip"
                      aria-label="運輸路段"
                    />
                  </template>
                </div>
                <div v-else class="progress-hint">此包裹尚未產生 route_path，無法繪製路徑進度。</div>

                <p class="route-summary">
                  <span class="summary-label">目前位置：</span>
                  <span class="summary-value">
                    <template v-if="routeModel(pkg).displayNode">
                      {{ displayNodeText(routeModel(pkg).displayNode) }}
                    </template>
                    <template v-else>{{ pkg.current_location || "-" }}</template>
                  </span>
                  <span class="summary-sep">·</span>
                  <span class="summary-label">狀態資訊：</span>
                  <span class="summary-value">
                    <template v-if="detailByPackageId[pkg.id]?.isLoading">讀取中...</template>
                    <template v-else-if="detailByPackageId[pkg.id]?.error">{{ detailByPackageId[pkg.id]?.error }}</template>
                    <template v-else>{{ detailByPackageId[pkg.id]?.latestDetails || "-" }}</template>
                  </span>
                </p>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>

  <div v-if="tooltip.open" ref="tooltipEl" class="hover-tip" :style="tooltipStyle" role="tooltip">
    {{ tooltip.text }}
  </div>
</template>

<style scoped>
.filters-card {
  margin-top: 14px;
}

.filters-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  font-weight: 700;
  margin: 10px 0 12px 0;
}

.results {
  margin-top: 16px;
}

.package-list {
  display: grid;
  gap: 12px;
  padding: 0;
  margin: 10px 0 0 0;
  list-style: none;
}

.package-row {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  overflow: hidden;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.package-row.active {
  border-color: var(--accent);
}

.row-btn {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 10px 12px;
  align-items: center;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 12px 14px;
  cursor: pointer;
}

.tracking {
  font-weight: 800;
}

.pill {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
  font-weight: 800;
  letter-spacing: 0.02em;
}

.pill.ok {
  background: rgba(34, 197, 94, 0.18);
  color: rgb(10, 11, 10);
  box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.22);
}

.pill.warning {
  background: rgba(255, 193, 7, 0.18);
  color: rgba(140, 105, 0, 1);
  box-shadow: inset 0 0 0 1px rgba(255, 193, 7, 0.25);
}

.meta {
  font-size: 13px;
  opacity: 0.85;
  white-space: nowrap;
}

.package-detail {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  padding: 12px 14px 14px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px 14px;
  margin-bottom: 12px;
}

.detail-item {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.03);
}

.detail-label {
  margin: 0 0 4px 0;
  font-size: 14px;
  opacity: 0.75;
}

.detail-value {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}

.progress-wrap {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.03);
}

.progress-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.route-legend {
  display: flex;
  gap: 8px;
}

.legend-pill {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
}

.legend-pill.ok {
  background: rgba(46, 160, 67, 0.18);
  color: rgba(28, 117, 48, 1);
}

.legend-pill.exception {
  background: rgba(255, 193, 7, 0.18);
  color: rgba(140, 105, 0, 1);
}

.legend-pill.pending {
  background: rgba(120, 120, 120, 0.16);
  color: rgba(60, 60, 60, 0.9);
}

.route-stepper {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  overflow-x: auto;
  padding: 8px 16px 8px;
  -webkit-overflow-scrolling: touch;
}

.route-step {
  flex: 0 0 auto;
  width: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.route-time {
  font-size: 11px;
  line-height: 1.15;
  opacity: 0.85;
  text-align: center;
  white-space: pre-line;
  min-height: 28px;
}

.route-stage {
  opacity: 0.95;
  text-align: center;
}

.route-node-name {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  opacity: 0.8;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.route-seg {
  flex: 0 0 72px;
  height: 10px;
  border-radius: 999px;
  margin-top: 42px;
  background: rgba(120, 120, 120, 0.22);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.06),
    0 6px 16px rgba(0, 0, 0, 0.06);
  border: 0;
  padding: 0;
}

.route-seg.pre {
  margin-top: 50px;
}

.route-seg.ok {
  background: linear-gradient(90deg, rgba(46, 160, 67, 0.9), rgba(66, 188, 90, 0.85));
}

.route-seg.exception {
  background: linear-gradient(90deg, rgba(255, 193, 7, 0.95), rgba(255, 214, 102, 0.9));
}

.route-seg.pending {
  background: rgba(120, 120, 120, 0.22);
}

.route-circle {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(120, 120, 120, 0.16);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.08),
    0 10px 26px rgba(0, 0, 0, 0.08);
  border: 0;
  padding: 0;
}

.route-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(120, 120, 120, 0.6);
}

.route-step.ok .route-circle {
  background: rgba(46, 160, 67, 0.18);
  box-shadow:
    inset 0 0 0 1px rgba(46, 160, 67, 0.25),
    0 12px 30px rgba(46, 160, 67, 0.15);
}

.route-step.ok .route-dot {
  background: rgba(46, 160, 67, 0.9);
}

.route-step.exception .route-circle {
  background: rgba(255, 193, 7, 0.2);
  box-shadow:
    inset 0 0 0 1px rgba(255, 193, 7, 0.32),
    0 12px 30px rgba(255, 193, 7, 0.12);
}

.route-step.exception .route-dot {
  background: rgba(255, 193, 7, 0.95);
}

.route-step.pending .route-circle {
  background: rgba(120, 120, 120, 0.12);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.06),
    0 10px 26px rgba(0, 0, 0, 0.06);
}

.route-step.current .route-circle {
  transform: translateY(-1px) scale(1.03);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.08),
    0 16px 40px rgba(0, 0, 0, 0.12);
}

.route-hit {
  position: relative;
  cursor: pointer;
  transition:
    transform 160ms ease,
    filter 160ms ease,
    box-shadow 160ms ease;
}

.route-hit:hover {
  transform: translateY(-2px) scale(1.015);
  filter: brightness(1.03) saturate(1.04);
}

.route-hit:focus-visible {
  outline: 2px solid rgba(99, 102, 241, 0.55);
  outline-offset: 3px;
}

.route-circle.route-hit:hover,
.route-circle.route-hit:focus-visible {
  box-shadow:
    inset 0 0 0 1px rgba(15, 23, 42, 0.08),
    0 18px 48px rgba(0, 0, 0, 0.14);
}

.route-seg.route-hit:hover,
.route-seg.route-hit:focus-visible {
  box-shadow:
    0 12px 26px rgba(0, 0, 0, 0.14),
    0 0 0 1px rgba(15, 23, 42, 0.08);
}

.hover-tip {
  position: fixed;
  transform: translate(-50%, -100%);
  padding: 7px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow:
    0 16px 46px rgba(0, 0, 0, 0.18),
    0 0 0 1px rgba(15, 23, 42, 0.08);
  font-size: 12px;
  line-height: 1.2;
  max-width: min(320px, calc(100vw - 24px));
  white-space: normal;
  text-align: center;
  z-index: 9999;
  pointer-events: none;
}

.progress-hint {
  font-size: 13px;
  opacity: 0.85;
}

.route-summary {
  margin: 10px 0 0 0;
  font-size: 13px;
  opacity: 0.92;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: baseline;
}

.summary-label {
  opacity: 0.75;
}

.summary-sep {
  opacity: 0.35;
}
</style>
