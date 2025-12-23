-- Track which packages are currently loaded on a vehicle (infinite capacity assumption)
CREATE TABLE IF NOT EXISTS vehicle_cargo (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  package_id TEXT NOT NULL REFERENCES packages(id),
  loaded_at TEXT,
  unloaded_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_vehicle_cargo_vehicle_unloaded ON vehicle_cargo(vehicle_id, unloaded_at);
CREATE INDEX IF NOT EXISTS idx_vehicle_cargo_package_unloaded ON vehicle_cargo(package_id, unloaded_at);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_vehicle_cargo_package_loaded ON vehicle_cargo(package_id) WHERE unloaded_at IS NULL;
