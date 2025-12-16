CREATE TABLE IF NOT EXISTS delivery_tasks (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES packages(id),
  task_type TEXT NOT NULL, -- pickup / deliver / transfer_pickup / transfer_dropoff
  from_location TEXT,
  to_location TEXT,
  assigned_driver_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending / accepted / in_progress / completed / canceled
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_delivery_tasks_assignee_status_created ON delivery_tasks(assigned_driver_id, status, created_at);

