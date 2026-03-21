-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: customer_surveys RLS policies used a recursive subquery pattern
--
-- The 20260316000001_customer_surveys_table.sql migration created policies
-- using: company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
--
-- This can trigger the 42P17 infinite recursion error on the profiles table
-- because the profiles SELECT RLS policy itself calls get_my_company_id().
--
-- Fix: replace with get_my_company_id() which is SECURITY DEFINER and
-- reads profiles bypassing RLS — no recursion possible.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── customer_surveys ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view company surveys" ON customer_surveys;
DROP POLICY IF EXISTS "Users can create company surveys" ON customer_surveys;
DROP POLICY IF EXISTS "Users can update company surveys" ON customer_surveys;
DROP POLICY IF EXISTS "customer_surveys_tenant_select" ON customer_surveys;
DROP POLICY IF EXISTS "customer_surveys_tenant_insert" ON customer_surveys;
DROP POLICY IF EXISTS "customer_surveys_tenant_update" ON customer_surveys;
DROP POLICY IF EXISTS "customer_surveys_tenant_delete" ON customer_surveys;

CREATE POLICY "customer_surveys_tenant_select" ON customer_surveys
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

CREATE POLICY "customer_surveys_tenant_insert" ON customer_surveys
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "customer_surveys_tenant_update" ON customer_surveys
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "customer_surveys_tenant_delete" ON customer_surveys
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ── Re-confirm get_my_company_id() is SECURITY DEFINER ────────────────────
-- Ensures no prior migration accidentally removed the SECURITY DEFINER
-- attribute, which would cause all tenant-scoped policies to hang/recurse.
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.company_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_company_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_company_id() TO authenticated;

-- ── Re-confirm contacts policies are non-recursive ────────────────────────
DROP POLICY IF EXISTS "contacts_tenant_select" ON contacts;
DROP POLICY IF EXISTS "contacts_tenant_insert" ON contacts;
DROP POLICY IF EXISTS "contacts_tenant_update" ON contacts;
DROP POLICY IF EXISTS "contacts_tenant_delete" ON contacts;
DROP POLICY IF EXISTS "company_members_contacts" ON contacts;

CREATE POLICY "contacts_tenant_select" ON contacts
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

CREATE POLICY "contacts_tenant_insert" ON contacts
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "contacts_tenant_update" ON contacts
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "contacts_tenant_delete" ON contacts
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ── Re-confirm appointments policies are non-recursive ────────────────────
DROP POLICY IF EXISTS "appointments_tenant_select" ON appointments;
DROP POLICY IF EXISTS "appointments_tenant_insert" ON appointments;
DROP POLICY IF EXISTS "appointments_tenant_update" ON appointments;
DROP POLICY IF EXISTS "appointments_tenant_delete" ON appointments;
DROP POLICY IF EXISTS "company_members_appointments" ON appointments;

CREATE POLICY "appointments_tenant_select" ON appointments
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

CREATE POLICY "appointments_tenant_insert" ON appointments
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "appointments_tenant_update" ON appointments
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "appointments_tenant_delete" ON appointments
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ── Re-confirm notifications policies ─────────────────────────────────────
DROP POLICY IF EXISTS "notifications_tenant_select" ON notifications;
DROP POLICY IF EXISTS "notifications_tenant_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_tenant_update" ON notifications;
DROP POLICY IF EXISTS "notifications_tenant_delete" ON notifications;

CREATE POLICY "notifications_tenant_select" ON notifications
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

CREATE POLICY "notifications_tenant_insert" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "notifications_tenant_update" ON notifications
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "notifications_tenant_delete" ON notifications
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());
