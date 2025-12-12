-- Migration: Add missing columns to monthly_billing table
-- Required by API contract for billing status and payment tracking

ALTER TABLE monthly_billing ADD COLUMN status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue'));
ALTER TABLE monthly_billing ADD COLUMN total_amount INTEGER DEFAULT 0;
ALTER TABLE monthly_billing ADD COLUMN due_date TEXT;
ALTER TABLE monthly_billing ADD COLUMN paid_at TEXT;
ALTER TABLE monthly_billing ADD COLUMN created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
