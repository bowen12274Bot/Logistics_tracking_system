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

const adminName = computed(() => auth.user?.user_name || 'ç³»çµ±ç®¡ç???)
const adminEmail = computed(() => auth.user?.email || 'admin@example.com')
const envMode = import.meta.env.MODE || 'development'

const sampleUsers: AdminUserRecord[] = [
  { id: 'u-driver', user_name: '?¸æ? HUB_1', email: 'driver_hub_1@example.com', user_class: 'driver', user_type: 'employee', address: 'HUB_1', status: 'active' },
  { id: 'u-warehouse', user_name: '?‰åº« HUB_0', email: 'warehouse_hub_0@example.com', user_class: 'warehouse_staff', user_type: 'employee', address: 'HUB_0', status: 'active' },
  { id: 'u-cs', user_name: 'å®¢æ? REG_1', email: 'cs_reg_1@example.com', user_class: 'customer_service', user_type: 'employee', address: 'REG_1', status: 'suspended' },
  { id: 'u-admin', user_name: 'ç³»çµ±ç®¡ç???, email: 'admin@example.com', user_class: 'admin', user_type: 'employee', address: 'HQ', status: 'active' },
]

const sampleContracts: AdminContractApplication[] = [
  {
    id: 'c-1',
    customer: { id: 'cust-1', email: 'cust@example.com' },
    company_name: 'ç¯„ä?ç§‘æ?',
    tax_id: '12345678',
    contact_person: '?‹å???,
    contact_phone: '0912-345-678',
    billing_address: '?°å?å¸‚ä¿¡ç¾©å?å¸‚å?è·?1 ??,
    notes: '?ˆç? 30 å¤?,
    status: 'pending',
    created_at: new Date().toISOString(),
  },
]

const sampleErrors: AdminSystemErrorRecord[] = [
  {
    id: 'err-1',
    level: 'error',
    code: 'INTERNAL_ERROR',
    message: 'ç¯„ä?ï¼šAPI 500 /api/warehouse/packages',
    details: 'REG-3 ?¹æ¬¡?ƒæ?å¤±æ?ï¼Œé?è©?3 æ¬¡ä? 500',
    occurred_at: new Date().toISOString(),
    resolved: false,
  },
  {
    id: 'err-2',
    level: 'warning',
    code: 'DELAYED_JOB',
    message: 'ç¯„ä?ï¼šworker å»¶é² 15 ?†é?',
    details: '?ˆç??’ç?å»¶é² >15 ?†é?ï¼Œè?æª¢æŸ¥ queue ?†ç?',
    occurred_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    resolved: true,
  },
]

// å¸³å?
const billing = reactive({
  cycle: new Date().toISOString().slice(0, 7),
  loading: false,
  message: '',
  error: '',
})

// ç³»çµ±?¯èª¤
const errors = reactive({
  list: [] as AdminSystemErrorRecord[],
  loading: false,
  error: '',
  level: 'all' as 'all' | AdminSystemErrorRecord['level'],
  resolved: 'all' as 'all' | 'true' | 'false',
})

// ?ˆç??³è?
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

// ?¡å·¥ç®¡ç?
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
  driver: '?¸æ?',
  warehouse_staff: '?‰åº«',
  customer_service: 'å®¢æ?',
  admin: 'ç®¡ç???,
  contract_customer: '?ˆç?å®¢æˆ¶',
  non_contract_customer: 'ä¸€?¬å®¢??,
}

const statusLabel: Record<string, string> = {
  active: '?Ÿç”¨',
  suspended: '?œç”¨',
  deleted: 'å·²åˆª??,
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
    users.error = err?.message || 'è¼‰å…¥?¡å·¥å¤±æ?ï¼Œæ”¹?¨ç?ä¾‹è???
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
    users.actionError = 'å§“å??Email?å?ç¢¼å?å¡?
    return
  }
  users.creating = true
  try {
    await api.adminCreateUser({
      ...createForm,
      phone_number: createForm.phone_number || undefined,
      address: createForm.address || undefined,
    })
    users.actionMessage = 'å·²å»ºç«‹å“¡å·¥å¸³??
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
    users.actionError = err?.message || 'å»ºç?å¤±æ?'
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
      users.actionMessage = 'å·²å???
    } else {
      await api.adminActivateUser(user.id)
      users.actionMessage = 'å·²å???
    }
    await loadUsers()
  } catch (err: any) {
    users.actionError = err?.message || '?€?‹æ›´?°å¤±??
  } finally {
    userActionLoading.value = false
  }
}

const resetPassword = async (user: AdminUserRecord) => {
  const pwd = window.prompt(`è«‹è¼¸??${user.email} ?„æ–°å¯†ç¢¼`, '')
  if (!pwd) return
  userActionLoading.value = true
  users.actionError = ''
  users.actionMessage = ''
  try {
    await api.adminResetUserPassword(user.id, { new_password: pwd })
    users.actionMessage = 'å·²é?è¨­å?ç¢¼ä¸¦å¼·åˆ¶?»å‡ºè©²ç”¨??
  } catch (err: any) {
    users.actionError = err?.message || '?è¨­å¤±æ?'
  } finally {
    userActionLoading.value = false
  }
}

const assignVehicle = async (user: AdminUserRecord) => {
  const code = window.prompt(`?‡æ´¾è»Šè?çµ?${user.email}ï¼Œè?è¼›ä»£ç¢¼`, '')
  if (!code) return
  const home = window.prompt('è»Šè?èµ·å?ç¯€é»ï??è¨­?¨æˆ¶?°å?ï¼Œå¯?™ç©ºï¼?, user.address || '')
  userActionLoading.value = true
  users.actionError = ''
  users.actionMessage = ''
  try {
    await api.adminAssignVehicle(user.id, { vehicle_code: code, home_node_id: home || undefined })
    users.actionMessage = 'å·²æ?æ´¾è?è¼?
  } catch (err: any) {
    users.actionError = err?.message || '?‡æ´¾å¤±æ?'
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
    users.actionError = err?.message || 'çµ±è?è¼‰å…¥å¤±æ?'
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
    contracts.error = err?.message || 'è¼‰å…¥?ˆç??³è?å¤±æ?ï¼Œæ”¹?¨ç?ä¾‹è???
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
    let creditLimit: number | undefined
    if (credit) {
      const creditNum = Number(credit)
      if (!Number.isFinite(creditNum) || creditNum < 0) {
        contracts.error = 'æ·‡ï??¤æ¤¤å¶…å®³????˜î??å­˜æš©'
        contracts.submitting = false
        return
      }
      creditLimit = Math.floor(creditNum)
    }
    await api.adminReviewContractApplication(contracts.expandedId, {
      status: contracts.decision,
      credit_limit: creditLimit,
      review_notes: contracts.notes.trim() || undefined,
    })
    contracts.feedback =
      contracts.decision === 'approved' ? 'å®¸å?????ç»±å‹­?µç??' : 'å®¸å??ç»²æ??ç»±å‹­?µç??'
    contracts.notes = ''
    contracts.credit = ''
    contracts.expandedId = ''
    await loadContracts()
  } catch (err: any) {
    contracts.error = err?.message || '?µâ??³æ¾¶è¾?'
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
    errors.error = err?.message || '?“å??†ç»¯?¤å???î€ƒæ¾¶è¾??›å±¾????æ¸šå¬­???'
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
      billing.error = '?œå¬­???YYYY-MM'
      billing.loading = false
      return
    }
    await api.adminSettleBilling({ cycle_year_month: billing.cycle })
    billing.message = 'å®¸æŸ¥?¬ä½¸??' + billing.cycle + ' ç»²æ„®?'
  } catch (err: any) {
    billing.error = err?.message || 'ç»²æ„®?æ¾¶è¾¨?'
  } finally {
    billing.loading = false
  }
}
        </select>
        <select v-model="errors.resolved">
          <option value="all">?¨éƒ¨?€??/option>
          <option value="false">?ªè???/option>
          <option value="true">å·²è???/option>
        </select>
        <button class="ghost-btn small-btn" type="button" :disabled="errors.loading" @click="loadErrors">å¥—ç”¨ç¯©é¸</button>
      </div>
      <p v-if="errors.loading" class="hint">è¼‰å…¥ä¸­â€?/p>
      <p v-else-if="errors.error" class="hint error">{{ errors.error }}</p>
      <p v-else-if="!errors.list.length" class="hint">?®å?æ²’æ??¯èª¤ç´€?„ã€?/p>
      <ul v-else class="list">
        <li v-for="err in errors.list" :key="err.id" class="row">
          <div>
            <strong>{{ err.code }}</strong>
            <p class="hint">{{ err.message }}</p>
            <p class="hint">?‚é?ï¼š{{ formatDateTime(err.occurred_at) }}</p>
            <p v-if="err.details" class="hint">è©³ç´°ï¼š{{ err.details }}</p>
          </div>
          <div class="pill-stack">
            <span class="pill pill--muted">{{ err.level }}</span>
            <span :class="['pill', err.resolved ? 'pill--success' : 'pill--alert']">
              {{ err.resolved ? 'å·²è??? : '?ªè??? }}
            </span>
          </div>
        </li>
      </ul>
    </div>
  </section>

  <section class="page-shell">
    <header class="section-head">
      <div>
        <p class="eyebrow">?ˆç?</p>
        <h2>?ˆç??³è?å¯©æ ¸</h2>
        <p class="hint">ä¸²æ¥ /api/admin/contract-applications ?‡å¯©?¸ç«¯é»ã€?/p>
      </div>
      <div class="filters">
        <select v-model="contracts.filter">
          <option value="all">?¨éƒ¨?€??/option>
          <option value="pending">å¾…å¯©??/option>
          <option value="approved">å·²æ ¸??/option>
          <option value="rejected">å·²æ?çµ?/option>
        </select>
        <button class="ghost-btn small-btn" type="button" :disabled="contracts.loading" @click="loadContracts">
          å¥—ç”¨ç¯©é¸
        </button>
      </div>
    </header>
    <p v-if="contracts.loading" class="hint">è¼‰å…¥ä¸­â€?/p>
    <p v-else-if="contracts.error" class="hint error">{{ contracts.error }}</p>
    <p v-else-if="!contracts.list.length" class="hint">?®å?æ²’æ??ˆç??³è???/p>
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
            <p class="hint">?³è?äººï?{{ app.customer?.email || app.customer?.id }}</p>
            <p class="hint">ç¨…ç?ï¼š{{ app.tax_id }}</p>
          </div>
          <div class="pill-stack">
            <span class="pill pill--muted">{{ app.status }}</span>
            <span class="pill pill--muted">{{ formatDateTime(app.created_at) }}</span>
          </div>
        </button>

        <div v-if="contracts.expandedId === app.id" class="panel">
          <div class="detail-grid">
            <p class="hint">?¯çµ¡äººï?{{ app.contact_person }}ï¼ˆ{{ app.contact_phone }}ï¼?/p>
            <p class="hint">å¸³å–®?°å?ï¼š{{ app.billing_address }}</p>
            <p class="hint">?™è¨»ï¼š{{ app.notes || '-' }}</p>
          </div>
          <div v-if="app.status === 'pending'" class="form-grid">
            <label class="form-field">
              <span>å¯©æ ¸çµæ?</span>
              <select v-model="contracts.decision" :disabled="contracts.submitting">
                <option value="approved">?¸å?</option>
                <option value="rejected">?’ç?</option>
              </select>
            </label>
            <label class="form-field">
              <span>ä¿¡ç”¨é¡åº¦ (?¸å¡«)</span>
              <input v-model="contracts.credit" type="number" min="0" :disabled="contracts.submitting" />
            </label>
            <label class="form-field span-2">
              <span>å¯©æ ¸?™è¨» (?¸å¡«)</span>
              <textarea v-model="contracts.notes" rows="2" :disabled="contracts.submitting"></textarea>
            </label>
            <div class="actions">
              <button class="primary-btn" type="button" :disabled="contracts.submitting" @click="reviewContract">
                {{ contracts.submitting ? '?å‡ºä¸­â€? : '?å‡ºå¯©æ ¸' }}
              </button>
            </div>
          </div>
          <p v-else class="hint">æ­¤ç”³è«‹å·²å®Œæ?ï¼š{{ app.status }}</p>
          <p v-if="contracts.feedback" class="hint success">{{ contracts.feedback }}</p>
        </div>
      </div>
    </div>
  </section>

  <section class="page-shell">
    <header class="section-head">
      <div>
        <p class="eyebrow">äººå“¡</p>
        <h2>?¡å·¥ç®¡ç?</h2>
        <p class="hint">ä¸²æ¥ /api/admin/users ?¨å??ä???/p>
      </div>
      <div class="filters">
        <input v-model="users.search" type="text" placeholder="?œå?å§“å? / Email" />
        <select v-model="users.role">
          <option value="all">?¨éƒ¨è§’è‰²</option>
          <option value="driver">?¸æ?</option>
          <option value="warehouse_staff">?‰åº«</option>
          <option value="customer_service">å®¢æ?</option>
          <option value="admin">ç®¡ç???/option>
        </select>
        <select v-model="users.status">
          <option value="all">?¨éƒ¨?€??/option>
          <option value="active">?Ÿç”¨</option>
          <option value="suspended">?œç”¨</option>
          <option value="deleted">å·²åˆª??/option>
        </select>
        <button class="ghost-btn small-btn" type="button" :disabled="users.loading" @click="loadUsers">å¥—ç”¨ç¯©é¸</button>
      </div>
    </header>

    <div class="card">
      <p class="eyebrow">å»ºç??¡å·¥</p>
      <div class="form-grid">
        <label class="form-field">
          <span>å§“å? *</span>
          <input v-model="createForm.user_name" type="text" />
        </label>
        <label class="form-field">
          <span>Email *</span>
          <input v-model="createForm.email" type="email" />
        </label>
        <label class="form-field">
          <span>å¯†ç¢¼ *</span>
          <input v-model="createForm.password" type="password" />
        </label>
        <label class="form-field">
          <span>?»è©±</span>
          <input v-model="createForm.phone_number" type="tel" />
        </label>
        <label class="form-field">
          <span>å·¥ä?ç¯€é»?/span>
          <input v-model="createForm.address" type="text" placeholder="ä¾‹ï?HUB_0 / REG_1" />
        </label>
        <label class="form-field">
          <span>è§’è‰²</span>
          <select v-model="createForm.user_class">
            <option value="driver">?¸æ?</option>
            <option value="warehouse_staff">?‰åº«</option>
            <option value="customer_service">å®¢æ?</option>
            <option value="admin">ç®¡ç???/option>
          </select>
        </label>
      </div>
      <div class="actions">
        <button class="primary-btn" type="button" :disabled="users.creating" @click="createUser">
          {{ users.creating ? 'å»ºç?ä¸­â€? : 'å»ºç??¡å·¥' }}
        </button>
        <p v-if="users.actionMessage" class="hint success">{{ users.actionMessage }}</p>
        <p v-if="users.actionError" class="hint error">{{ users.actionError }}</p>
      </div>
    </div>

    <div class="card list">
      <p v-if="users.loading" class="hint">è¼‰å…¥ä¸­â€?/p>
      <p v-else-if="users.error" class="hint error">{{ users.error }}</p>
      <p v-else-if="!users.list.length" class="hint">æ²’æ?ç¬¦å?æ¢ä»¶?„å“¡å·¥ã€?/p>
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
            <p class="hint">ç¯€é»ï?{{ user.address || '--' }}</p>
          </div>
          <div class="pill-stack">
            <span class="pill pill--muted">{{ userClassLabel[user.user_class] || user.user_class }}</span>
            <span :class="['pill', statusTone(user.status)]">{{ statusLabel[user.status ?? 'active'] || user.status }}</span>
          </div>
        </button>

        <div v-if="users.selectedId === user.id" class="panel">
          <div class="actions">
            <button class="ghost-btn small-btn" type="button" :disabled="userActionLoading" @click="toggleUserStatus(user)">
              {{ user.status === 'active' ? '?œç”¨' : '?Ÿç”¨' }}
            </button>
            <button class="ghost-btn small-btn" type="button" :disabled="userActionLoading" @click="resetPassword(user)">
              ?è¨­å¯†ç¢¼
            </button>
            <button
              class="ghost-btn small-btn"
              type="button"
              :disabled="userActionLoading || user.user_class !== 'driver'"
              @click="assignVehicle(user)"
            >
              ?‡æ´¾è»Šè?
            </button>
            <button class="ghost-btn small-btn" type="button" :disabled="userActionLoading" @click="fetchUserStats(user)">
              å·¥ä?çµ±è?
            </button>
          </div>
          <p v-if="users.actionMessage" class="hint success">{{ users.actionMessage }}</p>
          <p v-if="users.actionError" class="hint error">{{ users.actionError }}</p>
          <div v-if="userStats" class="stats">
            <p class="hint">ä»»å?å®Œæ?ï¼š{{ userStats.tasks_completed }}</p>
            <p class="hint">?•ç??…è£¹ï¼š{{ userStats.packages_processed }}</p>
            <p class="hint">?°å¸¸?å ±ï¼š{{ userStats.exceptions_reported }}</p>
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
