import 'vue-router'

export type Role =
  | 'contract_customer'
  | 'non_contract_customer'
  | 'driver'
  | 'warehouse_staff'
  | 'customer_service'
  | 'admin'

declare module 'vue-router' {
  interface RouteMeta {
    roles?: readonly Role[]
  }
}
