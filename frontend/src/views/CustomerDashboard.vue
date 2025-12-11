
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { usePackageStore } from '../stores/packages'
import { useAuthStore } from '../stores/auth'

type Link = {
  title: string
  to: string
  description: string
  featured?: boolean
}

const packageStore = usePackageStore()
const auth = useAuthStore()

const quickLinksBase: Link[] = [
  { title: '建立寄件', to: '/customer/send', description: '設定寄件人/收件人、配送速度與付款方式。' },
  { title: '包裹追蹤', to: '/customer/track', description: '查看站點、車輛、物流中心的即時狀態。' },
  { title: '個人資料', to: '/customer/profile', description: '修改姓名、電話、地址與支付偏好。' },
  { title: '合約 / 月結', to: '/customer/contract', description: '申請成為合約客戶、查看帳期貨物。' },
  { title: '付款', to: '/customer/payment', description: '在付款清單付款、付款紀錄查詢。' },
]

const hasUnpaid = computed(() =>
  packageStore.unpaidPackages.some((pkg) => !auth.user || pkg.customer_id === auth.user.id),
)

const quickLinks = computed<Link[]>(() =>
  quickLinksBase.map((link) =>
    link.to === '/customer/payment' ? { ...link, featured: hasUnpaid.value } : link,
  ),
)

onMounted(() => {
  packageStore.fetchUnpaid(auth.user?.id)
})
</script>

<template>
  <section class="page-shell">
    <header class="page-header">
      <p class="eyebrow">客戶</p>
      <h1>你的包裹主控台</h1>
      <p class="lede">監控每件貨態、快速寄件，並以月結讓帳務更可預期。</p>
    </header>

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
  </section>
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
