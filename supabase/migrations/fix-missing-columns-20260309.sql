-- Migration: Add columns missing from live DB that exist in migration definitions
-- Run in: Supabase SQL Editor
-- Safe: all statements use IF NOT EXISTS / IF EXISTS
-- Date: 2026-03-09

-- ============================================================
-- insurance_claims — add all columns that the app uses
-- (table was created without these columns; migration was a no-op)
-- ============================================================
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS adjuster_name     TEXT;
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS adjuster_phone    TEXT;
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS adjuster_email    TEXT;
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS claim_amount      NUMERIC(12,2);
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS approved_amount   NUMERIC(12,2);
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS deductible        NUMERIC(12,2);
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS project_id        UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS inspection_date   DATE;
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS loss_date         DATE;
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS notes             TEXT;

-- Ensure status column has a sensible default if missing
ALTER TABLE insurance_claims ALTER COLUMN status SET DEFAULT 'pending';

-- ============================================================
-- supplements — ensure description has a default so inserts
-- that omit it don't blow up (description is required in form, this is a safety net)
-- ============================================================
ALTER TABLE supplements ALTER COLUMN description SET DEFAULT '';

-- ============================================================
-- material_orders — add description if it exists as NOT NULL
-- without default in some environments (the app now sends it,
-- but add a default as a safety net)
-- ============================================================
ALTER TABLE material_orders ADD COLUMN IF NOT EXISTS description TEXT;
-- If description exists and is NOT NULL with no default, give it one
DO $$
BEGIN
  BEGIN
    ALTER TABLE material_orders ALTER COLUMN description SET DEFAULT '';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- ============================================================
-- estimates — ensure sign_token exists (used by signing flow)
-- ============================================================
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS sign_token TEXT;

-- ============================================================
-- work_orders — ensure signing columns exist
-- ============================================================
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS sign_token       TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS signed_by        TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS signature_data   TEXT;

-- ============================================================
-- Reload PostgREST schema cache so new columns are visible
-- ============================================================
NOTIFY pgrst, 'reload schema';

SELECT 'fix-missing-columns-20260309 applied successfully' AS status;
