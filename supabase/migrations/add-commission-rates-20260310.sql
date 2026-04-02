-- Migration: Add 3 commission rate columns per salesman
-- Run in Supabase SQL Editor

-- Add self-generated lead commission rate
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS commission_rate_self_gen NUMERIC(5,2) DEFAULT 0;

-- Add company-generated lead commission rate
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS commission_rate_company NUMERIC(5,2) DEFAULT 0;

-- Add custom/override commission rate
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS commission_rate_custom NUMERIC(5,2) DEFAULT 0;

-- Backfill: copy existing commission_rate into both new rate columns for continuity
UPDATE profiles
SET
  commission_rate_self_gen = COALESCE(commission_rate, 0),
  commission_rate_company   = COALESCE(commission_rate, 0)
WHERE commission_rate IS NOT NULL AND commission_rate > 0;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
