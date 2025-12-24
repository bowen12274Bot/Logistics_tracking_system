<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  api,
  type CustomerServiceContractApplication,
  type CustomerServiceExceptionRecord,
} from "../services/api";
import { exceptionReasonLabel } from "../lib/exceptionReasons";

type TabKey = "current" | "history";
type TaskKind = "exception" | "contract";

type TaskItem = {
  key: string; // `${kind}:${id}`
  kind: TaskKind;
  id: string;
  title: string;
  pill: { text: string; tone: "warning" | "done" };
  meta: string;
  createdAt: string | null;
  raw: CustomerServiceExceptionRecord | CustomerServiceContractApplication;
};

const activeTab = ref<TabKey>("current");
const expandedKey = ref<string | null>(null);

const isLoading = ref(false);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);

const exceptions = ref<CustomerServiceExceptionRecord[]>([]);
const contracts = ref<CustomerServiceContractApplication[]>([]);

const exceptionAction = ref<"resume" | "cancel">("resume");
const exceptionResumeMode = ref<"continue_segment" | "reroute_next_hop" | "redirect_destination">("continue_segment");
const exceptionNextHopOverride = ref("");
const exceptionDestinationOverride = ref("");
const exceptionHandlingReport = ref("");
const exceptionSubmitting = ref(false);
const exceptionSubmitError = ref<string | null>(null);

const contractDecision = ref<"approved" | "rejected">("approved");
const contractCreditLimit = ref<string>("");
const contractReviewNotes = ref("");
const contractSubmitting = ref(false);
const contractSubmitError = ref<string | null>(null);

const normalizeKey = (kind: TaskKind, id: string) => `${kind}:${id}`;

const reasonLabel = exceptionReasonLabel;

const contractStatusLabel = (status?: string | null) => {
  const s = String(status ?? "").trim().toLowerCase();
  if (s === "approved") return "已核准";
  if (s === "rejected") return "已拒絕";
  return "待審核";
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const currentTasks = computed<TaskItem[]>(() => {
  const tasks: TaskItem[] = [];

  for (const ex of exceptions.value) {
    if (Number(ex.handled ?? 0) === 1) continue;
    const id = String(ex.id);
    tasks.push({
      key: normalizeKey("exception", id),
      kind: "exception",
      id,
      title: ex.tracking_number || ex.package_id,
      pill: { text: "異常", tone: "warning" },
      meta: `分類：${reasonLabel(ex.reason_code)} · 申報：${ex.reported_role || "-"}`,
      createdAt: ex.reported_at ?? null,
      raw: ex,
    });
  }

  for (const app of contracts.value) {
    if (String(app.status) !== "pending") continue;
    const id = String(app.id);
    tasks.push({
      key: normalizeKey("contract", id),
      kind: "contract",
      id,
      title: app.company_name,
      pill: { text: "待審核", tone: "warning" },
      meta: `客戶：${app.customer?.email || app.customer?.id} · 統編：${app.tax_id}`,
      createdAt: app.created_at ?? null,
      raw: app,
    });
  }

  tasks.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return tasks;
});

const historyTasks = computed<TaskItem[]>(() => {
  const tasks: TaskItem[] = [];

  for (const ex of exceptions.value) {
    if (Number(ex.handled ?? 0) !== 1) continue;
    const id = String(ex.id);
    tasks.push({
      key: normalizeKey("exception", id),
      kind: "exception",
      id,
      title: ex.tracking_number || ex.package_id,
      pill: { text: "已結案", tone: "done" },
      meta: `分類：${reasonLabel(ex.reason_code)} · 申報：${ex.reported_role || "-"}`,
      createdAt: ex.handled_at ?? ex.reported_at ?? null,
      raw: ex,
    });
  }

  for (const app of contracts.value) {
    if (String(app.status) === "pending") continue;
    const id = String(app.id);
    tasks.push({
      key: normalizeKey("contract", id),
      kind: "contract",
      id,
      title: app.company_name,
      pill: { text: contractStatusLabel(app.status), tone: "done" },
      meta: `客戶：${app.customer?.email || app.customer?.id} · 統編：${app.tax_id}`,
      createdAt: app.reviewed_at ?? app.created_at ?? null,
      raw: app,
    });
  }

  tasks.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return tasks;
});

const tasksForActiveTab = computed(() =>
  activeTab.value === "current" ? currentTasks.value : historyTasks.value,
);

const expandedTask = computed<TaskItem | null>(() => {
  if (!expandedKey.value) return null;
  return tasksForActiveTab.value.find((t) => t.key === expandedKey.value) ?? null;
});

const toggleTask = (key: string) => {
  expandedKey.value = expandedKey.value === key ? null : key;
  exceptionSubmitError.value = null;
  contractSubmitError.value = null;
  notice.value = null;
  exceptionAction.value = "resume";
  exceptionResumeMode.value = "continue_segment";
  exceptionNextHopOverride.value = "";
  exceptionDestinationOverride.value = "";
};

const refresh = async () => {
  isLoading.value = true;
  error.value = null;
  notice.value = null;
  try {
    const [currentExceptions, handledExceptions, pendingContracts, approvedContracts, rejectedContracts] =
      await Promise.all([
        api.getCustomerServiceExceptions({ handled: false, limit: 200 }),
        api.getCustomerServiceExceptions({ handled: true, limit: 200 }),
        api.getCustomerServiceContractApplications({ status: "pending", limit: 200 }),
        api.getCustomerServiceContractApplications({ status: "approved", limit: 200 }),
        api.getCustomerServiceContractApplications({ status: "rejected", limit: 200 }),
      ]);

    exceptions.value = [
      ...(currentExceptions.exceptions ?? []),
      ...(handledExceptions.exceptions ?? []),
    ];
    contracts.value = [
      ...(pendingContracts.applications ?? []),
      ...(approvedContracts.applications ?? []),
      ...(rejectedContracts.applications ?? []),
    ];
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    isLoading.value = false;
  }
};

const submitExpandedException = async () => {
  const task = expandedTask.value;
  if (!task || task.kind !== "exception") return;

  exceptionSubmitError.value = null;
  const report = exceptionHandlingReport.value.trim();
  if (!report) {
    exceptionSubmitError.value = "handling_report 必填";
    return;
  }

  exceptionSubmitting.value = true;
  try {
    await api.handleCustomerServiceException(String(task.id), {
      action: exceptionAction.value,
      handling_report: report,
      ...(exceptionAction.value === "cancel"
        ? { cancel_reason: "destroy" as const }
        : {
            resume_mode: exceptionResumeMode.value,
            next_hop_override:
              exceptionResumeMode.value === "reroute_next_hop"
                ? exceptionNextHopOverride.value.trim() || undefined
                : undefined,
            destination_override:
              exceptionResumeMode.value === "redirect_destination"
                ? exceptionDestinationOverride.value.trim() || undefined
                : undefined,
          }),
    });
    notice.value = exceptionAction.value === "cancel" ? "已取消配送（配送失敗）" : "已恢復配送";
    exceptionHandlingReport.value = "";
    exceptionAction.value = "resume";
    exceptionResumeMode.value = "continue_segment";
    exceptionNextHopOverride.value = "";
    exceptionDestinationOverride.value = "";
    expandedKey.value = null;
    await refresh();
  } catch (e) {
    exceptionSubmitError.value = e instanceof Error ? e.message : String(e);
  } finally {
    exceptionSubmitting.value = false;
  }
};

const submitExpandedContract = async () => {
  const task = expandedTask.value;
  if (!task || task.kind !== "contract") return;

  contractSubmitError.value = null;
  const rawLimit = contractCreditLimit.value.trim();
  let creditLimit: number | undefined = undefined;
  if (rawLimit) {
    const parsed = Number(rawLimit);
    if (!Number.isFinite(parsed) || parsed < 0) {
      contractSubmitError.value = "credit_limit 必須為非負整數";
      return;
    }
    creditLimit = Math.floor(parsed);
  }

  contractSubmitting.value = true;
  try {
    await api.reviewCustomerServiceContractApplication(String(task.id), {
      status: contractDecision.value,
      credit_limit: creditLimit,
      review_notes: contractReviewNotes.value.trim() || undefined,
    });
    notice.value = contractDecision.value === "approved" ? "已核准合約申請" : "已拒絕合約申請";
    contractCreditLimit.value = "";
    contractReviewNotes.value = "";
    expandedKey.value = null;
    await refresh();
  } catch (e) {
    contractSubmitError.value = e instanceof Error ? e.message : String(e);
  } finally {
    contractSubmitting.value = false;
  }
};

watch(activeTab, () => {
  expandedKey.value = null;
  exceptionSubmitError.value = null;
  contractSubmitError.value = null;
  notice.value = null;
});

onMounted(async () => {
  await refresh();
});
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">員工 · 客服</p>
      <h1>客服任務清單</h1>
      <p class="lede">切換現在任務/過去紀錄，點開後再執行處理動作。</p>
    </header>

    <div class="tab-switch">
      <button class="tab-btn" :class="{ active: activeTab === 'current' }" type="button" :disabled="isLoading" @click="activeTab = 'current'">
        現在任務（{{ currentTasks.length }}）
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'history' }" type="button" :disabled="isLoading" @click="activeTab = 'history'">
        過去紀錄（{{ historyTasks.length }}）
      </button>
      <button class="ghost-btn" type="button" :disabled="isLoading" @click="refresh">重新整理</button>
    </div>

    <p v-if="error" class="hint" style="margin-top: 10px; color: #b91c1c">{{ error }}</p>
    <p v-else-if="notice" class="hint" style="margin-top: 10px; color: #166534">{{ notice }}</p>

    <div class="card" style="margin-top: 16px">
      <p v-if="isLoading" class="hint">載入中…</p>
      <p v-else-if="tasksForActiveTab.length === 0" class="hint">目前沒有資料。</p>

      <ul v-else class="package-list">
        <li v-for="t in tasksForActiveTab" :key="t.key" class="package-row" :class="{ active: expandedKey === t.key }">
          <button type="button" class="row-btn" @click="toggleTask(t.key)">
            <span class="tracking">{{ t.title }}</span>
            <span class="pill" :class="t.pill.tone">{{ t.pill.text }}</span>
            <span class="meta">{{ formatDateTime(t.createdAt) }}</span>
          </button>

          <div v-if="expandedKey === t.key" class="package-detail">
            <p class="hint" style="margin: 0 0 10px 0">{{ t.meta }}</p>

            <template v-if="t.kind === 'exception'">
              <p class="hint" style="margin: 0 0 10px 0">
                描述：{{ (t.raw as any).description || "-" }}
              </p>
              <p class="hint" style="margin: 0 0 6px 0">
                寄件地：{{ (t.raw as any).sender_address || "-" }} · 收件地：{{ (t.raw as any).receiver_address || "-" }}
              </p>
              <p v-if="(t.raw as any).active_vehicle_code" class="hint" style="margin: 0 0 6px 0">
                車上：{{ (t.raw as any).active_vehicle_code }} · 車輛位置：{{ (t.raw as any).active_vehicle_node_id || "-" }}
              </p>
              <p v-if="(t.raw as any).last_canceled_to_location" class="hint" style="margin: 0 0 10px 0">
                上一次任務：{{ (t.raw as any).last_canceled_from_location || "-" }} → {{ (t.raw as any).last_canceled_to_location || "-" }}
              </p>

              <div v-if="activeTab === 'history'" class="hint">此異常已結案。</div>
              <div v-else class="form-grid">
                <label class="form-field">
                  <span>動作</span>
                  <select v-model="exceptionAction" :disabled="exceptionSubmitting">
                    <option value="resume">恢復配送（resume）</option>
                    <option value="cancel">取消配送（cancel → 配送失敗）</option>
                  </select>
                </label>

                <label v-if="exceptionAction === 'resume'" class="form-field">
                  <span>恢復模式</span>
                  <select v-model="exceptionResumeMode" :disabled="exceptionSubmitting">
                    <option value="continue_segment">原行程恢復（繼續當下那一段）</option>
                    <option value="reroute_next_hop">改下一跳（目的地不變）</option>
                    <option value="redirect_destination">改目的地（留空=送回原處）</option>
                  </select>
                </label>

                <label v-if="exceptionAction === 'resume' && exceptionResumeMode === 'reroute_next_hop'" class="form-field span-2">
                  <span>指定下一跳（必須相鄰節點）</span>
                  <input v-model="exceptionNextHopOverride" type="text" :disabled="exceptionSubmitting" placeholder="例如 REG_0 / HUB_0" />
                </label>

                <label v-if="exceptionAction === 'resume' && exceptionResumeMode === 'redirect_destination'" class="form-field span-2">
                  <span>指定目的地（選填）</span>
                  <input
                    v-model="exceptionDestinationOverride"
                    type="text"
                    :disabled="exceptionSubmitting"
                    placeholder="留空=送回原處；或指定節點 ID（例如 END_HOME_1）"
                  />
                </label>

                <label v-if="exceptionAction === 'cancel'" class="form-field span">
                  <span>取消原因</span>
                  <input type="text" value="銷毀" disabled />
                </label>

                <label class="form-field span-2">
                  <span>handling_report（必填）</span>
                  <textarea
                    v-model="exceptionHandlingReport"
                    rows="3"
                    :disabled="exceptionSubmitting"
                    placeholder="請輸入處理摘要（導向處置可先寫在這裡）"
                  />
                </label>

              </div>

              <p v-if="exceptionSubmitError" class="hint" style="margin-top: 10px; color: #b91c1c">
                {{ exceptionSubmitError }}
              </p>
              <div v-if="activeTab === 'current'" style="display: flex; justify-content: flex-end; margin-top: 10px">
                <button class="primary-btn" type="button" :disabled="exceptionSubmitting" @click="submitExpandedException">
                  {{ exceptionSubmitting ? "送出中…" : "送出處理" }}
                </button>
              </div>
            </template>

            <template v-else>
              <div class="detail-grid">
                <div class="detail-item">
                  <p class="detail-label">公司名稱</p>
                  <p class="detail-value">{{ (t.raw as any).company_name }}</p>
                </div>
                <div class="detail-item">
                  <p class="detail-label">統一編號</p>
                  <p class="detail-value">{{ (t.raw as any).tax_id }}</p>
                </div>
                <div class="detail-item">
                  <p class="detail-label">聯絡人</p>
                  <p class="detail-value">{{ (t.raw as any).contact_person }}</p>
                </div>
                <div class="detail-item">
                  <p class="detail-label">聯絡電話</p>
                  <p class="detail-value">{{ (t.raw as any).contact_phone }}</p>
                </div>
                <div class="detail-item span-2">
                  <p class="detail-label">開票地址</p>
                  <p class="detail-value">{{ (t.raw as any).billing_address }}</p>
                </div>
              </div>

              <p class="hint" style="margin: 0">
                備註：{{ (t.raw as any).notes || "-" }}
              </p>

              <div v-if="activeTab === 'history'" class="hint" style="margin-top: 10px">
                此申請已審核：{{ contractStatusLabel((t.raw as any).status) }}
              </div>
              <div v-else style="margin-top: 10px">
                <div class="form-grid">
                  <label class="form-field">
                    <span>審核結果</span>
                    <select v-model="contractDecision" :disabled="contractSubmitting">
                      <option value="approved">核准</option>
                      <option value="rejected">拒絕</option>
                    </select>
                  </label>

                  <label class="form-field">
                    <span>credit_limit（選填）</span>
                    <input
                      v-model="contractCreditLimit"
                      type="number"
                      min="0"
                      step="1"
                      :disabled="contractSubmitting"
                      placeholder="例如 100000"
                    />
                  </label>

                  <label class="form-field span-2">
                    <span>review_notes（選填）</span>
                    <textarea
                      v-model="contractReviewNotes"
                      rows="3"
                      :disabled="contractSubmitting"
                      placeholder="審核備註（可留空）"
                    />
                  </label>
                </div>

                <p v-if="contractSubmitError" class="hint" style="margin-top: 10px; color: #b91c1c">
                  {{ contractSubmitError }}
                </p>
                <div style="display: flex; justify-content: flex-end; margin-top: 10px">
                  <button class="primary-btn" type="button" :disabled="contractSubmitting" @click="submitExpandedContract">
                    {{ contractSubmitting ? "送出中…" : "送出審核" }}
                  </button>
                </div>
              </div>
            </template>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.tab-switch {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 16px;
}

.tab-btn {
  border: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.06);
  cursor: pointer;
  font-weight: 800;
}

.tab-btn.active {
  background: rgba(99, 102, 241, 0.14);
  box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.25);
}

.package-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}

.package-row {
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.7);
  overflow: hidden;
}

.package-row.active {
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.08);
}

.row-btn {
  width: 100%;
  text-align: left;
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: center;
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

.pill.warning {
  background: rgba(255, 193, 7, 0.18);
  color: rgba(140, 105, 0, 1);
  box-shadow: inset 0 0 0 1px rgba(255, 193, 7, 0.25);
}

.pill.done {
  background: rgba(34, 197, 94, 0.14);
  color: rgba(28, 117, 48, 1);
  box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.18);
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

.detail-item.span-2 {
  grid-column: span 2;
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

@media (max-width: 720px) {
  .row-btn {
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
  }

  .meta {
    grid-column: 1 / -1;
  }
}
</style>
