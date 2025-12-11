-- Migration: Add missing columns to users table
-- Required by API contract for billing preference

ALTER TABLE users ADD COLUMN billing_preference TEXT CHECK (billing_preference IN ('cash', 'credit_card', 'bank_transfer', 'monthly', 'third_party_payment'));
