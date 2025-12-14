import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'

// 你專案裡原本的頁面（如果檔名不同，你就改成你自己的）
import CustomerDashboard from '../views/CustomerDashboard.vue'
import EmployeeDriverView from '../views/EmployeeDriverView.vue'
import EmployeeWarehouseView from '../views/EmployeeWarehouseView.vue'
import EmployeeCustomerServiceView from '../views/EmployeeCustomerServiceView.vue'
import AdminView from '../views/AdminView.vue'

import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },

    { path: '/login', name: 'login', component: LoginView },
    { path: '/register', name: 'register', component: LoginView },

    { path: '/customer', name: 'customer', component: CustomerDashboard, meta: { roles: ['contract_customer', 'non_contract_customer'] } },

    { path: '/employee/driver', name: 'driver', component: EmployeeDriverView, meta: { roles: ['driver'] } },
    { path: '/employee/warehouse', name: 'warehouse', component: EmployeeWarehouseView, meta: { roles: ['warehouse_staff'] } },
    { path: '/employee/customer-service', name: 'customer-service', component: EmployeeCustomerServiceView, meta: { roles: ['customer_service'] } },

    { path: '/admin', name: 'admin', component: AdminView, meta: { roles: ['admin'] } },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  const requiredRoles = (to.meta.roles as string[] | undefined) ?? []

  if (requiredRoles.length === 0) return true

  if (!auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  const role = auth.user?.user_class ?? ''
  if (!requiredRoles.includes(role)) {
    return { path: '/' }
  }

  return true
})

export default router
