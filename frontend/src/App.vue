<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from './stores/auth'
import { computed } from 'vue'

const auth = useAuthStore()
const { user, isLoggedIn } = storeToRefs(auth)

const logout = () => {
  auth.logout()
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
      <RouterLink to="/" class="brand">
        <span class="brand-mark">LogiSim</span>
        <span class="brand-sub">物流系統</span>
      </RouterLink>

      <nav class="nav-links">
        <RouterLink to="/">總覽</RouterLink>
        <RouterLink v-if="!isLoggedIn" to="/login">登入</RouterLink>
        <button v-else class="nav-btn" type="button" @click="logout">登出</button>
        <RouterLink v-if="isLoggedIn && roleNav" :to="roleNav.to">{{ roleNav.label }}</RouterLink>
      </nav>

      <div class="topbar-actions">
        <div v-if="isLoggedIn" class="user-chip">
          <span class="user-name">{{ user?.user_name }}</span>
          <span class="user-role">{{ user?.user_class }}</span>
        </div>
        <RouterLink v-else to="/login" class="primary-btn small-btn">開啟控制台</RouterLink>
      </div>
    </header>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 20px 72px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border: 1px solid var(--surface-stroke);
  border-radius: 16px;
  background: linear-gradient(120deg, rgba(255, 245, 237, 0.95), rgba(249, 210, 220, 0.92));
  color: #5b3a2c;
  position: sticky;
  top: 16px;
  backdrop-filter: blur(12px);
  box-shadow: 0 12px 40px rgba(168, 118, 96, 0.2);
  z-index: 5;
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: inherit;
}

.brand-mark {
  font-weight: 700;
  letter-spacing: 0.04em;
}

.brand-sub {
  font-size: 12px;
  opacity: 0.7;
}

.nav-links {
  display: flex;
  gap: 14px;
  align-items: center;
  font-size: 14px;
}

.nav-links a {
  color: #7b5344;
  padding: 6px 10px;
  border-radius: 10px;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.nav-links .nav-btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: #7b5344;
  padding: 6px 10px;
  border-radius: 10px;
  font: inherit;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.nav-links .nav-btn:hover {
  background: rgba(255, 255, 255, 0.35);
  color: #3f2620;
}

.nav-links a.router-link-active {
  background: rgba(255, 255, 255, 0.6);
  color: #3f2620;
}

.small-btn {
  padding: 10px 14px;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  color: #4a2623;
  border-radius: 12px;
  font-weight: 700;
}

.content {
  margin-top: 28px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid var(--surface-stroke);
  background: rgba(255, 255, 255, 0.72);
  color: #5b3a2c;
}

.user-role {
  font-size: 12px;
  opacity: 0.8;
}

@media (max-width: 768px) {
  .topbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .nav-links {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}
</style>
