import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import CustomerDashboard from '../views/CustomerDashboard.vue'
import CustomerScheduleView from '../views/CustomerScheduleView.vue'
import CustomerSendView from '../views/CustomerSendView.vue'
import CustomerTrackView from '../views/CustomerTrackView.vue'
import CustomerContractView from '../views/CustomerContractView.vue'
import CustomerPaymentView from '../views/CustomerPaymentView.vue'
import EmployeeCustomerServiceView from '../views/EmployeeCustomerServiceView.vue'
import EmployeeDriverView from '../views/EmployeeDriverView.vue'
import EmployeeWarehouseView from '../views/EmployeeWarehouseView.vue'
import AdminView from '../views/AdminView.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: LoginView },
    {
      path: '/customer',
      name: 'customer-dashboard',
      component: CustomerDashboard,
      meta: { roles: ['contract_customer', 'non_contract_customer'] },
    },
    {
      path: '/customer/schedule',
      name: 'customer-schedule',
      component: CustomerScheduleView,
      meta: { roles: ['contract_customer', 'non_contract_customer'] },
    },
    {
      path: '/customer/send',
      name: 'customer-send',
      component: CustomerSendView,
      meta: { roles: ['contract_customer', 'non_contract_customer'] },
    },
    {
      path: '/customer/track',
      name: 'customer-track',
      component: CustomerTrackView,
      meta: { roles: ['contract_customer', 'non_contract_customer'] },
    },
    {
      path: '/customer/contract',
      name: 'customer-contract',
      component: CustomerContractView,
      meta: { roles: ['contract_customer', 'non_contract_customer'] },
    },
    {
      path: '/customer/payment',
      name: 'customer-payment',
      component: CustomerPaymentView,
      meta: { roles: ['contract_customer', 'non_contract_customer'] },
    },
    {
      path: '/employee/customer-service',
      name: 'employee-customer-service',
      component: EmployeeCustomerServiceView,
      meta: { roles: ['customer_service'] },
    },
    {
      path: '/employee/driver',
      name: 'employee-driver',
      component: EmployeeDriverView,
      meta: { roles: ['driver'] },
    },
    {
      path: '/employee/warehouse',
      name: 'employee-warehouse',
      component: EmployeeWarehouseView,
      meta: { roles: ['warehouse_staff'] },
    },
    { path: '/admin', name: 'admin', component: AdminView, meta: { roles: ['admin'] } },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  
  // 沒有設定 roles → 這頁不需要權限 → 直接放行
  if (!to.meta?.roles) return true

  // 有角色限制但沒登入 → 導去 login
  if (!auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // 有登入 → 檢查 user_class 有沒有被允許
  const allowed = to.meta.roles as string[]
  if (auth.user && allowed.includes(auth.user.user_class)) {
    return true
  }

  // 若角色不符 → 導回首頁
  return { name: 'home' }
})

export default router
