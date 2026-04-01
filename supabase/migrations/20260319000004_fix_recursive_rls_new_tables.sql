-- ============================================================
-- FIX: Recursive RLS on 6 tables added after fix-recursive-rls-20260308.sql
-- Date: 2026-03-19
--
-- Problem:
--   The following 6 tables still use the banned recursive subquery pattern:
--
--     company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
--
--   When RLS is enabled on `profiles` itself, this causes PostgreSQL error
--   42P17 (infinite recursion) because evaluating the subquery re-triggers
--   the profiles RLS policy, which in turn tries to evaluate itself.
--
--   Affected tables (all defined in add-suppliers-orders-estimates.sql and
--   related migration files):
--     - crew_schedules
--     - change_orders
--     - permits
--     - equipment
--     - equipment_assignments
--     - company_integrations
--
--   NOTE: crew_schedules, change_orders, permits, equipment,
--   equipment_assignments, and company_integrations were included in
--   fix-recursive-rls-20260308.sql with the EXISTS pattern — however the
--   original add-suppliers-orders-estimates.sql and any re-run of that
--   file recreates the broken IN-subquery policies. This migration ensures
--   the safe EXISTS pattern is authoritative and drops any stale policies
--   by all known names.
--
-- Fix:
--   Drop ALL known policy names on each table, then recreate a single
--   consolidated policy using the safe EXISTS pattern. This matches the
--   exact approach used in fix-recursive-rls-20260308.sql.
--
-- How to run:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file and click Run
--   3. Confirm no 42P17 errors occur when querying these tables
-- ============================================================

-- ── crew_schedules ───────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_crew_schedules"          ON crew_schedules;
DROP POLICY IF EXISTS "Users can view their company crew_schedules" ON crew_schedules;
DROP POLICY IF EXISTS "Users can insert their company crew_schedules" ON crew_schedules;
DROP POLICY IF EXISTS "Users can update their company crew_schedules" ON crew_schedules;
DROP POLICY IF EXISTS "Users can delete their company crew_schedules" ON crew_schedules;
DROP POLICY IF EXISTS "crew_schedules_tenant_select"            ON crew_schedules;
DROP POLICY IF EXISTS "crew_schedules_tenant_insert"            ON crew_schedules;
DROP POLICY IF EXISTS "crew_schedules_tenant_update"            ON crew_schedules;
DROP POLICY IF EXISTS "crew_schedules_tenant_delete"            ON crew_schedules;

CREATE POLICY "company_members_crew_schedules"
  ON crew_schedules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = crew_schedules.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = crew_schedules.company_id
  ));

-- ── change_orders ────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_change_orders"           ON change_orders;
DROP POLICY IF EXISTS "Users can view their company change_orders" ON change_orders;
DROP POLICY IF EXISTS "Users can insert their company change_orders" ON change_orders;
DROP POLICY IF EXISTS "Users can update their company change_orders" ON change_orders;
DROP POLICY IF EXISTS "Users can delete their company change_orders" ON change_orders;
DROP POLICY IF EXISTS "change_orders_tenant_select"             ON change_orders;
DROP POLICY IF EXISTS "change_orders_tenant_insert"             ON change_orders;
DROP POLICY IF EXISTS "change_orders_tenant_update"             ON change_orders;
DROP POLICY IF EXISTS "change_orders_tenant_delete"             ON change_orders;

CREATE POLICY "company_members_change_orders"
  ON change_orders FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = change_orders.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = change_orders.company_id
  ));

-- ── permits ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_permits"                 ON permits;
DROP POLICY IF EXISTS "Users can view their company permits"    ON permits;
DROP POLICY IF EXISTS "Users can insert their company permits"  ON permits;
DROP POLICY IF EXISTS "Users can update their company permits"  ON permits;
DROP POLICY IF EXISTS "Users can delete their company permits"  ON permits;
DROP POLICY IF EXISTS "permits_tenant_select"                   ON permits;
DROP POLICY IF EXISTS "permits_tenant_insert"                   ON permits;
DROP POLICY IF EXISTS "permits_tenant_update"                   ON permits;
DROP POLICY IF EXISTS "permits_tenant_delete"                   ON permits;

CREATE POLICY "company_members_permits"
  ON permits FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = permits.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = permits.company_id
  ));

-- ── equipment ────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_equipment"               ON equipment;
DROP POLICY IF EXISTS "Users can view their company equipment"  ON equipment;
DROP POLICY IF EXISTS "Users can insert their company equipment" ON equipment;
DROP POLICY IF EXISTS "Users can update their company equipment" ON equipment;
DROP POLICY IF EXISTS "Users can delete their company equipment" ON equipment;
DROP POLICY IF EXISTS "equipment_tenant_select"                 ON equipment;
DROP POLICY IF EXISTS "equipment_tenant_insert"                 ON equipment;
DROP POLICY IF EXISTS "equipment_tenant_update"                 ON equipment;
DROP POLICY IF EXISTS "equipment_tenant_delete"                 ON equipment;

CREATE POLICY "company_members_equipment"
  ON equipment FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = equipment.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = equipment.company_id
  ));

-- ── equipment_assignments ────────────────────────────────────
DROP POLICY IF EXISTS "company_members_equipment_assignments"   ON equipment_assignments;
DROP POLICY IF EXISTS "Users can view their company equipment_assignments" ON equipment_assignments;
DROP POLICY IF EXISTS "Users can insert their company equipment_assignments" ON equipment_assignments;
DROP POLICY IF EXISTS "Users can update their company equipment_assignments" ON equipment_assignments;
DROP POLICY IF EXISTS "Users can delete their company equipment_assignments" ON equipment_assignments;
DROP POLICY IF EXISTS "equipment_assignments_tenant_select"     ON equipment_assignments;
DROP POLICY IF EXISTS "equipment_assignments_tenant_insert"     ON equipment_assignments;
DROP POLICY IF EXISTS "equipment_assignments_tenant_update"     ON equipment_assignments;
DROP POLICY IF EXISTS "equipment_assignments_tenant_delete"     ON equipment_assignments;

CREATE POLICY "company_members_equipment_assignments"
  ON equipment_assignments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = equipment_assignments.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = equipment_assignments.company_id
  ));

-- ── company_integrations ─────────────────────────────────────
-- company_integrations has separate read and write policies to allow
-- stricter write control (admins only in future). Both use EXISTS.
DROP POLICY IF EXISTS "company_members_read_integrations"       ON company_integrations;
DROP POLICY IF EXISTS "company_admins_write_integrations"       ON company_integrations;
DROP POLICY IF EXISTS "Users can view their company company_integrations" ON company_integrations;
DROP POLICY IF EXISTS "Users can insert their company company_integrations" ON company_integrations;
DROP POLICY IF EXISTS "Users can update their company company_integrations" ON company_integrations;
DROP POLICY IF EXISTS "Users can delete their company company_integrations" ON company_integrations;
DROP POLICY IF EXISTS "company_integrations_tenant_select"      ON company_integrations;
DROP POLICY IF EXISTS "company_integrations_tenant_insert"      ON company_integrations;
DROP POLICY IF EXISTS "company_integrations_tenant_update"      ON company_integrations;
DROP POLICY IF EXISTS "company_integrations_tenant_delete"      ON company_integrations;

CREATE POLICY "company_members_read_integrations"
  ON company_integrations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = company_integrations.company_id
  ));

CREATE POLICY "company_admins_write_integrations"
  ON company_integrations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = company_integrations.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = company_integrations.company_id
  ));

-- ── Reload PostgREST schema cache ─────────────────────────────
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE 'fix-recursive-rls-new-tables-20260319: Recursive RLS fixed on 6 tables.';
  RAISE NOTICE 'Tables updated: crew_schedules, change_orders, permits, equipment, equipment_assignments, company_integrations.';
  RAISE NOTICE 'All policies now use the safe EXISTS pattern — no more 42P17 recursion errors.';
END $$;
