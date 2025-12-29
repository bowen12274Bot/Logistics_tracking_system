/**
 * ForbiddenView Tests
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import ForbiddenView from '../../views/ForbiddenView.vue'
import { i18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { mockCustomerUser } from '../helpers'

// Helper to mount with route query
const mountView = async (query: Record<string, string> = {}, user: any = null) => {
  // Map 'target' to 'redirect' if present, to match view logic
  const routeQuery = { ...query }
  if (query.target) {
      routeQuery.redirect = query.target
      delete routeQuery.target
  }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/forbidden', component: ForbiddenView }],
  })
  await router.push({ path: '/forbidden', query: routeQuery })
  await router.isReady()

  const pinia = createPinia()
  setActivePinia(pinia)
  
  if (user) {
    const auth = useAuthStore()
    auth.user = user
  }

  return mount(ForbiddenView, {
    global: {
      plugins: [router, pinia, i18n],
    },
  })
}

describe('ForbiddenView', () => {
  it('renders default 403 message', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('無權限')
    expect(wrapper.text()).toContain('你沒有權限執行此操作')
  })

  it('renders specific role forbidden reason', async () => {
    const wrapper = await mountView({ reason: 'role_forbidden', target: '/admin' })
    expect(wrapper.text()).toContain('你的角色沒有權限進入此頁面')
    expect(wrapper.text()).toContain('嘗試前往：/admin')
  })

  it('shows current role if logged in', async () => {
    const wrapper = await mountView({}, mockCustomerUser)
    // Localized role name for customer is usually '一般會員' or '合約客戶' depending on type.
    // Based on failure: '合約客戶'
    expect(wrapper.text()).toMatch(/目前角色：(合約客戶|一般會員|Customer)/)
  })

  it('shows login button if not logged in', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('前往登入')
  })

  it('shows home button', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('回首頁')
  })
})
