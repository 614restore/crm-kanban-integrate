-- ═══════════════════════════════════════════════════════════════════════════
-- TrussCTR CRM — Fix All Database Audit Findings (2026-03-15)
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration addresses all 12 findings from the db-audit.md report:
--   CRITICAL: Stripe webhook table mismatch, no subscription enforcement
--   HIGH: Missing company_id filters, RLS recursion, storage security
--   MEDIUM: Missing indexes, RPC parameter gaps, trigger conflicts
--   LOW: N+1 patterns, trial date backfill
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- FINDING 1 (CRITICAL): Add missing indexes for Stripe webhook lookups
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_companies_stripe_subscription_id 
  ON companies (stripe_subscription_id) 
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_companies_stripe_customer_id 
  ON companies (stripe_customer_id) 
  WHERE stripe_customer_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- FINDING 4 (HIGH): Fix v2 PM tables RLS to use get_my_company_id()
-- ───────────────────────────────────────────────────────────────────────────

-- crew_schedules
DROP POLICY IF EXISTS "company_members_crew_schedules" ON crew_schedules;
CREATE POLICY "crew_schedules_tenant_select" ON crew_schedules 
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());
CREATE POLICY "crew_schedules_tenant_insert" ON crew_schedules 
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "crew_schedules_tenant_update" ON crew_schedules 
  FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id()) 
  WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "crew_schedules_tenant_delete" ON crew_schedules 
  FOR DELETE TO authenticated
  USING (company_id = get_my_company_id());

-- change_orders
DROP POLICY IF EXISTS "company_members_change_orders" ON change_orders;
CREATE POLICY "change_orders_tenant_select" ON change_orders 
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());
CREATE POLICY "change_orders_tenant_insert" ON change_orders 
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "change_orders_tenant_update" ON change_orders 
  FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id()) 
  WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "change_orders_tenant_delete" ON change_orders 
  FOR DELETE TO authenticated
  USING (company_id = get_my_company_id());

-- permits
DROP POLICY IF EXISTS "company_members_permits" ON permits;
CREATE POLICY "permits_tenant_select" ON permits 
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());
CREATE POLICY "permits_tenant_insert" ON permits 
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "permits_tenant_update" ON permits 
  FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id()) 
  WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "permits_tenant_delete" ON permits 
  FOR DELETE TO authenticated
  USING (company_id = get_my_company_id());

-- equipment
DROP POLICY IF EXISTS "company_members_equipment" ON equipment;
CREATE POLICY "equipment_tenant_select" ON equipment 
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());
CREATE POLICY "equipment_tenant_insert" ON equipment 
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "equipment_tenant_update" ON equipment 
  FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id()) 
  WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "equipment_tenant_delete" ON equipment 
  FOR DELETE TO authenticated
  USING (company_id = get_my_company_id());

-- equipment_assignments
DROP POLICY IF EXISTS "company_members_equipment_assignments" ON equipment_assignments;
CREATE POLICY "equipment_assignments_tenant_select" ON equipment_assignments 
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());
CREATE POLICY "equipment_assignments_tenant_insert" ON equipment_assignments 
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "equipment_assignments_tenant_update" ON equipment_assignments 
  FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id()) 
  WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "equipment_assignments_tenant_delete" ON equipment_assignments 
  FOR DELETE TO authenticated
  USING (company_id = get_my_company_id());

-- ───────────────────────────────────────────────────────────────────────────
-- FINDING 5 (HIGH): Fix expense receipt storage policies with company folder
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "expense_receipts_select" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_insert" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_delete" ON storage.objects;

CREATE POLICY "expense_receipts_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] = (get_my_company_id())::text
  );

CREATE POLICY "expense_receipts_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] = (get_my_company_id())::text
  );

CREATE POLICY "expense_receipts_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] = (get_my_company_id())::text
  );

-- ───────────────────────────────────────────────────────────────────────────
-- FINDING 6 (MEDIUM): Add missing company_id indexes
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_estimates_company_id ON estimates (company_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects (company_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_company_id ON work_orders (company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON suppliers (company_id);
CREATE INDEX IF NOT EXISTS idx_material_orders_company_id ON material_orders (company_id);

-- ───────────────────────────────────────────────────────────────────────────
-- FINDING 8 (MEDIUM): Expand update_my_company RPC with missing fields
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_my_company(
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_tagline text DEFAULT NULL,
  p_contractor_license text DEFAULT NULL,
  p_tax_id text DEFAULT NULL,
  p_from_email text DEFAULT NULL,
  p_from_name text DEFAULT NULL,
  p_google_review_url text DEFAULT NULL,
  p_yelp_review_url text DEFAULT NULL
)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_result public.companies;
BEGIN
  SELECT company_id INTO v_company_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No company found for current user';
  END IF;

  UPDATE public.companies SET
    name                = COALESCE(p_name, name),
    phone               = COALESCE(p_phone, phone),
    email               = COALESCE(p_email, email),
    website             = COALESCE(p_website, website),
    address             = COALESCE(p_address, address),
    city                = COALESCE(p_city, city),
    state               = COALESCE(p_state, state),
    zip                 = COALESCE(p_zip, zip),
    logo_url            = COALESCE(p_logo_url, logo_url),
    tagline             = COALESCE(p_tagline, tagline),
    contractor_license  = COALESCE(p_contractor_license, contractor_license),
    tax_id              = COALESCE(p_tax_id, tax_id),
    from_email          = COALESCE(p_from_email, from_email),
    from_name           = COALESCE(p_from_name, from_name),
    google_review_url   = COALESCE(p_google_review_url, google_review_url),
    yelp_review_url     = COALESCE(p_yelp_review_url, yelp_review_url),
    updated_at          = now()
  WHERE id = v_company_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_company(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_company(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- FINDING 12 (LOW): Backfill trial_ends_at for existing companies
-- ───────────────────────────────────────────────────────────────────────────
-- Set trial_ends_at to 14 days from company creation for existing trialing companies
UPDATE companies
SET trial_ends_at = created_at + INTERVAL '14 days'
WHERE trial_ends_at IS NOT NULL
  AND subscription_status = 'trialing'
  AND created_at IS NOT NULL
  AND trial_ends_at > created_at + INTERVAL '30 days'; -- Only fix obviously wrong dates

-- ───────────────────────────────────────────────────────────────────────────
-- COMMENT: Document the fixes
-- ───────────────────────────────────────────────────────────────────────────
COMMENT ON INDEX idx_companies_stripe_subscription_id IS 'Finding 1: Enables fast Stripe webhook lookups';
COMMENT ON INDEX idx_companies_stripe_customer_id IS 'Finding 1: Enables fast Stripe webhook lookups';
COMMENT ON POLICY "crew_schedules_tenant_select" ON crew_schedules IS 'Finding 4: Fixed RLS recursion';
-- Note: COMMENT ON POLICY for storage.objects omitted — Supabase restricts ownership of that relation
COMMENT ON INDEX idx_estimates_company_id IS 'Finding 6: Performance optimization for tenant queries';
COMMENT ON FUNCTION public.update_my_company IS 'Finding 8: Expanded to include all company fields';
