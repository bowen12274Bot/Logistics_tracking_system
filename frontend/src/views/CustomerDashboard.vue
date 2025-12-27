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
}

const { t } = useI18n()
const packageStore = usePackageStore()
const auth = useAuthStore()

const summaryLoading = ref(false)
const summaryError = ref<string | null>(null)
const inTransitResult = ref<TrackingSearchResponse | null>(null)
const historyResult = ref<TrackingSearchResponse | null>(null)

const quickLinksBase = computed<Link[]>(() => [
  { title: t('customer.dashboard.links.send.title'), to: '/customer/send', description: t('customer.dashboard.links.send.desc') },
  { title: t('customer.dashboard.links.track.title'), to: '/customer/track', description: t('customer.dashboard.links.track.desc') },
  { title: t('customer.dashboard.links.profile.title'), to: '/customer/profile', description: t('customer.dashboard.links.profile.desc') },
  { title: t('customer.dashboard.links.contract.title'), to: '/customer/contract', description: t('customer.dashboard.links.contract.desc') },
  { title: t('customer.dashboard.links.payment.title'), to: '/customer/payment', description: t('customer.dashboard.links.payment.desc') },
])

const hasUnpaid = computed(() => packageStore.unpaidPackages.length > 0)
const unpaidCount = computed(() => packageStore.unpaidPackages.length)

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

const quickLinks = computed<Link[]>(() =>
  quickLinksBase.value.map((link) =>
    link.to === '/customer/payment' ? { ...link, featured: hasUnpaid.value } : link,
  ),
)

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
        <RouterLink to="/customer/track" class="hint">{{ t('customer.dashboard.summary.viewTrack') }}</RouterLink>
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
              <p class="recent-tracking">{{ pkg.tracking_number || t('customer.dashboard.summary.noTracking') }}</p>
              <p class="hint" style="margin: 0">
                {{ t('customer.dashboard.summary.createdAt') }}：{{ formatDateTime(pkg.created_at) }}
                <span v-if="pkg.estimated_delivery"> · {{ t('customer.dashboard.summary.eta') }}：{{ formatDateTime(pkg.estimated_delivery) }}</span>
              </p>
            </div>
            <RouterLink class="ghost-btn small-btn" to="/customer/track">{{ t('customer.dashboard.summary.viewTrack') }}</RouterLink>
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
