import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'

import CustomerDashboard from '../views/CustomerDashboard.vue'
import CustomerProfileView from '../views/CustomerProfileView.vue'
import CustomerScheduleView from '../views/CustomerScheduleView.vue'
import CustomerSendView from '../views/CustomerSendView.vue'
import CustomerTrackView from '../views/CustomerTrackView.vue'
import CustomerContractView from '../views/CustomerContractView.vue'
import CustomerPaymentView from '../views/CustomerPaymentView.vue'
import PublicTrackView from '../views/PublicTrackView.vue'

import EmployeeDriverView from '../views/EmployeeDriverView.vue'
import EmployeeWarehouseView from '../views/EmployeeWarehouseView.vue'
import EmployeeCustomerServiceView from '../views/EmployeeCustomerServiceView.vue'

import AdminView from '../views/AdminView.vue'
import VirtualMapView from '../views/VirtualMapView.vue'
import DriverMapView from '../views/DriverMapView.vue'
import ShippingEstimateView from '../views/ShippingEstimateView.vue'

import { useAuthStore } from '../stores/auth'

/** ✅ 統一放角色常數，避免打錯字 */
const CUSTOMER_ROLES = ['contract_customer', 'non_contract_customer'] as const
const DRIVER_ROLES = ['driver'] as const
const WAREHOUSE_ROLES = ['warehouse_staff'] as const
const CS_ROLES = ['customer_service'] as const
const ADMIN_ROLES = ['admin'] as const

type Role =
  | (typeof CUSTOMER_ROLES)[number]
  | (typeof DRIVER_ROLES)[number]
  | (typeof WAREHOUSE_ROLES)[number]
  | (typeof CS_ROLES)[number]
  | (typeof ADMIN_ROLES)[number]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },

    { path: '/login', name: 'login', component: LoginView },
    { path: '/register', name: 'register', component: LoginView },

    { path: '/map', name: 'virtual-map', component: VirtualMapView },
    {
      path: '/driver/map',
      name: 'driver-map',
      component: DriverMapView,
      meta: { roles: DRIVER_ROLES },
    },
    { path: '/shipping/estimate', name: 'shipping-estimate', component: ShippingEstimateView },
    { path: '/track', name: 'public-track', component: PublicTrackView },

    {
      path: '/customer',
      name: 'customer-dashboard',
      component: CustomerDashboard,
      meta: { roles: CUSTOMER_ROLES },
    },
    {
      path: '/customer/profile',
      name: 'customer-profile',
      component: CustomerProfileView,
      meta: { roles: CUSTOMER_ROLES },
    },
    {
      path: '/customer/schedule',
      name: 'customer-schedule',
      component: CustomerScheduleView,
      meta: { roles: CUSTOMER_ROLES },
    },
    {
      path: '/customer/send',
      name: 'customer-send',
      component: CustomerSendView,
      meta: { roles: CUSTOMER_ROLES },
    },
    {
      path: '/customer/track',
      name: 'customer-track',
      component: CustomerTrackView,
      meta: { roles: CUSTOMER_ROLES },
    },
    {
      path: '/customer/contract',
      name: 'customer-contract',
      component: CustomerContractView,
      meta: { roles: CUSTOMER_ROLES },
    },
    {
      path: '/customer/payment',
      name: 'customer-payment',
      component: CustomerPaymentView,
      meta: { roles: CUSTOMER_ROLES },
    },

    {
      path: '/employee/customer-service',
      name: 'employee-customer-service',
      component: EmployeeCustomerServiceView,
      meta: { roles: CS_ROLES },
    },
    {
      path: '/employee/driver',
      name: 'employee-driver',
      component: EmployeeDriverView,
      meta: { roles: DRIVER_ROLES },
    },
    {
      path: '/employee/warehouse',
      name: 'employee-warehouse',
      component: EmployeeWarehouseView,
      meta: { roles: WAREHOUSE_ROLES },
    },

    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
      meta: { roles: ADMIN_ROLES },
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  // ✅ meta.roles 可能不存在，先安全取值
  const requiredRoles = (to.meta?.roles as readonly Role[] | undefined) ?? []

  // ✅ 不需要登入的頁面（沒有 roles）直接放行
  if (requiredRoles.length === 0) return true

  // ✅ 需要登入但未登入 → 去登入頁，並帶 redirect
  if (!auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // ✅ 已登入但角色不符 → 導回首頁
  const role = (auth.user?.user_class ?? '') as Role | ''
  if (!requiredRoles.includes(role as Role)) {
    return { path: '/' }
  }

  return true
})

export default router
