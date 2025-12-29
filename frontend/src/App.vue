<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from './stores/auth'
import UiToastHost from './components/ui/UiToastHost.vue'
import UiIcon from './components/ui/UiIcon.vue'
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

const isNavOpen = ref(false)
const topbarRoot = ref<HTMLElement | null>(null)

const isMenuOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)

const isCustomerRole = computed(() => {
  const role = (user.value?.user_class ?? '') as string
  return role === 'contract_customer' || role === 'non_contract_customer'
})

const closeMenu = () => {
  isMenuOpen.value = false
}

const closeNav = () => {
  isNavOpen.value = false
}

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const toggleNav = () => {
  isNavOpen.value = !isNavOpen.value
  if (isNavOpen.value) closeMenu()
}

const onDocumentPointerDown = (event: MouseEvent) => {
  const target = event.target instanceof Node ? event.target : null
  if (!target) return

  if (isMenuOpen.value) {
    const root = menuRoot.value
    if (root && root.contains(target)) return
    closeMenu()
  }

  if (isNavOpen.value) {
    const root = topbarRoot.value
    if (root && root.contains(target)) return
    closeNav()
  }
}

const onDocumentKeyDown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return
  closeMenu()
  closeNav()
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
    <header ref="topbarRoot" class="topbar">
      <div class="topbar-inner">
        <RouterLink to="/" class="brand" :aria-label="t('aria.brand')">
          <span class="brand-mark">{{ t('brand.name') }}</span>
          <span class="brand-sub">{{ t('brand.sub') }}</span>
        </RouterLink>

        <nav id="topbar-nav" class="nav-links" :class="{ open: isNavOpen }" :aria-label="t('aria.mainNav')">
          <RouterLink to="/" @click="closeNav">{{ t('nav.home') }}</RouterLink>
          <RouterLink v-if="!isLoggedIn" to="/login" @click="closeNav">{{ t('nav.login') }}</RouterLink>
          <RouterLink v-if="isLoggedIn && roleNav" :to="roleNav.to" @click="closeNav">{{ t(roleNav.labelKey) }}</RouterLink>
        </nav>

        <div class="topbar-actions">
          <button
            class="nav-toggle"
            type="button"
            :aria-label="t('aria.mainNav')"
            aria-controls="topbar-nav"
            :aria-expanded="isNavOpen"
            @click="toggleNav"
          >
            <UiIcon v-if="!isNavOpen" name="menu" :size="18" />
            <UiIcon v-else name="close" :size="18" />
          </button>
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
                <UiIcon name="user" :size="16" class="menu-icon" />
                {{ t('menu.personalSettings') }}
              </RouterLink>
              <RouterLink v-if="isCustomerRole" to="/customer/billing" class="menu-item" role="menuitem" @click="closeMenu">
                <UiIcon name="billing" :size="16" class="menu-icon" />
                {{ t('menu.billingCenter') }}
              </RouterLink>
              <button class="menu-item danger" type="button" role="menuitem" @click="logout">
                <UiIcon name="logout" :size="16" class="menu-icon" />
                {{ t('nav.logout') }}
              </button>
            </div>
          </div>
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

.nav-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(244, 182, 194, 0.55);
  background: rgba(244, 182, 194, 0.22);
  color: #3f2620;
  cursor: pointer;
}

.nav-toggle:hover {
  background: rgba(244, 182, 194, 0.35);
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
    padding: 10px 14px;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'brand actions'
      'nav nav';
    row-gap: 10px;
  }

  .brand {
    grid-area: brand;
  }

  .brand-sub {
    display: none;
  }

  .nav-links {
    grid-area: nav;
    display: none;
    justify-self: stretch;
    border-radius: 16px;
    border: 1px solid rgba(165, 122, 99, 0.18);
    background: rgba(255, 255, 255, 0.65);
    padding: 8px;
  }

  .nav-links.open {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .nav-links a {
    width: 100%;
    justify-content: flex-start;
    padding: 10px 12px;
  }

  .topbar-actions {
    grid-area: actions;
    justify-self: end;
    gap: 8px;
  }

  .nav-toggle {
    display: inline-flex;
  }

  .locale-switch select {
    height: 36px;
  }

  .user-role {
    display: none;
  }

  .user-name {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
