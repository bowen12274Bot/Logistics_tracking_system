<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import UiCard from "../components/ui/UiCard.vue";
import UiModal from "../components/ui/UiModal.vue";
import UiPageShell from "../components/ui/UiPageShell.vue";
import { useAuthStore } from "../stores/auth";
import { api, type PackageStatus, type Package } from "../services/api";
import { exceptionReasonLabel, selectableReasonsFor } from "../lib/exceptionReasons";
import { toastFromApiError } from "../services/errorToast";
import { useToasts } from "../components/ui/toast";

const auth = useAuthStore();
const toast = useToasts();
const { t } = useI18n();

const loading = ref(false);
const busy = ref(false);
const packages = ref<Package[]>([]);
const exceptionReports = ref<
  { id: string; tracking_number?: string | null; handled?: number | null; reported_at?: string | null; reason_code?: string | null }[]
>([]);

const selectedNode = ref("");
const adjacentNodes = ref<string[]>([]);
const awaitingReceive = computed(() => packages.value.filter((p) => p.status === "warehouse_in"));
const sorting = computed(() => packages.value.filter((p) => p.status === "warehouse_sorting"));
const dispatched = computed(() => packages.value.filter((p) => p.status === "route_decided"));

const receiveChecked = reactive<Record<string, boolean>>({});
const nextHopFor = reactive<Record<string, string>>({});

const allReceiveChecked = computed(() =>
  awaitingReceive.value.length > 0 &&
  awaitingReceive.value.every((p) => receiveChecked[p.id] === true),
);

const toggleAllReceive = () => {
  const next = !allReceiveChecked.value;
  for (const p of awaitingReceive.value) receiveChecked[p.id] = next;
};

const refresh = async () => {
  loading.value = true;
  try {
    const res = await api.getWarehousePackages();
    packages.value = res.packages ?? [];
    selectedNode.value = res.node_id ?? "";
    adjacentNodes.value = res.adjacent_nodes ?? [];
  } catch (err) {
    toastFromApiError(err, t("warehouse.errors.loadFailed"));
  } finally {
    loading.value = false;
  }
};

const receiveSelected = async () => {
  const targets = awaitingReceive.value.filter((p) => receiveChecked[p.id]);
  if (targets.length === 0) {
    toast.warning(t("warehouse.hints.selectToReceive"));
    return;
  }
  busy.value = true;
  try {
    const res = await api.warehouseReceive(targets.map((p) => p.id));
    const failed = res.failed_ids?.length ?? 0;
    toast.success(
      failed > 0
        ? t("warehouse.receive.doneWithFailed", { success: res.processed, failed })
        : t("warehouse.receive.done", { count: res.processed }),
    );
    await refresh();
  } catch (err) {
    toastFromApiError(err, t("warehouse.errors.receiveFailed"));
  } finally {
    busy.value = false;
  }
};

const setNextHop = (pkg: Package, node: string) => {
  nextHopFor[pkg.id] = node;
};

const dispatchOne = async (pkg: Package) => {
  const nextHop = nextHopFor[pkg.id];
  if (!nextHop) {
    toast.warning(t("warehouse.hints.selectNextHop"));
    return;
  }
  busy.value = true;
  try {
    await api.warehouseDispatch(pkg.id, { next_hop: nextHop });
    toast.success(t("warehouse.dispatch.done", { tracking: pkg.tracking_number ?? pkg.id }));
    await refresh();
  } catch (err) {
    toastFromApiError(err, t("warehouse.errors.dispatchFailed"));
  } finally {
    busy.value = false;
  }
};

const exceptionModalOpen = ref(false);
const exceptionTarget = ref<Package | null>(null);
const exceptionReason = ref("");
const exceptionNote = ref("");
const exceptionSubmitError = ref("");

const startException = (pkg: Package) => {
  exceptionTarget.value = pkg;
  exceptionReason.value = "";
  exceptionNote.value = "";
  exceptionSubmitError.value = "";
  exceptionModalOpen.value = true;
};

const closeExceptionModal = () => {
  exceptionModalOpen.value = false;
};

const submitException = async () => {
  exceptionSubmitError.value = "";
  if (!exceptionReason.value) {
    exceptionSubmitError.value = t("warehouse.errors.exceptionReasonRequired");
    return;
  }
  if (!exceptionNote.value.trim()) {
    exceptionSubmitError.value = t("warehouse.errors.exceptionNoteRequired");
    return;
  }
  if (!exceptionTarget.value) return;

  busy.value = true;
  try {
    await api.reportException({
      package_id: exceptionTarget.value.id,
      reason_code: exceptionReason.value,
      reported_by: auth.user?.id ?? "warehouse",
      handling_report: exceptionNote.value.trim(),
    });
    toast.success(t("warehouse.exception.done", { tracking: exceptionTarget.value.tracking_number ?? exceptionTarget.value.id }));
    await refresh();
    await loadExceptions();
    closeExceptionModal();
  } catch (err) {
    toastFromApiError(err, t("warehouse.errors.exceptionFailed"));
  } finally {
    busy.value = false;
  }
};

const loadExceptions = async () => {
  try {
    const res = await api.getExceptions({ scope: "mine" });
    exceptionReports.value = res.records ?? [];
  } catch (err) {
    // ignore silently; optional
  }
};

refresh();
loadExceptions();
</script>

<template>
  <UiPageShell :eyebrow="t('warehouse.page.eyebrow')" :title="t('warehouse.page.title')" :lede="t('warehouse.page.lede')">
    <div class="layout">
      <UiCard class="card">
        <div class="header-row">
          <div>
            <p class="eyebrow">{{ t('warehouse.section.current.title') }}</p>
            <p class="hint">
              {{ t('warehouse.section.current.hint', { node: selectedNode || t('warehouse.section.current.unknown') }) }}
            </p>
          </div>
          <div class="actions">
            <button class="ghost-btn" type="button" :disabled="loading || busy" @click="refresh">
              {{ t('warehouse.actions.refresh') }}
            </button>
            <RouterLink class="ghost-btn" to="/map">{{ t('warehouse.actions.map') }}</RouterLink>
          </div>
        </div>

        <p v-if="loading" class="hint">{{ t('common.loading') }}</p>

        <template v-else>
          <section class="section">
            <p class="eyebrow">{{ t('warehouse.section.receive.title') }}</p>
            <p class="hint" style="margin: 6px 0 0">{{ t('warehouse.section.receive.hint') }}</p>

            <div class="toolbar">
              <label class="checkbox">
                <input type="checkbox" :checked="allReceiveChecked" @change="toggleAllReceive" />
                <span>{{ allReceiveChecked ? t('warehouse.receive.uncheckAll') : t('warehouse.receive.checkAll') }}</span>
              </label>
              <button class="primary-btn small-btn" type="button" :disabled="busy" @click="receiveSelected">
                {{ t('warehouse.receive.cta', { count: awaitingReceive.length }) }}
              </button>
            </div>

            <p v-if="loading" class="hint" style="margin-top: 12px">{{ t('common.loading') }}</p>
            <p v-else-if="awaitingReceive.length === 0" class="hint" style="margin-top: 12px">
              {{ t('warehouse.section.receive.empty') }}
            </p>

            <ul v-else class="package-list">
              <li v-for="p in awaitingReceive" :key="p.id" class="package-row">
                <label class="checkbox">
                  <input v-model="receiveChecked[p.id]" type="checkbox" />
                  <span>{{ p.tracking_number ?? p.id }}</span>
                </label>
              </li>
            </ul>
          </section>

          <section class="section">
            <p class="eyebrow">{{ t('warehouse.section.sorting.title') }}</p>
            <p class="hint" style="margin: 6px 0 0">{{ t('warehouse.section.sorting.hint') }}</p>
            <span class="hint">{{ t('warehouse.section.sorting.counts', { sorting: sorting.length, dispatched: dispatched.length }) }}</span>

            <p v-if="adjacentNodes.length === 0" class="hint error">{{ t('warehouse.section.sorting.noAdjacent') }}</p>

            <div class="grid">
              <UiCard v-for="n in adjacentNodes" :key="n" class="adjacent-card">
                <p class="eyebrow">{{ n }}</p>
                <p class="hint">{{ t('warehouse.section.sorting.countPerNode', { count: sorting.filter((p) => nextHopFor[p.id] === n).length }) }}</p>

                <div class="list">
                  <p v-if="sorting.length === 0" class="hint">{{ t('warehouse.section.sorting.empty') }}</p>
                  <template v-else>
                    <div v-for="p in sorting" :key="p.id" class="sorting-row">
                      <span>{{ p.tracking_number ?? p.id }}</span>
                      <div class="row-actions">
                        <select v-model="nextHopFor[p.id]" @change="setNextHop(p, nextHopFor[p.id])">
                          <option value="" disabled>{{ t('warehouse.section.sorting.pickNext') }}</option>
                          <option v-for="node in adjacentNodes" :key="node" :value="node">{{ node }}</option>
                        </select>
                        <button class="primary-btn small-btn" type="button" :disabled="busy" @click="dispatchOne(p)">
                          {{ t('warehouse.actions.dispatch') }}
                        </button>
                        <button class="ghost-btn small-btn" type="button" :disabled="busy" @click="startException(p)">
                          {{ t('warehouse.actions.exception') }}
                        </button>
                      </div>
                    </div>
                  </template>
                </div>
              </UiCard>
            </div>
          </section>

          <section class="section">
            <p class="eyebrow">{{ t('warehouse.section.dispatched.title') }}</p>
            <p class="hint" style="margin-top: 6px">{{ t('warehouse.section.dispatched.hint') }}</p>

            <p v-if="dispatched.length === 0" class="hint">{{ t('warehouse.section.dispatched.empty') }}</p>
            <ul v-else class="package-list">
              <li v-for="p in dispatched" :key="p.id" class="package-row">
                <div class="row-actions">
                  <span>{{ p.tracking_number ?? p.id }}</span>
                  <button class="ghost-btn small-btn" type="button" :disabled="busy" @click="startException(p)">
                    {{ t('warehouse.actions.exception') }}
                  </button>
                </div>
              </li>
            </ul>
          </section>

          <section class="section">
            <p class="eyebrow">{{ t('warehouse.section.exceptions.title') }}</p>
            <p class="hint" style="margin: 6px 0 0">{{ t('warehouse.section.exceptions.hint') }}</p>
            <span class="hint">{{ t('warehouse.section.exceptions.count', { count: exceptionReports.length }) }}</span>

            <p v-if="loading" class="hint" style="margin-top: 12px">{{ t('common.loading') }}</p>
            <p v-else-if="exceptionReports.length === 0" class="hint" style="margin-top: 12px">
              {{ t('warehouse.section.exceptions.empty') }}
            </p>

            <ul v-else class="package-list">
              <li v-for="r in exceptionReports" :key="r.id" class="package-row">
                <div class="row-actions">
                  <div>
                    <div class="tracking">{{ r.tracking_number ?? r.id }}</div>
                    <div class="hint">
                      {{ t('warehouse.section.exceptions.status', { status: (r.handled ?? 0) === 1 ? t('warehouse.exceptions.handled') : t('warehouse.exceptions.unhandled') }) }}
                      · {{ r.reported_at ?? "-" }}
                    </div>
                  </div>
                  <div class="hint">{{ exceptionReasonLabel(r.reason_code, t) }}</div>
                </div>
              </li>
            </ul>
          </section>
        </template>
      </UiCard>
    </div>

    <UiModal v-model="exceptionModalOpen" :title="t('warehouse.modal.title')" aria-label="report exception" @close="closeExceptionModal">
      <div class="modal-body">
        <p class="muted">
          {{ t('warehouse.modal.tracking', { tracking: exceptionTarget?.tracking_number ?? exceptionTarget?.id ?? "-" }) }}
        </p>

        <label class="form-field">
          <span>{{ t('warehouse.modal.reasonLabel') }}</span>
          <select v-model="exceptionReason" required>
            <option value="" disabled>{{ t('warehouse.modal.reasonPlaceholder') }}</option>
            <option v-for="r in selectableReasonsFor('warehouse_staff')" :key="r.code" :value="r.code">
              {{ exceptionReasonLabel(r.code, t) }}
            </option>
          </select>
        </label>

        <label class="form-field">
          <span>{{ t('warehouse.modal.noteLabel') }}</span>
          <textarea
            v-model="exceptionNote"
            rows="3"
            :placeholder="t('warehouse.modal.notePlaceholder')"
            required
          ></textarea>
        </label>

        <p v-if="exceptionSubmitError" class="error">{{ exceptionSubmitError }}</p>
      </div>

      <template #footer>
        <div class="modal-actions">
          <button class="primary-btn" type="button" :disabled="busy" @click="submitException">{{ t('warehouse.modal.submit') }}</button>
          <button class="ghost-btn" type="button" :disabled="busy" @click="closeExceptionModal">{{ t('common.cancel') }}</button>
        </div>
      </template>
    </UiModal>
  </UiPageShell>
</template>

<style scoped>
.layout {
  display: grid;
  gap: 16px;
}

.card {
  padding: 16px;
}

.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.section {
  margin-top: 20px;
  display: grid;
  gap: 8px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.checkbox {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font-size: 14px;
}

.package-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}

.package-row {
  border: 1px solid var(--surface-stroke);
  padding: 10px;
  border-radius: 10px;
  background: #fff;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  flex-wrap: wrap;
}

.grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.adjacent-card {
  border: 1px dashed var(--surface-stroke);
}

.list {
  display: grid;
  gap: 10px;
}

.sorting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sorting-row select {
  min-width: 120px;
}

.hint.error {
  color: #c0392b;
}

.modal-body {
  display: grid;
  gap: 10px;
}

.error {
  color: #c0392b;
  font-weight: 600;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>
