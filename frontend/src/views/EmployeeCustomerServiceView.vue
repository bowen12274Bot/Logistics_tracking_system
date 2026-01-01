<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  api,
  type CustomerServiceContractApplication,
  type CustomerServiceExceptionRecord,
} from "../services/api";
import { EXCEPTION_REASONS, exceptionReasonLabel } from "../lib/exceptionReasons";
import UiCard from '../components/ui/UiCard.vue'
import UiList from '../components/ui/UiList.vue'
import UiModal from '../components/ui/UiModal.vue'
import UiNotice from '../components/ui/UiNotice.vue'
import UiPageShell from '../components/ui/UiPageShell.vue'
import UiButton from '../components/ui/UiButton.vue'
import { useToasts } from "../components/ui/toast";
import { toastFromApiError, translateCommonBackendMessages } from "../services/errorToast";
import { roleLabelKey } from "../services/roleLabels";

type TaskKind = "exception" | "contract";
type ViewKey = "exceptions" | "contracts" | "handled";
type HandledTypeFilter = "all" | "exception" | "contract";
type ExceptionReasonFilter = "" | (typeof EXCEPTION_REASONS)[number]["code"];

type TaskBase = {
  key: string; // `${kind}:${id}`
  id: string;
  title: string;
  pill: { text: string; tone: "warning" | "done" };
  meta: string;
  createdAt: string | null;
};

type ExceptionTask = TaskBase & { kind: "exception"; raw: CustomerServiceExceptionRecord };
type ContractTask = TaskBase & { kind: "contract"; raw: CustomerServiceContractApplication };
type TaskItem = ExceptionTask | ContractTask;

const activeView = ref<ViewKey>("exceptions");
const selectedKey = ref<string | null>(null);

const { t, locale } = useI18n();

const viewOrder: ViewKey[] = ["exceptions", "contracts", "handled"];
const exceptionsTabRef = ref<HTMLButtonElement | null>(null);
const contractsTabRef = ref<HTMLButtonElement | null>(null);
const handledTabRef = ref<HTMLButtonElement | null>(null);

const taskButtonRefs = new Map<string, HTMLButtonElement>();

const csLayoutRef = ref<HTMLElement | null>(null);
const isFullscreen = ref(false);

const isLoading = ref(false);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);
const lastRefreshedAt = ref<string | null>(null);

const exceptions = ref<CustomerServiceExceptionRecord[]>([]);
const contracts = ref<CustomerServiceContractApplication[]>([]);

const isCancelConfirmOpen = ref(false);

const exceptionReasonFilter = ref<ExceptionReasonFilter>("");
const handledTypeFilter = ref<HandledTypeFilter>("all");

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

const reasonLabel = (code?: string | null) => exceptionReasonLabel(code, t);

const roleLabel = (role?: string | null) => {
  const key = roleLabelKey(role as never);
  return key ? t(key) : (role ? String(role) : "-");
};

const contractStatusLabel = (status?: string | null) => {
  const s = String(status ?? "").trim().toLowerCase();
  if (s === "approved") return t("cs.contract.status.approved");
  if (s === "rejected") return t("cs.contract.status.rejected");
  return t("cs.contract.status.pending");
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const targetLocale = locale.value === 'en-US' ? 'en-US' : 'zh-TW';
  return date.toLocaleString(targetLocale);
};

const normalizeReasonCode = (code?: string | null) => {
  const key = String(code ?? "").trim();
  if (!key) return "other" as const;
  return EXCEPTION_REASONS.some((r) => r.code === key) ? (key as ExceptionReasonFilter) : ("other" as const);
};

const exceptionUnhandledTasks = computed<ExceptionTask[]>(() => {
  const tasks: ExceptionTask[] = [];
  for (const ex of exceptions.value) {
    if (Number(ex.handled ?? 0) === 1) continue;
    const id = String(ex.id);
    tasks.push({
      key: normalizeKey("exception", id),
      kind: "exception" as const,
      id,
      title: ex.tracking_number || ex.package_id,
      pill: { text: t("cs.exception.pill.pending"), tone: "warning" },
      meta: `${t("cs.labels.reason")}：${reasonLabel(ex.reason_code)} · ${t("cs.labels.reportedBy")}：${roleLabel(ex.reported_role)}`,
      createdAt: ex.reported_at ?? null,
      raw: ex,
    });
  }
  tasks.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return tasks;
});

const exceptionHandledTasks = computed<ExceptionTask[]>(() => {
  const tasks: ExceptionTask[] = [];
  for (const ex of exceptions.value) {
    if (Number(ex.handled ?? 0) !== 1) continue;
    const id = String(ex.id);
    tasks.push({
      key: normalizeKey("exception", id),
      kind: "exception" as const,
      id,
      title: ex.tracking_number || ex.package_id,
      pill: { text: t("cs.exception.pill.done"), tone: "done" },
      meta: `${t("cs.labels.reason")}：${reasonLabel(ex.reason_code)} · ${t("cs.labels.reportedBy")}：${roleLabel(ex.reported_role)}`,
      createdAt: ex.handled_at ?? ex.reported_at ?? null,
      raw: ex,
    });
  }
  tasks.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return tasks;
});

const contractPendingTasks = computed<ContractTask[]>(() => {
  const tasks: ContractTask[] = [];
  for (const app of contracts.value) {
    if (String(app.status) !== "pending") continue;
    const id = String(app.id);
    tasks.push({
      key: normalizeKey("contract", id),
      kind: "contract" as const,
      id,
      title: app.company_name,
      pill: { text: t("cs.contract.pill.pending"), tone: "warning" },
      meta: `${t("cs.labels.customer")}：${app.customer?.email || app.customer?.id} · ${t("cs.labels.taxId")}：${app.tax_id}`,
      createdAt: app.created_at ?? null,
      raw: app,
    });
  }
  tasks.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return tasks;
});

const contractHandledTasks = computed<ContractTask[]>(() => {
  const tasks: ContractTask[] = [];
  for (const app of contracts.value) {
    if (String(app.status) === "pending") continue;
    const id = String(app.id);
    tasks.push({
      key: normalizeKey("contract", id),
      kind: "contract" as const,
      id,
      title: app.company_name,
      pill: { text: contractStatusLabel(app.status), tone: "done" },
      meta: `${t("cs.labels.customer")}：${app.customer?.email || app.customer?.id} · ${t("cs.labels.taxId")}：${app.tax_id}`,
      createdAt: app.reviewed_at ?? app.created_at ?? null,
      raw: app,
    });
  }
  tasks.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return tasks;
});

const viewCounts = computed(() => ({
  exceptions: exceptionUnhandledTasks.value.length,
  contracts: contractPendingTasks.value.length,
  handled: exceptionHandledTasks.value.length + contractHandledTasks.value.length,
}));

const showHandledTypeFilter = computed(() => activeView.value === "handled");
const showExceptionReasonFilter = computed(
  () => activeView.value === "exceptions" || (activeView.value === "handled" && handledTypeFilter.value !== "contract"),
);
const shouldTypeFilterSpan = computed(() => showHandledTypeFilter.value && !showExceptionReasonFilter.value);
const shouldReasonFilterSpan = computed(() => showExceptionReasonFilter.value && !showHandledTypeFilter.value);

const visibleTasks = computed<TaskItem[]>(() => {
  if (activeView.value === "exceptions") {
    const reason = exceptionReasonFilter.value;
    const base = exceptionUnhandledTasks.value;
    if (!reason) return base;
    return base.filter((t) => normalizeReasonCode(t.raw.reason_code) === reason);
  }

  if (activeView.value === "contracts") {
    return contractPendingTasks.value;
  }

  const typeFilter = handledTypeFilter.value;
  const merged: TaskItem[] = [
    ...(typeFilter === "contract" ? [] : exceptionHandledTasks.value),
    ...(typeFilter === "exception" ? [] : contractHandledTasks.value),
  ];

  const reason = exceptionReasonFilter.value;
  if (!reason) return merged;
  return merged.filter((t) => t.kind !== "exception" || normalizeReasonCode(t.raw.reason_code) === reason);
});

const selectedTask = computed<TaskItem | null>(() => {
  if (!selectedKey.value) return null;
  return visibleTasks.value.find((t) => t.key === selectedKey.value) ?? null;
});

const isReadOnlyView = computed(() => activeView.value === "handled");

const detailScrollRef = ref<HTMLElement | null>(null);
const exceptionActionSelectRef = ref<HTMLSelectElement | null>(null);
const contractDecisionSelectRef = ref<HTMLSelectElement | null>(null);

const exceptionPendingCount = computed(() => exceptionUnhandledTasks.value.length);
const exceptionDoneCount = computed(() => exceptionHandledTasks.value.length);
const contractPendingCount = computed(() => contractPendingTasks.value.length);
const contractDoneCount = computed(() => contractHandledTasks.value.length);

const emptyListTitle = computed(() => {
  if (activeView.value === "exceptions") return t("cs.empty.exceptions");
  if (activeView.value === "contracts") return t("cs.empty.contracts");
  if (handledTypeFilter.value === "exception") return t("cs.empty.handledExceptions");
  if (handledTypeFilter.value === "contract") return t("cs.empty.handledContracts");
  return t("cs.empty.handledAll");
});

const emptyListHint = computed(() => t("cs.empty.hint"));

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
};

const focusActiveViewTab = async () => {
  await nextTick();
  const el =
    activeView.value === "exceptions"
      ? exceptionsTabRef.value
      : activeView.value === "contracts"
        ? contractsTabRef.value
        : handledTabRef.value;
  el?.focus();
};

const onViewSwitchKeydown = async (e: KeyboardEvent) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const key = e.key;
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;

  e.preventDefault();
  e.stopPropagation();

  const currentIndex = Math.max(0, viewOrder.indexOf(activeView.value));
  const nextIndex =
    key === "Home"
      ? 0
      : key === "End"
        ? viewOrder.length - 1
        : key === "ArrowLeft"
          ? Math.max(0, currentIndex - 1)
          : Math.min(viewOrder.length - 1, currentIndex + 1);

  const nextView = viewOrder[nextIndex];
  if (!nextView) return;
  if (nextView === activeView.value) return;
  activeView.value = nextView;
  await focusActiveViewTab();
};

const setTaskButtonRef = (key: string, el: Element | null) => {
  if (el instanceof HTMLButtonElement) taskButtonRefs.set(key, el);
  else taskButtonRefs.delete(key);
};

const focusSelectedTask = async () => {
  if (!selectedKey.value) return;
  await nextTick();
  taskButtonRefs.get(selectedKey.value)?.focus();
};

const focusDetailForm = async () => {
  if (isReadOnlyView.value) return;
  await nextTick();
  if (selectedTask.value?.kind === "exception") exceptionActionSelectRef.value?.focus();
  if (selectedTask.value?.kind === "contract") contractDecisionSelectRef.value?.focus();
};

const syncFullscreenState = () => {
  const el = csLayoutRef.value;
  isFullscreen.value = Boolean(el && document.fullscreenElement === el);
};

const requestElementFullscreen = async (el: HTMLElement) => {
  const anyEl = el as unknown as {
    requestFullscreen?: () => Promise<void> | void;
    webkitRequestFullscreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };

  if (typeof anyEl.requestFullscreen === "function") return anyEl.requestFullscreen();
  if (typeof anyEl.webkitRequestFullscreen === "function") return anyEl.webkitRequestFullscreen();
  if (typeof anyEl.msRequestFullscreen === "function") return anyEl.msRequestFullscreen();
};

const exitFullscreen = async () => {
  const anyDoc = document as unknown as { exitFullscreen?: () => Promise<void> | void };
  if (typeof anyDoc.exitFullscreen === "function") return anyDoc.exitFullscreen();
};

const toggleFullscreen = async () => {
  const el = csLayoutRef.value;
  if (!el) return;
  if (document.fullscreenElement === el) await exitFullscreen();
  else await requestElementFullscreen(el);
  syncFullscreenState();
};

const onTaskListKeydown = async (e: KeyboardEvent) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (isEditableTarget(e.target)) return;
  if (visibleTasks.value.length === 0) return;

  const key = e.key;
  const moveKeys = ["ArrowDown", "ArrowUp", "Home", "End"];
  if (moveKeys.includes(key)) {
    e.preventDefault();
    e.stopPropagation();

    const currentIndex = visibleTasks.value.findIndex((t) => t.key === selectedKey.value);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex =
      key === "Home"
        ? 0
        : key === "End"
          ? visibleTasks.value.length - 1
          : key === "ArrowUp"
            ? Math.max(0, safeIndex - 1)
            : Math.min(visibleTasks.value.length - 1, safeIndex + 1);

    const nextKey = visibleTasks.value[nextIndex]?.key;
    if (!nextKey) return;
    selectTask(nextKey);
    await focusSelectedTask();
    return;
  }

  if (key === "Enter" || key === " ") {
    e.preventDefault();
    e.stopPropagation();
    await focusDetailForm();
  }
};

const selectTask = (key: string) => {
  selectedKey.value = key;
  notice.value = null;
  exceptionSubmitError.value = null;
  contractSubmitError.value = null;
  resetExceptionForm();
  resetContractForm();
};

const toggleTaskSelection = (key: string) => {
  if (selectedKey.value === key) {
    selectedKey.value = null;
    notice.value = null;
    exceptionSubmitError.value = null;
    contractSubmitError.value = null;
    resetExceptionForm();
    resetContractForm();
    return;
  }
  selectTask(key);
};

const resetExceptionForm = () => {
  exceptionSubmitError.value = null;
  exceptionAction.value = "resume";
  exceptionResumeMode.value = "continue_segment";
  exceptionNextHopOverride.value = "";
  exceptionDestinationOverride.value = "";
  exceptionHandlingReport.value = "";
  isCancelConfirmOpen.value = false;
};

const resetContractForm = () => {
  contractSubmitError.value = null;
  contractDecision.value = "approved";
  contractCreditLimit.value = "";
  contractReviewNotes.value = "";
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
    toastFromApiError(e, error.value ?? t("cs.errors.loadFailed"));
  } finally {
    lastRefreshedAt.value = new Date().toISOString();
    isLoading.value = false;
  }
};

const submitExpandedException = async () => {
  const task = selectedTask.value as ExceptionTask | null;
  if (!task || task.kind !== "exception") return;

  exceptionSubmitError.value = null;
  const report = exceptionHandlingReport.value.trim();
  if (!report) {
    exceptionSubmitError.value = t("cs.errors.handlingReportRequired");
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
    notice.value =
      exceptionAction.value === "cancel" ? t("cs.notices.exceptionCanceled") : t("cs.notices.exceptionResumed");
    resetExceptionForm();
    await refresh();
  } catch (e) {
    const rawMessage = e instanceof Error ? e.message : String(e);
    exceptionSubmitError.value = translateCommonBackendMessages(rawMessage);
    toastFromApiError(e, exceptionSubmitError.value ?? t("cs.errors.actionFailed"));
  } finally {
    exceptionSubmitting.value = false;
  }
};

const submitExpandedContract = async () => {
  const task = selectedTask.value as ContractTask | null;
  if (!task || task.kind !== "contract") return;

  contractSubmitError.value = null;
  const rawLimit = contractCreditLimit.value.trim();
  let creditLimit: number | undefined = undefined;
  if (rawLimit) {
    const parsed = Number(rawLimit);
    if (!Number.isFinite(parsed) || parsed < 0) {
      contractSubmitError.value = t("cs.errors.creditLimitNonNegativeInteger");
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
    notice.value =
      contractDecision.value === "approved" ? t("cs.notices.contractApproved") : t("cs.notices.contractRejected");
    resetContractForm();
    await refresh();
  } catch (e) {
    contractSubmitError.value = e instanceof Error ? e.message : String(e);
    toastFromApiError(e, contractSubmitError.value ?? t("cs.errors.actionFailed"));
  } finally {
    contractSubmitting.value = false;
  }
};

const requestSubmitExpandedException = async () => {
  const task = selectedTask.value as ExceptionTask | null;
  if (!task || task.kind !== "exception") return;

  exceptionSubmitError.value = null;
  const report = exceptionHandlingReport.value.trim();
  if (!report) {
    exceptionSubmitError.value = t("cs.errors.handlingReportRequired");
    return;
  }

  if (exceptionAction.value === "cancel") {
    isCancelConfirmOpen.value = true;
    return;
  }

  await submitExpandedException();
};

const cancelConfirmSummary = computed(() => {
  const task = selectedTask.value;
  if (!task || task.kind !== "exception") return null;
  const report = exceptionHandlingReport.value.trim();
  return {
    title: task.title,
    meta: task.meta,
    reportPreview: report.length > 120 ? `${report.slice(0, 120)}…` : report,
  };
});

watch(activeView, () => {
  notice.value = null;
  error.value = null;
  isCancelConfirmOpen.value = false;
  resetExceptionForm();
  resetContractForm();
  selectedKey.value = null;
  exceptionReasonFilter.value = "";
  handledTypeFilter.value = "all";
});

watch(
  () => visibleTasks.value.map((t) => t.key).join("|"),
  () => {
    if (selectedKey.value && visibleTasks.value.some((t) => t.key === selectedKey.value)) return;
    selectedKey.value = visibleTasks.value[0]?.key ?? null;
  },
  { immediate: true },
);

onMounted(async () => {
  await refresh();
  syncFullscreenState();
  document.addEventListener("fullscreenchange", syncFullscreenState);
});

onUnmounted(() => {
  document.removeEventListener("fullscreenchange", syncFullscreenState);
});
</script>

<template>
  <UiPageShell :eyebrow="t('cs.page.eyebrow')" :title="t('cs.page.title')" :lede="t('cs.page.lede')">
    <UiNotice v-if="error" tone="error" role="alert" style="margin-top: 10px">{{ error }}</UiNotice>
    <UiNotice v-else-if="notice" tone="success" style="margin-top: 10px">{{ notice }}</UiNotice>

    <UiCard class="cs-overview-bar" style="margin-top: 16px">
      <div class="cs-overview">
        <div class="overview-card">
          <p class="eyebrow">{{ t('cs.overview.pendingExceptions.label') }}</p>
          <p class="overview-value">{{ exceptionPendingCount }}</p>
          <p class="hint" style="margin: 6px 0 0">
            {{ t('cs.overview.pendingExceptions.hint', { view: t('cs.views.exceptions') }) }}
          </p>
        </div>
        <div class="overview-card">
          <p class="eyebrow">{{ t('cs.overview.doneExceptions.label') }}</p>
          <p class="overview-value">{{ exceptionDoneCount }}</p>
          <p class="hint" style="margin: 6px 0 0">
            {{
              t('cs.overview.doneExceptions.hint', {
                view: t('cs.views.handled'),
                type: t('cs.filters.type.exception'),
              })
            }}
          </p>
        </div>
        <div class="overview-card">
          <p class="eyebrow">{{ t('cs.overview.pendingContracts.label') }}</p>
          <p class="overview-value">{{ contractPendingCount }}</p>
          <p class="hint" style="margin: 6px 0 0">
            {{ t('cs.overview.pendingContracts.hint', { view: t('cs.views.contracts') }) }}
          </p>
        </div>
        <div class="overview-card">
          <p class="eyebrow">{{ t('cs.overview.doneContracts.label') }}</p>
          <p class="overview-value">{{ contractDoneCount }}</p>
          <p class="hint" style="margin: 6px 0 0">
            {{
              t('cs.overview.doneContracts.hint', {
                view: t('cs.views.handled'),
                type: t('cs.filters.type.contract'),
              })
            }}
          </p>
        </div>
      </div>
    </UiCard>

    <div ref="csLayoutRef" class="cs-layout" :class="{ fullscreen: isFullscreen }">
      <div class="cs-layout-header">
        <div class="cs-layout-header-row">
          <div class="cs-view-switch" role="tablist" :aria-label="t('cs.views.aria')" @keydown="onViewSwitchKeydown">
            <button
              class="cs-view-btn"
              :class="{ active: activeView === 'exceptions' }"
              type="button"
              :disabled="isLoading"
              role="tab"
              :aria-selected="activeView === 'exceptions'"
              :tabindex="activeView === 'exceptions' ? 0 : -1"
              ref="exceptionsTabRef"
              @click="activeView = 'exceptions'"
            >
              <span class="cs-view-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path
                    d="M12 2 1 21h22L12 2Zm0 6.5c.55 0 1 .45 1 1v5.5a1 1 0 1 1-2 0V9.5c0-.55.45-1 1-1Zm0 10.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z"
                  />
                </svg>
              </span>
              <span>{{ t('cs.views.exceptions') }}</span>
              <span class="cs-view-count">({{ viewCounts.exceptions }})</span>
            </button>
            <button
              class="cs-view-btn"
              :class="{ active: activeView === 'contracts' }"
              type="button"
              :disabled="isLoading"
              role="tab"
              :aria-selected="activeView === 'contracts'"
              :tabindex="activeView === 'contracts' ? 0 : -1"
              ref="contractsTabRef"
              @click="activeView = 'contracts'"
            >
              <span class="cs-view-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M7 2h7l5 5v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5L14 3.5Z" />
                  <path d="M8 11h8v2H8v-2Zm0 4h8v2H8v-2Z" />
                </svg>
              </span>
              <span>{{ t('cs.views.contracts') }}</span>
              <span class="cs-view-count">({{ viewCounts.contracts }})</span>
            </button>
            <button
              class="cs-view-btn"
              :class="{ active: activeView === 'handled' }"
              type="button"
              :disabled="isLoading"
              role="tab"
              :aria-selected="activeView === 'handled'"
              :tabindex="activeView === 'handled' ? 0 : -1"
              ref="handledTabRef"
              @click="activeView = 'handled'"
            >
              <span class="cs-view-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path
                    d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm-1.1-6.2 7.2-7.2-1.4-1.4-5.8 5.8-2.5-2.5-1.4 1.4 3.9 3.9Z"
                  />
                </svg>
              </span>
              <span>{{ t('cs.views.handled') }}</span>
              <span class="cs-view-count">({{ viewCounts.handled }})</span>
            </button>
          </div>

          <div class="cs-header-actions">
            <router-link class="ghost-btn small-btn" to="/cs/packages">
              {{ t('cs.actions.packageSearch') }}
            </router-link>
            <UiButton icon="refresh" variant="ghost" size="small" :disabled="isLoading" @click="refresh">
              {{ isLoading ? t('cs.actions.refreshing') : t('cs.actions.refresh') }}
            </UiButton>
            <UiButton
              :icon="isFullscreen ? 'fullscreen-exit' : 'fullscreen'"
              variant="ghost"
              size="small"
              @click="toggleFullscreen"
            >
              {{ isFullscreen ? t('cs.actions.exitFullscreen') : t('cs.actions.enterFullscreen') }}
            </UiButton>
          </div>
        </div>
      </div>

      <UiCard class="cs-list">
        <div class="cs-list-fixed">
          <div class="cs-filters">
            <label v-if="showHandledTypeFilter" class="filter-field" :class="{ 'filter-span-2': shouldTypeFilterSpan }">
              <span class="hint">{{ t('cs.filters.type.label') }}</span>
              <select v-model="handledTypeFilter" :disabled="isLoading">
                <option value="all">{{ t('cs.filters.type.all') }}</option>
                <option value="exception">{{ t('cs.filters.type.exception') }}</option>
                <option value="contract">{{ t('cs.filters.type.contract') }}</option>
              </select>
            </label>

            <label
              v-if="showExceptionReasonFilter"
              class="filter-field"
              :class="{ 'filter-span-2': shouldReasonFilterSpan }"
            >
              <span class="hint">{{ t('cs.filters.reason.label') }}</span>
              <select v-model="exceptionReasonFilter" :disabled="isLoading">
                <option value="">{{ t('cs.filters.reason.all') }}</option>
                <option v-for="r in EXCEPTION_REASONS" :key="r.code" :value="r.code">{{ reasonLabel(r.code) }}</option>
              </select>
            </label>
          </div>
        </div>

        <div class="cs-list-scroll">
          <p v-if="isLoading" class="hint" style="margin: 0">{{ t('common.loading') }}</p>
          <div v-else-if="visibleTasks.length === 0" class="cs-empty">
            <p class="cs-empty-title">{{ emptyListTitle }}</p>
            <p class="hint" style="margin: 6px 0 0">{{ emptyListHint }}</p>
          </div>
          <ul v-else class="task-list" @keydown="onTaskListKeydown">
            <li v-for="t in visibleTasks" :key="t.key" class="task-row">
              <button
                class="task-btn"
                type="button"
                :class="{ active: selectedKey === t.key }"
                :aria-current="selectedKey === t.key ? 'true' : undefined"
                :ref="(el) => setTaskButtonRef(t.key, el as Element | null)"
                @click="toggleTaskSelection(t.key)"
              >
                <div class="task-main">
                  <div class="task-title">{{ t.title }}</div>
                  <div class="task-meta">{{ t.meta }}</div>
                </div>
                <div class="task-side">
                  <span class="status-pill" :class="t.pill.tone">{{ t.pill.text }}</span>
                  <span class="task-time">{{ formatDateTime(t.createdAt) }}</span>
                </div>
              </button>
            </li>
          </ul>
        </div>
      </UiCard>

      <UiCard class="cs-detail">
        <div class="cs-detail-fixed">
          <template v-if="selectedTask">
            <div class="detail-header">
              <div>
                <div class="detail-title">{{ selectedTask.title }}</div>
                <div class="detail-sub">{{ selectedTask.meta }}</div>
              </div>
              <span class="status-pill" :class="selectedTask.pill.tone">{{ selectedTask.pill.text }}</span>
            </div>
          </template>
          <template v-else>
            <div class="detail-header">
              <div>
                <div class="detail-title">{{ t('cs.cheatsheet.title') }}</div>
                <div class="detail-sub">{{ t('cs.cheatsheet.subtitle') }}</div>
              </div>
            </div>
          </template>
        </div>

        <div class="cs-detail-scroll" ref="detailScrollRef">
          <template v-if="!selectedTask">
            <div class="detail-section">
              <p class="hint" style="margin: 0 0 10px 0">{{ t('cs.cheatsheet.sections.flow') }}</p>
              <ol class="cheat-list">
                <li>{{ t('cs.cheatsheet.flow.step1') }}</li>
                <li>{{ t('cs.cheatsheet.flow.step2') }}</li>
                <li>{{ t('cs.cheatsheet.flow.step3') }}</li>
              </ol>
            </div>
            <div class="detail-section">
              <p class="hint" style="margin: 0 0 10px 0">{{ t('cs.cheatsheet.sections.exception') }}</p>
              <ul class="cheat-list">
                <li>{{ t('cs.cheatsheet.exception.item1') }}</li>
                <li>{{ t('cs.cheatsheet.exception.item2') }}</li>
              </ul>
            </div>
            <div class="detail-section">
              <p class="hint" style="margin: 0 0 10px 0">{{ t('cs.cheatsheet.sections.contract') }}</p>
              <ul class="cheat-list">
                <li>{{ t('cs.cheatsheet.contract.item1') }}</li>
                <li>{{ t('cs.cheatsheet.contract.item2') }}</li>
                <li>{{ t('cs.cheatsheet.contract.item3') }}</li>
              </ul>
            </div>
          </template>

          <template v-else-if="selectedTask.kind === 'exception'">
            <div class="detail-section">
              <p class="hint" style="margin: 0 0 10px 0">{{ t('cs.labels.basicInfo') }}</p>
              <div class="detail-grid">
                <div class="detail-item span">
                  <p class="detail-label">{{ t('cs.labels.senderAddress') }}</p>
                  <p class="detail-value">{{ selectedTask.raw.sender_address || '-' }}</p>
                </div>
                <div class="detail-item span">
                  <p class="detail-label">{{ t('cs.labels.receiverAddress') }}</p>
                  <p class="detail-value">{{ selectedTask.raw.receiver_address || '-' }}</p>
                </div>

                <div class="detail-item">
                  <p class="detail-label">{{ t('cs.labels.reason') }}</p>
                  <p class="detail-value">{{ reasonLabel(selectedTask.raw.reason_code) }}</p>
                </div>
                <div class="detail-item">
                  <p class="detail-label">{{ t('cs.labels.reportedBy') }}</p>
                  <p class="detail-value">{{ roleLabel(selectedTask.raw.reported_role) }}</p>
                </div>
                <div class="detail-item">
                  <p class="detail-label">{{ t('cs.labels.onVehicle') }}</p>
                  <p class="detail-value">{{ selectedTask.raw.active_vehicle_code || '-' }}</p>
                </div>
                <div class="detail-item span">
                  <p class="detail-label">{{ t('cs.labels.vehicleLocation') }}</p>
                  <p class="detail-value">{{ selectedTask.raw.active_vehicle_node_id || '-' }}</p>
                </div>
                <div class="detail-item span">
                  <p class="detail-label">{{ t('cs.labels.lastTask') }}</p>
                  <p class="detail-value">
                    {{ selectedTask.raw.last_canceled_from_location || '-' }} → {{ selectedTask.raw.last_canceled_to_location || '-' }}
                  </p>
                </div>
                <div class="detail-item">
                  <p class="detail-label">{{ t('cs.labels.reportedAt') }}</p>
                  <p class="detail-value">{{ formatDateTime(selectedTask.raw.reported_at) }}</p>
                </div>
              </div>
            </div>

            <div class="detail-section">
              <p class="hint" style="margin: 0 0 10px 0">{{ t('cs.labels.reportDescription') }}</p>
              <div class="cs-report-description">{{ selectedTask.raw.description || '-' }}</div>
            </div>

            <div v-if="isReadOnlyView" class="hint">{{ t('cs.exception.readOnlyHint') }}</div>
            <div v-else class="detail-section">
              <p class="hint" style="margin: 0 0 10px 0">{{ selectedTask.title }} · {{ selectedTask.meta }}</p>

              <div class="form-grid" style="margin-top: 6px">
                <label class="form-field">
                  <span>{{ t('cs.modal.exception.fields.action') }}</span>
                  <select ref="exceptionActionSelectRef" v-model="exceptionAction" :disabled="exceptionSubmitting">
                    <option value="resume">{{ t('cs.modal.exception.action.resume') }}</option>
                    <option value="cancel">{{ t('cs.modal.exception.action.cancel') }}</option>
                  </select>
                </label>

                <label v-if="exceptionAction === 'resume'" class="form-field">
                  <span>{{ t('cs.modal.exception.fields.resumeMode') }}</span>
                  <select v-model="exceptionResumeMode" :disabled="exceptionSubmitting">
                    <option value="continue_segment">{{ t('cs.modal.exception.resumeMode.continueSegment') }}</option>
                    <option value="redirect_destination">{{ t('cs.modal.exception.resumeMode.redirectDestination') }}</option>
                  </select>
                </label>



                <label
                  v-if="exceptionAction === 'resume' && exceptionResumeMode === 'redirect_destination'"
                  class="form-field span-2"
                >
                  <span>{{ t('cs.modal.exception.fields.destination') }}</span>
                  <input
                    v-model="exceptionDestinationOverride"
                    type="text"
                    :disabled="exceptionSubmitting"
                    :placeholder="t('cs.modal.exception.placeholders.destination')"
                  />
                </label>

                <label v-if="exceptionAction === 'cancel'" class="form-field span">
                  <span>{{ t('cs.modal.exception.fields.cancelReason') }}</span>
                  <input type="text" :value="t('cs.modal.exception.cancelReasonValue')" disabled />
                </label>

                <label class="form-field span-2">
                  <span>{{ t('cs.modal.exception.fields.handlingReport') }}</span>
                  <textarea
                    v-model="exceptionHandlingReport"
                    rows="4"
                    :disabled="exceptionSubmitting"
                    :placeholder="t('cs.modal.exception.placeholders.handlingReport')"
                  />
                </label>
              </div>

              <UiNotice v-if="exceptionSubmitError" tone="error" role="alert" style="margin-top: 10px">
                {{ exceptionSubmitError }}
              </UiNotice>

              <div class="cs-inline-actions">
                <button
                  class="ghost-btn"
                  type="button"
                  :disabled="exceptionSubmitting"
                  @click="resetExceptionForm"
                >
                  {{ t('common.reset') }}
                </button>
                <button
                  class="ghost-btn"
                  type="button"
                  :disabled="exceptionSubmitting"
                  @click="requestSubmitExpandedException"
                >
                  {{ exceptionSubmitting ? t('common.submitting') : t('cs.actions.submitHandling') }}
                </button>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="detail-grid">
              <div class="detail-item">
                <p class="detail-label">{{ t('cs.labels.companyName') }}</p>
                <p class="detail-value">{{ selectedTask.raw.company_name }}</p>
              </div>
              <div class="detail-item">
                <p class="detail-label">{{ t('cs.labels.taxId') }}</p>
                <p class="detail-value">{{ selectedTask.raw.tax_id }}</p>
              </div>
              <div class="detail-item">
                <p class="detail-label">{{ t('cs.labels.contactPerson') }}</p>
                <p class="detail-value">{{ selectedTask.raw.contact_person }}</p>
              </div>
              <div class="detail-item">
                <p class="detail-label">{{ t('cs.labels.contactPhone') }}</p>
                <p class="detail-value">{{ selectedTask.raw.contact_phone }}</p>
              </div>
              <div class="detail-item span-2">
                <p class="detail-label">{{ t('cs.labels.billingAddress') }}</p>
                <p class="detail-value">{{ selectedTask.raw.billing_address }}</p>
              </div>
            </div>

            <p class="hint" style="margin: 0">{{ t('cs.labels.notes') }}：{{ selectedTask.raw.notes || '-' }}</p>

            <div v-if="isReadOnlyView" class="hint" style="margin-top: 10px">
              {{ t('cs.contract.readOnlyHint', { status: contractStatusLabel(selectedTask.raw.status) }) }}
            </div>
            <div v-else class="detail-section" style="margin-top: 12px">
              <p class="hint" style="margin: 0 0 10px 0">{{ selectedTask.title }} · {{ selectedTask.meta }}</p>

              <div class="form-grid" style="margin-top: 6px">
                <label class="form-field">
                  <span>{{ t('cs.modal.contract.fields.decision') }}</span>
                  <select ref="contractDecisionSelectRef" v-model="contractDecision" :disabled="contractSubmitting">
                    <option value="approved">{{ t('cs.modal.contract.decision.approved') }}</option>
                    <option value="rejected">{{ t('cs.modal.contract.decision.rejected') }}</option>
                  </select>
                </label>

                <label class="form-field">
                  <span>{{ t('cs.modal.contract.fields.creditLimit') }}</span>
                  <input
                    v-model="contractCreditLimit"
                    type="number"
                    min="0"
                    step="1"
                    :disabled="contractSubmitting"
                    :placeholder="t('cs.modal.contract.placeholders.creditLimit')"
                  />
                </label>

                <label class="form-field span-2">
                  <span>{{ t('cs.modal.contract.fields.reviewNotes') }}</span>
                  <textarea
                    v-model="contractReviewNotes"
                    rows="4"
                    :disabled="contractSubmitting"
                    :placeholder="t('cs.modal.contract.placeholders.reviewNotes')"
                  />
                </label>
              </div>

              <UiNotice v-if="contractSubmitError" tone="error" role="alert" style="margin-top: 10px">
                {{ contractSubmitError }}
              </UiNotice>

              <div class="cs-inline-actions">
                <button class="ghost-btn" type="button" :disabled="contractSubmitting" @click="resetContractForm">
                  {{ t('common.reset') }}
                </button>
                <button class="ghost-btn" type="button" :disabled="contractSubmitting" @click="submitExpandedContract">
                  {{ contractSubmitting ? t('common.submitting') : t('cs.actions.submitReview') }}
                </button>
              </div>
            </div>
          </template>
        </div>
      </UiCard>
    </div>

    <UiModal v-model="isCancelConfirmOpen" :title="t('cs.modal.cancelConfirm.title')" :close-text="t('common.back')">
      <template v-if="cancelConfirmSummary">
        <UiNotice tone="warning" :title="t('cs.modal.cancelConfirm.warningTitle')">
          {{ t('cs.modal.cancelConfirm.warningBody') }}
        </UiNotice>

        <div class="detail-section" style="margin-top: 12px">
          <p class="hint" style="margin: 0 0 6px 0">
            {{ t('cs.labels.task') }}：{{ cancelConfirmSummary.title }}
          </p>
          <p class="hint" style="margin: 0 0 10px 0">{{ cancelConfirmSummary.meta }}</p>
          <p class="hint" style="margin: 0">
            {{ t('cs.labels.handlingReport') }}：{{ cancelConfirmSummary.reportPreview || '-' }}
          </p>
        </div>
      </template>
      <template v-else>
        <p class="hint" style="margin: 0">{{ t('cs.empty.selectExceptionFirst') }}</p>
      </template>
      <template #actions>
        <button class="ghost-btn" type="button" :disabled="exceptionSubmitting" @click="isCancelConfirmOpen = false">
          {{ t('common.back') }}
        </button>
        <button
          class="primary-btn"
          type="button"
          :disabled="exceptionSubmitting || !cancelConfirmSummary"
          @click="submitExpandedException"
        >
          {{ exceptionSubmitting ? t('common.submitting') : t('cs.actions.confirmCancel') }}
        </button>
      </template>
    </UiModal>
  </UiPageShell>
</template>

<style scoped>
.cs-overview-bar {
  padding: 14px 16px;
}

.cs-layout {
  display: grid;
  grid-template-columns: minmax(320px, 420px) 1fr;
  grid-template-rows: auto 1fr;
  gap: 14px;
  align-items: stretch;
  margin-top: 14px;
  height: min(680px, calc(100vh - 260px));
}

.cs-layout.fullscreen {
  margin-top: 0;
  height: 100vh;
  padding: 14px;
  grid-template-columns: minmax(360px, 520px) 1fr;
  background: var(--surface-card);
}

.cs-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.cs-layout-header {
  grid-column: 1 / -1;
  display: grid;
  gap: 6px;
}

.cs-last-refresh {
  padding-left: 2px;
}

.cs-layout-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.cs-view-switch {
  display: inline-flex;
  border: 1px solid rgba(165, 122, 99, 0.18);
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 248, 241, 0.65);
}

.cs-view-btn {
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

.cs-view-btn.active {
  background: rgba(244, 182, 194, 0.28);
}

.cs-view-btn:disabled {
  opacity: 0.75;
  cursor: not-allowed;
}

.cs-view-icon {
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

.cs-view-count {
  opacity: 0.85;
  font-weight: 800;
}

.cs-refresh-btn {
  height: 44px;
}

.cs-list {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 12px;
  min-height: 0;
}

.cs-list-fixed {
  display: block;
}

.cs-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-items: end;
}

.filter-field {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  min-width: 0;
}

.filter-span-2 {
  grid-column: 1 / -1;
}

.filter-field select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--surface-stroke);
  background: rgba(255, 255, 255, 0.86);
  color: var(--text-main);
}

.overview-card {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.18);
  background: rgba(255, 255, 255, 0.55);
}

.overview-value {
  margin: 2px 0 0 0;
  font-size: 18px;
  font-weight: 900;
  color: #3f2620;
}

.cs-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.cs-list-scroll {
  min-height: 0;
  overflow: auto;
  padding-right: 6px;
}

.cs-empty {
  padding: 14px 12px;
  border-radius: 12px;
  border: 1px dashed rgba(165, 122, 99, 0.28);
  background: rgba(255, 255, 255, 0.45);
}

.cs-empty-title {
  margin: 0;
  font-weight: 800;
  color: var(--text-main);
}

.task-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}

.task-row {
  margin: 0;
  padding: 0;
}

.task-btn {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  border: 1px solid rgba(165, 122, 99, 0.18);
  background: rgba(255, 255, 255, 0.55);
  border-radius: 12px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  color: inherit;
}

.task-btn:hover:not(.active) {
  background: rgba(255, 255, 255, 0.75);
  border-color: rgba(165, 122, 99, 0.28);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(165, 122, 99, 0.12);
}

.task-btn:active:not(.active) {
  transform: translateY(0);
  box-shadow: none;
}

.task-btn.active {
  border-color: rgba(244, 182, 194, 0.7);
  box-shadow: 0 12px 28px rgba(255, 145, 160, 0.18);
  background: rgba(255, 255, 255, 0.78);
}

.task-main {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.task-title {
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-meta {
  font-size: 13px;
  opacity: 0.85;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-side {
  display: grid;
  gap: 6px;
  justify-items: end;
}

.status-pill {
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

.status-pill.done {
  background: rgba(72, 187, 120, 0.16);
  border-color: rgba(72, 187, 120, 0.28);
  color: rgba(28, 79, 54, 0.95);
}

.task-time {
  font-size: 13px;
  opacity: 0.85;
  white-space: nowrap;
}

.cs-detail {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 12px;
  min-height: 0;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.detail-title {
  font-size: 18px;
  font-weight: 900;
  margin: 0;
}

.detail-sub {
  font-size: 13px;
  opacity: 0.8;
  margin-top: 6px;
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
  border: 1px solid rgba(165, 122, 99, 0.18);
  background: rgba(255, 255, 255, 0.55);
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

.detail-section {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.18);
  background: rgba(255, 255, 255, 0.55);
  margin-bottom: 12px;
}

.cs-report-description {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.6;
  color: var(--text-main);
  font-size: 14px;
}

.cs-detail-fixed {
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgba(255, 248, 241, 0.92);
  border-radius: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(165, 122, 99, 0.12);
}

.cs-detail-scroll {
  min-height: 0;
  overflow: auto;
  padding-right: 6px;
}

.cs-inline-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
}

.cheat-list {
  margin: 0;
  padding-left: 18px;
  color: var(--text-main);
}

.cheat-list li {
  margin: 6px 0;
}

@media (max-width: 980px) {
  .cs-layout {
    grid-template-columns: 1fr;
    height: auto;
  }

  .cs-layout.fullscreen {
    height: 100vh;
    padding: 12px;
  }

  .detail-item.span-2 {
    grid-column: auto;
  }
}
</style>
