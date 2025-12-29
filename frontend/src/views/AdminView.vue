<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../stores/auth";
import UiCard from "../components/ui/UiCard.vue";
import UiList from "../components/ui/UiList.vue";
import UiNotice from "../components/ui/UiNotice.vue";
import UiPageShell from "../components/ui/UiPageShell.vue";
import {
  api,
  type AdminContractApplication,
  type AdminSystemErrorRecord,
  type AdminUserClass,
  type AdminUserRecord,
} from "../services/api";

const { t, locale } = useI18n();
const auth = useAuthStore();

// Admin overview is always visible; the workbench switches between sections below.

const buildSampleUsers = (): AdminUserRecord[] => [
  { id: "u-driver", user_name: t("admin.samples.driver"), email: "driver_hub_1@example.com", user_class: "driver", user_type: "employee", address: "HUB_1", status: "active" },
  { id: "u-warehouse", user_name: t("admin.samples.warehouse"), email: "warehouse_hub_0@example.com", user_class: "warehouse_staff", user_type: "employee", address: "HUB_0", status: "active" },
  { id: "u-cs", user_name: t("admin.samples.cs"), email: "cs_reg_1@example.com", user_class: "customer_service", user_type: "employee", address: "REG_1", status: "suspended" },
  { id: "u-admin", user_name: t("admin.samples.admin"), email: "admin@example.com", user_class: "admin", user_type: "employee", address: "HQ", status: "active" },
];

const buildSampleContracts = (): AdminContractApplication[] => [
  {
    id: "c-1",
    customer: { id: "cust-1", email: "cust@example.com" },
    company_name: t("admin.samples.company"),
    tax_id: "12345678",
    contact_person: t("admin.samples.contactPerson"),
    contact_phone: "0912-345-678",
    billing_address: t("admin.samples.billingAddress"),
    notes: t("admin.samples.notes"),
    status: "pending",
    created_at: new Date().toISOString(),
  },
];

const buildSampleErrors = (): AdminSystemErrorRecord[] => [
  {
    id: "err-1",
    level: "error",
    code: "INTERNAL_ERROR",
    message: t("admin.samples.errorMessage1"),
    details: t("admin.samples.errorDetail1"),
    occurred_at: new Date().toISOString(),
    resolved: false,
  },
  {
    id: "err-2",
    level: "warning",
    code: "DELAYED_JOB",
    message: t("admin.samples.errorMessage2"),
    details: t("admin.samples.errorDetail2"),
    occurred_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    resolved: true,
  },
];

const billing = reactive({
  cycle: new Date().toISOString().slice(0, 7),
  loading: false,
  message: "",
  error: "",
});

const errors = reactive({
  list: [] as AdminSystemErrorRecord[],
  loading: false,
  error: "",
  level: "all" as "all" | AdminSystemErrorRecord["level"],
  resolved: "all" as "all" | "true" | "false",
  isSample: false,
});

const contracts = reactive({
  list: [] as AdminContractApplication[],
  loading: false,
  error: "",
  filter: "pending" as "pending" | "approved" | "rejected" | "all",
  expandedId: "",
  decision: "approved" as "approved" | "rejected",
  credit: "",
  notes: "",
  submitting: false,
  feedback: "",
  isSample: false,
});

const users = reactive({
  list: [] as AdminUserRecord[],
  loading: false,
  error: "",
  search: "",
  role: "all",
  status: "active",
  creating: false,
  actionMessage: "",
  actionError: "",
  selectedId: "",
  isSample: false,
});

const createForm = reactive({
  user_name: "",
  email: "",
  password: "",
  phone_number: "",
  address: "",
  user_class: "driver" as AdminUserClass,
});

const userStats = ref<{ tasks_completed: number; packages_processed: number; exceptions_reported: number } | null>(null);
const userActionLoading = ref(false);

const pendingContractsCount = computed(() => contracts.list.filter((c) => c.status === "pending").length);
const unresolvedErrorsCount = computed(() => errors.list.filter((e) => !e.resolved).length);

async function refreshAll() {
  await Promise.all([loadUsers(), loadContracts(), loadErrors()]);
}

type AdminWorkbenchTab = "billing" | "errors" | "contracts" | "users";
const workbenchTab = ref<AdminWorkbenchTab>("contracts");

const selectWorkbenchTab = (tab: AdminWorkbenchTab) => {
  workbenchTab.value = tab;
  users.selectedId = "";
  contracts.expandedId = "";
  userStats.value = null;
  contracts.feedback = "";
  contracts.error = "";
  errors.error = "";
};

const userClassLabel = (role: string) => t(`admin.userClass.${role}`, role);
const statusLabel = (status?: string) => t(`admin.status.${status ?? "active"}`, status ?? "");
const statusTone = (status?: string) => (status === "suspended" || status === "deleted" ? "pill--alert" : "pill--success");

const formatDateTime = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const loadUsers = async () => {
  users.loading = true;
  users.error = "";
  try {
    const res = await api.adminGetUsers({
      search: users.search || undefined,
      user_class: users.role === "all" ? undefined : users.role,
      status: users.status === "all" ? undefined : (users.status as any),
      limit: 50,
    });
    users.list = res.users ?? [];
    users.isSample = false;
  } catch (err: any) {
    users.error = err?.message || t("admin.users.errors.load");
    users.list = buildSampleUsers();
    users.isSample = true;
  } finally {
    users.loading = false;
  }
};

const createUser = async () => {
  users.actionMessage = "";
  users.error = "";
  users.actionError = "";
  if (!createForm.user_name || !createForm.email || !createForm.password) {
    users.actionError = t("admin.users.errors.required");
    return;
  }
  users.creating = true;
  try {
    await api.adminCreateUser({
      ...createForm,
      phone_number: createForm.phone_number || undefined,
      address: createForm.address || undefined,
    });
    users.actionMessage = t("admin.users.feedback.created");
    Object.assign(createForm, {
      user_name: "",
      email: "",
      password: "",
      phone_number: "",
      address: "",
      user_class: createForm.user_class,
    });
    await loadUsers();
  } catch (err: any) {
    users.actionError = err?.message || t("admin.users.errors.createFailed");
  } finally {
    users.creating = false;
  }
};

const selectUser = (id: string) => {
  users.selectedId = users.selectedId === id ? "" : id;
  users.actionMessage = "";
  users.actionError = "";
  userStats.value = null;
};

const toggleUserStatus = async (user: AdminUserRecord) => {
  userActionLoading.value = true;
  users.actionError = "";
  users.actionMessage = "";
  try {
    if (user.status === "active") {
      await api.adminSuspendUser(user.id, { reason: "manual" });
      users.actionMessage = t("admin.users.feedback.suspended");
    } else {
      await api.adminActivateUser(user.id);
      users.actionMessage = t("admin.users.feedback.activated");
    }
    await loadUsers();
  } catch (err: any) {
    users.actionError = err?.message || t("admin.users.errors.toggleFailed");
  } finally {
    userActionLoading.value = false;
  }
};

const resetPassword = async (user: AdminUserRecord) => {
  const pwd = window.prompt(t("admin.users.prompts.resetPassword", { email: user.email }), "");
  if (!pwd) return;
  userActionLoading.value = true;
  users.actionError = "";
  users.actionMessage = "";
  try {
    await api.adminResetUserPassword(user.id, { new_password: pwd });
    users.actionMessage = t("admin.users.feedback.reset");
  } catch (err: any) {
    users.actionError = err?.message || t("admin.users.errors.resetFailed");
  } finally {
    userActionLoading.value = false;
  }
};

const assignVehicle = async (user: AdminUserRecord) => {
  const code = window.prompt(t("admin.users.prompts.assignVehicle", { email: user.email }), "");
  if (!code) return;
  const home = window.prompt(t("admin.users.prompts.assignHome"), user.address || "");
  userActionLoading.value = true;
  users.actionError = "";
  users.actionMessage = "";
  try {
    await api.adminAssignVehicle(user.id, { vehicle_code: code, home_node_id: home || undefined });
    users.actionMessage = t("admin.users.feedback.assigned");
  } catch (err: any) {
    users.actionError = err?.message || t("admin.users.errors.assignFailed");
  } finally {
    userActionLoading.value = false;
  }
};

const fetchUserStats = async (user: AdminUserRecord) => {
  userActionLoading.value = true;
  users.actionError = "";
  try {
    const res = await api.adminUserWorkStats(user.id);
    userStats.value = res.stats;
  } catch (err: any) {
    users.actionError = err?.message || t("admin.users.errors.statsFailed");
  } finally {
    userActionLoading.value = false;
  }
};

const loadContracts = async () => {
  contracts.loading = true;
  contracts.error = "";
  try {
    const res = await api.adminListContractApplications(
      contracts.filter === "all" ? {} : { status: contracts.filter as any },
    );
    contracts.list = res.applications ?? [];
    contracts.isSample = false;
  } catch (err: any) {
    contracts.error = err?.message || t("admin.contracts.errors.load");
    contracts.list = buildSampleContracts();
    contracts.isSample = true;
  } finally {
    contracts.loading = false;
  }
};

const reviewContract = async () => {
  if (!contracts.expandedId) return;
  contracts.submitting = true;
  contracts.error = "";
  contracts.feedback = "";
  try {
    const credit = contracts.credit.trim();
    let creditLimit: number | undefined;
    if (credit) {
      const parsed = Number(credit);
      if (!Number.isFinite(parsed) || parsed < 0) {
        contracts.error = t("admin.contracts.errors.credit");
        contracts.submitting = false;
        return;
      }
      creditLimit = Math.floor(parsed);
    }
    await api.adminReviewContractApplication(contracts.expandedId, {
      status: contracts.decision,
      credit_limit: creditLimit,
      review_notes: contracts.notes.trim() || undefined,
    });
    contracts.feedback =
      contracts.decision === "approved" ? t("admin.contracts.feedback.approved") : t("admin.contracts.feedback.rejected");
    contracts.notes = "";
    contracts.credit = "";
    contracts.expandedId = "";
    await loadContracts();
  } catch (err: any) {
    contracts.error = err?.message || t("admin.contracts.errors.reviewFailed");
  } finally {
    contracts.submitting = false;
  }
};

const loadErrors = async () => {
  errors.loading = true;
  errors.error = "";
  try {
    const res = await api.adminSystemErrors({
      level: errors.level === "all" ? undefined : (errors.level as any),
      resolved: errors.resolved === "all" ? undefined : errors.resolved === "true",
      limit: 50,
    });
    errors.list = res.errors ?? [];
    errors.isSample = false;
  } catch (err: any) {
    errors.error = err?.message || t("admin.errors.errors.load");
    errors.list = buildSampleErrors();
    errors.isSample = true;
  } finally {
    errors.loading = false;
  }
};

const settleBilling = async () => {
  billing.loading = true;
  billing.error = "";
  billing.message = "";
  try {
    if (!/^\d{4}-\d{2}$/.test(billing.cycle)) {
      billing.error = t("admin.billing.errors.cycleFormat");
      billing.loading = false;
      return;
    }
    await api.adminSettleBilling({ cycle_year_month: billing.cycle });
    billing.message = t("admin.billing.feedback.settled", { cycle: billing.cycle });
  } catch (err: any) {
    billing.error = err?.message || t("admin.billing.errors.settleFailed");
  } finally {
    billing.loading = false;
  }
};

onMounted(async () => {
  await Promise.all([loadUsers(), loadContracts(), loadErrors()]);
});

watch(
  locale,
  () => {
    if (users.isSample) users.list = buildSampleUsers();
    if (contracts.isSample) contracts.list = buildSampleContracts();
    if (errors.isSample) errors.list = buildSampleErrors();
  },
  { immediate: false },
);
</script>

<template>
  <UiPageShell :eyebrow="t('admin.hero.eyebrow')" :title="t('admin.hero.title')" :lede="t('admin.hero.lede')">

    <section style="margin-top: 12px">
      <div class="admin-mini-stats" :aria-label="t('admin.tabs.overview')">
        <div class="mini-stat" role="group">
          <p class="eyebrow">{{ t('admin.billing.eyebrow') }}</p>
          <p class="stat-value">{{ billing.cycle }}</p>
        </div>
        <div class="mini-stat" role="group">
          <p class="eyebrow">{{ t('admin.errors.eyebrow') }}</p>
          <p class="stat-value">{{ unresolvedErrorsCount }}</p>
        </div>
        <div class="mini-stat" role="group">
          <p class="eyebrow">{{ t('admin.contracts.eyebrow') }}</p>
          <p class="stat-value">{{ pendingContractsCount }}</p>
        </div>
        <div class="mini-stat" role="group">
          <p class="eyebrow">{{ t('admin.users.eyebrow') }}</p>
          <p class="stat-value">{{ users.list.length || 0 }}</p>
        </div>
      </div>
    </section>

    <div class="admin-tabs" style="margin-top: 12px">
      <div class="admin-workbench-bar">
        <div class="tab-switch" role="tablist" aria-label="admin workbench">
          <button type="button" :class="{ active: workbenchTab === 'billing' }" @click="selectWorkbenchTab('billing')">
            {{ t('admin.billing.title') }}
          </button>
          <button type="button" :class="{ active: workbenchTab === 'errors' }" @click="selectWorkbenchTab('errors')">
            {{ t('admin.errors.title') }}
            <span v-if="unresolvedErrorsCount > 0" class="tab-count">{{ unresolvedErrorsCount }}</span>
          </button>
          <button type="button" :class="{ active: workbenchTab === 'contracts' }" @click="selectWorkbenchTab('contracts')">
            {{ t('admin.contracts.title') }}
            <span v-if="pendingContractsCount > 0" class="tab-count">{{ pendingContractsCount }}</span>
          </button>
          <button type="button" :class="{ active: workbenchTab === 'users' }" @click="selectWorkbenchTab('users')">
            {{ t('admin.users.title') }}
          </button>
        </div>
        <button class="ghost-btn small-btn" type="button" @click="refreshAll">
          {{ t('admin.overview.actions.refresh') }}
        </button>
      </div>
    </div>

    <section v-if="workbenchTab === 'billing'" style="margin-top: 12px">
      <UiCard>
        <div class="card-head">
          <div>
            <p class="eyebrow">{{ t('admin.billing.eyebrow') }}</p>
            <h2>{{ t('admin.billing.title') }}</h2>
            <p class="hint">{{ t('admin.billing.hint') }}</p>
          </div>
          <button class="primary-btn small-btn" type="button" :disabled="billing.loading" @click="settleBilling">
            {{ billing.loading ? t('common.submitting') : t('admin.billing.cta') }}
          </button>
        </div>
        <div class="form-row">
          <label class="form-field">
            <span>{{ t('admin.billing.fields.cycle') }}</span>
            <input v-model="billing.cycle" type="month" />
          </label>
        </div>
        <UiNotice v-if="billing.message" tone="success" style="margin-top: 10px">{{ billing.message }}</UiNotice>
        <UiNotice v-if="billing.error" tone="error" role="alert" style="margin-top: 10px">{{ billing.error }}</UiNotice>
      </UiCard>
    </section>

    <section v-else-if="workbenchTab === 'errors'" style="margin-top: 12px">
      <UiCard>
        <div class="card-head">
          <div>
            <p class="eyebrow">{{ t('admin.errors.eyebrow') }}</p>
            <h2>{{ t('admin.errors.title') }}</h2>
          </div>
          <button class="ghost-btn small-btn" type="button" :disabled="errors.loading" @click="loadErrors">
            {{ t('admin.actions.refreshErrors') }}
          </button>
        </div>
        <div class="filters">
          <select v-model="errors.level">
            <option value="all">{{ t('admin.errors.filters.level.all') }}</option>
            <option value="info">{{ t('admin.errors.filters.level.info') }}</option>
            <option value="warning">{{ t('admin.errors.filters.level.warning') }}</option>
            <option value="error">{{ t('admin.errors.filters.level.error') }}</option>
            <option value="critical">{{ t('admin.errors.filters.level.critical') }}</option>
          </select>
          <select v-model="errors.resolved">
            <option value="all">{{ t('admin.errors.filters.resolved.all') }}</option>
            <option value="false">{{ t('admin.errors.filters.resolved.false') }}</option>
            <option value="true">{{ t('admin.errors.filters.resolved.true') }}</option>
          </select>
          <button class="ghost-btn small-btn" type="button" :disabled="errors.loading" @click="loadErrors">
            {{ t('admin.actions.applyFilters') }}
          </button>
        </div>
        <p v-if="errors.loading" class="hint">{{ t('common.loading') }}</p>
        <UiNotice v-if="errors.error" tone="error" role="alert" style="margin-top: 10px">{{ errors.error }}</UiNotice>
        <template v-if="!errors.loading && errors.list.length">
          <UiList variant="plain" as="ul" style="margin-top: 10px">
            <li v-for="err in errors.list" :key="err.id" class="row">
              <div>
                <strong>{{ err.code }}</strong>
                <p class="hint">{{ err.message }}</p>
                <p class="hint">{{ t('admin.errors.occurredAt', { time: formatDateTime(err.occurred_at) }) }}</p>
                <p v-if="err.details" class="hint">{{ t('admin.errors.detail', { detail: err.details }) }}</p>
              </div>
              <div class="pill-stack">
                <span class="pill pill--muted">{{ err.level }}</span>
                <span :class="['pill', err.resolved ? 'pill--success' : 'pill--alert']">
                  {{ err.resolved ? t('admin.errors.resolved') : t('admin.errors.unresolved') }}
                </span>
              </div>
            </li>
          </UiList>
        </template>
        <p v-else-if="!errors.loading" class="hint">{{ t('admin.errors.empty') }}</p>
      </UiCard>
    </section>

  <section v-else-if="workbenchTab === 'contracts'" style="margin-top: 12px">
    <header class="admin-section-head">
      <div class="section-header" style="margin: 0">
        <p class="eyebrow">{{ t('admin.contracts.eyebrow') }}</p>
        <h2>{{ t('admin.contracts.title') }}</h2>
        <p class="hint">{{ t('admin.contracts.hint') }}</p>
      </div>
      <div class="filters">
        <select v-model="contracts.filter">
          <option value="all">{{ t('admin.contracts.filters.all') }}</option>
          <option value="pending">{{ t('admin.contracts.filters.pending') }}</option>
          <option value="approved">{{ t('admin.contracts.filters.approved') }}</option>
          <option value="rejected">{{ t('admin.contracts.filters.rejected') }}</option>
        </select>
        <button class="ghost-btn small-btn" type="button" :disabled="contracts.loading" @click="loadContracts">
          {{ t('admin.actions.applyFilters') }}
        </button>
      </div>
    </header>
    <p v-if="contracts.loading" class="hint">{{ t('common.loading') }}</p>
    <UiNotice v-if="contracts.error" tone="error" role="alert" style="margin-top: 10px">{{ contracts.error }}</UiNotice>
    <template v-if="!contracts.loading && contracts.list.length">
      <UiCard style="margin-top: 10px">
        <UiList variant="plain" as="div">
        <div
          v-for="app in contracts.list"
          :key="app.id"
          class="row contract-row"
          :class="{ active: contracts.expandedId === app.id }"
        >
          <button class="row-btn" type="button" @click="contracts.expandedId = contracts.expandedId === app.id ? '' : app.id">
            <div>
              <strong>{{ app.company_name }}</strong>
              <p class="hint">{{ t('admin.contracts.applicant', { email: app.customer?.email || app.customer?.id }) }}</p>
              <p class="hint">{{ t('admin.contracts.taxId', { tax: app.tax_id }) }}</p>
            </div>
            <div class="pill-stack">
              <span class="pill pill--muted">{{ app.status }}</span>
              <span class="pill pill--muted">{{ formatDateTime(app.created_at) }}</span>
            </div>
          </button>

          <div v-if="contracts.expandedId === app.id" class="panel">
            <div class="detail-grid">
              <p class="hint">{{ t('admin.contracts.contact', { name: app.contact_person, phone: app.contact_phone }) }}</p>
              <p class="hint">{{ t('admin.contracts.billingAddress', { addr: app.billing_address }) }}</p>
              <p class="hint">{{ t('admin.contracts.notes', { notes: app.notes || '-' }) }}</p>
            </div>
            <div v-if="app.status === 'pending'" class="form-grid">
              <label class="form-field">
                <span>{{ t('admin.contracts.fields.decision') }}</span>
                <select v-model="contracts.decision" :disabled="contracts.submitting">
                  <option value="approved">{{ t('admin.contracts.decision.approved') }}</option>
                  <option value="rejected">{{ t('admin.contracts.decision.rejected') }}</option>
                </select>
              </label>
              <label class="form-field">
                <span>{{ t('admin.contracts.fields.credit') }}</span>
                <input v-model="contracts.credit" type="number" min="0" :disabled="contracts.submitting" />
              </label>
              <label class="form-field span-2">
                <span>{{ t('admin.contracts.fields.notes') }}</span>
                <textarea v-model="contracts.notes" rows="2" :disabled="contracts.submitting"></textarea>
              </label>
              <div class="actions">
                <button class="primary-btn" type="button" :disabled="contracts.submitting" @click="reviewContract">
                  {{ contracts.submitting ? t('common.submitting') : t('admin.contracts.submit') }}
                </button>
              </div>
            </div>
            <p v-else class="hint">{{ t('admin.contracts.completed', { status: app.status }) }}</p>
            <UiNotice v-if="contracts.feedback" tone="success" style="margin-top: 10px">{{ contracts.feedback }}</UiNotice>
          </div>
        </div>
        </UiList>
      </UiCard>
    </template>
    <p v-else-if="!contracts.loading" class="hint">{{ t('admin.contracts.empty') }}</p>
  </section>

  <section v-else-if="workbenchTab === 'users'" style="margin-top: 12px">
    <header class="admin-section-head">
      <div class="section-header" style="margin: 0">
        <p class="eyebrow">{{ t('admin.users.eyebrow') }}</p>
        <h2>{{ t('admin.users.title') }}</h2>
        <p class="hint">{{ t('admin.users.hint') }}</p>
      </div>
      <div class="filters">
        <input v-model="users.search" type="text" :placeholder="t('admin.users.filters.search')" />
        <select v-model="users.role">
          <option value="all">{{ t('admin.users.filters.role.all') }}</option>
          <option value="driver">{{ t('admin.userClass.driver') }}</option>
          <option value="warehouse_staff">{{ t('admin.userClass.warehouse_staff') }}</option>
          <option value="customer_service">{{ t('admin.userClass.customer_service') }}</option>
          <option value="admin">{{ t('admin.userClass.admin') }}</option>
        </select>
        <select v-model="users.status">
          <option value="all">{{ t('admin.users.filters.status.all') }}</option>
          <option value="active">{{ t('admin.status.active') }}</option>
          <option value="suspended">{{ t('admin.status.suspended') }}</option>
          <option value="deleted">{{ t('admin.status.deleted') }}</option>
        </select>
        <button class="ghost-btn small-btn" type="button" :disabled="users.loading" @click="loadUsers">
          {{ t('admin.actions.applyFilters') }}
        </button>
      </div>
    </header>

    <div class="admin-stack" style="margin-top: 10px">
    <UiCard>
      <p class="eyebrow">{{ t('admin.users.create.title') }}</p>
      <div class="form-grid">
        <label class="form-field">
          <span>{{ t('admin.users.fields.name') }} *</span>
          <input v-model="createForm.user_name" type="text" />
        </label>
        <label class="form-field">
          <span>Email *</span>
          <input v-model="createForm.email" type="email" />
        </label>
        <label class="form-field">
          <span>{{ t('admin.users.fields.password') }} *</span>
          <input v-model="createForm.password" type="password" />
        </label>
        <label class="form-field">
          <span>{{ t('admin.users.fields.phone') }}</span>
          <input v-model="createForm.phone_number" type="tel" />
        </label>
        <label class="form-field">
          <span>{{ t('admin.users.fields.address') }}</span>
          <input v-model="createForm.address" type="text" :placeholder="t('admin.users.fields.addressPlaceholder')" />
        </label>
        <label class="form-field">
          <span>{{ t('admin.users.fields.role') }}</span>
          <select v-model="createForm.user_class">
            <option value="driver">{{ t('admin.userClass.driver') }}</option>
            <option value="warehouse_staff">{{ t('admin.userClass.warehouse_staff') }}</option>
            <option value="customer_service">{{ t('admin.userClass.customer_service') }}</option>
            <option value="admin">{{ t('admin.userClass.admin') }}</option>
          </select>
        </label>
      </div>
      <div class="actions">
        <button class="primary-btn" type="button" :disabled="users.creating" @click="createUser">
          {{ users.creating ? t('common.submitting') : t('admin.users.create.cta') }}
        </button>
      </div>
      <UiNotice v-if="users.actionMessage" tone="success" style="margin-top: 10px">{{ users.actionMessage }}</UiNotice>
      <UiNotice v-if="users.actionError" tone="error" role="alert" style="margin-top: 10px">{{ users.actionError }}</UiNotice>
    </UiCard>

    <UiCard>
      <p v-if="users.loading" class="hint">{{ t('common.loading') }}</p>
      <UiNotice v-if="users.error" tone="error" role="alert" style="margin-top: 10px">{{ users.error }}</UiNotice>
      <template v-if="!users.loading && users.list.length">
        <UiList variant="plain" as="div">
          <div
            v-for="user in users.list"
            :key="user.id"
            class="row user-row"
            :class="{ active: users.selectedId === user.id }"
          >
            <button class="row-btn" type="button" @click="selectUser(user.id)">
              <div>
                <strong>{{ user.user_name }}</strong>
                <p class="hint">{{ user.email }}</p>
                <p class="hint">{{ t('admin.users.node', { node: user.address || '--' }) }}</p>
              </div>
              <div class="pill-stack">
                <span class="pill pill--muted">{{ userClassLabel(user.user_class) || user.user_class }}</span>
                <span :class="['pill', statusTone(user.status)]">{{ statusLabel(user.status) || user.status }}</span>
              </div>
            </button>

            <div v-if="users.selectedId === user.id" class="panel">
              <div class="actions">
                <button
                  class="ghost-btn small-btn"
                  type="button"
                  :disabled="userActionLoading"
                  @click="toggleUserStatus(user)"
                >
                  {{ user.status === 'active' ? t('admin.users.actions.suspend') : t('admin.users.actions.activate') }}
                </button>
                <button
                  class="ghost-btn small-btn"
                  type="button"
                  :disabled="userActionLoading"
                  @click="resetPassword(user)"
                >
                  {{ t('admin.users.actions.resetPassword') }}
                </button>
                <button
                  class="ghost-btn small-btn"
                  type="button"
                  :disabled="userActionLoading || user.user_class !== 'driver'"
                  @click="assignVehicle(user)"
                >
                  {{ t('admin.users.actions.assignVehicle') }}
                </button>
                <button
                  class="ghost-btn small-btn"
                  type="button"
                  :disabled="userActionLoading"
                  @click="fetchUserStats(user)"
                >
                  {{ t('admin.users.actions.stats') }}
                </button>
              </div>
              <UiNotice v-if="users.actionMessage" tone="success" style="margin-top: 10px">{{ users.actionMessage }}</UiNotice>
              <UiNotice v-if="users.actionError" tone="error" role="alert" style="margin-top: 10px">{{ users.actionError }}</UiNotice>
              <div v-if="userStats" class="stats" style="margin-top: 10px">
                <p class="hint">{{ t('admin.users.stats.tasks', { count: userStats.tasks_completed }) }}</p>
                <p class="hint">{{ t('admin.users.stats.packages', { count: userStats.packages_processed }) }}</p>
                <p class="hint">{{ t('admin.users.stats.exceptions', { count: userStats.exceptions_reported }) }}</p>
              </div>
            </div>
          </div>
        </UiList>
      </template>
      <p v-else-if="!users.loading" class="hint">{{ t('admin.users.empty') }}</p>
    </UiCard>
    </div>
  </section>
  </UiPageShell>
</template>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(225, 139, 139, 0.12);
  color: var(--text-main);
  border: 1px solid rgba(165, 122, 99, 0.24);
  font-size: 13px;
}

.pill--success {
  background: rgba(97, 185, 140, 0.14);
  border-color: rgba(78, 154, 117, 0.35);
}

.pill--alert {
  background: rgba(239, 72, 111, 0.12);
  border-color: rgba(200, 64, 93, 0.35);
}

.pill--muted {
  background: rgba(255, 255, 255, 0.55);
}

.admin-tabs {
  display: flex;
  justify-content: flex-start;
}

.admin-workbench-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(200, 64, 93, 0.35);
  background: rgba(239, 72, 111, 0.12);
  color: var(--text-main);
  font-size: 12px;
  font-weight: 800;
}

.admin-mini-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.mini-stat {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--surface-stroke);
  background: rgba(255, 255, 255, 0.78);
  text-align: center;
}

.mini-stat:hover {
  background: rgba(255, 255, 255, 0.78);
}

.mini-stat:focus-visible {
  outline: 2px solid rgba(165, 122, 99, 0.35);
  outline-offset: 2px;
}

.mini-stat .eyebrow {
  margin: 0;
}

.mini-stat .stat-value {
  margin: 6px 0 0;
  font-size: 20px;
  font-weight: 800;
  color: #3f2620;
}

.admin-mini-main {
  min-width: 0;
}

.admin-mini-main strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-mini-main .hint {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-grid {
  display: grid;
  gap: 12px;
}

.admin-grid--two-col {
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.filters input,
.filters select {
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--surface-stroke);
  background: rgba(255, 255, 255, 0.86);
}

.form-row {
  display: grid;
  gap: 10px;
}

.form-field span {
  font-size: 13px;
  color: var(--text-muted);
}

.admin-section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.admin-stack {
  display: grid;
  gap: 12px;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 8px;
}

.row {
  border: 1px solid var(--surface-stroke);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
  padding: 8px;
}

.row-btn {
  display: flex;
  width: 100%;
  text-align: left;
  gap: 10px;
  justify-content: space-between;
  align-items: center;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 6px;
}

.row.active {
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.08);
}

.panel {
  border-top: 1px dashed var(--surface-stroke);
  margin-top: 6px;
  padding-top: 8px;
  display: grid;
  gap: 8px;
}

.pill-stack {
  display: inline-flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.detail-grid {
  display: grid;
  gap: 6px;
}

.contract-row .row-btn {
  align-items: flex-start;
}

.user-row .actions {
  margin: 0;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 6px;
}

@media (max-width: 860px) {
  .row-btn {
    align-items: flex-start;
  }
}
</style>
