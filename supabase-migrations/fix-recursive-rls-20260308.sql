-- ============================================================
-- FIX: Recursive RLS policies on 6 tables (B01)
-- The 20260307_v2_pm_features.sql and 20260307_company_integrations.sql
-- migrations used:
--   company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
-- which triggers infinite recursion (42P17) because profiles itself
-- has an RLS policy that reads profiles.
--
-- Fix: use EXISTS with a lateral reference instead of IN (subquery),
-- or use auth.jwt() -> 'company_id' if available. Safest fix is EXISTS.
-- ============================================================

-- ── crew_schedules ───────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_crew_schedules" ON crew_schedules;
CREATE POLICY "company_members_crew_schedules"
  ON crew_schedules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = crew_schedules.company_id
  ));

-- ── change_orders ────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_change_orders" ON change_orders;
CREATE POLICY "company_members_change_orders"
  ON change_orders FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = change_orders.company_id
  ));

-- ── permits ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_permits" ON permits;
CREATE POLICY "company_members_permits"
  ON permits FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = permits.company_id
  ));

-- ── equipment ────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_equipment" ON equipment;
CREATE POLICY "company_members_equipment"
  ON equipment FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = equipment.company_id
  ));

-- ── equipment_assignments ────────────────────────────────────
DROP POLICY IF EXISTS "company_members_equipment_assignments" ON equipment_assignments;
CREATE POLICY "company_members_equipment_assignments"
  ON equipment_assignments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = equipment_assignments.company_id
  ));

-- ── company_integrations ─────────────────────────────────────
DROP POLICY IF EXISTS "company_members_read_integrations" ON company_integrations;
DROP POLICY IF EXISTS "company_admins_write_integrations" ON company_integrations;

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
  ));

-- ============================================================
-- FIX: Expense receipts storage bucket isolation (B02)
-- Add company-scoped storage policies so users can only access
-- their own company's receipts. Path convention: {company_id}/{filename}
-- ============================================================

-- Remove any existing policies on expense-receipts (including previously created ones)
DROP POLICY IF EXISTS "allow_all_expense_receipts" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_expense_receipts" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_select" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_insert" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_delete" ON storage.objects;

-- SELECT: users can only read files in their own company's folder
CREATE POLICY "expense_receipts_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (storage.foldername(name))[1] = profiles.company_id::text
    )
  );

-- INSERT: users can only upload to their own company's folder
CREATE POLICY "expense_receipts_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (storage.foldername(name))[1] = profiles.company_id::text
    )
  );

-- DELETE: users can only delete their own company's files
CREATE POLICY "expense_receipts_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (storage.foldername(name))[1] = profiles.company_id::text
    )
  );
