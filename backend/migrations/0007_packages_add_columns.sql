-- Migration: Add missing columns to packages table
-- Required by API contract for sender/receiver details and package status

ALTER TABLE packages ADD COLUMN sender_phone TEXT;
ALTER TABLE packages ADD COLUMN sender_address TEXT;
ALTER TABLE packages ADD COLUMN receiver_phone TEXT;
ALTER TABLE packages ADD COLUMN receiver_address TEXT;
ALTER TABLE packages ADD COLUMN status TEXT DEFAULT 'created';
ALTER TABLE packages ADD COLUMN estimated_delivery TEXT;
ALTER TABLE packages ADD COLUMN created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
