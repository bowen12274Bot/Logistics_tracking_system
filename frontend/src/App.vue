<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from './stores/auth'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const { user, isLoggedIn } = storeToRefs(auth)
const router = useRouter()

const logout = () => {
  auth.logout()
  router.push('/')
}

const roleNav = computed(() => {
  const role = user.value?.user_class
  if (!role) return null

  if (role === 'contract_customer' || role === 'non_contract_customer') {
    return { to: '/customer', label: '客戶' }
  }

  const map: Record<string, { to: string; label: string }> = {
    driver: { to: '/employee/driver', label: '司機' },
    warehouse_staff: { to: '/employee/warehouse', label: '倉儲' },
    customer_service: { to: '/employee/customer-service', label: '客服' },
    admin: { to: '/admin', label: '管理' },
  }

  return map[role] ?? null
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="topbar-inner">
        <RouterLink to="/" class="brand" aria-label="回到總覽">
          <span class="brand-mark">LogiSim</span>
          <span class="brand-sub">物流系統</span>
        </RouterLink>

        <nav class="nav-links" aria-label="主導覽">
          <RouterLink to="/">總覽</RouterLink>
          <RouterLink v-if="!isLoggedIn" to="/login">登入</RouterLink>
          <RouterLink v-if="isLoggedIn && roleNav" :to="roleNav.to">{{ roleNav.label }}</RouterLink>
        </nav>

        <div class="topbar-actions">
          <div v-if="isLoggedIn" class="user-chip">
            <span class="user-name">{{ user?.user_name }}</span>
            <span class="user-role">{{ user?.user_class }}</span>
            <button class="ghost-btn small-btn" type="button" @click="logout">登出</button>
          </div>
          <RouterLink v-else to="/login" class="primary-btn small-btn">開啟控制台</RouterLink>
        </div>
      </div>
    </header>

    <main class="content">
      <div class="content-inner">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.topbar {
  background: rgba(255, 255, 255, 0.92);
  color: var(--text-main);
  border-bottom: 1px solid rgba(165, 122, 99, 0.18);
  position: sticky;
  top: 0;
  backdrop-filter: blur(14px);
  z-index: 20;
}

.topbar-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 14px 20px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 14px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: inherit;
  justify-self: start;
}

.brand-mark {
  font-weight: 800;
  letter-spacing: 0.02em;
}

.brand-sub {
  font-size: 12px;
  opacity: 0.75;
}

.nav-links {
  display: flex;
  gap: 14px;
  align-items: center;
  font-size: 14px;
  justify-self: center;
}

.nav-links a {
  color: var(--text-main);
  padding: 9px 14px;
  border-radius: 999px;
  border: 1px solid transparent;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.nav-links a.router-link-active {
  background: rgba(244, 182, 194, 0.4);
  border-color: rgba(244, 182, 194, 0.55);
  color: #3f2620;
}

.small-btn {
  padding: 10px 16px;
  border-radius: 999px;
  font-weight: 700;
  background: rgba(244, 182, 194, 0.4);
  border-color: rgba(244, 182, 194, 0.55);
  color: #3f2620;
}

.content {
  padding: 28px 0 72px;
  background: #fff8f2;
  flex: 1;
}

.content-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-self: end;
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid rgba(165, 122, 99, 0.22);
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-main);
}

.user-role {
  font-size: 12px;
  opacity: 0.7;
}

.primary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  padding: 10px 14px;
  text-decoration: none;
  color: #2f2a24;
  background: rgba(255, 182, 193, 0.55);
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: transform 0.15s ease;
}

.primary-btn:hover {
  transform: translateY(-1px);
}

.ghost-btn {
  background: transparent;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 8px 10px;
  cursor: pointer;
  color: #2f2a24;
}

.small-btn {
  font-size: 12px;
  padding: 6px 10px;
  background: rgba(244, 182, 194, 0.4);
  border-color: rgba(244, 182, 194, 0.55);
  color: #3f2620;
}

@media (max-width: 768px) {
  .topbar-inner {
    grid-template-columns: 1fr;
    justify-items: start;
  }

  .nav-links {
    flex-wrap: wrap;
    justify-content: flex-start;
    justify-self: start;
  }

  .topbar-actions {
    justify-self: start;
  }
}
</style>
