<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { api, type DeliveryTaskRecord, type MapEdge, type MapNode, type VehicleRecord } from "../services/api";
import { useFullscreen } from "../composables/useFullscreen";
import { selectableReasonsFor } from "../lib/exceptionReasons";
import UiCard from "../components/ui/UiCard.vue";
import UiModal from "../components/ui/UiModal.vue";
import UiNotice from "../components/ui/UiNotice.vue";
import UiPageShell from "../components/ui/UiPageShell.vue";
import UiButton from "../components/ui/UiButton.vue";
import { useToasts } from "../components/ui/toast";
import { toastFromApiError } from "../services/errorToast";
const truckIconUrl = new URL("../assets/truck.png", import.meta.url).href;

type ViewBox = { x: number; y: number; w: number; h: number };

const route = useRoute();
const { t, locale } = useI18n();

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

const assignedTasks = ref<DeliveryTaskRecord[]>([]);
const handoffTasks = ref<DeliveryTaskRecord[]>([]);
const sidebarCollapsed = ref(false);
const arriveError = ref<string | null>(null);
const arriveBusy = ref(false);
const expandedTaskKeys = ref<Set<string>>(new Set());
const lastSyncAt = ref<string | null>(null);
const cargo = ref<Array<{ package_id: string; tracking_number: string | null; loaded_at: string | null }>>([]);
const cargoPackageIds = computed(() => new Set(cargo.value.map((c) => String(c.package_id))));

function toggleTaskExpanded(key: string) {
  const next = new Set(expandedTaskKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedTaskKeys.value = next;
}

function canDropoffTask(task: DeliveryTaskRecord) {
  if (String(task.status) !== "in_progress") return false;
  return cargoPackageIds.value.has(String(task.package_id));
}

function paymentDueAmount(task: DeliveryTaskRecord) {
  if (task.paid_at) return null;
  const amount = Number(task.payment_amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

function deliveryTimeLabel(raw: unknown) {
  const key = String(raw ?? "").trim().toLowerCase();
  if (!key) return t("driver.map.deliveryTime.unset");
  if (key === "standard") return t("driver.map.deliveryTime.standard");
  if (key === "express") return t("driver.map.deliveryTime.express");
  if (key === "economy") return t("driver.map.deliveryTime.economy");
  return String(raw);
}

function taskTypeLabel(raw: unknown) {
  const key = String(raw ?? "").trim().toLowerCase();
  if (key === "pickup") return t("driver.map.taskType.pickup");
  if (key === "deliver") return t("driver.map.taskType.deliver");
  if (key === "enroute") return t("driver.map.taskType.enroute");
  if (key === "dropoff") return t("driver.map.taskType.dropoff");
  return String(raw ?? "");
}

function routeLabel(task: DeliveryTaskRecord) {
  const from = String(task.from_location ?? "-").trim() || "-";
  const to = String(task.to_location ?? "-").trim() || "-";
  return `${from} → ${to}`;
}

function paymentTypeKey(task: DeliveryTaskRecord) {
  return String(task.payment_type ?? "").trim().toLowerCase();
}

function paymentMethodKey(task: DeliveryTaskRecord) {
  return String(task.payment_method ?? "").trim().toLowerCase();
}

function isCashLikeMethod(task: DeliveryTaskRecord) {
  const method = paymentMethodKey(task);
  return method === "" || method === "cash";
}

function dimensionsLabelFromTask(task: DeliveryTaskRecord) {
  const l = Number(task.length);
  const w = Number(task.width);
  const h = Number(task.height);
  if ([l, w, h].every((n) => Number.isFinite(n) && n > 0)) return `${l}×${w}×${h} cm`;

  const raw = String(task.size ?? "").trim();
  if (!raw) return "--";
  const match = raw.match(/(\d+(?:\.\d+)?)\s*[xX×*]\s*(\d+(?:\.\d+)?)\s*[xX×*]\s*(\d+(?:\.\d+)?)/);
  if (!match) return raw;
  return `${match[1]}×${match[2]}×${match[3]} cm`;
}

function weightLabelFromTask(task: DeliveryTaskRecord) {
  const kg = Number(task.weight);
  if (!Number.isFinite(kg) || kg <= 0) return "--";
  return `${kg} kg`;
}

function paymentStatusLabel(task: DeliveryTaskRecord) {
  return task.paid_at ? t("driver.map.paymentStatus.paid") : t("driver.map.paymentStatus.unpaid");
}

function cashDueHint(task: DeliveryTaskRecord) {
  if (task.paid_at) return "";
  const amount = paymentDueAmount(task);
  if (amount == null) return "";
  if (!isCashLikeMethod(task)) return "";
  return t("driver.map.payment.cashHint");
}

function destinationForTask(task: DeliveryTaskRecord) {
  const nodeId = (currentNodeId.value ?? "").trim();
  const to = String(task.to_location ?? "").trim();
  const from = String(task.from_location ?? "").trim();
  const status = String(task.status ?? "").trim().toLowerCase();
  const onTruck = cargoPackageIds.value.has(String(task.package_id));

  const destination =
    nodeId && to === nodeId && !onTruck
      ? from
      : status === "in_progress"
        ? to
        : from;

  return destination.trim() || null;
}

function canEnrouteTask(task: DeliveryTaskRecord) {
  const dest = destinationForTask(task);
  const nodeId = (currentNodeId.value ?? "").trim();
  if (!dest) return false;
  if (!nodeId) return true;
  return dest !== nodeId;
}

function isCodStoreTask(task: DeliveryTaskRecord) {
  const paymentType = String(task.payment_type ?? "").trim().toLowerCase();
  if (paymentType !== "cod") return false;
  const to = String(task.to_location ?? task.receiver_address ?? "").trim().toUpperCase();
  return to.startsWith("END_STORE_");
}

function canCollectCashHere(args: {
  task: DeliveryTaskRecord;
  nodeId: string;
  isAtFrom: boolean;
  isAtTo: boolean;
  onTruck: boolean;
  status: string;
}) {
  const { task, isAtFrom, isAtTo, onTruck, status } = args;
  if (task.paid_at) return false;
  if (paymentDueAmount(task) == null) return false;
  if (!isCashLikeMethod(task)) return false;

  const type = paymentTypeKey(task);
  if (type === "prepaid") {
    const taskType = String(task.task_type ?? "").trim().toLowerCase();
    return taskType === "pickup" && isAtFrom && (status === "pending" || status === "accepted");
  }

  if (type === "cod") {
    if (isCodStoreTask(task)) return false;
    const taskType = String(task.task_type ?? "").trim().toLowerCase();
    return taskType !== "pickup" && isAtTo && status === "in_progress" && onTruck;
  }

  return false;
}

function canDropoffNow(task: DeliveryTaskRecord) {
  if (!canDropoffTask(task)) return false;
  if (task.paid_at) return true;
  const type = String(task.payment_type ?? "").trim().toLowerCase();
  const to = String(task.to_location ?? "").trim().toUpperCase();
  if (type === "cod" && to.startsWith("END_HOME_") && paymentDueAmount(task) != null) return false;
  return true;
}

function canPickupNow(task: DeliveryTaskRecord) {
  const status = String(task.status ?? "").trim().toLowerCase();
  if (status !== "pending" && status !== "accepted") return false;
  if (task.paid_at) return true;
  const type = String(task.payment_type ?? "").trim().toLowerCase();
  if (type === "prepaid" && paymentDueAmount(task) != null) return false;
  return true;
}

type TaskActionKind = "pickup" | "dropoff" | "collect" | "enroute" | "takeover";
type TaskListItem = {
  key: string;
  source: "assigned" | "handoff";
  task: DeliveryTaskRecord;
  note?: string;
  action: { kind: TaskActionKind; label: string; disabled?: boolean; reason?: string } | null;
};

const activeAssignedTasks = computed(() => {
  return assignedTasks.value.filter((t) => {
    const status = String(t.status ?? "").trim().toLowerCase();
    const pkgStatus = String(t.package_status ?? "").trim().toLowerCase();
    if (pkgStatus === "exception") return false;
    if (status === "completed" || status === "canceled") return false;
    return true;
  });
});

const handoffAtCurrentNode = computed(() => {
  const nodeId = currentNodeId.value;
  if (!nodeId) return [];
  return handoffTasks.value.filter((t) => String(t.from_location ?? "").trim() === nodeId);
});

const taskListItems = computed<TaskListItem[]>(() => {
  const nodeId = (currentNodeId.value ?? "").trim();
  const items: TaskListItem[] = [];

  for (const task of activeAssignedTasks.value) {
    const from = String(task.from_location ?? "").trim();
    const to = String(task.to_location ?? "").trim();
    const status = String(task.status ?? "").trim().toLowerCase();
    const onTruck = cargoPackageIds.value.has(String(task.package_id));

    const isAtFrom = Boolean(nodeId && from === nodeId);
    const isAtTo = Boolean(nodeId && to === nodeId);

    const taskType = String(task.task_type ?? "").trim().toLowerCase();

    const collectable = canCollectCashHere({ task, nodeId, isAtFrom, isAtTo, onTruck, status });
    const pickupable = taskType === "pickup" && isAtFrom && (status === "pending" || status === "accepted");
    const dropoffable = isAtTo && status === "in_progress" && onTruck;

    let note: string | undefined;
    if (isAtTo && status === "in_progress" && !onTruck) note = t("driver.map.task.note.dropoffButNotOnTruck");

    let action: TaskListItem["action"] = null;
    if (collectable) {
      action = { kind: "collect", label: t("driver.map.action.collect") };
    } else if (pickupable) {
      action = {
        kind: "pickup",
        label: t("driver.map.action.pickup"),
        disabled: !canPickupNow(task),
        reason: !canPickupNow(task) ? t("driver.map.action.reason.needPaidFirst") : undefined,
      };
    } else if (dropoffable) {
      action = {
        kind: "dropoff",
        label: t("driver.map.action.dropoff"),
        disabled: !canDropoffNow(task),
        reason: !canDropoffNow(task) ? t("driver.map.action.reason.needPaidFirst") : undefined,
      };
    } else {
      action = { kind: "enroute", label: t("driver.map.action.enroute"), disabled: !canEnrouteTask(task) };
    }

    items.push({
      key: `assigned:${task.id}`,
      source: "assigned",
      task,
      note,
      action,
    });
  }

  for (const task of handoffAtCurrentNode.value) {
    items.push({
      key: `handoff:${task.id}`,
      source: "handoff",
      task,
      action: { kind: "takeover", label: t("driver.map.action.takeover") },
    });
  }

  const rank = (item: TaskListItem) => {
    if (!item.action) return 9;
    if (item.action.kind === "collect") return 0;
    if (item.action.kind === "pickup" || item.action.kind === "dropoff") return 1;
    if (item.action.kind === "enroute") return 2;
    if (item.action.kind === "takeover") return 3;
    return 9;
  };

  return items.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return String(a.task.tracking_number ?? a.task.package_id).localeCompare(String(b.task.tracking_number ?? b.task.package_id));
  });
});

const exceptionModalOpen = ref(false);
const exceptionTarget = ref<{ packageId: string; taskId?: string } | null>(null);
const exceptionReasons = selectableReasonsFor("driver").map((r) => ({ code: r.code, label: t(r.i18nKey) }));
const exceptionForm = reactive({ reason_code: "", description: "", location_mode: "node" as "node" | "truck" });

const hoveredNode = computed(() => {
  const id = hoveredNodeId.value;
  return id ? nodesById.value.get(id) ?? null : null;
});

const hoveredIsNeighbor = computed(() => {
  const id = hoveredNodeId.value;
  if (!id) return false;
  return isNeighbor(id);
});

const toast = useToasts();

async function refreshArriveData() {
  arriveError.value = null;
  try {
    // 優化：使用聚合 Dashboard API，減少 3 個調用為 1 個
    const dashboard = await api.getDriverDashboard();
    assignedTasks.value = dashboard.assigned_tasks ?? [];
    handoffTasks.value = dashboard.handoff_tasks ?? [];
    cargo.value = dashboard.cargo ?? [];
    // 更新車輛資訊（如果需要）
    if (dashboard.vehicle) {
      vehicle.value = dashboard.vehicle;
      if (dashboard.vehicle.current_node_id) {
        currentNodeId.value = dashboard.vehicle.current_node_id;
      }
    }
    const targetLocale = locale.value === 'en-US' ? 'en-US' : 'zh-TW';
    lastSyncAt.value = new Date().toLocaleString(targetLocale);
  } catch (e: any) {
    arriveError.value = String(e?.message ?? e);
    toastFromApiError(e, arriveError.value);
  }
}

async function markArrivalForCashPayWindow() {
  const nodeId = String(currentNodeId.value ?? "").trim();
  if (!nodeId) return;

  const targets = activeAssignedTasks.value.filter((task) => {
    if (task.paid_at) return false;
    if (paymentDueAmount(task) == null) return false;
    if (!isCashLikeMethod(task)) return false;
    if (isCodStoreTask(task)) return false;
    const taskType = String(task.task_type ?? "").trim().toLowerCase();
    const from = String(task.from_location ?? "").trim();
    const to = String(task.to_location ?? "").trim();
    if (taskType === "pickup") return from === nodeId;
    return to === nodeId;
  });
  if (targets.length === 0) return;

  // 優化：使用批量 API，將 N 個調用減為 1 個
  const taskIds = targets.map((task) => task.id);
  await api.batchArriveDriverTasks(taskIds);
}

function collapseSidebar() {
  sidebarCollapsed.value = true;
  exceptionModalOpen.value = false;
}

function openTaskList(auto = false) {
  if (auto) {
    const hasAny = taskListItems.value.some((i) => i.action && i.action.kind !== "enroute");
    if (!hasAny) return;
  }
  sidebarCollapsed.value = false;
}

async function collectCashForTask(task: DeliveryTaskRecord) {
  if (arriveBusy.value) return;
  arriveBusy.value = true;
  arriveError.value = null;
  try {
    if (!isCashLikeMethod(task)) {
      throw new Error(t("driver.map.errors.notCashPayment"));
    }
    const ok = window.confirm(t("driver.map.confirm.collectCash"));
    if (!ok) return;
    await api.arriveDriverTask(task.id);
    await api.driverCollectCash(task.package_id);
    toast.success(t("driver.map.toast.cashCollected"));
    await refreshArriveData();
  } catch (e: any) {
    arriveError.value = String(e?.message ?? e);
    toastFromApiError(e, arriveError.value);
  } finally {
    arriveBusy.value = false;
  }
}

async function takeOverTask(taskId: string) {
  if (arriveBusy.value) return;
  arriveBusy.value = true;
  arriveError.value = null;
  try {
    await api.acceptDriverTask(taskId);
    toast.success(t("driver.map.toast.taskAccepted"));
    await refreshArriveData();
  } catch (e: any) {
    arriveError.value = String(e?.message ?? e);
    toastFromApiError(e, arriveError.value);
  } finally {
    arriveBusy.value = false;
  }
}

async function pickupTask(task: DeliveryTaskRecord) {
  if (arriveBusy.value) return;
  arriveBusy.value = true;
  arriveError.value = null;
  try {
    await api.pickupDriverTask(task.id);
    toast.success(t("driver.map.toast.pickedUp"));
    await refreshArriveData();
  } catch (e: any) {
    arriveError.value = String(e?.message ?? e);
    toastFromApiError(e, arriveError.value);
  } finally {
    arriveBusy.value = false;
  }
}

async function dropoffTask(task: DeliveryTaskRecord) {
  if (arriveBusy.value) return;
  arriveBusy.value = true;
  arriveError.value = null;
  try {
    await api.dropoffDriverTask(task.id);
    toast.success(t("driver.map.toast.droppedOff"));
    await refreshArriveData();
  } catch (e: any) {
    arriveError.value = String(e?.message ?? e);
    toastFromApiError(e, arriveError.value);
  } finally {
    arriveBusy.value = false;
  }
}

async function enrouteTask(task: DeliveryTaskRecord) {
  if (arriveBusy.value) return;
  arriveBusy.value = true;
  arriveError.value = null;
  try {
    await api.enrouteDriverTask(task.id);
    await refreshArriveData();
    const destination = destinationForTask(task);
    if (destination) await highlightRouteTo(destination);
  } catch (e: any) {
    arriveError.value = String(e?.message ?? e);
    toastFromApiError(e, arriveError.value);
  } finally {
    arriveBusy.value = false;
  }
}

function startException(task: DeliveryTaskRecord) {
  exceptionTarget.value = { packageId: task.package_id, taskId: task.id };
  exceptionForm.reason_code = "";
  exceptionForm.description = "";
  const onTruck = cargoPackageIds.value.has(String(task.package_id));
  exceptionForm.location_mode = onTruck ? "truck" : "node";
  exceptionModalOpen.value = true;
}

function closeExceptionModal() {
  exceptionModalOpen.value = false;
  exceptionTarget.value = null;
  arriveError.value = null;
}

async function submitException() {
  if (!exceptionTarget.value) return;
  if (arriveBusy.value) return;
  if (!exceptionForm.reason_code.trim()) {
    arriveError.value = t("driver.map.exception.errors.reasonRequired");
    toast.warning(arriveError.value);
    return;
  }
  if (!exceptionForm.description.trim()) {
    arriveError.value = t("driver.map.exception.errors.descriptionRequired");
    toast.warning(arriveError.value);
    return;
  }
  arriveBusy.value = true;
  arriveError.value = null;
  try {
    await api.driverReportPackageException(exceptionTarget.value.packageId, {
      reason_code: exceptionForm.reason_code.trim(),
      description: exceptionForm.description.trim(),
      location:
        exceptionForm.location_mode === "truck"
          ? (truckCode.value || "").trim() || undefined
          : (currentNodeId.value || "").trim() || undefined,
    });
    exceptionModalOpen.value = false;
    exceptionTarget.value = null;
    await refreshArriveData();
  } catch (e: any) {
    arriveError.value = String(e?.message ?? e);
    toastFromApiError(e, arriveError.value);
  } finally {
    arriveBusy.value = false;
  }
}

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
    error.value = t("driver.map.errors.moveFailed", { message: String(e?.message ?? e) });
    truckPos.x = fromX;
    truckPos.y = fromY;
  } finally {
    moving.value = false;
  }

  await refreshActiveRouteFromCurrent();
  await refreshArriveData();
  await markArrivalForCashPayWindow();
  openTaskList(true);
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

function applyDeepLinkFromQuery() {
  const focus = String(route.query.focus ?? "").trim();
  if (!focus) return;
  if (!nodesById.value.get(focus)) return;
  focusOnNode(focus);
  void highlightRouteTo(focus);
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

    await refreshArriveData();
    await markArrivalForCashPayWindow();
    applyDeepLinkFromQuery();
  } catch (e: any) {
    error.value = String(e?.message ?? e);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <UiPageShell class="map-page--bleed">
    <header class="page-header section-header--split">
      <div>
        <p class="eyebrow">{{ t("driver.eyebrow") }}</p>
        <h1>{{ t("driver.map.page.title") }}</h1>
        <p class="lede">{{ t("driver.map.page.lede") }}</p>
      </div>
    </header>

    <UiCard v-if="error" class="error-card">{{ error }}</UiCard>
    <UiCard v-else-if="loading">{{ t("common.loading") }}</UiCard>

    <div v-else ref="stageEl" class="card map-canvas" :class="{ fullscreen: isFullscreen }">
      <div class="map-stage" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
        <div class="map-main">
          <div class="map-controls">
            <UiButton
              v-if="fullscreenSupported"
              :icon="isFullscreen ? 'fullscreen-exit' : 'fullscreen'"
              variant="ghost"
              type="button"
              @click="toggleFullscreen"
            >
              {{ isFullscreen ? t("driver.map.controls.fullscreen.exit") : t("driver.map.controls.fullscreen.enter") }}
            </UiButton>
            <UiButton
              v-if="sidebarCollapsed"
              icon="chevron-left"
              variant="ghost"
              type="button"
              @click="openTaskList()"
            >
              {{ t("driver.map.controls.sidebar.expand") }}
            </UiButton>
            <UiButton
              v-else
              icon="chevron-right"
              variant="ghost"
              type="button"
              @click="collapseSidebar"
            >
              {{ t("driver.map.controls.sidebar.collapse") }}
            </UiButton>
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
        </div>

        <aside v-if="!sidebarCollapsed" class="map-sidebar" aria-label="driver work panel">
          <UiCard class="map-overlay driver-info-card" role="complementary" aria-label="driver map panel">
            <p class="eyebrow">{{ t("driver.map.info.title") }}</p>
            <div class="driver-info-grid">
              <div class="driver-info-row">
                <strong>{{ t("driver.map.info.vehicleCode") }}：</strong>
                <span class="driver-info-value">{{ vehicle?.vehicle_code ?? t("driver.map.info.unlinked") }}</span>
              </div>
              <div class="driver-info-row">
                <strong>{{ t("driver.map.info.currentNode") }}：</strong>
                <span class="driver-info-value">{{ currentNodeId ?? "-" }}</span>
                <span v-if="activeRouteTargetId" class="pill info nav-pill">
                  {{ t("driver.map.info.navTo", { node: activeRouteTargetId }) }}
                </span>
              </div>
              <div class="driver-info-row">
                <strong>{{ t("driver.map.info.cargo") }}：</strong>
                <span class="driver-info-value">{{ t("driver.map.info.cargoCount", { count: cargo.length }) }}</span>
              </div>
              <div class="driver-info-row">
                <strong>{{ t("driver.map.info.lastSync") }}：</strong>
                <span class="driver-info-value">{{ lastSyncAt ?? t("driver.map.info.notSynced") }}</span>
              </div>
            </div>
          </UiCard>

          <UiCard class="map-overlay task-panel" role="complementary" aria-label="task list">
            <div class="task-header">
              <div>
                <p class="eyebrow">{{ t("driver.map.taskList.title") }}</p>
              </div>
              <div class="task-header-actions">
                <UiButton icon="refresh" variant="ghost" type="button" :disabled="arriveBusy" @click="refreshArriveData">
                  {{ t("driver.map.taskList.refresh") }}
                </UiButton>
              </div>
            </div>

            <UiNotice v-if="arriveError" tone="error" role="alert" style="margin-top: 10px">{{ arriveError }}</UiNotice>

            <div class="task-body">
              <ul v-if="taskListItems.length > 0" class="task-list">
                <li
                  v-for="item in taskListItems"
                  :key="item.key"
                  class="task-row"
                  :class="{ active: expandedTaskKeys.has(item.key) }"
                >
                  <div class="task-row-top">
                    <button
                      type="button"
                      class="row-btn"
                      :aria-expanded="expandedTaskKeys.has(item.key)"
                      @click="toggleTaskExpanded(item.key)"
                    >
                      <div class="row-line row-line--top">
                        <span class="tracking">
                          <svg class="mini-icon" viewBox="0 0 24 24" aria-hidden="true">
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
                          {{ item.task.tracking_number ?? item.task.package_id }}
                        </span>
                        <svg class="mini-icon chevron" viewBox="0 0 20 20" aria-hidden="true">
                          <path
                            d="M5 7l5 6 5-6"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </div>
                      <div class="row-line row-line--meta">
                        <span v-if="item.source !== 'handoff'" class="pill info">
                          <svg class="mini-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                            <path
                              d="M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.6"
                            />
                          </svg>
                          {{ deliveryTimeLabel(item.task.delivery_time) }}
                        </span>
                        <span
                          v-if="item.source !== 'handoff'"
                          class="pill"
                          :class="item.task.paid_at ? 'success' : 'danger'"
                        >
                          <svg class="mini-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.6"
                              stroke-linejoin="round"
                            />
                            <path d="M16 11h.01" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
                          </svg>
                          {{ paymentStatusLabel(item.task) }}
                        </span>
                        <span v-else class="pill info">{{ item.action?.label ?? t("driver.map.action.takeover") }}</span>
                      </div>
                    </button>
                  </div>

                  <div v-if="expandedTaskKeys.has(item.key)" class="task-detail">
                    <div class="detail-grid">
                      <p class="meta">{{ t("driver.map.task.fields.route") }}：{{ routeLabel(item.task) }}</p>
                      <p v-if="item.source !== 'handoff'" class="meta">
                        {{ t("driver.map.task.fields.taskType") }}：{{ taskTypeLabel(item.task.task_type) }}
                      </p>
                      <p v-if="item.source !== 'handoff'" class="meta">
                        {{ t("driver.map.task.fields.paymentStatus") }}：{{ paymentStatusLabel(item.task) }}
                      </p>
                      <p v-if="item.source !== 'handoff'" class="meta">
                        {{ t("driver.map.task.fields.sender") }}：{{ item.task.sender_name ?? "-" }}
                      </p>
                      <p v-if="item.source !== 'handoff'" class="meta">
                        {{ t("driver.map.task.fields.receiver") }}：{{ item.task.receiver_name ?? "-" }}
                      </p>
                      <p v-if="item.source !== 'handoff'" class="meta">
                        {{ t("driver.map.task.fields.dimensions") }}：{{ dimensionsLabelFromTask(item.task) }}
                      </p>
                      <p v-if="item.source !== 'handoff'" class="meta">
                        {{ t("driver.map.task.fields.weight") }}：{{ weightLabelFromTask(item.task) }}
                      </p>
                      <p v-if="paymentDueAmount(item.task) != null" class="meta">
                        {{ t("driver.map.task.fields.amountDue") }}：{{ paymentDueAmount(item.task) }}
                      </p>
                      <p v-if="cashDueHint(item.task)" class="meta">
                        {{ t("driver.map.task.fields.cashHint") }}：{{ cashDueHint(item.task) }}
                      </p>
                      <p v-if="item.task.instructions" class="meta">
                        {{ t("driver.map.task.fields.csNotes") }}：{{ item.task.instructions }}
                      </p>
                      <p v-if="item.note" class="meta">{{ t("driver.map.task.fields.hint") }}：{{ item.note }}</p>
                      <p v-if="item.action?.reason" class="meta">{{ t("driver.map.task.fields.hint") }}：{{ item.action.reason }}</p>
                    </div>

                    <div class="detail-actions">
                      <button
                        v-if="item.action"
                        class="primary-btn small-btn"
                        type="button"
                        :disabled="arriveBusy || item.action.disabled"
                        @click="
                          item.action.kind === 'takeover'
                            ? takeOverTask(item.task.id)
                            : item.action.kind === 'collect'
                              ? collectCashForTask(item.task)
                              : item.action.kind === 'pickup'
                                ? pickupTask(item.task)
                                : item.action.kind === 'dropoff'
                                  ? dropoffTask(item.task)
                                  : enrouteTask(item.task)
                        "
                      >
                        {{ item.action.label }}
                      </button>
                      <button class="ghost-btn small-btn" type="button" :disabled="arriveBusy" @click="startException(item.task)">
                        {{ t("driver.map.exception.report") }}
                      </button>
                    </div>
                  </div>
                </li>
              </ul>
              <div v-else class="task-empty">
                <p class="task-empty-title">{{ t("driver.map.taskList.empty.title") }}</p>
                <p class="hint" style="margin: 6px 0 0">{{ t("driver.map.taskList.empty.lede") }}</p>
                <p class="hint" style="margin: 6px 0 0">{{ t("driver.map.taskList.empty.stepsTitle") }}</p>
                <ul class="task-empty-list">
                  <li class="hint">{{ t("driver.map.taskList.empty.tip.refresh") }}</li>
                  <li class="hint">{{ t("driver.map.taskList.empty.tip.move") }}</li>
                  <li class="hint">{{ t("driver.map.taskList.empty.tip.handoff") }}</li>
                  <li class="hint">{{ t("driver.map.taskList.empty.tip.contact") }}</li>
                </ul>
              </div>
            </div>

            <UiModal
              v-model="exceptionModalOpen"
              :title="t('driver.map.exception.title')"
              aria-label="report exception"
              :close-on-backdrop="!arriveBusy"
              :close-on-esc="!arriveBusy"
              @close="closeExceptionModal"
            >
              <template #subtitle>
                <p class="hint" style="margin: 0">{{ t("driver.map.exception.package", { id: exceptionTarget?.packageId ?? '-' }) }}</p>
              </template>

              <div class="form-grid" style="grid-template-columns: 1fr; gap: 10px">
                <label class="form-field">
                  <span>{{ t("driver.map.exception.reasonLabel") }}</span>
                  <select v-model="exceptionForm.reason_code" :disabled="arriveBusy">
                    <option value="" disabled>{{ t("driver.map.exception.reasonPlaceholder") }}</option>
                    <option v-for="r in exceptionReasons" :key="r.code" :value="r.code">{{ r.label }}</option>
                  </select>
                </label>

                <label class="form-field">
                  <span>{{ t("driver.map.exception.locationLabel") }}</span>
                  <select v-model="exceptionForm.location_mode" :disabled="arriveBusy">
                    <option value="truck">{{ t("driver.map.exception.location.truck", { code: truckCode || '-' }) }}</option>
                    <option value="node">{{ t("driver.map.exception.location.node", { node: currentNodeId || '-' }) }}</option>
                  </select>
                </label>

                <label class="form-field">
                  <span>{{ t("driver.map.exception.descriptionLabel") }}</span>
                  <textarea
                    v-model="exceptionForm.description"
                    rows="3"
                    :disabled="arriveBusy"
                    :placeholder="t('driver.map.exception.descriptionPlaceholder')"
                  />
                </label>
              </div>

              <template #actions>
                <button class="primary-btn small-btn" type="button" :disabled="arriveBusy" @click="submitException">
                  {{ t("driver.map.exception.submit") }}
                </button>
                <button class="ghost-btn small-btn" type="button" :disabled="arriveBusy" @click="closeExceptionModal">
                  {{ t("common.cancel") }}
                </button>
              </template>
            </UiModal>
          </UiCard>
        </aside>
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
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 12px;
}

.map-stage.sidebar-collapsed {
  grid-template-columns: 1fr;
}

.map-main {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: hidden;
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
  width: auto;
  max-height: none;
  overflow: visible;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(8px);
}

.driver-info-card {
  height: 168px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  overflow: hidden;
}

.driver-info-grid {
  margin-top: 8px;
  display: grid;
  gap: 10px;
  font-size: 13px;
}

.driver-info-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.driver-info-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-pill {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-empty {
  border: 1px dashed rgba(15, 23, 42, 0.18);
  background: rgba(15, 23, 42, 0.02);
  border-radius: 14px;
  padding: 12px;
}

.task-empty-title {
  margin: 0;
  font-weight: 800;
  color: rgba(15, 23, 42, 0.92);
}

.task-empty-list {
  margin: 8px 0 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
}

.map-sidebar {
  height: 100%;
  overflow: hidden;
  padding: 12px;
  border-left: 1px solid rgba(15, 23, 42, 0.12);
  display: grid;
  align-content: start;
  grid-template-rows: auto 1fr;
  gap: 12px;
  background: rgba(255, 255, 255, 0.85);
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

@media (max-width: 900px) {
  .map-page--bleed {
    width: auto;
    position: static;
    left: auto;
    transform: none;
  }
  .map-canvas {
    height: auto;
    overflow: visible;
    padding: 12px;
  }
  .map-stage {
    grid-template-columns: 1fr;
    height: auto;
    gap: 12px;
  }
  .map-main {
    height: clamp(520px, 62vh, 720px);
    border: 1px solid rgba(15, 23, 42, 0.12);
    border-radius: 16px;
  }
  .map-sidebar {
    height: auto;
    overflow: visible;
    padding: 0;
    border-left: none;
    background: transparent;
  }
  .task-panel {
    position: static;
    width: auto;
    max-height: none;
    margin: 0;
  }
}

.task-panel {
  position: static;
  width: auto;
  max-height: none;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.task-header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.task-body {
  margin-top: 8px;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.task-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.task-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.22);
  color: rgba(30, 64, 175, 0.95);
  font-weight: 800;
  font-size: 12px;
  white-space: nowrap;
}

.task-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}

.task-row {
  border: 1px solid rgba(15, 23, 42, 0.1);
  background: rgba(248, 250, 252, 0.9);
  border-radius: 14px;
  overflow: hidden;
}

.task-row.active {
  border-color: rgba(37, 99, 235, 0.26);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12);
}

.task-row-top {
  padding: 10px;
}

.row-btn {
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  padding: 0;
  display: grid;
  gap: 8px;
}

.row-line {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  flex-wrap: wrap;
}

.row-line--top {
  justify-content: space-between;
  flex-wrap: nowrap;
}

.row-line--meta {
  justify-content: flex-start;
}

.mini-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  color: rgba(15, 23, 42, 0.62);
}

.mini-icon.chevron {
  transition: transform 140ms ease;
}

.task-row.active .mini-icon.chevron {
  transform: rotate(180deg);
}

.tracking {
  font-weight: 800;
  color: rgba(15, 23, 42, 0.95);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  background: rgba(15, 23, 42, 0.04);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.pill.success {
  border-color: rgba(34, 197, 94, 0.35);
  background: rgba(34, 197, 94, 0.10);
  color: rgba(21, 128, 61, 0.95);
}

.pill.danger {
  border-color: rgba(239, 68, 68, 0.32);
  background: rgba(239, 68, 68, 0.08);
  color: rgba(185, 28, 28, 0.95);
}

.pill.info {
  border-color: rgba(37, 99, 235, 0.28);
  background: rgba(37, 99, 235, 0.08);
  color: rgba(30, 64, 175, 0.95);
}

.meta {
  font-size: 12px;
  color: rgba(15, 23, 42, 0.64);
}

.detail-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 10px;
}

.detail-actions .small-btn {
  min-width: 96px;
  height: 36px;
  padding-top: 0;
  padding-bottom: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  line-height: 1;
}

.task-detail {
  border-top: 1px solid rgba(15, 23, 42, 0.1);
  padding: 10px;
  background: rgba(255, 255, 255, 0.75);
}

.detail-grid {
  display: grid;
  gap: 6px;
}

</style>



