<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { usePackageStore } from '../stores/packages'
import UiPageShell from '../components/ui/UiPageShell.vue'
import CustomerContractView from './CustomerContractView.vue'
import CustomerPaymentView from './CustomerPaymentView.vue'

const { t } = useI18n()
const auth = useAuthStore()
const packageStore = usePackageStore()
const route = useRoute()
const router = useRouter()

const unpaidCount = computed(() => packageStore.unpaidPackages.length)
const hasUnpaid = computed(() => unpaidCount.value > 0)

type BillingTab = 'unpaid' | 'monthly' | 'records'
const activeTab = computed<BillingTab>(() => {
  const raw = route.query.tab
  const value = typeof raw === 'string' ? raw : ''
  return value === 'monthly' || value === 'records' ? value : 'unpaid'
})

const setTab = (tab: BillingTab) => {
  const nextQuery = { ...route.query, tab }
  router.replace({ query: nextQuery })
}

const paymentInitialTab = computed<'list' | 'records'>(() => (activeTab.value === 'records' ? 'records' : 'list'))

onMounted(() => {
  packageStore.fetchUnpaid(auth.user?.id)
})
</script>

<template>
  <UiPageShell :eyebrow="t('billing.center.eyebrow')" :title="t('billing.center.title')" :lede="t('billing.center.lede')">
    <div class="tab-switch" role="tablist" :aria-label="t('billing.center.title')">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'unpaid' }"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'unpaid'"
        @click="setTab('unpaid')"
      >
        {{ t('billing.center.tabs.unpaid') }}
        <span
          v-if="hasUnpaid"
          class="tab-pill"
          :title="t('billing.center.cards.payments.unpaid', { count: unpaidCount })"
        >
          {{ t('billing.center.badge.count', { count: unpaidCount }) }}
        </span>
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'monthly' }"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'monthly'"
        @click="setTab('monthly')"
      >
        {{ t('billing.center.tabs.monthly') }}
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'records' }"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'records'"
        @click="setTab('records')"
      >
        {{ t('billing.center.tabs.records') }}
      </button>
    </div>

    <div class="tab-panel" role="tabpanel">
      <CustomerPaymentView
        v-if="activeTab === 'unpaid' || activeTab === 'records'"
        :embedded="true"
        :initial-tab="paymentInitialTab"
      />
      <CustomerContractView v-else :embedded="true" />
    </div>
  </UiPageShell>
</template>

<style scoped>
.tab-switch {
  display: inline-flex;
  gap: 6px;
  border: 1px solid var(--surface-stroke);
  border-radius: 12px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.75);
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: inherit;
  border-radius: 10px;
  font-weight: 700;
}

.tab-btn.active {
  background: linear-gradient(135deg, rgba(255, 214, 214, 0.6), rgba(255, 164, 164, 0.6));
}

.tab-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(244, 182, 194, 0.35);
  border: 1px solid rgba(244, 182, 194, 0.55);
  color: #3f2620;
  font-weight: 800;
  font-size: 12px;
  white-space: nowrap;
}

.tab-panel {
  display: block;
}
</style>
