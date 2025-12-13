CREATE TABLE IF NOT EXISTS monthly_billing_items (
  id TEXT PRIMARY KEY,
  monthly_billing_id TEXT, -- monthly_billing_id
  package_id TEXT          -- package_id
);