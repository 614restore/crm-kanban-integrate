-- ============================================================
-- FIX: Missing indexes on high-traffic tables
-- Date: 2026-03-19
--
-- Problem:
--   The tables estimates, projects, work_orders, suppliers, and
--   material_orders lack composite and covering indexes for the query
--   patterns the application actually executes. Every company-scoped
--   list query (the most common operation in a CRM) must scan the full
--   table even when a company_id + status or company_id + date compound
--   index would allow an index-only seek.
--
--   Additionally:
--     - customer_surveys has no composite index on (company_id, submitted_at)
--       despite submitted_at DESC being the natural sort for survey lists.
--     - subcontractor_crews (added in add-commission-subcontractor-20260309.sql)
--       has no indexes at all.
--     - material_orders.project_id FK (added in application layer) has no index.
--
--   All CREATE INDEX statements use IF NOT EXISTS so this migration is
--   fully idempotent and safe to re-run.
--
-- How to run:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file and click Run
--   3. Indexes are created CONCURRENTLY where noted — these are
--      non-blocking on live data. Plain CREATE INDEX is used for the
--      Supabase SQL Editor (which runs in a transaction; CONCURRENT
--      cannot run inside a transaction block).
--   4. To run non-blocking on a live database outside the editor, replace
--      CREATE INDEX IF NOT EXISTS with CREATE INDEX CONCURRENTLY IF NOT EXISTS
--      and execute each statement individually outside a transaction.
-- ============================================================

-- ============================================================
-- SUPPLIERS
-- Already have: company_id, is_active, name
-- Adding: composite for list-by-company-active pattern
-- ============================================================

-- Most supplier lists filter by company AND active status together
CREATE INDEX IF NOT EXISTS idx_suppliers_company_active
  ON suppliers(company_id, is_active);

-- Composite for searching by company + name (autocomplete / lookup)
CREATE INDEX IF NOT EXISTS idx_suppliers_company_name
  ON suppliers(company_id, name);

-- ============================================================
-- MATERIAL ORDERS
-- Already have: company_id, supplier_id, status, order_number, order_date DESC
-- Adding: composite company+status (most common filter combo),
--         company+supplier (join path used by active_suppliers_with_stats view)
-- ============================================================

-- List material orders by company filtered by status (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_material_orders_company_status
  ON material_orders(company_id, status);

-- Orders list sorted by date within a company
CREATE INDEX IF NOT EXISTS idx_material_orders_company_order_date
  ON material_orders(company_id, order_date DESC);

-- project_id FK — not present in original migration; used when projects
-- link to material orders in the application layer
CREATE INDEX IF NOT EXISTS idx_material_orders_project_id
  ON material_orders(project_id) WHERE project_id IS NOT NULL;

-- ============================================================
-- ESTIMATES
-- Already have: company_id, contact_id, status, estimate_number,
--               validity_date, created_at DESC, (company_id, estimate_number) UNIQUE
-- Adding: composite company+status (filter by pipeline stage),
--         composite company+contact_id (show all estimates for a contact),
--         company+created_at (default sort for estimate list views)
-- ============================================================

-- Estimate pipeline filter: WHERE company_id = $1 AND status = $2
CREATE INDEX IF NOT EXISTS idx_estimates_company_status
  ON estimates(company_id, status);

-- All estimates for a contact within a company
CREATE INDEX IF NOT EXISTS idx_estimates_company_contact
  ON estimates(company_id, contact_id);

-- Default sort order: newest estimates first, scoped to company
CREATE INDEX IF NOT EXISTS idx_estimates_company_created_at
  ON estimates(company_id, created_at DESC);

-- Expiry check used by pending_estimates view: company + validity_date
CREATE INDEX IF NOT EXISTS idx_estimates_company_validity
  ON estimates(company_id, validity_date);

-- ============================================================
-- PROJECTS
-- Already have: company_id, contact_id, estimate_id, status, priority,
--               project_manager_id, start_date, created_at DESC,
--               (company_id, project_number) UNIQUE
-- Adding: composite company+status (active project board),
--         company+status+priority (kanban-style filtering),
--         company+contact (customer project history)
-- ============================================================

-- Active project board: WHERE company_id = $1 AND status NOT IN (...)
CREATE INDEX IF NOT EXISTS idx_projects_company_status
  ON projects(company_id, status);

-- Priority-sorted project board within a company and status
CREATE INDEX IF NOT EXISTS idx_projects_company_status_priority
  ON projects(company_id, status, priority);

-- All projects for a contact (customer project history page)
CREATE INDEX IF NOT EXISTS idx_projects_company_contact
  ON projects(company_id, contact_id);

-- Projects sorted by start date within a company (schedule view)
CREATE INDEX IF NOT EXISTS idx_projects_company_start_date
  ON projects(company_id, start_date);

-- ============================================================
-- WORK ORDERS
-- Already have: company_id, project_id, contact_id, status, priority,
--               scheduled_date, assigned_to GIN, created_at DESC,
--               (company_id, work_order_number) UNIQUE
-- Adding: composite company+status (dispatch queue),
--         composite company+scheduled_date (scheduling calendar),
--         composite project+status (work orders per project)
-- ============================================================

-- Dispatch queue: WHERE company_id = $1 AND status = $2
CREATE INDEX IF NOT EXISTS idx_work_orders_company_status
  ON work_orders(company_id, status);

-- Scheduling calendar: WHERE company_id = $1 ORDER BY scheduled_date
CREATE INDEX IF NOT EXISTS idx_work_orders_company_scheduled_date
  ON work_orders(company_id, scheduled_date);

-- All work orders for a project, filtered by status
CREATE INDEX IF NOT EXISTS idx_work_orders_project_status
  ON work_orders(project_id, status) WHERE project_id IS NOT NULL;

-- All work orders for a contact within a company
CREATE INDEX IF NOT EXISTS idx_work_orders_company_contact
  ON work_orders(company_id, contact_id);

-- ============================================================
-- CUSTOMER SURVEYS
-- Already have: company_id, contact_id, work_order_id, submitted_at DESC
-- Adding: composite company+submitted_at (default survey list sort),
--         composite company+overall_rating (NPS/satisfaction reports)
-- ============================================================

-- Default survey list view: WHERE company_id = $1 ORDER BY submitted_at DESC
CREATE INDEX IF NOT EXISTS idx_customer_surveys_company_submitted_at
  ON customer_surveys(company_id, submitted_at DESC);

-- Satisfaction report: aggregate ratings per company
CREATE INDEX IF NOT EXISTS idx_customer_surveys_company_rating
  ON customer_surveys(company_id, overall_rating);

-- ============================================================
-- SUBCONTRACTOR CREWS
-- No indexes exist on this table (added in add-commission-subcontractor-20260309.sql)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_subcontractor_crews_company_id
  ON subcontractor_crews(company_id);

CREATE INDEX IF NOT EXISTS idx_subcontractor_crews_company_active
  ON subcontractor_crews(company_id, is_active);

-- ── Reload PostgREST schema cache ─────────────────────────────
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE 'add-missing-indexes-20260319: Index migration complete.';
  RAISE NOTICE 'Added composite indexes on: suppliers, material_orders, estimates, projects, work_orders, customer_surveys, subcontractor_crews.';
  RAISE NOTICE 'All statements used IF NOT EXISTS — safe to re-run.';
END $$;
