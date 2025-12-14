<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
const { user, isLoggedIn } = storeToRefs(auth)

const logout = () => auth.logout()

/** 依角色回傳：導覽上要顯示的文字 */
const roleNavLabel = computed(() => {
  const r = user.value?.user_class
  if (r === 'admin') return '管理員'
  if (r === 'customer_service') return '客服'
  if (r === 'warehouse_staff') return '倉儲'
  if (r === 'driver') return '司機'
  if (r === 'contract_customer' || r === 'non_contract_customer') return '客戶'
  return '我的介面'
})

/** 依角色回傳：點導覽要前往的路由 */
const roleHomePath = computed(() => {
  const r = user.value?.user_class
  if (r === 'admin') return '/admin'
  if (r === 'customer_service') return '/employee/customer-service'
  if (r === 'warehouse_staff') return '/employee/warehouse'
  if (r === 'driver') return '/employee/driver'
  return '/customer'
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

        <!-- 🔓 未登入：只顯示 總覽 / 登入 / 註冊 -->
        <template v-if="!isLoggedIn">
          <RouterLink to="/login">登入</RouterLink>
          <RouterLink to="/register">註冊</RouterLink>
        </template>

        <!-- 🔐 已登入：顯示「客戶/司機/倉儲/客服/管理員」(依角色變動) -->
        <template v-else>
          <RouterLink :to="roleHomePath">{{ roleNavLabel }}</RouterLink>
        </template>
      </nav>

      <div class="topbar-actions">
        <div v-if="isLoggedIn" class="user-chip">
          <span class="user-name">{{ user?.user_name }}</span>
          <span class="user-role">{{ user?.user_class }}</span>
          <button class="ghost-btn small-btn" type="button" @click="logout">登出</button>
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
  min-height: 100vh;
  background: #fff8f2;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.brand {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  text-decoration: none;
  color: #2f2a24;
}

.brand-mark {
  font-weight: 800;
  letter-spacing: 0.2px;
}

.brand-sub {
  font-size: 13px;
  opacity: 0.7;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.nav-links a {
  text-decoration: none;
  color: #4a4036;
  padding: 8px 10px;
  border-radius: 12px;
  transition: background 0.15s ease, transform 0.15s ease;
}

.nav-links a.router-link-active {
  background: rgba(255, 182, 193, 0.35);
}

.nav-links a:hover {
  background: rgba(233, 210, 180, 0.35);
  transform: translateY(-1px);
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
  padding: 8px 10px;
  background: rgba(233, 210, 180, 0.25);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 14px;
}

.user-name {
  font-weight: 700;
  font-size: 13px;
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
