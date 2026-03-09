-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 3 production errors (2026-03-09)
-- Run this in Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. insurance_claims: drop NOT NULL on contact_id ─────────────────────────
--    Error: "null value in column contact_id violates not-null constraint"
--    The table was created before this migration with NOT NULL; schema intent is nullable.
ALTER TABLE insurance_claims
  ALTER COLUMN contact_id DROP NOT NULL;

-- ── 2. profiles: add 3 commission rate columns ───────────────────────────────
--    Error: 400 on profiles (column commission_rate_self_gen does not exist)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS commission_rate_self_gen NUMERIC(5,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS commission_rate_company   NUMERIC(5,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS commission_rate_custom    NUMERIC(5,2) DEFAULT 0;

-- Backfill from legacy commission_rate if it exists
UPDATE profiles
SET
  commission_rate_self_gen = COALESCE(commission_rate, 0),
  commission_rate_company   = COALESCE(commission_rate, 0)
WHERE commission_rate IS NOT NULL AND commission_rate > 0;

-- ── 3. profiles: add ui_prefs column ─────────────────────────────────────────
--    Error: 400 on profiles (column ui_prefs does not exist)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ui_prefs JSONB NOT NULL DEFAULT '{}';

-- ── Reload PostgREST schema cache ─────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
