
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import { api, type WarehouseExceptionRecord, type WarehousePackageRecord } from "../services/api";
import { exceptionReasonLabel, selectableReasonsFor } from "../lib/exceptionReasons";
import UiCard from "../components/ui/UiCard.vue";
import UiList from "../components/ui/UiList.vue";
import UiModal from "../components/ui/UiModal.vue";
import UiNotice from "../components/ui/UiNotice.vue";
import UiPageShell from "../components/ui/UiPageShell.vue";
import { useToasts } from "../components/ui/toast";
import { toastFromApiError } from "../services/errorToast";

const loading = ref(true);
const busy = ref(false);
const error = ref<string | null>(null);
const toast = useToasts();

const warehouseNodeId = ref<string | null>(null);
const neighbors = ref<string[]>([]);
const packages = ref<WarehousePackageRecord[]>([]);
const exceptionReports = ref<WarehouseExceptionRecord[]>([]);

const receiveSelection = reactive<Record<string, boolean>>({});
const nextHopByPackageId = reactive<Record<string, string>>({});

const awaitingReceive = computed(() => packages.value.filter((p) => p.ui_state === "await_receive"));
const sorting = computed(() => packages.value.filter((p) => p.ui_state === "sorting"));
const dispatched = computed(() => packages.value.filter((p) => p.ui_state === "dispatched"));

const exceptionModalOpen = ref(false);
const exceptionTarget = ref<WarehousePackageRecord | null>(null);
const exceptionReasons = selectableReasonsFor("warehouse_staff").map((r) => ({ code: r.code, label: r.label }));
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
    toast.warning("請先勾選要點收的包裹。");
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    const res = await api.receiveWarehousePackages(ids);
    const failed = res.details?.failed?.length ?? 0;
    toast.success(
      failed > 0 ? `點收完成（成功 ${res.processed}，失敗 ${failed}）` : `點收完成（共 ${res.processed} 件）`,
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
    toast.warning("請先選擇下一跳節點。");
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    await api.dispatchWarehouseNext(p.id, { toNodeId });
    toast.success(`已派發：${p.tracking_number ?? p.id}`);
    await refresh();
  } catch (e: any) {
    error.value = String(e?.message ?? e);
    toastFromApiError(e, error.value);
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
    exceptionSubmitError.value = "請先選擇異常原因。";
    return;
  }
  if (!description) {
    exceptionSubmitError.value = "請填寫說明（必填）。";
    return;
  }

  busy.value = true;
  exceptionSubmitError.value = null;
  error.value = null;
  try {
    await api.reportWarehouseException(target.id, { reason_code: reason, description });
    toast.success(`已申報異常：${target.tracking_number ?? target.id}`);
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
});
</script>

<template>
  <UiPageShell eyebrow="員工 · 倉儲" title="站點與中心作業" lede="點收本站包裹、分揀並決定下一跳，派發司機轉運任務。">
    <UiCard style="margin-top: 16px">
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

      <UiNotice v-if="error" tone="error" role="alert" style="margin-top: 10px">{{ error }}</UiNotice>
      <p v-else-if="loading" class="hint" style="margin-top: 10px">載入中…</p>
    </UiCard>

    <UiCard style="margin-top: 16px">
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

      <UiList v-else style="margin-top: 12px">
        <li v-for="p in awaitingReceive" :key="p.id" style="display: grid; gap: 6px">
          <div style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; align-items: center">
            <label style="display: flex; align-items: center; gap: 10px">
              <input v-model="receiveSelection[p.id]" type="checkbox" :disabled="busy" />
              <strong>{{ p.tracking_number ?? p.id }}</strong>
            </label>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: flex-end">
              <span class="hint">{{ p.latest_event.delivery_status ?? "-" }} · {{ p.latest_event.events_at ?? "-" }}</span>
              <button class="ghost-btn small-btn" type="button" :disabled="busy" @click="startException(p)">申報異常</button>
            </div>
          </div>
          <div class="hint">{{ p.sender_address ?? "-" }} → {{ p.receiver_address ?? "-" }}</div>
        </li>
      </UiList>
    </UiCard>

    <UiCard style="margin-top: 16px">
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

            <UiList v-else style="margin-top: 10px">
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
                  <button class="ghost-btn small-btn" type="button" :disabled="busy" @click="startException(p)">申報異常</button>
                </div>
              </li>
            </UiList>
          </div>
        </div>

        <div v-if="dispatched.length > 0" style="border-top: 1px solid #e5e7eb; padding-top: 12px">
          <p class="eyebrow">已派發（route_decided）</p>
          <p class="hint" style="margin-top: 6px">已建立下一段任務，等待司機接手。</p>
          <UiList style="margin-top: 10px">
            <li v-for="p in dispatched" :key="p.id" style="display: grid; gap: 6px">
              <div style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap">
                <strong>{{ p.tracking_number ?? p.id }}</strong>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: flex-end">
                  <span class="hint">{{ p.latest_event.events_at ?? "-" }}</span>
                  <button class="ghost-btn small-btn" type="button" :disabled="busy" @click="startException(p)">申報異常</button>
                </div>
              </div>
              <div class="hint">{{ p.latest_event.delivery_details ?? "-" }}</div>
            </li>
          </UiList>
        </div>
      </div>
    </UiCard>

    <UiCard style="margin-top: 16px">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap">
        <div>
          <p class="eyebrow">異常申報紀錄</p>
          <p class="hint" style="margin: 6px 0 0">僅顯示你提交的倉儲異常申報（是否已處理由客服結案）。</p>
        </div>
        <span class="hint">共 {{ exceptionReports.length }} 筆</span>
      </div>

      <div v-if="loading" class="hint" style="margin-top: 12px">載入中…</div>
      <div v-else-if="exceptionReports.length === 0" class="hint" style="margin-top: 12px">目前沒有異常申報紀錄。</div>
      <UiList v-else style="margin-top: 12px">
        <li v-for="r in exceptionReports" :key="r.id" style="display: grid; gap: 6px">
          <div style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; align-items: baseline">
            <strong>{{ r.tracking_number ?? r.package_id }}</strong>
            <span class="hint">{{ (r.handled ?? 0) === 1 ? "已處理" : "未處理" }} · {{ r.reported_at ?? "-" }}</span>
          </div>
          <div class="hint">{{ exceptionReasonLabel(r.reason_code) }}</div>
          <div class="hint">{{ r.description ?? "-" }}</div>
        </li>
      </UiList>
    </UiCard>

    <UiModal v-model="exceptionModalOpen" title="申報異常" aria-label="report exception" @close="closeExceptionModal">
      <template #subtitle>
        <p class="hint" style="margin: 0">
          包裹：{{ exceptionTarget?.tracking_number ?? exceptionTarget?.id ?? "-" }}
        </p>
      </template>

      <div class="form-grid" style="grid-template-columns: 1fr; gap: 10px">
        <label class="form-field">
          <span>異常原因（必選）</span>
          <select v-model="exceptionForm.reason_code" :disabled="busy">
            <option value="" disabled>請選擇異常原因</option>
            <option v-for="r in exceptionReasons" :key="r.code" :value="r.code">{{ r.label }}</option>
          </select>
        </label>

        <label class="form-field">
          <span>說明（必填）</span>
          <textarea
            v-model="exceptionForm.description"
            rows="3"
            :disabled="busy"
            placeholder="例：站內找不到包裹；已確認交接清單與貨架區域，請客服協助追查。"
          />
        </label>

        <UiNotice v-if="exceptionSubmitError" tone="error" role="alert">{{ exceptionSubmitError }}</UiNotice>
      </div>

      <template #actions>
        <button class="primary-btn" type="button" :disabled="busy" @click="submitException">送出</button>
        <button class="ghost-btn" type="button" :disabled="busy" @click="closeExceptionModal">取消</button>
      </template>
    </UiModal>
  </UiPageShell>
</template>
