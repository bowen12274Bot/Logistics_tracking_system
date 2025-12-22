
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import { api, type WarehousePackageRecord } from "../services/api";

const loading = ref(true);
const busy = ref(false);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);

const warehouseNodeId = ref<string | null>(null);
const neighbors = ref<string[]>([]);
const packages = ref<WarehousePackageRecord[]>([]);

const receiveSelection = reactive<Record<string, boolean>>({});
const nextHopByPackageId = reactive<Record<string, string>>({});

const awaitingReceive = computed(() => packages.value.filter((p) => p.ui_state === "await_receive"));
const sorting = computed(() => packages.value.filter((p) => p.ui_state === "sorting"));
const dispatched = computed(() => packages.value.filter((p) => p.ui_state === "dispatched"));

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
  const fallbackNeighbor = neighborIds[0];
  if (!fallbackNeighbor) return;
  for (const p of pkgs) {
    if (p.ui_state !== "sorting") continue;
    if (nextHopByPackageId[p.id]) continue;
    nextHopByPackageId[p.id] = p.suggested_to_node_id ?? fallbackNeighbor;
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

async function refresh() {
  loading.value = true;
  error.value = null;
  notice.value = null;
  try {
    const res = await api.getWarehousePackages(300);
    warehouseNodeId.value = res.warehouse_node_id ?? null;
    neighbors.value = res.neighbors ?? [];
    packages.value = res.packages ?? [];
    ensureNextHopDefaults(res.packages ?? [], res.neighbors ?? []);
  } catch (e: any) {
    error.value = String(e?.message ?? e);
  } finally {
    loading.value = false;
  }
}

async function receiveSelected() {
  const ids = selectedReceiveIds.value;
  if (ids.length === 0) {
    notice.value = "請先勾選要點收的包裹。";
    return;
  }
  busy.value = true;
  error.value = null;
  notice.value = null;
  try {
    const res = await api.receiveWarehousePackages(ids);
    const failed = res.details?.failed?.length ?? 0;
    notice.value = failed > 0 ? `點收完成（成功 ${res.processed}，失敗 ${failed}）` : `點收完成（共 ${res.processed} 件）`;
    for (const id of ids) delete receiveSelection[id];
    await refresh();
  } catch (e: any) {
    error.value = String(e?.message ?? e);
  } finally {
    busy.value = false;
  }
}

async function dispatchOne(p: WarehousePackageRecord) {
  const toNodeId = String(nextHopByPackageId[p.id] ?? "").trim();
  if (!toNodeId) {
    notice.value = "請先選擇下一跳節點。";
    return;
  }
  busy.value = true;
  error.value = null;
  notice.value = null;
  try {
    await api.dispatchWarehouseNext(p.id, { toNodeId });
    notice.value = `已派發：${p.tracking_number ?? p.id}`;
    await refresh();
  } catch (e: any) {
    error.value = String(e?.message ?? e);
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">員工 · 倉儲</p>
      <h1>站點與中心作業</h1>
      <p class="lede">點收本站包裹、分揀並決定下一跳，派發司機轉運任務。</p>
    </header>

    <div class="card" style="margin-top: 16px">
      <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: space-between">
        <div>
          <p class="eyebrow">本站</p>
          <p class="hint" style="margin-top: 6px">{{ warehouseNodeId ?? "-" }}</p>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center">
          <button class="ghost-btn" type="button" :disabled="loading || busy" @click="refresh">重新整理</button>
          <RouterLink class="ghost-btn" to="/map">查看地圖</RouterLink>
        </div>
      </div>

      <p v-if="error" class="hint" style="margin-top: 10px; color: #b91c1c">{{ error }}</p>
      <p v-else-if="notice" class="hint" style="margin-top: 10px">{{ notice }}</p>
      <p v-else-if="loading" class="hint" style="margin-top: 10px">載入中…</p>
    </div>

    <div class="card" style="margin-top: 16px">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap">
        <div>
          <p class="eyebrow">點收清單</p>
          <p class="hint" style="margin: 6px 0 0">此區顯示本站已到站（warehouse_in）但尚未點收的包裹。</p>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center">
          <button class="ghost-btn" type="button" :disabled="busy || awaitingReceive.length === 0" @click="toggleReceiveAll">
            {{ allReceiveChecked ? "取消全選" : "全選" }}
          </button>
          <button class="primary-btn" type="button" :disabled="busy || selectedReceiveIds.length === 0" @click="receiveSelected">
            點收（{{ selectedReceiveIds.length }}）
          </button>
        </div>
      </div>

      <div v-if="loading" class="hint" style="margin-top: 12px">載入中…</div>
      <div v-else-if="awaitingReceive.length === 0" class="hint" style="margin-top: 12px">目前沒有待點收包裹。</div>

      <ul v-else class="task-list" style="margin-top: 12px">
        <li v-for="p in awaitingReceive" :key="p.id" style="display: grid; gap: 6px">
          <div style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; align-items: center">
            <label style="display: flex; align-items: center; gap: 10px">
              <input v-model="receiveSelection[p.id]" type="checkbox" :disabled="busy" />
              <strong>{{ p.tracking_number ?? p.id }}</strong>
            </label>
            <span class="hint">{{ p.latest_event.delivery_status ?? "-" }} · {{ p.latest_event.events_at ?? "-" }}</span>
          </div>
          <div class="hint">{{ p.sender_address ?? "-" }} → {{ p.receiver_address ?? "-" }}</div>
        </li>
      </ul>
    </div>

    <div class="card" style="margin-top: 16px">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap">
        <div>
          <p class="eyebrow">分揀工作區</p>
          <p class="hint" style="margin: 6px 0 0">點收後會進入此區，可決定下一跳並派發下一段任務。</p>
        </div>
        <span class="hint">待分揀 {{ sorting.length }} · 已派發 {{ dispatched.length }}</span>
      </div>

      <div v-if="neighbors.length === 0" class="hint" style="margin-top: 12px">
        找不到本站相鄰節點（edges）。請確認地圖資料。
      </div>

      <div v-else style="margin-top: 12px; display: grid; gap: 14px">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px">
          <div v-for="n in neighbors" :key="n" style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px">
            <div style="display: flex; justify-content: space-between; gap: 10px; align-items: baseline">
              <strong>{{ n }}</strong>
              <span class="hint">{{ sortingGroups.get(n)?.length ?? 0 }} 件</span>
            </div>

            <div v-if="(sortingGroups.get(n)?.length ?? 0) === 0" class="hint" style="margin-top: 10px">
              暫無包裹
            </div>

            <ul v-else class="task-list" style="margin-top: 10px">
              <li v-for="p in (sortingGroups.get(n) ?? [])" :key="p.id" style="display: grid; gap: 8px">
                <div style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap">
                  <strong>{{ p.tracking_number ?? p.id }}</strong>
                  <span class="hint">{{ p.latest_event.delivery_status ?? "-" }}</span>
                </div>
                <div class="hint">{{ p.receiver_address ?? "-" }}</div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center">
                  <select v-model="nextHopByPackageId[p.id]" :disabled="busy" class="ghost-btn" style="padding: 8px 10px">
                    <option v-for="opt in neighbors" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                  <button class="primary-btn small-btn" type="button" :disabled="busy" @click="dispatchOne(p)">派發</button>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div v-if="dispatched.length > 0" style="border-top: 1px solid #e5e7eb; padding-top: 12px">
          <p class="eyebrow">已派發（route_decided）</p>
          <p class="hint" style="margin-top: 6px">已建立下一段任務，等待司機接手。</p>
          <ul class="task-list" style="margin-top: 10px">
            <li v-for="p in dispatched" :key="p.id" style="display: grid; gap: 6px">
              <div style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap">
                <strong>{{ p.tracking_number ?? p.id }}</strong>
                <span class="hint">{{ p.latest_event.events_at ?? "-" }}</span>
              </div>
              <div class="hint">{{ p.latest_event.delivery_details ?? "-" }}</div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
