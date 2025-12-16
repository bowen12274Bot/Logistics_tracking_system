CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  driver_user_id TEXT NOT NULL REFERENCES users(id),
  vehicle_code TEXT NOT NULL,
  home_node_id TEXT REFERENCES nodes(id),
  current_node_id TEXT REFERENCES nodes(id),
  updated_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_driver_user_id ON vehicles(driver_user_id);

