<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { usePackageStore } from '../stores/packages'
import { useAuthStore } from '../stores/auth'
import UiPageShell from '../components/ui/UiPageShell.vue'
import UiCard from '../components/ui/UiCard.vue'
import UiList from '../components/ui/UiList.vue'
import { api, type PackageRecord, type TrackingSearchResponse } from '../services/api'
import { formatDateTime } from '../utils/packageDisplay'

type Link = {
  title: string
  to: string
  description: string
  featured?: boolean
  badge?: string
  muted?: boolean
}

const { t } = useI18n()
const packageStore = usePackageStore()
const auth = useAuthStore()

const summaryLoading = ref(false)
const summaryError = ref<string | null>(null)
const inTransitResult = ref<TrackingSearchResponse | null>(null)
const historyResult = ref<TrackingSearchResponse | null>(null)

const primaryLinks = computed<Link[]>(() => [
  { title: t('customer.dashboard.links.send.title'), to: '/customer/send', description: t('customer.dashboard.links.send.desc') },
  { title: t('customer.dashboard.links.track.title'), to: '/customer/track', description: t('customer.dashboard.links.track.desc') },
])

const hasUnpaid = computed(() => packageStore.unpaidPackages.length > 0)
const unpaidCount = computed(() => packageStore.unpaidPackages.length)
const unpaidIdSet = computed(() => new Set(packageStore.unpaidPackages.map((pkg) => pkg.id)))
const isUnpaid = (pkgId?: string | null) => (pkgId ? unpaidIdSet.value.has(pkgId) : false)

const inTransitCount = computed(() => inTransitResult.value?.total ?? null)
const historyCount = computed(() => historyResult.value?.total ?? null)

const recentInTransit = computed<PackageRecord[]>(() => {
  const packages = inTransitResult.value?.packages ?? []
  return [...packages]
    .sort((a: any, b: any) => {
      const aKey = String(a.current_updated_at ?? a.created_at ?? '').trim()
      const bKey = String(b.current_updated_at ?? b.created_at ?? '').trim()
      return bKey.localeCompare(aKey)
    })
    .slice(0, 3)
})

const quickLinks = computed<Link[]>(() => primaryLinks.value)

const utilityLinks = computed<Link[]>(() => {
  const paymentBadge = hasUnpaid.value ? t('customer.dashboard.utility.unpaidBadge', { count: unpaidCount.value }) : ''

  const payment: Link = {
    title: t('customer.dashboard.links.payment.title'),
    to: '/customer/payment',
    description: t('customer.dashboard.links.payment.desc'),
    featured: hasUnpaid.value,
    badge: paymentBadge,
    muted: !hasUnpaid.value,
  }

  const billing: Link = {
    title: t('customer.dashboard.links.contract.title'),
    to: '/customer/billing',
    description: t('customer.dashboard.links.contract.desc'),
  }

  return hasUnpaid.value ? [payment, billing] : [billing, payment]
})

onMounted(() => {
  packageStore.fetchUnpaid(auth.user?.id)

  if (!auth.isLoggedIn) return

  summaryLoading.value = true
  summaryError.value = null
  Promise.all([api.searchTracking({ status_group: 'in_transit' }), api.searchTracking({ status_group: 'history' })])
    .then(([inTransit, history]) => {
      inTransitResult.value = inTransit
      historyResult.value = history
    })
    .catch((err) => {
      inTransitResult.value = null
      historyResult.value = null
      summaryError.value = err instanceof Error ? err.message : String(err)
    })
    .finally(() => {
      summaryLoading.value = false
    })
})
</script>

<template>
  <UiPageShell
    :eyebrow="t('customer.dashboard.eyebrow')"
    :title="t('customer.dashboard.title')"
    :lede="t('customer.dashboard.lede')"
  >
    <div class="card-grid">
      <RouterLink
        v-for="link in quickLinks"
        :key="link.to"
        :to="link.to"
        class="card link-card"
        :class="{ featured: link.featured }"
      >
        <div>
          <p class="eyebrow">{{ link.title }}</p>
          <p class="hint">{{ link.description }}</p>
        </div>
        <span aria-hidden="true">&rarr;</span>
      </RouterLink>
    </div>

    <div class="dashboard-summary">
      <div class="section-header">
        <h2>{{ t('customer.dashboard.summary.title') }}</h2>
      </div>

      <div class="mini-stats" :aria-label="t('customer.dashboard.summary.title')">
        <div>
          <p class="eyebrow">{{ t('customer.dashboard.summary.inTransit') }}</p>
          <p class="stat-value">{{ summaryLoading ? '...' : inTransitCount ?? '-' }}</p>
        </div>
        <div>
          <p class="eyebrow">{{ t('customer.dashboard.summary.history') }}</p>
          <p class="stat-value">{{ summaryLoading ? '...' : historyCount ?? '-' }}</p>
        </div>
        <div>
          <p class="eyebrow">{{ t('customer.dashboard.summary.unpaid') }}</p>
          <p class="stat-value">{{ packageStore.isLoading ? '...' : unpaidCount }}</p>
        </div>
      </div>

      <UiCard class="recent-card">
        <div class="section-header" style="margin-bottom: 8px">
          <h3 style="margin: 0">{{ t('customer.dashboard.summary.recentInTransit') }}</h3>
        </div>

        <p v-if="summaryError" class="hint" style="margin: 0">{{ summaryError }}</p>
        <p v-else-if="summaryLoading" class="hint" style="margin: 0">{{ t('customer.dashboard.summary.loading') }}</p>
        <p v-else-if="recentInTransit.length === 0" class="hint" style="margin: 0">{{ t('customer.dashboard.summary.emptyInTransit') }}</p>
        <UiList v-else variant="plain" as="ul">
          <li v-for="pkg in recentInTransit" :key="pkg.id" class="recent-item">
            <div class="recent-main">
              <p class="recent-tracking">
                {{ pkg.tracking_number || t('customer.dashboard.summary.noTracking') }}
                <span class="status-pill" :class="{ danger: isUnpaid(pkg.id) }">
                  {{ isUnpaid(pkg.id) ? t('customer.dashboard.summary.unpaidPill') : t('customer.dashboard.summary.paidPill') }}
                </span>
              </p>
              <p class="hint" style="margin: 0">
                {{ t('customer.dashboard.summary.createdAt') }}：{{ formatDateTime(pkg.created_at) }}
                <span v-if="pkg.estimated_delivery"> · {{ t('customer.dashboard.summary.eta') }}：{{ formatDateTime(pkg.estimated_delivery) }}</span>
              </p>
            </div>
            <div class="recent-actions">
              <RouterLink
                v-if="isUnpaid(pkg.id)"
                class="ghost-btn small-btn"
                :to="{ path: '/customer/billing', query: { tab: 'unpaid', package_id: pkg.id, tracking_number: pkg.tracking_number || undefined } }"
              >
                {{ t('customer.dashboard.summary.goPay') }}
              </RouterLink>
              <RouterLink class="ghost-btn small-btn" to="/customer/track">{{ t('customer.dashboard.summary.viewTrack') }}</RouterLink>
            </div>
          </li>
        </UiList>
      </UiCard>

      <UiCard class="utility-card">
        <div class="section-header" style="margin-bottom: 8px">
          <h3 style="margin: 0">{{ t('customer.dashboard.utility.title') }}</h3>
        </div>
        <UiList variant="plain" as="ul">
          <li v-for="item in utilityLinks" :key="item.to" class="utility-item">
            <RouterLink :to="item.to" class="utility-link" :class="{ featured: item.featured, muted: item.muted }">
              <div class="utility-main">
                <p class="eyebrow" style="margin: 0">{{ item.title }}</p>
                <p class="hint" style="margin: 0">{{ item.description }}</p>
              </div>
              <span v-if="item.badge" class="pill">{{ item.badge }}</span>
              <span aria-hidden="true">&rarr;</span>
            </RouterLink>
          </li>
        </UiList>
      </UiCard>
    </div>
  </UiPageShell>
</template>

<style scoped>
.dashboard-summary {
  margin-top: 16px;
  display: grid;
  gap: 12px;
}

.dashboard-summary .section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.stat-value {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: #3f2620;
}

.recent-card {
  padding: 14px 16px;
}

.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 12px;
  border: 1px solid rgba(165, 122, 99, 0.18);
  background: rgba(255, 255, 255, 0.55);
}

.recent-main {
  min-width: 0;
}

.recent-tracking {
  margin: 0 0 2px;
  font-weight: 800;
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.recent-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(72, 187, 120, 0.16);
  border: 1px solid rgba(72, 187, 120, 0.28);
  color: rgba(28, 79, 54, 0.95);
  font-weight: 800;
  font-size: 12px;
  white-space: nowrap;
}

.status-pill.danger {
  background: rgba(161, 60, 60, 0.12);
  border-color: rgba(161, 60, 60, 0.25);
  color: rgba(114, 34, 34, 0.95);
}

.link-card.featured {
  position: relative;
  overflow: hidden;
  border-color: var(--accent);
  box-shadow: 0 16px 40px rgba(255, 145, 160, 0.25);
  background: linear-gradient(135deg, rgba(255, 247, 240, 0.9), rgba(255, 225, 233, 0.85));
}

.link-card.featured::after {
  content: '';
  position: absolute;
  inset: -30%;
  background: radial-gradient(circle at 30% 20%, rgba(255, 204, 188, 0.4), transparent 45%),
    radial-gradient(circle at 80% 40%, rgba(255, 182, 206, 0.35), transparent 50%),
    radial-gradient(circle at 50% 90%, rgba(255, 220, 180, 0.25), transparent 55%);
  pointer-events: none;
  animation: floatGlow 10s ease-in-out infinite;
}

.link-card.featured > div .eyebrow {
  color: var(--accent-strong);
  letter-spacing: 0.04em;
}

.link-card.featured span[aria-hidden] {
  font-weight: 800;
}

.utility-card {
  padding: 14px 16px;
}

.utility-item {
  margin: 0;
  padding: 0;
}

.utility-link {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  text-decoration: none;
  color: var(--text-main);
  border: 1px solid rgba(165, 122, 99, 0.18);
  background: rgba(255, 255, 255, 0.55);
}

.utility-link:hover {
  background: rgba(255, 255, 255, 0.75);
}

.utility-link.featured {
  border-color: rgba(244, 182, 194, 0.7);
  box-shadow: 0 12px 28px rgba(255, 145, 160, 0.18);
}

.utility-link.muted {
  background: rgba(255, 255, 255, 0.45);
  border-color: rgba(165, 122, 99, 0.12);
  opacity: 0.88;
}

.utility-link.muted:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.7);
}

.utility-main {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.pill {
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

@keyframes floatGlow {
  0% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(4%, -3%, 0);
  }
  100% {
    transform: translate3d(0, 0, 0);
  }
}
</style>
