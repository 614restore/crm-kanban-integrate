-- Migration: 20260401000001_fix_remaining_rls_and_indexes.sql
--
-- Covers findings not addressed by 20260315000001_fix_all_audit_findings.sql:
--
-- B01 (partial): company_integrations was the only table still using the banned
--   "SELECT company_id FROM profiles WHERE id = auth.uid()" pattern.
--   All other v2 PM tables (crew_schedules, change_orders, permits, equipment,
--   equipment_assignments) were fixed in the 20260315 migration.
--
-- H04 (partial): contact-level and project-level FK indexes were missing.
--   Company-level indexes were added in 20260315; these fill the gaps.

-- ─── B01: Fix recursive RLS on company_integrations ─────────────────────────

DROP POLICY IF EXISTS "company_members_read_integrations"  ON company_integrations;
DROP POLICY IF EXISTS "company_admins_write_integrations"  ON company_integrations;

CREATE POLICY "company_integrations_tenant_select" ON company_integrations
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

CREATE POLICY "company_integrations_tenant_insert" ON company_integrations
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "company_integrations_tenant_update" ON company_integrations
  FOR UPDATE TO authenticated
  USING  (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "company_integrations_tenant_delete" ON company_integrations
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ─── H04: Missing FK / join-column indexes ───────────────────────────────────

-- estimates → contact (used on contact detail page to load all estimates)
CREATE INDEX IF NOT EXISTS idx_estimates_contact_id
  ON estimates (contact_id);

-- projects → contact
CREATE INDEX IF NOT EXISTS idx_projects_contact_id
  ON projects (contact_id);

-- work_orders → project (used to load work orders for a project)
CREATE INDEX IF NOT EXISTS idx_work_orders_project_id
  ON work_orders (project_id);

-- material_orders → supplier
CREATE INDEX IF NOT EXISTS idx_material_orders_supplier_id
  ON material_orders (supplier_id);

-- material_orders → project
CREATE INDEX IF NOT EXISTS idx_material_orders_project_id
  ON material_orders (project_id);

-- material_order_items → order (used on every order detail fetch)
CREATE INDEX IF NOT EXISTS idx_material_order_items_order_id
  ON material_order_items (order_id);
