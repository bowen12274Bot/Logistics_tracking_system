import type { Role } from '../types/router'

export function roleLabelKey(role: Role | '' | null | undefined): string | null {
  if (!role) return null

  const map: Record<Role, string> = {
    contract_customer: 'role.contractCustomer',
    non_contract_customer: 'role.nonContractCustomer',
    driver: 'role.driver',
    warehouse_staff: 'role.warehouse',
    customer_service: 'role.customerService',
    admin: 'role.admin',
  }

  return map[role] ?? null
}

