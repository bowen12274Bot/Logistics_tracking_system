<script setup lang="ts">
import { computed, reactive } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

const adminName = computed(() => auth.user?.user_name || '管理員')
const adminEmail = computed(() => auth.user?.email || 'admin@example.com')
const envMode = import.meta.env.MODE || 'development'

const metrics = [
  { title: '今日單量', value: '1,024', hint: '含 96 件 COD', trend: '+8% vs 昨日' },
  { title: '異常率', value: '2.4%', hint: '24 / 1,024 件', severity: 'medium' as const },
  { title: '營收 (估)', value: '$1.82M', hint: '含月結預估 $0.72M', trend: '+5% vs 昨日' },
  { title: 'Critical 警示', value: '2', hint: '需立即處理的系統錯誤', severity: 'high' as const },
]

const trendData = [
  { day: 'D-6', orders: 780 },
  { day: 'D-5', orders: 820 },
  { day: 'D-4', orders: 910 },
  { day: 'D-3', orders: 860 },
  { day: 'D-2', orders: 940 },
  { day: 'D-1', orders: 950 },
  { day: 'Today', orders: 1024 },
]

const criticalAlerts = [
  { id: 1, title: 'API 500 /api/warehouse/packages', time: '10:22', detail: 'REG-3 批次掃描失敗，重試 3 次仍 500' },
  { id: 2, title: 'Delayed worker job', time: '09:58', detail: '月結排程延遲 >15 分鐘，請檢查 queue 堆積' },
]

const quickActions = [
  { title: '服務規則與計價', detail: '維護尺寸、時效、特殊標記的費率組合', cta: '檢視草稿' },
  { title: '虛擬地圖', detail: '調整中心、轉運站、門市、車隊位置', cta: '前往地圖', to: '/map' },
  { title: '角色與權限', detail: '稽核 user_class、測試帳號、強制登出', cta: '管理用戶' },
  { title: '帳務維護', detail: '重新產生月結、處理貨到付款對帳', cta: '檢視作業' },
]

const workflow = [
  {
    title: '例行監控',
    items: ['API 狀態：正常', 'Worker 發佈：12/23 03:12', '資料庫備份：完成'],
    state: 'success',
  },
  {
    title: '待辦提醒',
    items: ['設定 service_rules 規則卡', '匯入最新區域路徑成本', '客服異常處理 SLA'],
    state: 'warning',
  },
  {
    title: '風險觀察',
    items: ['轉運站 R2 負載 82%', 'Driver 手動 override 路徑：3 筆', '待覆核的 exception：2 件'],
    state: 'alert',
  },
]

const queueItems = [
  { title: '權限 / 帳號', desc: '客戶改為合約戶、重設密碼、停用測試帳號', owner: '客服', eta: '今天 17:00' },
  { title: '運費與規則', desc: '易碎與國際件疊加費率、禁運組合提示', owner: '定價', eta: '本週' },
  { title: '路徑與車隊', desc: '調整 hub_2 週邊門市班次，檢查車輛位置回報', owner: '營運', eta: '明日' },
]

const userFilters = reactive({
  keyword: '',
  role: 'all',
  site: 'all',
})

const userList = [
  { id: 'u1', name: '王小明', email: 'driver_hub_0@example.com', role: 'Driver', site: 'HUB-0', status: 'active' },
  { id: 'u2', name: '李倉庫', email: 'warehouse_hub_0@example.com', role: 'Warehouse', site: 'HUB-0', status: 'active' },
  { id: 'u3', name: '林客服', email: 'cs@example.com', role: 'CS', site: 'REG-2', status: 'locked' },
  { id: 'u4', name: 'Admin', email: 'admin@example.com', role: 'Admin', site: 'HQ', status: 'active' },
]

const filteredUsers = computed(() => {
  return userList.filter((u) => {
    const kw = userFilters.keyword.trim().toLowerCase()
    const matchKw = kw ? u.name.toLowerCase().includes(kw) || u.email.toLowerCase().includes(kw) : true
    const matchRole = userFilters.role === 'all' ? true : u.role === userFilters.role
    const matchSite = userFilters.site === 'all' ? true : u.site === userFilters.site
    return matchKw && matchRole && matchSite
  })
})

const serviceRules = [
  { box: 'Envelope', level: 'Overnight', base: 120, intl: true, fragile: false },
  { box: 'S', level: 'Two-day', base: 180, intl: false, fragile: true },
  { box: 'M', level: 'Standard', base: 260, intl: false, fragile: true },
  { box: 'L', level: 'Economy', base: 320, intl: false, fragile: false },
]

const mockAction = (msg: string) => window.alert(msg)
</script>

<template>
  <section class="page-shell admin-hero">
    <div class="hero-copy">
      <p class="eyebrow">管理員</p>
      <h1>登入後的控制台</h1>
      <p class="lede">集中檢視規則、權限、地圖與帳務，快速確認系統健康度。</p>
      <div class="pill-row">
        <span class="pill">登入帳號：{{ adminEmail }}</span>
        <span class="pill pill--success">角色：{{ auth.user?.user_class ?? 'admin' }}</span>
        <span class="pill pill--muted">環境：{{ envMode }}</span>
      </div>
      <div class="hero-actions">
        <RouterLink to="/map" class="primary-btn small-btn">虛擬地圖</RouterLink>
        <RouterLink to="/shipping/estimate" class="ghost-btn small-btn">試算運價</RouterLink>
        <button type="button" class="ghost-btn small-btn muted">同步最新設定</button>
      </div>
    </div>

    <div class="card hero-side">
      <div class="hero-side-top">
        <div>
          <p class="eyebrow">登入身分</p>
          <h3>{{ adminName }}</h3>
          <p class="hint">{{ adminEmail }}</p>
        </div>
        <span class="badge">Admin</span>
      </div>
      <ul class="task-list side-list">
        <li>服務規則：等待新一版費率</li>
        <li>異常稽核：2 件待覆核</li>
        <li>帳務：月結批次預計凌晨執行</li>
      </ul>
    </div>
  </section>

  <section class="page-shell">
    <header class="section-header">
      <h2>系統總覽</h2>
      <p class="hint">以 mock 資料呈現，後續可接上 /api/admin/stats。</p>
    </header>
    <div class="card-grid stats-grid">
      <div v-for="metric in metrics" :key="metric.title" class="card stat-card">
        <div class="stat-head">
          <p class="eyebrow">{{ metric.title }}</p>
          <span v-if="metric.badge" class="pill pill--muted">{{ metric.badge }}</span>
          <span
            v-else-if="metric.severity"
            class="pill"
            :class="{ 'pill--alert': metric.severity === 'high', 'pill--warning': metric.severity === 'medium' }"
          >
            {{ metric.severity === 'high' ? '需要注意' : '留意' }}
          </span>
        </div>
        <div class="stat-value">{{ metric.value }}</div>
        <p class="hint">{{ metric.hint }}</p>
        <p v-if="metric.trend" class="stat-trend">{{ metric.trend }}</p>
      </div>
    </div>

    <div class="card trend-card">
      <div class="trend-head">
        <div>
          <p class="eyebrow">最近 7 日單量趨勢</p>
          <p class="hint">後續可替換為折線圖，現用條狀圖占位。</p>
        </div>
        <span class="pill pill--muted">mock data</span>
      </div>
      <div class="trend-bars">
        <div v-for="point in trendData" :key="point.day" class="trend-bar">
          <div class="bar" :style="{ height: `${(point.orders / 1100) * 100}%` }"></div>
          <span class="trend-day">{{ point.day }}</span>
          <span class="trend-value">{{ point.orders }}</span>
        </div>
      </div>
    </div>

    <div class="card alert-card" v-if="criticalAlerts.length">
      <div class="alert-head">
        <p class="eyebrow">Critical 警示</p>
        <span class="pill pill--alert">需立即處理</span>
      </div>
      <ul class="task-list">
        <li v-for="alert in criticalAlerts" :key="alert.id" class="alert-item">
          <div class="alert-main">
            <strong>{{ alert.title }}</strong>
            <span class="hint">{{ alert.detail }}</span>
          </div>
          <span class="pill pill--muted">{{ alert.time }}</span>
        </li>
      </ul>
    </div>
  </section>

  <section class="page-shell">
    <header class="section-header">
      <h2>常用操作</h2>
      <p class="hint">整理管理員登入後最常需要的入口，部分先以占位顯示。</p>
    </header>
    <div class="card-grid quick-grid">
      <div v-for="item in quickActions" :key="item.title" class="card quick-card link-card">
        <div>
          <p class="eyebrow">{{ item.title }}</p>
          <p class="hint">{{ item.detail }}</p>
        </div>
        <RouterLink v-if="item.to" :to="item.to" class="pill pill--action">{{ item.cta }}</RouterLink>
        <span v-else class="pill pill--muted">{{ item.cta }}</span>
      </div>
    </div>
  </section>

  <section class="page-shell">
    <header class="section-header">
      <h2>使用者與權限</h2>
      <p class="hint">員工列表、搜尋、角色/站點篩選，後續串 /api/admin/users。</p>
    </header>
    <div class="card user-card">
      <div class="user-filters">
        <input v-model="userFilters.keyword" type="text" placeholder="搜尋姓名 / Email" />
        <select v-model="userFilters.role">
          <option value="all">全部角色</option>
          <option value="Driver">Driver</option>
          <option value="Warehouse">Warehouse</option>
          <option value="CS">CS</option>
          <option value="Admin">Admin</option>
        </select>
        <select v-model="userFilters.site">
          <option value="all">全部站點</option>
          <option value="HQ">HQ</option>
          <option value="HUB-0">HUB-0</option>
          <option value="REG-2">REG-2</option>
        </select>
        <button class="ghost-btn small-btn" type="button" @click="mockAction('搜尋 /api/admin/users')">搜尋</button>
        <button class="primary-btn small-btn" type="button" @click="mockAction('新增員工')">新增員工</button>
      </div>
      <div class="user-table">
        <div class="user-row user-header">
          <span>姓名 / Email</span>
          <span>角色</span>
          <span>站點</span>
          <span>狀態</span>
          <span>操作</span>
        </div>
        <div v-for="u in filteredUsers" :key="u.id" class="user-row">
          <div class="user-main">
            <strong>{{ u.name }}</strong>
            <span class="hint">{{ u.email }}</span>
          </div>
          <span>{{ u.role }}</span>
          <span>{{ u.site }}</span>
          <span :class="['status', u.status === 'active' ? 'status-ok' : 'status-lock']">
            {{ u.status === 'active' ? '啟用' : '停用' }}
          </span>
          <div class="user-actions">
            <button class="ghost-btn tiny-btn" type="button" @click="mockAction(`重設密碼 ${u.email}`)">重設密碼</button>
            <button class="ghost-btn tiny-btn" type="button" @click="mockAction(`編輯 ${u.email}`)">編輯</button>
            <button class="ghost-btn tiny-btn" type="button" @click="mockAction(`${u.status === 'active' ? '停用' : '啟用'} ${u.email}`)">
              {{ u.status === 'active' ? '停用' : '啟用' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="page-shell">
    <header class="section-header">
      <h2>服務規則設定</h2>
      <p class="hint">運費與服務參數，後續可串 service_rules API / S3 / S5。</p>
    </header>
    <div class="card service-card">
      <div class="service-header">
        <span class="eyebrow">表格編輯器 (mock)</span>
        <button class="primary-btn small-btn" type="button" @click="mockAction('儲存規則')">儲存規則</button>
      </div>
      <div class="service-table">
        <div class="service-row service-header-row">
          <span>Box Type</span>
          <span>Service Level</span>
          <span>基礎費率</span>
          <span>國際加價</span>
          <span>易碎加價</span>
        </div>
        <div v-for="rule in serviceRules" :key="`${rule.box}-${rule.level}`" class="service-row">
          <span>{{ rule.box }}</span>
          <span>{{ rule.level }}</span>
          <input type="number" :value="rule.base" />
          <label class="toggle">
            <input type="checkbox" :checked="rule.intl" />
            <span>啟用</span>
          </label>
          <label class="toggle">
            <input type="checkbox" :checked="rule.fragile" />
            <span>啟用</span>
          </label>
        </div>
      </div>
    </div>
  </section>

  <section class="page-shell">
    <header class="section-header">
      <h2>作業監控</h2>
      <p class="hint">例行任務、待辦與風險觀察，協助管理員快速掃描狀態。</p>
    </header>
    <div class="card-grid workflow-grid">
      <div v-for="block in workflow" :key="block.title" class="card workflow-card">
        <div class="workflow-head">
          <p class="eyebrow">{{ block.title }}</p>
          <span
            class="pill"
            :class="{
              'pill--success': block.state === 'success',
              'pill--warning': block.state === 'warning',
              'pill--alert': block.state === 'alert'
            }"
          >
            {{
              block.state === 'success'
                ? '正常'
                : block.state === 'warning'
                  ? '提醒'
                  : '需注意'
            }}
          </span>
        </div>
        <ul class="task-list">
          <li v-for="line in block.items" :key="line">{{ line }}</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="page-shell">
    <header class="section-header">
      <h2>待處理隊列</h2>
      <p class="hint">尚未完成的維運項目，後續可接上工單/通知 API。</p>
    </header>
    <div class="card queue-card">
      <ul class="task-list queue-list">
        <li v-for="item in queueItems" :key="item.title" class="queue-item">
          <div class="queue-main">
            <strong>{{ item.title }}</strong>
            <p class="hint">{{ item.desc }}</p>
          </div>
          <div class="queue-meta">
            <span class="pill pill--muted">{{ item.owner }}</span>
            <span class="pill pill--action">{{ item.eta }}</span>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.admin-hero {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 14px;
}

.hero-copy h1 {
  margin-bottom: 6px;
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

.pill--warning {
  background: rgba(255, 191, 105, 0.18);
  border-color: rgba(208, 152, 78, 0.4);
}

.pill--alert {
  background: rgba(239, 72, 111, 0.12);
  border-color: rgba(200, 64, 93, 0.35);
}

.pill--muted {
  background: rgba(255, 255, 255, 0.55);
}

.pill--action {
  background: rgba(244, 182, 194, 0.3);
  border-color: rgba(244, 182, 194, 0.5);
}

.hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.hero-side {
  display: flex;
  flex-direction: column;
  gap: 10px;
  justify-content: space-between;
}

.hero-side-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.badge {
  display: inline-flex;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(165, 122, 99, 0.2);
  font-weight: 700;
}

.side-list {
  margin-top: 4px;
  gap: 6px;
}

.stats-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.stat-card {
  display: grid;
  gap: 8px;
}

.stat-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.stat-value {
  font-size: 32px;
  font-weight: 800;
}

.stat-trend {
  color: #2f6f4e;
  font-weight: 700;
}

.quick-grid {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.quick-card {
  align-items: flex-start;
}

.workflow-grid {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.workflow-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.trend-card {
  margin-top: 14px;
}

.trend-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.trend-bars {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 12px;
  align-items: end;
}

.trend-bar {
  display: grid;
  gap: 6px;
  justify-items: center;
}

.bar {
  width: 100%;
  max-width: 80px;
  background: linear-gradient(180deg, rgba(244, 182, 194, 0.8), rgba(244, 182, 194, 0.25));
  border-radius: 10px 10px 4px 4px;
  min-height: 24px;
}

.trend-day {
  font-weight: 700;
}

.trend-value {
  font-size: 12px;
  color: var(--text-muted);
}

.alert-card {
  margin-top: 14px;
}

.alert-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.alert-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
}

.alert-main strong {
  display: block;
  margin-bottom: 4px;
}

.alert-main .hint {
  display: block;
}

.user-card {
  display: grid;
  gap: 12px;
}

.user-filters {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  align-items: center;
}

.user-filters input,
.user-filters select {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--surface-stroke);
  background: rgba(255, 255, 255, 0.86);
}

.user-table {
  display: grid;
  gap: 6px;
}

.user-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 2fr;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.18);
  background: rgba(255, 255, 255, 0.6);
}

.user-header {
  font-weight: 700;
  background: rgba(255, 255, 255, 0.8);
}

.user-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.tiny-btn {
  padding: 6px 10px;
  border-radius: 10px;
}

.status {
  display: inline-flex;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid rgba(165, 122, 99, 0.2);
}

.status-ok {
  background: rgba(97, 185, 140, 0.12);
  border-color: rgba(78, 154, 117, 0.35);
}

.status-lock {
  background: rgba(239, 72, 111, 0.08);
  border-color: rgba(200, 64, 93, 0.35);
}

.service-card {
  display: grid;
  gap: 10px;
}

.service-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.service-table {
  display: grid;
  gap: 8px;
}

.service-row {
  display: grid;
  grid-template-columns: 1.2fr 1.2fr 1fr 1fr 1fr;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.16);
  background: rgba(255, 255, 255, 0.7);
}

.service-header-row {
  font-weight: 700;
  background: rgba(255, 255, 255, 0.85);
}

.service-row input[type='number'] {
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--surface-stroke);
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.queue-card {
  padding: 8px 12px;
}

.queue-list {
  gap: 10px;
}

.queue-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px dashed rgba(165, 122, 99, 0.24);
}

.queue-main strong {
  display: block;
  margin-bottom: 4px;
}

.queue-meta {
  display: inline-flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.muted {
  opacity: 0.7;
}

@media (max-width: 860px) {
  .admin-hero {
    grid-template-columns: 1fr;
  }

  .user-row {
    grid-template-columns: 1fr;
  }

  .user-actions {
    justify-content: flex-start;
  }

  .service-row {
    grid-template-columns: 1fr;
  }
}
</style>
