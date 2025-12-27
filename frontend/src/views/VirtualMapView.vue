<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { api, type MapEdge, type MapNode } from "../services/api";
import { useFullscreen } from "../composables/useFullscreen";
import UiCard from "../components/ui/UiCard.vue";
import UiPageShell from "../components/ui/UiPageShell.vue";

type ViewBox = { x: number; y: number; w: number; h: number };

const loading = ref(true);
const error = ref<string | null>(null);

const nodes = ref<MapNode[]>([]);
const edges = ref<MapEdge[]>([]);
const selectedNodeId = ref<string | null>(null);
const hoveredNodeId = ref<string | null>(null);
const route = useRoute();

const svgEl = ref<SVGSVGElement | null>(null);
const stageEl = ref<HTMLDivElement | null>(null);
const { isSupported: fullscreenSupported, isFullscreen, toggle: toggleFullscreen } =
  useFullscreen(stageEl);

const nodesById = computed(() => {
  const map = new Map<string, MapNode>();
  for (const node of nodes.value) map.set(node.id, node);
  return map;
});

const selectedNode = computed(() =>
  selectedNodeId.value ? nodesById.value.get(selectedNodeId.value) ?? null : null,
);

const hoveredNode = computed(() =>
  hoveredNodeId.value ? nodesById.value.get(hoveredNodeId.value) ?? null : null,
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

  const x = minX - padX;
  const y = minY - padY;
  const w = (maxX - minX) + padX * 2;
  const h = (maxY - minY) + padY * 2;
  return { x, y, w, h };
}

const initialViewBox = ref<ViewBox>({ x: 0, y: 0, w: 10000, h: 10000 });
const viewBox = reactive<ViewBox>({ x: 0, y: 0, w: 10000, h: 10000 });

function resetView() {
  viewBox.x = initialViewBox.value.x;
  viewBox.y = initialViewBox.value.y;
  viewBox.w = initialViewBox.value.w;
  viewBox.h = initialViewBox.value.h;
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
  return tier === "hub_hub" ? 0.58 : tier === "hub_reg" ? 0.48 : tier === "reg_reg" ? 0.34 : 0.44;
}

function edgeStroke(edge: MapEdge) {
  const tier = edgeTier(edge);
  if (tier === "hub_hub") return "rgba(100, 116, 139, 0.98)";
  if (tier === "hub_reg") return "rgba(148, 163, 184, 0.96)";
  if (tier === "reg_reg") return "rgba(148, 163, 184, 0.9)";
  return "rgba(71, 85, 105, 0.9)";
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

const drag = reactive<{
  active: boolean;
  startClientX: number;
  startClientY: number;
  startBox: ViewBox;
}>({
  active: false,
  startClientX: 0,
  startClientY: 0,
  startBox: { x: 0, y: 0, w: 10000, h: 10000 },
});

function onPointerDown(e: PointerEvent) {
  const el = svgEl.value;
  if (!el) return;
  el.setPointerCapture(e.pointerId);
  drag.active = true;
  drag.startClientX = e.clientX;
  drag.startClientY = e.clientY;
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

  viewBox.x = drag.startBox.x - dx * drag.startBox.w;
  viewBox.y = drag.startBox.y - dy * drag.startBox.h;
}

function onPointerUp(e: PointerEvent) {
  const el = svgEl.value;
  if (el) el.releasePointerCapture(e.pointerId);
  drag.active = false;
}

function nodeStyle(node: MapNode) {
  if (node.level === 1) return { r: 150, fill: "#2563eb" };
  if (node.level === 2) return { r: 95, fill: "#16a34a" };
  if (node.subtype === "store") return { r: 55, fill: "#a855f7" };
  return { r: 55, fill: "#f97316" };
}

function shouldShowLabel(node: MapNode) {
  if (node.level <= 2) return true;
  if (node.id === selectedNodeId.value) return true;
  if (node.id === hoveredNodeId.value) return true;
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
  return {
    x: node.x,
    y: node.y - nodeStyle(node).r - 60,
    anchor: "middle",
    cls: node.level <= 2 ? "major" : "",
  };
}

function toggleSelected(id: string) {
  selectedNodeId.value = selectedNodeId.value === id ? null : id;
}

const viewBoxAttr = computed(() => `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);

function focusOnNode(id: string) {
  const node = nodesById.value.get(id);
  if (!node) return;
  selectedNodeId.value = id;

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
    const data = await api.getMap();
    nodes.value = data.nodes ?? [];
    edges.value = data.edges ?? [];
    initialViewBox.value = computeInitialViewBox(nodes.value);
    resetView();
    const nodeFromQuery = typeof route.query.node === "string" ? route.query.node : "";
    if (nodeFromQuery) focusOnNode(nodeFromQuery);
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
});

watch(
  () => route.query.node,
  (value) => {
    const id = typeof value === "string" ? value : "";
    if (!id) return;
    if (nodes.value.length === 0) return;
    focusOnNode(id);
  },
);
</script>

<template>
  <UiPageShell class="map-page map-page--bleed">
    <template #header>
      <div class="section-header section-header--split">
        <div>
          <h2>虛擬地圖</h2>
          <p class="hint">顯示 nodes/edges，支援縮放與平移。</p>
        </div>
        <div class="map-actions">
          <button class="ghost-btn" type="button" @click="resetView">重置視角</button>
        </div>
      </div>
    </template>

    <UiCard v-if="error">
      <p class="eyebrow">載入失敗</p>
      <p class="hint">{{ error }}</p>
    </UiCard>

    <div v-else class="map-layout">
      <div ref="stageEl" class="card map-canvas" :class="{ fullscreen: isFullscreen }">
        <div v-if="loading" class="hint">載入地圖中...</div>
        <div v-else class="map-stage">
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
            role="img"
            aria-label="virtual map"
            @wheel.passive="false"
            @wheel="onWheel"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          >
            <g class="edges">
              <line
                v-for="e in edges"
                :key="e.id"
                :x1="nodesById.get(e.source)?.x ?? 0"
                :y1="nodesById.get(e.source)?.y ?? 0"
                :x2="nodesById.get(e.target)?.x ?? 0"
                :y2="nodesById.get(e.target)?.y ?? 0"
                class="edge-line"
                :stroke="edgeStroke(e)"
                :opacity="edgeOpacity(e)"
                :stroke-width="edgeStrokeWidth(e)"
              />
            </g>
            <g class="nodes">
              <g
                v-for="n in nodes"
                :key="n.id"
                class="node"
                :class="{ selected: n.id === selectedNodeId }"
                @pointerdown.stop
                @mouseenter="hoveredNodeId = n.id"
                @mouseleave="hoveredNodeId = null"
                @click.stop="toggleSelected(n.id)"
              >
                <circle
                  v-if="hoveredNodeId === n.id"
                  :cx="n.x"
                  :cy="n.y"
                  :r="nodeStyle(n).r + 58"
                  class="hover-ring"
                />
                <circle
                  v-if="hoveredNodeId === n.id"
                  :cx="n.x"
                  :cy="n.y"
                  :r="nodeStyle(n).r + 36"
                  class="hover-glow"
                />
                <circle
                  v-if="n.id === selectedNodeId"
                  :cx="n.x"
                  :cy="n.y"
                  :r="nodeStyle(n).r + 70"
                  class="node-pulse"
                />
                <circle
                  :cx="n.x"
                  :cy="n.y"
                  :r="nodeStyle(n).r"
                  :fill="nodeStyle(n).fill"
                  :stroke="n.id === selectedNodeId ? 'rgba(236, 239, 82, 0.85)' : 'rgba(15, 23, 42, 0.18)'"
                  :stroke-width="n.id === selectedNodeId ? 22 : 12"
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
          </svg>

          <UiCard class="map-overlay" role="complementary" aria-label="map panel">
            <p class="eyebrow">圖例</p>
            <div class="legend">
              <div class="legend-item">
                <span class="dot hub"></span>
                <span>配送中心</span>
              </div>
              <div class="legend-item">
                <span class="dot reg"></span>
                <span>配送站</span>
              </div>
              <div class="legend-item">
                <span class="dot home"></span>
                <span>住家</span>
              </div>
              <div class="legend-item">
                <span class="dot store"></span>
                <span>超商</span>
              </div>
            </div>

            <p class="eyebrow">資訊</p>
            <div v-if="selectedNode" class="hint">
              <div><strong>ID：</strong>{{ selectedNode.id }}</div>
              <div><strong>Name：</strong>{{ selectedNode.name }}</div>
              <div><strong>Level：</strong>{{ selectedNode.level }}</div>
              <div><strong>Subtype：</strong>{{ selectedNode.subtype ?? "-" }}</div>
              <div><strong>座標：</strong>({{ selectedNode.x }}, {{ selectedNode.y }})</div>
            </div>
            <div v-else class="hint">點選節點查看詳細資訊。</div>
          </UiCard>
        </div>
      </div>
    </div>
  </UiPageShell>
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

.map-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
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

.map-controls {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 5;
  display: flex;
  gap: 8px;
  pointer-events: auto;
}

.map-svg {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
  background:
    radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.35) 1px, transparent 0) 0 0 / 26px 26px,
    #ffffff;
}

.map-svg:active {
  cursor: grabbing;
}

.edge-line {
  stroke-linecap: round;
  stroke-linejoin: round;
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

.node.selected .node-label {
  fill: rgba(2, 6, 23, 1);
}

.node circle {
  vector-effect: none;
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
  vector-effect: none;
}

.hover-glow {
  fill: none;
  stroke: rgba(59, 130, 246, 0.6);
  stroke-width: 22;
  opacity: 0.28;
  pointer-events: none;
  vector-effect: none;
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

.node-pulse {
  fill: none;
  stroke: rgba(99, 102, 241, 0.85);
  stroke-width: 34;
  opacity: 0.2;
  pointer-events: none;
  animation: nodePulse 1600ms ease-out infinite;
}

@keyframes nodePulse {
  0% {
    opacity: 0.22;
    stroke-width: 40;
  }
  70% {
    opacity: 0.05;
    stroke-width: 8;
  }
  100% {
    opacity: 0;
    stroke-width: 8;
  }
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

.fullscreen {
  height: 100vh;
  background: #ffffff;
}

:fullscreen .map-overlay {
  top: 18px;
  right: 18px;
}

.legend {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  display: inline-block;
}

.dot.hub {
  background: #2563eb;
}
.dot.reg {
  background: #16a34a;
}
.dot.home {
  background: #f97316;
}
.dot.store {
  background: #a855f7;
}

@media (max-width: 900px) {
  .map-page--bleed {
    width: auto;
    position: static;
    left: auto;
    transform: none;
  }
  .map-layout {
    grid-template-columns: 1fr;
  }
  .map-canvas {
    height: clamp(520px, 62vh, 720px);
  }
  .map-svg {
    height: 100%;
  }
  .map-overlay {
    position: static;
    width: auto;
    max-height: none;
    margin: 12px;
  }
}
</style>
