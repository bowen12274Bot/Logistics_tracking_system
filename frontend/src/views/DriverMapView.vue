<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api, type MapEdge, type MapNode, type VehicleRecord } from "../services/api";
import { useFullscreen } from "../composables/useFullscreen";
const truckIconUrl = new URL("../assets/truck.png", import.meta.url).href;

type ViewBox = { x: number; y: number; w: number; h: number };

const loading = ref(true);
const error = ref<string | null>(null);

const nodes = ref<MapNode[]>([]);
const edges = ref<MapEdge[]>([]);

const vehicle = ref<VehicleRecord | null>(null);
const currentNodeId = ref<string | null>(null);
const truckCode = computed(() => vehicle.value?.vehicle_code ?? "TRUCK");
const truckFlipX = ref<1 | -1>(1);

const svgEl = ref<SVGSVGElement | null>(null);
const stageEl = ref<HTMLDivElement | null>(null);
const { isSupported: fullscreenSupported, isFullscreen, toggle: toggleFullscreen } =
  useFullscreen(stageEl);

const nodesById = computed(() => {
  const map = new Map<string, MapNode>();
  for (const node of nodes.value) map.set(node.id, node);
  return map;
});

const neighborsById = computed(() => {
  const map = new Map<string, Set<string>>();
  for (const edge of edges.value) {
    const a = String(edge.source).trim();
    const b = String(edge.target).trim();
    if (!map.has(a)) map.set(a, new Set());
    if (!map.has(b)) map.set(b, new Set());
    map.get(a)!.add(b);
    map.get(b)!.add(a);
  }
  return map;
});

const currentNode = computed(() =>
  currentNodeId.value ? nodesById.value.get(currentNodeId.value) ?? null : null,
);

function computeInitialViewBox(allNodes: MapNode[]): ViewBox {
  if (allNodes.length === 0) return { x: 0, y: 0, w: 10000, h: 10000 };
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of allNodes) {
    if (node.x < minX) minX = node.x;
    if (node.x > maxX) maxX = node.x;
    if (node.y < minY) minY = node.y;
    if (node.y > maxY) maxY = node.y;
  }
  const padX = Math.max(200, (maxX - minX) * 0.06);
  const padY = Math.max(200, (maxY - minY) * 0.06);
  return { x: minX - padX, y: minY - padY, w: (maxX - minX) + padX * 2, h: (maxY - minY) + padY * 2 };
}

const initialViewBox = ref<ViewBox>({ x: 0, y: 0, w: 10000, h: 10000 });
const viewBox = reactive<ViewBox>({ x: 0, y: 0, w: 10000, h: 10000 });
const viewBoxAttr = computed(() => `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);

const drag = reactive({
  active: false,
  startClientX: 0,
  startClientY: 0,
  moved: false,
  downNodeId: null as string | null,
  startBox: { x: 0, y: 0, w: 10000, h: 10000 } as ViewBox,
});

function eventToNodeId(e: Event): string | null {
  const target = e.target as Element | null;
  if (!target) return null;
  const nodeEl = target.closest("g.node") as SVGGElement | null;
  const id = nodeEl?.dataset?.nodeId;
  return typeof id === "string" && id ? id : null;
}

function clientToSvg(clientX: number, clientY: number): { x: number; y: number } | null {
  const el = svgEl.value;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const px = (clientX - rect.left) / rect.width;
  const py = (clientY - rect.top) / rect.height;
  return { x: viewBox.x + px * viewBox.w, y: viewBox.y + py * viewBox.h };
}

function onWheel(e: WheelEvent) {
  const cursor = clientToSvg(e.clientX, e.clientY);
  const el = svgEl.value;
  if (!cursor || !el) return;
  e.preventDefault();
  const rect = el.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width;
  const py = (e.clientY - rect.top) / rect.height;
  const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;
  const newW = viewBox.w * zoomFactor;
  const newH = viewBox.h * zoomFactor;
  viewBox.x = cursor.x - px * newW;
  viewBox.y = cursor.y - py * newH;
  viewBox.w = newW;
  viewBox.h = newH;
}

function onPointerDown(e: PointerEvent) {
  const el = svgEl.value;
  if (!el) return;
  e.preventDefault();
  el.setPointerCapture(e.pointerId);
  drag.active = true;
  drag.startClientX = e.clientX;
  drag.startClientY = e.clientY;
  drag.moved = false;
  drag.downNodeId = eventToNodeId(e);
  drag.startBox = { x: viewBox.x, y: viewBox.y, w: viewBox.w, h: viewBox.h };
}

function onPointerMove(e: PointerEvent) {
  if (!drag.active) return;
  const el = svgEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const dx = (e.clientX - drag.startClientX) / rect.width;
  const dy = (e.clientY - drag.startClientY) / rect.height;
  if (!drag.moved) {
    const px = e.clientX - drag.startClientX;
    const py = e.clientY - drag.startClientY;
    if (Math.hypot(px, py) >= 6) drag.moved = true;
  }
  viewBox.x = drag.startBox.x - dx * drag.startBox.w;
  viewBox.y = drag.startBox.y - dy * drag.startBox.h;
}

function onPointerUp(e: PointerEvent) {
  const el = svgEl.value;
  if (el) el.releasePointerCapture(e.pointerId);
  drag.active = false;
  if (!drag.moved && drag.downNodeId && currentNodeId.value) {
    const id = drag.downNodeId;
    if (moving.value) {
      // ignore interactions while moving
    } else if (isNeighbor(id)) void animateMoveTo(id);
    else void highlightRouteTo(id);
  }
  drag.downNodeId = null;
}

function nodeStyle(node: MapNode) {
  if (node.level === 1) return { r: 150, fill: "#2563eb" };
  if (node.level === 2) return { r: 95, fill: "#16a34a" };
  if (node.subtype === "store") return { r: 55, fill: "#a855f7" };
  return { r: 55, fill: "#f97316" };
}

const moving = ref(false);
const truckPos = reactive({ x: 0, y: 0 });
const activeRoutePath = ref<string[] | null>(null);
const activeRouteTargetId = ref<string | null>(null);
const hoveredNodeId = ref<string | null>(null);

const hoveredNode = computed(() => {
  const id = hoveredNodeId.value;
  return id ? nodesById.value.get(id) ?? null : null;
});

const hoveredIsNeighbor = computed(() => {
  const id = hoveredNodeId.value;
  if (!id) return false;
  return isNeighbor(id);
});

const routeSegments = computed(() => {
  const path = activeRoutePath.value;
  if (!path || path.length < 2) return [];

  const segments: Array<{
    from: MapNode;
    to: MapNode;
    key: string;
    tier: "near" | "mid" | "far";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }> = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (!a || !b) continue;
    const from = nodesById.value.get(a);
    const to = nodesById.value.get(b);
    if (!from || !to) continue;
    const key = a < b ? `${a}::${b}` : `${b}::${a}`;
    const tier: "near" | "mid" | "far" = i === 0 ? "near" : i === 1 ? "mid" : "far";

    segments.push({
      from,
      to,
      key,
      tier,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
    });
  }
  return segments;
});

function isNeighbor(targetId: string) {
  const from = currentNodeId.value;
  if (!from) return false;
  return neighborsById.value.get(from)?.has(targetId) ?? false;
}

async function highlightRouteTo(targetId: string) {
  if (moving.value) return;
  const from = currentNodeId.value;
  if (!from) return;
  if (targetId === from) {
    activeRoutePath.value = null;
    activeRouteTargetId.value = null;
    return;
  }
  if (activeRouteTargetId.value === targetId && activeRoutePath.value) {
    activeRoutePath.value = null;
    activeRouteTargetId.value = null;
    return;
  }
  try {
    const res = await api.getMapRoute({ from, to: targetId });
    activeRoutePath.value = res.route.path;
    activeRouteTargetId.value = targetId;
    if (res.route.path.length >= 2) {
      const nextId = String(res.route.path[1] ?? "");
      const fromNode = nodesById.value.get(from);
      const nextNode = nodesById.value.get(nextId);
      if (fromNode && nextNode) {
        truckFlipX.value = nextNode.x - fromNode.x < 0 ? -1 : 1;
      }
    }
  } catch {
    activeRoutePath.value = null;
    activeRouteTargetId.value = null;
  }
}

async function refreshActiveRouteFromCurrent() {
  if (moving.value) return;
  const to = activeRouteTargetId.value;
  const from = currentNodeId.value;
  if (!to || !from) return;
  if (to === from) {
    activeRoutePath.value = null;
    activeRouteTargetId.value = null;
    return;
  }

  try {
    const res = await api.getMapRoute({ from, to });
    activeRoutePath.value = res.route.path;
    if (res.route.path.length >= 2) {
      const nextId = String(res.route.path[1] ?? "");
      const fromNode = nodesById.value.get(from);
      const nextNode = nodesById.value.get(nextId);
      if (fromNode && nextNode) {
        truckFlipX.value = nextNode.x - fromNode.x < 0 ? -1 : 1;
      }
    }
  } catch {
    activeRoutePath.value = null;
    activeRouteTargetId.value = null;
  }
}

const zoomScale = computed(() => {
  const base = Number(initialViewBox.value.w);
  const cur = Number(viewBox.w);
  if (!Number.isFinite(base) || !Number.isFinite(cur) || cur <= 0) return 1;
  return base / cur;
});

type EdgeTier = "hub_hub" | "hub_reg" | "reg_reg" | "reg_end";

const edgeWidths = computed(() => {
  const z = zoomScale.value;
  if (z < 1.15) return { hub_hub: 11, hub_reg: 9, reg_reg: 6, reg_end: 6 } as const;
  if (z < 2.0) return { hub_hub: 16, hub_reg: 13, reg_reg: 9, reg_end: 9 } as const;
  return { hub_hub: 23, hub_reg: 19, reg_reg: 13, reg_end: 13 } as const;
});

const routeActive = computed(() => Boolean(activeRoutePath.value && activeRoutePath.value.length > 1));

function edgeTier(edge: MapEdge): EdgeTier {
  const a = nodesById.value.get(String(edge.source).trim());
  const b = nodesById.value.get(String(edge.target).trim());
  const la = a?.level ?? 3;
  const lb = b?.level ?? 3;
  if (la === 1 && lb === 1) return "hub_hub";
  if ((la === 1 && lb === 2) || (la === 2 && lb === 1)) return "hub_reg";
  if (la === 2 && lb === 2) return "reg_reg";
  return "reg_end";
}

function edgeStrokeWidth(edge: MapEdge) {
  return edgeWidths.value[edgeTier(edge)];
}

function edgeOpacity(edge: MapEdge) {
  const tier = edgeTier(edge);
  const base =
    tier === "hub_hub" ? 0.58 : tier === "hub_reg" ? 0.48 : tier === "reg_reg" ? 0.34 : 0.44;
  return routeActive.value ? base * 0.55 : base;
}

function edgeStroke(edge: MapEdge) {
  const tier = edgeTier(edge);
  if (tier === "hub_hub") return "rgba(100, 116, 139, 0.98)";
  if (tier === "hub_reg") return "rgba(148, 163, 184, 0.96)";
  if (tier === "reg_reg") return "rgba(148, 163, 184, 0.9)";
  return "rgba(71, 85, 105, 0.9)";
}

const routeEdgeWidths = computed(() => {
  const z = zoomScale.value;
  if (z < 1.15) return { near: 28, mid: 20, far: 14 };
  if (z < 2.0) return { near: 38, mid: 28, far: 20 };
  return { near: 52, mid: 38, far: 28 };
});

const routeCasingWidths = computed(() => {
  const w = routeEdgeWidths.value;
  return { near: w.near + 14, mid: w.mid + 12, far: w.far + 10 };
});

function shouldShowLabel(node: MapNode) {
  if (node.id === currentNodeId.value) return true;
  if (currentNodeId.value && neighborsById.value.get(currentNodeId.value)?.has(node.id)) return true;
  if (node.level <= 2) return true;
  return zoomScale.value >= 2.2;
}

const labelPosById = computed(() => {
  const regs = nodes.value.filter((n) => n.level === 2);
  const map = new Map<
    string,
    { x: number; y: number; anchor: "start" | "middle" | "end"; cls: string }
  >();

  for (const node of nodes.value) {
    if (node.level !== 3 || !node.id.startsWith("END_") || regs.length === 0) continue;

    let nearest: MapNode | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const reg of regs) {
      const dx = node.x - reg.x;
      const dy = node.y - reg.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        nearest = reg;
      }
    }

    if (!nearest) continue;
    const dx = node.x - nearest.x;
    const dy = node.y - nearest.y;
    const mag = Math.hypot(dx, dy) || 1;
    const ux = dx / mag;
    const uy = dy / mag;
    const offset = 170;
    const x = node.x + ux * offset;
    const y = node.y + uy * offset;
    const anchor: "start" | "end" = ux >= 0 ? "start" : "end";
    map.set(node.id, { x, y, anchor, cls: "end" });
  }

  return map;
});

function labelProps(node: MapNode): {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  cls: string;
} {
  const end = labelPosById.value.get(node.id);
  if (end) return end;
  return { x: node.x, y: node.y - nodeStyle(node).r - 60, anchor: "middle", cls: node.level <= 2 ? "major" : "" };
}

function edgeDistance(fromId: string, toId: string) {
  const hit = edges.value.find((e) => {
    const a = String(e.source).trim();
    const b = String(e.target).trim();
    return (a === fromId && b === toId) || (a === toId && b === fromId);
  });
  return hit ? Number(hit.distance) : null;
}

async function animateMoveTo(targetId: string) {
  const fromId = currentNodeId.value;
  const fromNode = fromId ? nodesById.value.get(fromId) : null;
  const toNode = nodesById.value.get(targetId);
  if (!fromId || !fromNode || !toNode) return;
  if (!isNeighbor(targetId)) return;
  if (moving.value) return;

  moving.value = true;

  const fromX = fromNode.x;
  const fromY = fromNode.y;
  const toX = toNode.x;
  const toY = toNode.y;
  truckFlipX.value = toX - fromX < 0 ? -1 : 1;

  const distance = edgeDistance(fromId, targetId) ?? Math.hypot(toX - fromX, toY - fromY);
  const speed = 1200;
  const durationMs = Math.max(600, Math.min(6000, (distance / speed) * 1000));

  const startedAt = performance.now();
  truckPos.x = fromX;
  truckPos.y = fromY;

  await new Promise<void>((resolve) => {
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      truckPos.x = fromX + (toX - fromX) * t;
      truckPos.y = fromY + (toY - fromY) * t;
      if (t >= 1) return resolve();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  try {
    await api.moveVehicleMe({ fromNodeId: fromId, toNodeId: targetId });
    currentNodeId.value = targetId;
    if (vehicle.value) vehicle.value.current_node_id = targetId;
  } catch (e: any) {
    error.value = `更新車輛位置失敗：${String(e?.message ?? e)}`;
    truckPos.x = fromX;
    truckPos.y = fromY;
  } finally {
    moving.value = false;
  }

  await refreshActiveRouteFromCurrent();
}

function focusOnNode(id: string) {
  const node = nodesById.value.get(id);
  if (!node) return;
  const targetW = Math.min(initialViewBox.value.w, 3600);
  const targetH = Math.min(initialViewBox.value.h, 3600);
  viewBox.w = targetW;
  viewBox.h = targetH;
  viewBox.x = node.x - targetW / 2;
  viewBox.y = node.y - targetH / 2;
}

onMounted(async () => {
  loading.value = true;
  error.value = null;
  try {
    const map = await api.getMap();
    nodes.value = map.nodes ?? [];
    edges.value = map.edges ?? [];

    initialViewBox.value = computeInitialViewBox(nodes.value);
    viewBox.x = initialViewBox.value.x;
    viewBox.y = initialViewBox.value.y;
    viewBox.w = initialViewBox.value.w;
    viewBox.h = initialViewBox.value.h;

    try {
      const me = await api.getVehicleMe();
      vehicle.value = me.vehicle;
      currentNodeId.value = me.vehicle.current_node_id ?? me.vehicle.home_node_id ?? null;
    } catch {
      vehicle.value = null;
      currentNodeId.value = nodes.value[0]?.id ?? null;
    }

    if (currentNodeId.value) {
      const n = nodesById.value.get(currentNodeId.value);
      if (n) {
        truckPos.x = n.x;
        truckPos.y = n.y;
        focusOnNode(n.id);
      }
    }
  } catch (e: any) {
    error.value = String(e?.message ?? e);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="page-shell map-page--bleed">
    <header class="page-header section-header--split">
      <div>
        <p class="eyebrow">員工 · 司機</p>
        <h1>司機地圖</h1>
        <p class="lede">只顯示自己的貨車，並可在相鄰節點間移動。</p>
      </div>
    </header>

    <div v-if="error" class="card error-card">{{ error }}</div>
    <div v-else-if="loading" class="card">載入中…</div>

    <div v-else ref="stageEl" class="card map-canvas" :class="{ fullscreen: isFullscreen }">
      <div class="map-stage">
        <div class="map-controls">
          <button
            v-if="fullscreenSupported"
            class="ghost-btn"
            type="button"
            @click="toggleFullscreen"
          >
            {{ isFullscreen ? "退出全螢幕" : "全螢幕" }}
          </button>
        </div>

        <svg
          ref="svgEl"
          class="map-svg"
          :viewBox="viewBoxAttr"
          @wheel="onWheel"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
        >
          <g class="edges">
            <line
              v-for="e in edges"
              :key="e.id"
              class="edge-line"
              :stroke="edgeStroke(e)"
              :opacity="edgeOpacity(e)"
              :stroke-width="edgeStrokeWidth(e)"
              :x1="nodesById.get(e.source)?.x ?? 0"
              :y1="nodesById.get(e.source)?.y ?? 0"
              :x2="nodesById.get(e.target)?.x ?? 0"
              :y2="nodesById.get(e.target)?.y ?? 0"
            />
          </g>

          <g v-if="routeSegments.length > 0" class="route">
            <line
              v-for="seg in routeSegments"
              :key="`${seg.key}::casing`"
              class="route-casing"
              :class="seg.tier"
              :stroke-width="routeCasingWidths[seg.tier]"
              :x1="seg.x1"
              :y1="seg.y1"
              :x2="seg.x2"
              :y2="seg.y2"
            />
            <line
              v-for="seg in routeSegments"
              :key="`${seg.key}::core`"
              class="route-line"
              :class="seg.tier"
              :stroke-width="routeEdgeWidths[seg.tier]"
              :x1="seg.x1"
              :y1="seg.y1"
              :x2="seg.x2"
              :y2="seg.y2"
            />
          </g>

          <g class="nodes">
            <g
              v-for="n in nodes"
              :key="n.id"
              class="node"
              :data-node-id="n.id"
              :class="{
                current: n.id === currentNodeId,
                neighbor: currentNodeId ? neighborsById.get(currentNodeId)?.has(n.id) : false,
                hovered: hoveredNodeId === n.id,
              }"
              @mouseenter="hoveredNodeId = n.id"
              @mouseleave="hoveredNodeId = null"
              @dblclick.stop="focusOnNode(n.id)"
            >
              <circle
                v-if="hoveredNodeId === n.id"
                :cx="n.x"
                :cy="n.y"
                :r="nodeStyle(n).r + 24"
                class="hover-ring"
              />
              <circle
                v-if="hoveredNodeId === n.id"
                :cx="n.x"
                :cy="n.y"
                :r="nodeStyle(n).r + 20"
                class="hover-glow"
              />
              <circle
                v-if="
                  hoveredNodeId === n.id &&
                  currentNodeId &&
                  neighborsById.get(currentNodeId)?.has(n.id)
                "
                :cx="n.x"
                :cy="n.y"
                :r="nodeStyle(n).r + 120"
                class="neighbor-halo"
              />
              <circle
                :cx="n.x"
                :cy="n.y"
                :r="nodeStyle(n).r"
                :fill="nodeStyle(n).fill"
                :stroke="
                  n.id === currentNodeId
                    ? 'rgba(59, 130, 246, 0.95)'
                    : currentNodeId && neighborsById.get(currentNodeId)?.has(n.id)
                      ? 'rgba(34, 197, 94, 0.85)'
                      : 'rgba(15, 23, 42, 0.18)'
                "
                :stroke-width="
                  n.id === currentNodeId
                    ? 24
                    : currentNodeId && neighborsById.get(currentNodeId)?.has(n.id)
                      ? 28
                      : 12
                "
              />
              <text
                v-if="shouldShowLabel(n)"
                :x="labelProps(n).x"
                :y="labelProps(n).y"
                :text-anchor="labelProps(n).anchor"
                class="node-label"
                :class="labelProps(n).cls"
              >
                {{ n.name }}
              </text>
            </g>
          </g>

          <g class="truck" :transform="`translate(${truckPos.x} ${truckPos.y})`">
            <g class="truck-icon-wrap" :transform="truckFlipX < 0 ? 'scale(-1 1)' : undefined">
              <image
                class="truck-icon"
                :href="truckIconUrl"
                :xlink:href="truckIconUrl"
                x="-300"
                y="-240"
                width="600"
                height="480"
                preserveAspectRatio="xMidYMid meet"
              />
            </g>
            <text y="-96" text-anchor="middle" class="truck-code">{{ truckCode }}</text>
          </g>
        </svg>

        <div class="card map-overlay" role="complementary" aria-label="driver map panel">
          <p class="eyebrow">狀態</p>
          <div class="hint">
            <div><strong>貨車編號：</strong>{{ vehicle?.vehicle_code ?? "未串接" }}</div>
            <div><strong>目前位置：</strong>{{ currentNodeId ?? "-" }}</div>
          </div>

          <div v-if="activeRoutePath" class="hint">
            <p class="eyebrow">導航路徑</p>
            <div class="route-chip">{{ activeRoutePath.join(" → ") }}</div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.map-page--bleed {
  width: min(1600px, calc(100vw - 48px));
  position: relative;
  left: 50%;
  transform: translateX(-50%);
}

.section-header--split {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.map-controls {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 5;
  display: flex;
  gap: 8px;
  pointer-events: auto;
}

.map-canvas {
  height: clamp(620px, 76vh, 860px);
  padding: 0;
  overflow: hidden;
  position: relative;
  background: #ffffff;
}

.map-stage {
  position: relative;
  width: 100%;
  height: 100%;
}

.map-svg {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
  background:
    radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.35) 1px, transparent 0) 0 0 / 26px 26px,
    #ffffff;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.map-svg:active {
  cursor: grabbing;
}

.edge-line {
  stroke-linecap: round;
  stroke-linejoin: round;
}

.route-casing {
  stroke: rgba(15, 23, 42, 0.28);
  stroke-linecap: round;
  stroke-linejoin: round;
}

.route-line {
  stroke: rgba(236, 239, 82, 0.95);
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 10px rgba(236, 239, 82, 0.35));
}

.route-line.near {
  opacity: 1;
}

.route-line.mid {
  opacity: 0.88;
}

.route-line.far {
  opacity: 0.76;
}

.neighbor-halo {
  fill: none;
  stroke: rgba(34, 197, 94, 0.5);
  stroke-width: 46;
  opacity: 0.22;
  pointer-events: none;
  animation: neighborPulse 1200ms ease-out infinite;
}

@keyframes neighborPulse {
  0% {
    opacity: 0.22;
    stroke-width: 56;
  }
  70% {
    opacity: 0.06;
    stroke-width: 20;
  }
  100% {
    opacity: 0;
    stroke-width: 20;
  }
}

.node-label {
  font-size: 120px;
  fill: rgba(15, 23, 42, 0.85);
  pointer-events: none;
  user-select: none;
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.85);
  stroke-width: 22px;
}

.node-label.major {
  font-weight: 700;
}

.node-label.end {
  font-size: 92px;
  stroke-width: 18px;
}

.node.neighbor .node-label {
  fill: rgba(21, 128, 61, 0.95);
}

.node {
  cursor: pointer;
}

.hover-ring {
  fill: none;
  stroke: rgba(15, 23, 42, 0.22);
  stroke-width: 18;
  opacity: 0.9;
  pointer-events: none;
}

.hover-glow {
  fill: none;
  stroke: rgba(59, 130, 246, 0.6);
  stroke-width: 22;
  opacity: 0.28;
  pointer-events: none;
  filter: drop-shadow(0 0 14px rgba(59, 130, 246, 0.32));
  animation: hoverPulse 1200ms ease-out infinite;
}

@keyframes hoverPulse {
  0% {
    opacity: 0.26;
    stroke-width: 26;
  }
  70% {
    opacity: 0.10;
    stroke-width: 14;
  }
  100% {
    opacity: 0.18;
    stroke-width: 14;
  }
}

.node circle {
  vector-effect: none;
}

.truck-code {
  font-size: 72px;
  fill: rgba(15, 23, 42, 0.92);
  pointer-events: none;
  user-select: none;
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.92);
  stroke-width: 22px;
}

.truck-icon {
  pointer-events: none;
  user-select: none;
}

.map-overlay {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 220px;
  max-height: calc(100% - 24px);
  overflow: auto;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(8px);
}

.hint {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
}

.route-chip {
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.06);
  word-break: break-word;
}

.fullscreen {
  height: 100vh;
  background: #ffffff;
}

:fullscreen .map-overlay {
  top: 18px;
  right: 18px;
}

@media (max-width: 900px) {
  .map-page--bleed {
    width: auto;
    position: static;
    left: auto;
    transform: none;
  }
  .map-canvas {
    height: clamp(520px, 62vh, 720px);
  }
  .map-overlay {
    position: static;
    width: auto;
    max-height: none;
    margin: 12px;
  }
}
</style>
