<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from './stores/auth'
import UiToastHost from './components/ui/UiToastHost.vue'
import { useI18n } from 'vue-i18n'
import { roleLabelKey } from './services/roleLabels'
import type { Role } from './types/router'

type RoleNav = { to: string; labelKey: string }

const auth = useAuthStore()
const { user, isLoggedIn } = storeToRefs(auth)
const router = useRouter()
const { t, locale } = useI18n()

const logout = () => {
  auth.logout()
  router.push('/')
}

const roleNav = computed<RoleNav | null>(() => {
  const role = user.value?.user_class
  if (!role) return null

  if (role === 'contract_customer' || role === 'non_contract_customer') {
    return { to: '/customer', labelKey: 'nav.customer' }
  }

  const map: Record<string, RoleNav> = {
    driver: { to: '/employee/driver', labelKey: 'nav.driver' },
    warehouse_staff: { to: '/employee/warehouse', labelKey: 'nav.warehouse' },
    customer_service: { to: '/employee/customer-service', labelKey: 'nav.customerService' },
    admin: { to: '/admin', labelKey: 'nav.admin' },
  }

  return map[role] ?? null
})

const localeOptions = [
  { value: 'zh-TW', labelKey: 'locale.zh' },
  { value: 'en-US', labelKey: 'locale.en' },
]

const userRoleLabel = computed(() => {
  const key = roleLabelKey((user.value?.user_class ?? '') as Role | '')
  return key ? t(key) : ''
})

const isMenuOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)

const isCustomerRole = computed(() => {
  const role = (user.value?.user_class ?? '') as string
  return role === 'contract_customer' || role === 'non_contract_customer'
})

const closeMenu = () => {
  isMenuOpen.value = false
}

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const onDocumentPointerDown = (event: MouseEvent) => {
  if (!isMenuOpen.value) return
  const root = menuRoot.value
  if (!root) return
  if (event.target instanceof Node && root.contains(event.target)) return
  closeMenu()
}

const onDocumentKeyDown = (event: KeyboardEvent) => {
  if (!isMenuOpen.value) return
  if (event.key === 'Escape') closeMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeyDown)
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="topbar-inner">
        <RouterLink to="/" class="brand" :aria-label="t('aria.brand')">
          <span class="brand-mark">{{ t('brand.name') }}</span>
          <span class="brand-sub">{{ t('brand.sub') }}</span>
        </RouterLink>

        <nav class="nav-links" :aria-label="t('aria.mainNav')">
          <RouterLink to="/">{{ t('nav.home') }}</RouterLink>
          <RouterLink v-if="!isLoggedIn" to="/login">{{ t('nav.login') }}</RouterLink>
          <RouterLink v-if="isLoggedIn && roleNav" :to="roleNav.to">{{ t(roleNav.labelKey) }}</RouterLink>
        </nav>

        <div class="topbar-actions">
          <label class="locale-switch">
            <span class="sr-only">{{ t('aria.localeSwitch') }}</span>
            <select v-model="locale">
              <option v-for="option in localeOptions" :key="option.value" :value="option.value">
                {{ t(option.labelKey) }}
              </option>
            </select>
          </label>
          <div v-if="isLoggedIn" ref="menuRoot" class="user-menu">
            <button
              class="user-chip"
              type="button"
              :aria-label="t('menu.account')"
              aria-haspopup="menu"
              :aria-expanded="isMenuOpen"
              @click="toggleMenu"
            >
              <span class="user-name">{{ user?.user_name }}</span>
              <span v-if="userRoleLabel" class="user-role">{{ userRoleLabel }}</span>
            </button>

            <div v-if="isMenuOpen" class="menu-panel" role="menu">
              <RouterLink v-if="isCustomerRole" to="/customer/profile" class="menu-item" role="menuitem" @click="closeMenu">
                <span class="menu-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path
                      d="M12 12c2.76 0 5-2.46 5-5.5S14.76 1 12 1 7 3.46 7 6.5 9.24 12 12 12Zm0 2c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5Z"
                    />
                  </svg>
                </span>
                {{ t('menu.personalSettings') }}
              </RouterLink>
              <RouterLink v-if="isCustomerRole" to="/customer/billing" class="menu-item" role="menuitem" @click="closeMenu">
                <span class="menu-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path
                      d="M7 3h10a2 2 0 0 1 2 2v1h-2V5H7v14h10v-1h2v1a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                    />
                    <path d="M9 7h8v2H9V7Zm0 4h8v2H9v-2Zm0 4h6v2H9v-2Z" />
                  </svg>
                </span>
                {{ t('menu.billingCenter') }}
              </RouterLink>
              <button class="menu-item danger" type="button" role="menuitem" @click="logout">
                <span class="menu-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M10 17v-2h4V9h-4V7h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-4Z" />
                    <path d="M8.59 16.59 10 18l-6-6 6-6-1.41 1.41L4.83 11H14v2H4.83l3.76 3.59Z" />
                    <path d="M20 3h-8v2h8v14h-8v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" />
                  </svg>
                </span>
                {{ t('nav.logout') }}
              </button>
            </div>
          </div>
          <RouterLink v-else to="/login" class="primary-btn small-btn">{{ t('nav.login') }}</RouterLink>
        </div>
      </div>
    </header>

    <main class="content">
      <div class="content-inner">
        <RouterView />
      </div>
    </main>

    <UiToastHost />
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
  max-width: 1320px;
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

.content {
  padding: 28px 0 72px;
  background: #fff8f2;
  flex: 1;
}

.content-inner {
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 20px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-self: end;
}

.locale-switch select {
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.8);
  color: #2f2a24;
  font-size: 12px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
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
  cursor: pointer;
}

.user-role {
  font-size: 12px;
  opacity: 0.7;
}

.user-menu {
  position: relative;
}

.menu-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 180px;
  border-radius: 14px;
  border: 1px solid rgba(165, 122, 99, 0.22);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 18px 40px rgba(46, 31, 26, 0.18);
  padding: 6px;
  display: grid;
  gap: 4px;
  z-index: 30;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-main);
  text-decoration: none;
  cursor: pointer;
  font-size: 14px;
}

.menu-icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
}

.menu-icon svg {
  display: block;
}

.menu-item:hover {
  background: rgba(244, 182, 194, 0.22);
  border-color: rgba(244, 182, 194, 0.35);
}

.menu-item.danger:hover {
  background: rgba(161, 60, 60, 0.12);
  border-color: rgba(161, 60, 60, 0.25);
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
  font-weight: 700;
  font-size: 12px;
  padding: 6px 10px;
  background: rgba(244, 182, 194, 0.4);
  border: 1px solid rgba(244, 182, 194, 0.55);
  color: #3f2620;
  border-radius: 999px;
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
