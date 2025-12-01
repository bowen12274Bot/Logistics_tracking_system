CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  weight INTEGER,
  size TEXT,
  service_type TEXT,
  payment_type TEXT,
  final_billing_date TEXT,
  dangerous_materials BOOLEAN,
  fragile_items BOOLEAN,
  international_shipments BOOLEAN,
  tracking_number TEXT,
  contents_description TEXT,
  description_json TEXT
);