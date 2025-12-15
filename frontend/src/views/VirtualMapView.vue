<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { api, type MapEdge, type MapNode } from "../services/api";

type ViewBox = { x: number; y: number; w: number; h: number };

const loading = ref(true);
const error = ref<string | null>(null);

const nodes = ref<MapNode[]>([]);
const edges = ref<MapEdge[]>([]);
const selectedNodeId = ref<string | null>(null);
const route = useRoute();

const svgEl = ref<SVGSVGElement | null>(null);

const nodesById = computed(() => {
  const map = new Map<string, MapNode>();
  for (const node of nodes.value) map.set(node.id, node);
  return map;
});

const selectedNode = computed(() =>
  selectedNodeId.value ? nodesById.value.get(selectedNodeId.value) ?? null : null,
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
  <section class="page-shell map-page map-page--bleed">
    <header class="section-header section-header--split">
      <div>
        <h2>虛擬地圖</h2>
        <p class="hint">顯示 nodes/edges，支援縮放與平移。</p>
      </div>
      <div class="map-actions">
        <button class="ghost-btn" type="button" @click="resetView">重置視角</button>
      </div>
    </header>

    <div v-if="error" class="card">
      <p class="eyebrow">載入失敗</p>
      <p class="hint">{{ error }}</p>
    </div>

    <div v-else class="map-layout">
      <div class="card map-canvas">
        <div v-if="loading" class="hint">載入地圖中...</div>
        <div v-else class="map-stage">
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
              />
            </g>
            <g class="nodes">
              <g
                v-for="n in nodes"
                :key="n.id"
                class="node"
                :class="{ selected: n.id === selectedNodeId }"
                @pointerdown.stop
                @click.stop="toggleSelected(n.id)"
              >
                <circle
                  v-if="n.id === selectedNodeId"
                  :cx="n.x"
                  :cy="n.y"
                  :r="nodeStyle(n).r + 70"
                  class="node-pulse"
                />
                <circle :cx="n.x" :cy="n.y" :r="nodeStyle(n).r" :fill="nodeStyle(n).fill" />
                <text :x="n.x" :y="n.y - nodeStyle(n).r - 60" class="node-label">
                  {{ n.name }}
                </text>
              </g>
            </g>
          </svg>

          <div class="card map-overlay" role="complementary" aria-label="map panel">
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
    radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.35) 1px, transparent 0) 0 0 / 26px 26px;
}

.map-svg:active {
  cursor: grabbing;
}

.edge-line {
  stroke: rgba(148, 163, 184, 0.55);
  stroke-width: 18;
  vector-effect: non-scaling-stroke;
}

.node-label {
  font-size: 120px;
  fill: rgba(15, 23, 42, 0.85);
  text-anchor: middle;
  pointer-events: none;
  user-select: none;
}

.node.selected .node-label {
  fill: rgba(2, 6, 23, 1);
}

.node circle {
  stroke: rgba(15, 23, 42, 0.2);
  stroke-width: 16;
  vector-effect: non-scaling-stroke;
}

.node.selected circle {
  stroke: rgba(236, 239, 82, 0.715);
  stroke-width: 16;
}

.node-pulse {
  fill: none;
  stroke: rgba(99, 102, 241, 0.85);
  stroke-width: 34;
  opacity: 0.2;
  vector-effect: non-scaling-stroke;
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
