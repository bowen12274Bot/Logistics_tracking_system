import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import CustomerDashboard from '../views/CustomerDashboard.vue'
import CustomerProfileView from '../views/CustomerProfileView.vue'
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
import type { Role } from '../types/router'
import { useAuthStore } from '../stores/auth'

// Route access control by role
const CUSTOMER_ROLES = ['contract_customer', 'non_contract_customer'] as const
const DRIVER_ROLES = ['driver'] as const
const WAREHOUSE_ROLES = ['warehouse_staff'] as const
const CS_ROLES = ['customer_service'] as const
const ADMIN_ROLES = ['admin'] as const

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  },
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
  const requiredRoles = (to.meta?.roles as readonly Role[] | undefined) ?? []

  if (requiredRoles.length === 0) return true

  if (!auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  const role = (auth.user?.user_class ?? '') as Role | ''
  if (!requiredRoles.includes(role as Role)) {
    return { path: '/' }
  }

  return true
})

export default router
