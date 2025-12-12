CREATE TABLE IF NOT EXISTS contract_applications (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  tax_id TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  billing_address TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  review_notes TEXT,
  credit_limit INTEGER,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_contract_applications_customer ON contract_applications (customer_id);
CREATE INDEX IF NOT EXISTS idx_contract_applications_status ON contract_applications(status);

-- Seed one approved application for the demo contract customer user-cust-1
INSERT OR IGNORE INTO contract_applications (
  id, customer_id, company_name, tax_id, contact_person, contact_phone, billing_address, notes, status, created_at
) VALUES (
  'contract-app-1',
  'user-cust-1',
  '示範合約客戶股份有限公司',
  '12345678',
  '示範聯絡人',
  '0912345678',
  '台北市信義區松仁路 1 號',
  '種子資料：預設為已核准示範合約客戶申請。',
  'approved',
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
);
