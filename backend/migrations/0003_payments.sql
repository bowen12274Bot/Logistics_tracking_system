CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  payer_user_id TEXT,
  payment_method TEXT,
  total_amount INTEGER,
  service_fee INTEGER,
  distance_fee INTEGER,
  weight_volume_fee INTEGER,
  special_fee INTEGER,
  calculated_at TEXT,
  paid_at TEXT,
  collected_by TEXT,
  package_id TEXT REFERENCES packages(id)
);
