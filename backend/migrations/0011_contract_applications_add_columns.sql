-- Migration: Extend contract_applications table
-- Adds review and credit fields required by admin workflow

ALTER TABLE contract_applications ADD COLUMN reviewed_by TEXT REFERENCES users(id);
ALTER TABLE contract_applications ADD COLUMN reviewed_at TEXT;
ALTER TABLE contract_applications ADD COLUMN review_notes TEXT;
ALTER TABLE contract_applications ADD COLUMN credit_limit INTEGER;

CREATE INDEX IF NOT EXISTS idx_contract_applications_status ON contract_applications(status);
