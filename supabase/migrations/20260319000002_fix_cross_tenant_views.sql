-- ============================================================
-- FIX: Cross-tenant view exposure (P0 Security)
-- Date: 2026-03-19
--
-- Problem:
--   5 views in add-suppliers-orders-estimates.sql were created without
--   any company_id filter and granted SELECT TO authenticated. This means
--   any authenticated user from ANY tenant can read all other tenants'
--   suppliers, estimates, projects, and work orders — a complete
--   multi-tenant data isolation failure.
--
--   Affected views:
--     - active_suppliers_with_stats
--     - estimates_with_customer
--     - pending_estimates
--     - active_projects_with_stats
--     - work_orders_with_details
--
-- Fix:
--   Drop and recreate each view with WITH (security_invoker = true).
--   This ensures the view executes under the calling user's identity,
--   so the RLS policies on the underlying tables (suppliers, estimates,
--   projects, work_orders, contacts) are applied — restricting results
--   to the caller's own company automatically.
--
--   The blanket GRANT SELECT TO authenticated is replaced with a grant
--   to authenticated only after security_invoker is set.
--
-- How to run:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file and click Run
--   3. Verify: as a non-admin user, querying these views should only
--      return rows belonging to that user's company_id
-- ============================================================

-- ── Revoke existing blanket grants first ─────────────────────
REVOKE SELECT ON active_suppliers_with_stats FROM authenticated;
REVOKE SELECT ON estimates_with_customer FROM authenticated;
REVOKE SELECT ON pending_estimates FROM authenticated;
REVOKE SELECT ON active_projects_with_stats FROM authenticated;
REVOKE SELECT ON work_orders_with_details FROM authenticated;

-- ── Drop views ────────────────────────────────────────────────
DROP VIEW IF EXISTS active_suppliers_with_stats;
DROP VIEW IF EXISTS estimates_with_customer;
DROP VIEW IF EXISTS pending_estimates;
DROP VIEW IF EXISTS active_projects_with_stats;
DROP VIEW IF EXISTS work_orders_with_details;

-- ── Recreate: active_suppliers_with_stats ─────────────────────
-- security_invoker = true means RLS on suppliers + material_orders
-- is applied under the calling user's session — only their company's
-- rows are visible.
CREATE OR REPLACE VIEW active_suppliers_with_stats
  WITH (security_invoker = true)
AS
SELECT
  s.*,
  COUNT(mo.id)            AS order_count,
  COALESCE(SUM(mo.total), 0) AS total_ordered
FROM suppliers s
LEFT JOIN material_orders mo ON s.id = mo.supplier_id
WHERE s.is_active = true
GROUP BY s.id;

-- ── Recreate: estimates_with_customer ─────────────────────────
CREATE OR REPLACE VIEW estimates_with_customer
  WITH (security_invoker = true)
AS
SELECT
  e.*,
  c.first_name,
  c.last_name,
  c.email AS customer_email,
  c.phone AS customer_phone
FROM estimates e
JOIN contacts c ON e.contact_id = c.id;

-- ── Recreate: pending_estimates ───────────────────────────────
CREATE OR REPLACE VIEW pending_estimates
  WITH (security_invoker = true)
AS
SELECT *
FROM estimates
WHERE status IN ('sent', 'viewed')
  AND validity_date >= CURRENT_DATE;

-- ── Recreate: active_projects_with_stats ──────────────────────
CREATE OR REPLACE VIEW active_projects_with_stats
  WITH (security_invoker = true)
AS
SELECT
  p.*,
  c.first_name || ' ' || c.last_name  AS customer_name,
  c.email                              AS customer_email,
  COUNT(wo.id)                         AS work_order_count,
  COALESCE(SUM(wo.total_cost), 0)      AS total_work_order_cost,
  p.estimated_budget - p.actual_cost   AS budget_remaining
FROM projects p
JOIN contacts c ON p.contact_id = c.id
LEFT JOIN work_orders wo ON p.id = wo.project_id
WHERE p.status NOT IN ('completed', 'cancelled')
GROUP BY p.id, c.first_name, c.last_name, c.email;

-- ── Recreate: work_orders_with_details ────────────────────────
CREATE OR REPLACE VIEW work_orders_with_details
  WITH (security_invoker = true)
AS
SELECT
  wo.*,
  c.first_name || ' ' || c.last_name AS customer_name,
  c.phone                             AS customer_phone,
  p.name                              AS project_name,
  p.project_number
FROM work_orders wo
JOIN contacts c ON wo.contact_id = c.id
LEFT JOIN projects p ON wo.project_id = p.id;

-- ── Re-grant to authenticated (views now honour caller's RLS) ─
GRANT SELECT ON active_suppliers_with_stats  TO authenticated;
GRANT SELECT ON estimates_with_customer      TO authenticated;
GRANT SELECT ON pending_estimates            TO authenticated;
GRANT SELECT ON active_projects_with_stats   TO authenticated;
GRANT SELECT ON work_orders_with_details     TO authenticated;

-- ── Reload PostgREST schema cache ─────────────────────────────
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE 'fix-cross-tenant-views-20260319: All 5 views recreated with security_invoker = true.';
  RAISE NOTICE 'Cross-tenant data exposure via views is now closed.';
END $$;
