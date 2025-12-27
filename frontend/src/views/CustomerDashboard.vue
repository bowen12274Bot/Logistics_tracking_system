<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { usePackageStore } from '../stores/packages'
import { useAuthStore } from '../stores/auth'
import UiPageShell from '../components/ui/UiPageShell.vue'

type Link = {
  title: string
  to: string
  description: string
  featured?: boolean
}

const { t } = useI18n()
const packageStore = usePackageStore()
const auth = useAuthStore()

const quickLinksBase = computed<Link[]>(() => [
  { title: t('customer.dashboard.links.send.title'), to: '/customer/send', description: t('customer.dashboard.links.send.desc') },
  { title: t('customer.dashboard.links.track.title'), to: '/customer/track', description: t('customer.dashboard.links.track.desc') },
  { title: t('customer.dashboard.links.profile.title'), to: '/customer/profile', description: t('customer.dashboard.links.profile.desc') },
  { title: t('customer.dashboard.links.contract.title'), to: '/customer/contract', description: t('customer.dashboard.links.contract.desc') },
  { title: t('customer.dashboard.links.payment.title'), to: '/customer/payment', description: t('customer.dashboard.links.payment.desc') },
])

const hasUnpaid = computed(() => packageStore.unpaidPackages.length > 0)

const quickLinks = computed<Link[]>(() =>
  quickLinksBase.value.map((link) =>
    link.to === '/customer/payment' ? { ...link, featured: hasUnpaid.value } : link,
  ),
)

onMounted(() => {
  packageStore.fetchUnpaid(auth.user?.id)
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
  </UiPageShell>
</template>

<style scoped>
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
