CREATE TABLE IF NOT EXISTS package_events (
  id TEXT PRIMARY KEY,
  package_id TEXT,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN (
    'created',
    'picked_up',
    'in_transit',
    'sorting',
    'warehouse_in',
    'warehouse_received',
    'warehouse_out',
    'out_for_delivery',
    'delivered',
    'exception',
    'exception_resolved',
    'route_decided',
    'sorting_started',
    'sorting_completed',
    'enroute_pickup',
    'arrived_pickup',
    'payment_collected_prepaid',
    'enroute_delivery',
    'arrived_delivery',
    'payment_collected_cod'
  )),
  delivery_details TEXT,
  events_at TEXT,
  location TEXT
);

-- Fast lookups for latest status/events per package
CREATE INDEX IF NOT EXISTS idx_package_events_package_time ON package_events(package_id, events_at);

-- Treat packages.status as a cache of latest package_events.delivery_status.
-- This keeps existing query patterns fast while making events the source of truth.
DROP TRIGGER IF EXISTS trg_package_events_sync_status;
CREATE TRIGGER trg_package_events_sync_status
AFTER INSERT ON package_events
WHEN NEW.delivery_status IS NOT NULL
  AND TRIM(NEW.delivery_status) != ''
  -- Only sync if this inserted event is the latest by timestamp for that package.
  AND (NEW.events_at IS NULL OR NEW.events_at = (
    SELECT MAX(events_at) FROM package_events WHERE package_id = NEW.package_id
  ))
BEGIN
  UPDATE packages
  -- NOTE: packages.status is a customer-facing "stage" cache, not a full event type.
  -- Map fine-grained operational events (package_events.delivery_status) into a stable stage set.
  SET status =
    CASE LOWER(TRIM(NEW.delivery_status))
      -- Stage statuses (kept for backward compatibility)
      WHEN 'created' THEN 'created'
      WHEN 'picked_up' THEN 'picked_up'
      WHEN 'in_transit' THEN 'in_transit'
      WHEN 'sorting' THEN 'sorting'
      WHEN 'warehouse_in' THEN 'warehouse_in'
      WHEN 'warehouse_out' THEN 'warehouse_out'
      WHEN 'out_for_delivery' THEN 'out_for_delivery'
      WHEN 'delivered' THEN 'delivered'
      WHEN 'exception' THEN 'exception'
      WHEN 'exception_resolved' THEN CASE
        WHEN NEW.location LIKE 'HUB_%' OR NEW.location LIKE 'REG_%' THEN 'warehouse_in'
        ELSE 'in_transit'
      END

      -- Extended operational events -> stage mapping
      WHEN 'enroute_pickup' THEN 'in_transit'
      WHEN 'arrived_pickup' THEN 'in_transit'
      WHEN 'payment_collected_prepaid' THEN 'in_transit'

      WHEN 'warehouse_received' THEN 'warehouse_in'

      WHEN 'route_decided' THEN 'sorting'
      WHEN 'sorting_started' THEN 'sorting'
      WHEN 'sorting_completed' THEN 'sorting'

      WHEN 'enroute_delivery' THEN 'out_for_delivery'
      WHEN 'arrived_delivery' THEN 'out_for_delivery'
      WHEN 'payment_collected_cod' THEN 'out_for_delivery'

      ELSE (SELECT status FROM packages WHERE id = NEW.package_id)
    END
  WHERE id = NEW.package_id;
END;
