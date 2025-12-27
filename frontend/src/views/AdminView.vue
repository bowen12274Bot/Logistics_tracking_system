<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import {
  api,
  type AdminContractApplication,
  type AdminSystemErrorRecord,
  type AdminUserClass,
  type AdminUserRecord,
} from '../services/api'

const auth = useAuthStore()

const adminName = computed(() => auth.user?.user_name || '系統管理員')
const adminEmail = computed(() => auth.user?.email || 'admin@example.com')
const envMode = import.meta.env.MODE || 'development'

const sampleUsers: AdminUserRecord[] = [
  { id: 'u-driver', user_name: '司機 HUB_1', email: 'driver_hub_1@example.com', user_class: 'driver', user_type: 'employee', address: 'HUB_1', status: 'active' },
  { id: 'u-warehouse', user_name: '倉庫 HUB_0', email: 'warehouse_hub_0@example.com', user_class: 'warehouse_staff', user_type: 'employee', address: 'HUB_0', status: 'active' },
  { id: 'u-cs', user_name: '客服 REG_1', email: 'cs_reg_1@example.com', user_class: 'customer_service', user_type: 'employee', address: 'REG_1', status: 'suspended' },
  { id: 'u-admin', user_name: '系統管理員', email: 'admin@example.com', user_class: 'admin', user_type: 'employee', address: 'HQ', status: 'active' },
]

const sampleContracts: AdminContractApplication[] = [
  {
    id: 'c-1',
    customer: { id: 'cust-1', email: 'cust@example.com' },
    company_name: '範例科技',
    tax_id: '12345678',
    contact_person: '王小明',
    contact_phone: '0912-345-678',
    billing_address: '台北市信義區市府路 1 號',
    notes: '月結 30 天',
    status: 'pending',
    created_at: new Date().toISOString(),
  },
]

const sampleErrors: AdminSystemErrorRecord[] = [
  {
    id: 'err-1',
    level: 'error',
    code: 'INTERNAL_ERROR',
    message: '範例：API 500 /api/warehouse/packages',
    details: 'REG-3 批次掃描失敗，重試 3 次仍 500',
    occurred_at: new Date().toISOString(),
    resolved: false,
  },
  {
    id: 'err-2',
    level: 'warning',
    code: 'DELAYED_JOB',
    message: '範例：worker 延遲 15 分鐘',
    details: '月結排程延遲 >15 分鐘，請檢查 queue 堆積',
    occurred_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    resolved: true,
  },
]

// 帳務
const billing = reactive({
  cycle: new Date().toISOString().slice(0, 7),
  loading: false,
  message: '',
  error: '',
})

// 系統錯誤
const errors = reactive({
  list: [] as AdminSystemErrorRecord[],
  loading: false,
  error: '',
  level: 'all' as 'all' | AdminSystemErrorRecord['level'],
  resolved: 'all' as 'all' | 'true' | 'false',
})

// 合約申請
const contracts = reactive({
  list: [] as AdminContractApplication[],
  loading: false,
  error: '',
  filter: 'pending' as 'pending' | 'approved' | 'rejected' | 'all',
  expandedId: '',
  decision: 'approved' as 'approved' | 'rejected',
  credit: '',
  notes: '',
  submitting: false,
  feedback: '',
})

// 員工管理
const users = reactive({
  list: [] as AdminUserRecord[],
  loading: false,
  error: '',
  search: '',
  role: 'all',
  status: 'active',
  creating: false,
  actionMessage: '',
  actionError: '',
  selectedId: '',
})

const createForm = reactive({
  user_name: '',
  email: '',
  password: '',
  phone_number: '',
  address: '',
  user_class: 'driver' as AdminUserClass,
})

const userStats = ref<{ tasks_completed: number; packages_processed: number; exceptions_reported: number } | null>(
  null,
)
const userActionLoading = ref(false)

const userClassLabel: Record<string, string> = {
  driver: '司機',
  warehouse_staff: '倉庫',
  customer_service: '客服',
  admin: '管理員',
  contract_customer: '合約客戶',
  non_contract_customer: '一般客戶',
}

const statusLabel: Record<string, string> = {
  active: '啟用',
  suspended: '停用',
  deleted: '已刪除',
}

const statusTone = (status?: string) => {
  if (status === 'suspended' || status === 'deleted') return 'pill--alert'
  return 'pill--success'
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const loadUsers = async () => {
  users.loading = true
  users.error = ''
  try {
    const res = await api.adminGetUsers({
      search: users.search || undefined,
      user_class: users.role === 'all' ? undefined : users.role,
      status: users.status === 'all' ? undefined : (users.status as any),
      limit: 50,
    })
    users.list = res.users ?? []
  } catch (err: any) {
    users.error = err?.message || '載入員工失敗，改用範例資料'
    users.list = sampleUsers
  } finally {
    users.loading = false
  }
}

const createUser = async () => {
  users.actionMessage = ''
  users.error = ''
  users.actionError = ''
  if (!createForm.user_name || !createForm.email || !createForm.password) {
    users.actionError = '姓名、Email、密碼必填'
    return
  }
  users.creating = true
  try {
    await api.adminCreateUser({
      ...createForm,
      phone_number: createForm.phone_number || undefined,
      address: createForm.address || undefined,
    })
    users.actionMessage = '已建立員工帳號'
    Object.assign(createForm, {
      user_name: '',
      email: '',
      password: '',
      phone_number: '',
      address: '',
      user_class: createForm.user_class,
    })
    await loadUsers()
  } catch (err: any) {
    users.actionError = err?.message || '建立失敗'
  } finally {
    users.creating = false
  }
}

const selectUser = (id: string) => {
  users.selectedId = users.selectedId === id ? '' : id
  users.actionMessage = ''
  users.actionError = ''
  userStats.value = null
}

const toggleUserStatus = async (user: AdminUserRecord) => {
  userActionLoading.value = true
  users.actionError = ''
  users.actionMessage = ''
  try {
    if (user.status === 'active') {
      await api.adminSuspendUser(user.id, { reason: 'manual' })
      users.actionMessage = '已停用'
    } else {
      await api.adminActivateUser(user.id)
      users.actionMessage = '已啟用'
    }
    await loadUsers()
  } catch (err: any) {
    users.actionError = err?.message || '狀態更新失敗'
  } finally {
    userActionLoading.value = false
  }
}

const resetPassword = async (user: AdminUserRecord) => {
  const pwd = window.prompt(`請輸入 ${user.email} 的新密碼`, '')
  if (!pwd) return
  userActionLoading.value = true
  users.actionError = ''
  users.actionMessage = ''
  try {
    await api.adminResetUserPassword(user.id, { new_password: pwd })
    users.actionMessage = '已重設密碼並強制登出該用戶'
  } catch (err: any) {
    users.actionError = err?.message || '重設失敗'
  } finally {
    userActionLoading.value = false
  }
}

const assignVehicle = async (user: AdminUserRecord) => {
  const code = window.prompt(`指派車輛給 ${user.email}，車輛代碼`, '')
  if (!code) return
  const home = window.prompt('車輛起始節點（預設用戶地址，可留空）', user.address || '')
  userActionLoading.value = true
  users.actionError = ''
  users.actionMessage = ''
  try {
    await api.adminAssignVehicle(user.id, { vehicle_code: code, home_node_id: home || undefined })
    users.actionMessage = '已指派車輛'
  } catch (err: any) {
    users.actionError = err?.message || '指派失敗'
  } finally {
    userActionLoading.value = false
  }
}

const fetchUserStats = async (user: AdminUserRecord) => {
  userActionLoading.value = true
  users.actionError = ''
  try {
    const res = await api.adminUserWorkStats(user.id)
    userStats.value = res.stats
  } catch (err: any) {
    users.actionError = err?.message || '統計載入失敗'
  } finally {
    userActionLoading.value = false
  }
}

const loadContracts = async () => {
  contracts.loading = true
  contracts.error = ''
  try {
    const res = await api.adminListContractApplications(
      contracts.filter === 'all' ? {} : { status: contracts.filter as any },
    )
    contracts.list = res.applications ?? []
  } catch (err: any) {
    contracts.error = err?.message || '載入合約申請失敗，改用範例資料'
    contracts.list = sampleContracts
  } finally {
    contracts.loading = false
  }
}

const reviewContract = async () => {
  if (!contracts.expandedId) return
  contracts.submitting = true
  contracts.error = ''
  contracts.feedback = ''
  try {
    const credit = contracts.credit.trim()
    const creditNum = credit ? Number(credit) : undefined
    if (credit && (!Number.isFinite(creditNum) || creditNum < 0)) {
      contracts.error = '信用額度需為正整數'
      contracts.submitting = false
      return
    }
    await api.adminReviewContractApplication(contracts.expandedId, {
      status: contracts.decision,
      credit_limit: credit ? Math.floor(creditNum as number) : undefined,
      review_notes: contracts.notes.trim() || undefined,
    })
    contracts.feedback = contracts.decision === 'approved' ? '已核准合約申請' : '已拒絕合約申請'
    contracts.notes = ''
    contracts.credit = ''
    contracts.expandedId = ''
    await loadContracts()
  } catch (err: any) {
    contracts.error = err?.message || '審核失敗'
  } finally {
    contracts.submitting = false
  }
}

const loadErrors = async () => {
  errors.loading = true
  errors.error = ''
  try {
    const res = await api.adminSystemErrors({
      level: errors.level === 'all' ? undefined : (errors.level as any),
      resolved: errors.resolved === 'all' ? undefined : errors.resolved === 'true',
      limit: 50,
    })
    errors.list = res.errors ?? []
  } catch (err: any) {
    errors.error = err?.message || '載入系統錯誤失敗，改用範例資料'
    errors.list = sampleErrors
  } finally {
    errors.loading = false
  }
}

const settleBilling = async () => {
  billing.loading = true
  billing.error = ''
  billing.message = ''
  try {
    if (!/^\d{4}-\d{2}$/.test(billing.cycle)) {
      billing.error = '請輸入 YYYY-MM'
      billing.loading = false
      return
    }
    await api.adminSettleBilling({ cycle_year_month: billing.cycle })
    billing.message = `已送出 ${billing.cycle} 結算`
  } catch (err: any) {
    billing.error = err?.message || '結算失敗'
  } finally {
    billing.loading = false
  }
}

onMounted(async () => {
  await Promise.all([loadUsers(), loadContracts(), loadErrors()])
})
</script>

<template>
  <section class="page-shell admin-hero">
    <div class="hero-copy">
      <p class="eyebrow">系統管理員</p>
      <h1>管理後台</h1>
      <p class="lede">日常維運、帳務、合約審核與權限管理。</p>
      <div class="pill-row">
        <span class="pill">登入：{{ adminEmail }}</span>
        <span class="pill pill--success">角色：{{ auth.user?.user_class ?? 'admin' }}</span>
        <span class="pill pill--muted">環境：{{ envMode }}</span>
      </div>
    </div>
    <div class="card hero-side">
      <p class="eyebrow">快速檢視</p>
      <ul class="hero-list">
        <li>帳期：{{ billing.cycle }}</li>
        <li>待審合約：{{ contracts.list.filter((c) => c.status === 'pending').length }}</li>
        <li>員工數：{{ users.list.length }}</li>
      </ul>
      <button class="ghost-btn small-btn" type="button" :disabled="errors.loading" @click="loadErrors">刷新錯誤</button>
    </div>
  </section>

  <section class="page-shell grid two-col">
    <div class="card">
      <div class="card-head">
        <div>
          <p class="eyebrow">帳務</p>
          <h2>帳期結算</h2>
          <p class="hint">呼叫 /api/admin/billing/settle 產生月結帳單。</p>
        </div>
        <button class="primary-btn small-btn" type="button" :disabled="billing.loading" @click="settleBilling">
          {{ billing.loading ? '執行中…' : '執行結算' }}
        </button>
      </div>
      <div class="form-row">
        <label class="form-field">
          <span>帳期 (YYYY-MM)</span>
          <input v-model="billing.cycle" type="month" />
        </label>
      </div>
      <p v-if="billing.message" class="hint success">{{ billing.message }}</p>
      <p v-if="billing.error" class="hint error">{{ billing.error }}</p>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <p class="eyebrow">系統</p>
          <h2>系統錯誤列表</h2>
        </div>
        <button class="ghost-btn small-btn" type="button" :disabled="errors.loading" @click="loadErrors">重新整理</button>
      </div>
      <div class="filters">
        <select v-model="errors.level">
          <option value="all">全部等級</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="critical">Critical</option>
        </select>
        <select v-model="errors.resolved">
          <option value="all">全部狀態</option>
          <option value="false">未處理</option>
          <option value="true">已處理</option>
        </select>
        <button class="ghost-btn small-btn" type="button" :disabled="errors.loading" @click="loadErrors">套用篩選</button>
      </div>
      <p v-if="errors.loading" class="hint">載入中…</p>
      <p v-else-if="errors.error" class="hint error">{{ errors.error }}</p>
      <p v-else-if="!errors.list.length" class="hint">目前沒有錯誤紀錄。</p>
      <ul v-else class="list">
        <li v-for="err in errors.list" :key="err.id" class="row">
          <div>
            <strong>{{ err.code }}</strong>
            <p class="hint">{{ err.message }}</p>
            <p class="hint">時間：{{ formatDateTime(err.occurred_at) }}</p>
            <p v-if="err.details" class="hint">詳細：{{ err.details }}</p>
          </div>
          <div class="pill-stack">
            <span class="pill pill--muted">{{ err.level }}</span>
            <span :class="['pill', err.resolved ? 'pill--success' : 'pill--alert']">
              {{ err.resolved ? '已處理' : '未處理' }}
            </span>
          </div>
        </li>
      </ul>
    </div>
  </section>

  <section class="page-shell">
    <header class="section-head">
      <div>
        <p class="eyebrow">合約</p>
        <h2>合約申請審核</h2>
        <p class="hint">串接 /api/admin/contract-applications 與審核端點。</p>
      </div>
      <div class="filters">
        <select v-model="contracts.filter">
          <option value="all">全部狀態</option>
          <option value="pending">待審核</option>
          <option value="approved">已核准</option>
          <option value="rejected">已拒絕</option>
        </select>
        <button class="ghost-btn small-btn" type="button" :disabled="contracts.loading" @click="loadContracts">
          套用篩選
        </button>
      </div>
    </header>
    <p v-if="contracts.loading" class="hint">載入中…</p>
    <p v-else-if="contracts.error" class="hint error">{{ contracts.error }}</p>
    <p v-else-if="!contracts.list.length" class="hint">目前沒有合約申請。</p>
    <div v-else class="card list">
      <div
        v-for="app in contracts.list"
        :key="app.id"
        class="row contract-row"
        :class="{ active: contracts.expandedId === app.id }"
      >
        <button class="row-btn" type="button" @click="contracts.expandedId = contracts.expandedId === app.id ? '' : app.id">
          <div>
            <strong>{{ app.company_name }}</strong>
            <p class="hint">申請人：{{ app.customer?.email || app.customer?.id }}</p>
            <p class="hint">稅籍：{{ app.tax_id }}</p>
          </div>
          <div class="pill-stack">
            <span class="pill pill--muted">{{ app.status }}</span>
            <span class="pill pill--muted">{{ formatDateTime(app.created_at) }}</span>
          </div>
        </button>

        <div v-if="contracts.expandedId === app.id" class="panel">
          <div class="detail-grid">
            <p class="hint">聯絡人：{{ app.contact_person }}（{{ app.contact_phone }}）</p>
            <p class="hint">帳單地址：{{ app.billing_address }}</p>
            <p class="hint">備註：{{ app.notes || '-' }}</p>
          </div>
          <div v-if="app.status === 'pending'" class="form-grid">
            <label class="form-field">
              <span>審核結果</span>
              <select v-model="contracts.decision" :disabled="contracts.submitting">
                <option value="approved">核准</option>
                <option value="rejected">拒絕</option>
              </select>
            </label>
            <label class="form-field">
              <span>信用額度 (選填)</span>
              <input v-model="contracts.credit" type="number" min="0" :disabled="contracts.submitting" />
            </label>
            <label class="form-field span-2">
              <span>審核備註 (選填)</span>
              <textarea v-model="contracts.notes" rows="2" :disabled="contracts.submitting"></textarea>
            </label>
            <div class="actions">
              <button class="primary-btn" type="button" :disabled="contracts.submitting" @click="reviewContract">
                {{ contracts.submitting ? '送出中…' : '送出審核' }}
              </button>
            </div>
          </div>
          <p v-else class="hint">此申請已完成：{{ app.status }}</p>
          <p v-if="contracts.feedback" class="hint success">{{ contracts.feedback }}</p>
        </div>
      </div>
    </div>
  </section>

  <section class="page-shell">
    <header class="section-head">
      <div>
        <p class="eyebrow">人員</p>
        <h2>員工管理</h2>
        <p class="hint">串接 /api/admin/users 全套操作。</p>
      </div>
      <div class="filters">
        <input v-model="users.search" type="text" placeholder="搜尋姓名 / Email" />
        <select v-model="users.role">
          <option value="all">全部角色</option>
          <option value="driver">司機</option>
          <option value="warehouse_staff">倉庫</option>
          <option value="customer_service">客服</option>
          <option value="admin">管理員</option>
        </select>
        <select v-model="users.status">
          <option value="all">全部狀態</option>
          <option value="active">啟用</option>
          <option value="suspended">停用</option>
          <option value="deleted">已刪除</option>
        </select>
        <button class="ghost-btn small-btn" type="button" :disabled="users.loading" @click="loadUsers">套用篩選</button>
      </div>
    </header>

    <div class="card">
      <p class="eyebrow">建立員工</p>
      <div class="form-grid">
        <label class="form-field">
          <span>姓名 *</span>
          <input v-model="createForm.user_name" type="text" />
        </label>
        <label class="form-field">
          <span>Email *</span>
          <input v-model="createForm.email" type="email" />
        </label>
        <label class="form-field">
          <span>密碼 *</span>
          <input v-model="createForm.password" type="password" />
        </label>
        <label class="form-field">
          <span>電話</span>
          <input v-model="createForm.phone_number" type="tel" />
        </label>
        <label class="form-field">
          <span>工作節點</span>
          <input v-model="createForm.address" type="text" placeholder="例：HUB_0 / REG_1" />
        </label>
        <label class="form-field">
          <span>角色</span>
          <select v-model="createForm.user_class">
            <option value="driver">司機</option>
            <option value="warehouse_staff">倉庫</option>
            <option value="customer_service">客服</option>
            <option value="admin">管理員</option>
          </select>
        </label>
      </div>
      <div class="actions">
        <button class="primary-btn" type="button" :disabled="users.creating" @click="createUser">
          {{ users.creating ? '建立中…' : '建立員工' }}
        </button>
        <p v-if="users.actionMessage" class="hint success">{{ users.actionMessage }}</p>
        <p v-if="users.actionError" class="hint error">{{ users.actionError }}</p>
      </div>
    </div>

    <div class="card list">
      <p v-if="users.loading" class="hint">載入中…</p>
      <p v-else-if="users.error" class="hint error">{{ users.error }}</p>
      <p v-else-if="!users.list.length" class="hint">沒有符合條件的員工。</p>
      <div
        v-else
        v-for="user in users.list"
        :key="user.id"
        class="row user-row"
        :class="{ active: users.selectedId === user.id }"
      >
        <button class="row-btn" type="button" @click="selectUser(user.id)">
          <div>
            <strong>{{ user.user_name }}</strong>
            <p class="hint">{{ user.email }}</p>
            <p class="hint">節點：{{ user.address || '--' }}</p>
          </div>
          <div class="pill-stack">
            <span class="pill pill--muted">{{ userClassLabel[user.user_class] || user.user_class }}</span>
            <span :class="['pill', statusTone(user.status)]">{{ statusLabel[user.status ?? 'active'] || user.status }}</span>
          </div>
        </button>

        <div v-if="users.selectedId === user.id" class="panel">
          <div class="actions">
            <button class="ghost-btn small-btn" type="button" :disabled="userActionLoading" @click="toggleUserStatus(user)">
              {{ user.status === 'active' ? '停用' : '啟用' }}
            </button>
            <button class="ghost-btn small-btn" type="button" :disabled="userActionLoading" @click="resetPassword(user)">
              重設密碼
            </button>
            <button
              class="ghost-btn small-btn"
              type="button"
              :disabled="userActionLoading || user.user_class !== 'driver'"
              @click="assignVehicle(user)"
            >
              指派車輛
            </button>
            <button class="ghost-btn small-btn" type="button" :disabled="userActionLoading" @click="fetchUserStats(user)">
              工作統計
            </button>
          </div>
          <p v-if="users.actionMessage" class="hint success">{{ users.actionMessage }}</p>
          <p v-if="users.actionError" class="hint error">{{ users.actionError }}</p>
          <div v-if="userStats" class="stats">
            <p class="hint">任務完成：{{ userStats.tasks_completed }}</p>
            <p class="hint">處理包裹：{{ userStats.packages_processed }}</p>
            <p class="hint">異常回報：{{ userStats.exceptions_reported }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin-hero {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 14px;
}

.pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0 12px;
}

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

.hero-side {
  display: grid;
  gap: 10px;
}

.hero-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 6px;
}

.grid.two-col {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 12px;
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

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}

.form-field {
  display: grid;
  gap: 6px;
}

.form-field input,
.form-field select,
.form-field textarea {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--surface-stroke);
  background: rgba(255, 255, 255, 0.86);
  color: var(--text-main);
}

.form-field span {
  font-size: 13px;
  color: var(--text-muted);
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 8px;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
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

.hint.success {
  color: #166534;
}

.hint.error {
  color: #b91c1c;
}

@media (max-width: 860px) {
  .admin-hero {
    grid-template-columns: 1fr;
  }

  .row-btn {
    align-items: flex-start;
  }
}
</style>
