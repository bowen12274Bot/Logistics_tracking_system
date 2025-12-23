-- Add status columns to users table
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted'));
ALTER TABLE users ADD COLUMN suspended_at TEXT;
ALTER TABLE users ADD COLUMN suspended_reason TEXT;
ALTER TABLE users ADD COLUMN deleted_at TEXT;
