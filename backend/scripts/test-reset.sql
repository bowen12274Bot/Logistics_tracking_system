-- Test reset SQL
PRAGMA foreign_keys=OFF;

-- Reset default user accounts to active status
UPDATE users 
SET status = 'active', 
    deleted_at = NULL, 
    suspended_at = NULL, 
    suspended_reason = NULL 
WHERE id IN ('user-cust-1','user-cust-2','user-driver-0','user-warehouse-0','user-cs-0','user-admin-0')
   OR id LIKE 'user-driver-hub_%'
   OR id LIKE 'user-warehouse-hub_%'
   OR id LIKE 'user-warehouse-reg_%';

-- Delete non-default users
DELETE FROM users 
WHERE id NOT IN ('user-cust-1','user-cust-2','user-driver-0','user-warehouse-0','user-cs-0','user-admin-0')
  AND id NOT LIKE 'user-driver-hub_%'
  AND id NOT LIKE 'user-warehouse-hub_%'
  AND id NOT LIKE 'user-warehouse-reg_%';

-- Clear delivery data
DELETE FROM package_events;
DELETE FROM package_exceptions;
DELETE FROM packages;
DELETE FROM delivery_tasks;
DELETE FROM vehicle_cargo;
DELETE FROM vehicles;
DELETE FROM payments;
DELETE FROM monthly_billing_items;
DELETE FROM monthly_billing;
DELETE FROM contract_applications;
DELETE FROM tokens;
DELETE FROM system_errors;
DELETE FROM access_logs;
DELETE FROM rate_limits;

PRAGMA foreign_keys=ON;
