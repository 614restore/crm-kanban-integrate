-- ============================================================
-- FIX: Recursive RLS on customer_surveys table
-- Date: 2026-03-19
--
-- Problem:
--   The customer_surveys table (created in
--   supabase/migrations/20260316000001_customer_surveys_table.sql)
--   uses the banned recursive subquery pattern on all 3 policies:
--
--     company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
--
--   When RLS is enabled on `profiles`, this causes PostgreSQL error
--   42P17 (infinite recursion): evaluating the IN-subquery re-enters
--   the profiles RLS policy, which tries to evaluate itself.
--
--   There is also no DELETE policy, leaving a gap for orphaned rows.
--
-- Fix:
--   Drop the 3 existing policies (SELECT, INSERT, UPDATE) and recreate
--   them — plus a new DELETE policy — using the safe EXISTS pattern
--   that matches the rest of the codebase.
--
-- How to run:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file and click Run
--   3. Confirm survey queries no longer return 42P17 errors
-- ============================================================

-- ── Drop all existing policies ────────────────────────────────
DROP POLICY IF EXISTS "Users can view company surveys"          ON customer_surveys;
DROP POLICY IF EXISTS "Users can create company surveys"        ON customer_surveys;
DROP POLICY IF EXISTS "Users can update company surveys"        ON customer_surveys;
DROP POLICY IF EXISTS "Users can delete company surveys"        ON customer_surveys;
DROP POLICY IF EXISTS "company_members_customer_surveys"        ON customer_surveys;
DROP POLICY IF EXISTS "customer_surveys_tenant_select"          ON customer_surveys;
DROP POLICY IF EXISTS "customer_surveys_tenant_insert"          ON customer_surveys;
DROP POLICY IF EXISTS "customer_surveys_tenant_update"          ON customer_surveys;
DROP POLICY IF EXISTS "customer_surveys_tenant_delete"          ON customer_surveys;

-- ── Recreate with safe EXISTS pattern ────────────────────────
-- Single consolidated FOR ALL policy following the same pattern
-- used throughout the rest of the codebase (fix-recursive-rls-20260308.sql).
CREATE POLICY "company_members_customer_surveys"
  ON customer_surveys FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = customer_surveys.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = customer_surveys.company_id
  ));

-- ── Reload PostgREST schema cache ─────────────────────────────
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE 'fix-customer-surveys-rls-20260319: customer_surveys RLS fixed.';
  RAISE NOTICE 'Replaced 3 IN-subquery policies with 1 safe EXISTS policy (covers ALL operations).';
  RAISE NOTICE 'DELETE gap also closed — previously missing DELETE policy is now covered.';
END $$;
