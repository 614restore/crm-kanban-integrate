-- Add Production Board and Billing Board to all companies.
-- The 20260325000001 migration only created Retail + Insurance boards.
-- This migration:
--   1. Updates create_default_boards_for_company to create all 4 boards.
--   2. Backfills Production + Billing boards for companies that already
--      have the 2-board set but are missing the new ones.

-- ── Helper: create all four default boards for a given company ────────────────
CREATE OR REPLACE FUNCTION public.create_default_boards_for_company(p_company_id uuid)
RETURNS void AS $$
DECLARE
  v_retail_board_id     uuid;
  v_insurance_board_id  uuid;
  v_production_board_id uuid;
  v_billing_board_id    uuid;
BEGIN
  -- ── Retail / Cash-Job Pipeline ──────────────────────────────────────────────
  INSERT INTO public.kanban_boards (company_id, name, type, visible_to, is_default)
  VALUES (p_company_id, 'Retail Pipeline (Cash Jobs)', 'sales',
          ARRAY['owner','manager','admin','sales'], true)
  RETURNING id INTO v_retail_board_id;

  INSERT INTO public.kanban_columns (board_id, title, status, color, sort_order) VALUES
    (v_retail_board_id, 'New Lead',                   'prospect',      '#94a3b8', 0),
    (v_retail_board_id, 'Contacted / Qualifying',     'lead',          '#6366f1', 1),
    (v_retail_board_id, 'Inspection Scheduled',       'appt_set',      '#8b5cf6', 2),
    (v_retail_board_id, 'Estimating',                 'estimating',    '#0ea5e9', 3),
    (v_retail_board_id, 'Estimate Sent',              'estimate_sent', '#a855f7', 4),
    (v_retail_board_id, 'Follow-up / Negotiation',   'contingency',   '#f59e0b', 5),
    (v_retail_board_id, 'Sold / Ready for Production','signed',        '#22c55e', 6),
    (v_retail_board_id, 'Scheduled',                  'in_progress',   '#3b82f6', 7),
    (v_retail_board_id, 'In Progress',                'build_phase',   '#06b6d4', 8),
    (v_retail_board_id, 'Punch List',                 'cleanup',       '#f97316', 9),
    (v_retail_board_id, 'Completed',                  'completed',     '#10b981', 10),
    (v_retail_board_id, 'Retail (Cash Job)',          'retail',        '#a855f7', 11),
    (v_retail_board_id, 'Lost',                       'lost',          '#ef4444', 12);

  -- ── Insurance / Claims Pipeline ────────────────────────────────────────────
  INSERT INTO public.kanban_boards (company_id, name, type, visible_to, is_default)
  VALUES (p_company_id, 'Insurance Pipeline (Claims)', 'sales',
          ARRAY['owner','manager','admin','sales'], true)
  RETURNING id INTO v_insurance_board_id;

  INSERT INTO public.kanban_columns (board_id, title, status, color, sort_order) VALUES
    (v_insurance_board_id, 'New Lead (Damage Report)',   'prospect',             '#94a3b8', 0),
    (v_insurance_board_id, 'Inspection Scheduled',       'appt_set',             '#6366f1', 1),
    (v_insurance_board_id, 'Inspection & Authorization', 'claim_filed',          '#8b5cf6', 2),
    (v_insurance_board_id, 'Adjuster Scheduled',         'adjuster_scheduled',   '#7c3aed', 3),
    (v_insurance_board_id, 'Initial Estimate Review',    'inspection_completed', '#06b6d4', 4),
    (v_insurance_board_id, 'Supplement Filed',           'supplement_filed',     '#f59e0b', 5),
    (v_insurance_board_id, 'Approved / Final Scope',     'approved',             '#14b8a6', 6),
    (v_insurance_board_id, 'Sold / Ready for Production','signed',               '#22c55e', 7),
    (v_insurance_board_id, 'Scheduled',                  'in_progress',          '#3b82f6', 8),
    (v_insurance_board_id, 'In Progress',                'build_phase',          '#06b6d4', 9),
    (v_insurance_board_id, 'Punch List',                 'cleanup',              '#f97316', 10),
    (v_insurance_board_id, 'Completed',                  'completed',            '#10b981', 11),
    (v_insurance_board_id, 'Lost',                       'lost',                 '#ef4444', 12);

  -- ── Production Board ───────────────────────────────────────────────────────
  INSERT INTO public.kanban_boards (company_id, name, type, visible_to, is_default)
  VALUES (p_company_id, 'Production Board', 'production',
          ARRAY['owner','manager','admin','production'], true)
  RETURNING id INTO v_production_board_id;

  INSERT INTO public.kanban_columns (board_id, title, status, color, sort_order) VALUES
    (v_production_board_id, 'Sold / New',         'signed',           '#22c55e', 0),
    (v_production_board_id, 'Ordering Material',  'ordering_material','#0ea5e9', 1),
    (v_production_board_id, 'Scheduled',          'in_progress',      '#3b82f6', 2),
    (v_production_board_id, 'In Progress',        'build_phase',      '#06b6d4', 3),
    (v_production_board_id, 'Punch List',         'cleanup',          '#f97316', 4),
    (v_production_board_id, 'Completed',          'completed',        '#10b981', 5);

  -- ── Billing Board ─────────────────────────────────────────────────────────
  INSERT INTO public.kanban_boards (company_id, name, type, visible_to, is_default)
  VALUES (p_company_id, 'Billing Board', 'billing',
          ARRAY['owner','manager','admin','billing'], true)
  RETURNING id INTO v_billing_board_id;

  INSERT INTO public.kanban_columns (board_id, title, status, color, sort_order) VALUES
    (v_billing_board_id, 'Incoming Job',      'cleanup',          '#f97316', 0),
    (v_billing_board_id, 'Scheduled Job',     'in_progress',      '#3b82f6', 1),
    (v_billing_board_id, 'In Progress',       'build_phase',      '#06b6d4', 2),
    (v_billing_board_id, 'Complete',          'completed',        '#10b981', 3),
    (v_billing_board_id, 'Invoicing',         'invoicing',        '#8b5cf6', 4),
    (v_billing_board_id, 'Pending Payment',   'pending_payment',  '#f59e0b', 5),
    (v_billing_board_id, 'Paid & Closed',     'completed',        '#22c55e', 6);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Backfill: add Production + Billing boards to companies that have the ──────
-- 2-board set (Retail + Insurance) but are missing Production and/or Billing.
DO $$
DECLARE
  r RECORD;
  v_production_board_id uuid;
  v_billing_board_id    uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT kb.company_id
    FROM public.kanban_boards kb
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_boards b2
      WHERE b2.company_id = kb.company_id
        AND b2.name = 'Production Board'
    )
  LOOP
    -- Add Production Board
    INSERT INTO public.kanban_boards (company_id, name, type, visible_to, is_default)
    VALUES (r.company_id, 'Production Board', 'production',
            ARRAY['owner','manager','admin','production'], true)
    RETURNING id INTO v_production_board_id;

    INSERT INTO public.kanban_columns (board_id, title, status, color, sort_order) VALUES
      (v_production_board_id, 'Sold / New',         'signed',           '#22c55e', 0),
      (v_production_board_id, 'Ordering Material',  'ordering_material','#0ea5e9', 1),
      (v_production_board_id, 'Scheduled',          'in_progress',      '#3b82f6', 2),
      (v_production_board_id, 'In Progress',        'build_phase',      '#06b6d4', 3),
      (v_production_board_id, 'Punch List',         'cleanup',          '#f97316', 4),
      (v_production_board_id, 'Completed',          'completed',        '#10b981', 5);
  END LOOP;

  FOR r IN
    SELECT DISTINCT kb.company_id
    FROM public.kanban_boards kb
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_boards b2
      WHERE b2.company_id = kb.company_id
        AND b2.name = 'Billing Board'
    )
  LOOP
    -- Add Billing Board
    INSERT INTO public.kanban_boards (company_id, name, type, visible_to, is_default)
    VALUES (r.company_id, 'Billing Board', 'billing',
            ARRAY['owner','manager','admin','billing'], true)
    RETURNING id INTO v_billing_board_id;

    INSERT INTO public.kanban_columns (board_id, title, status, color, sort_order) VALUES
      (v_billing_board_id, 'Incoming Job',      'cleanup',          '#f97316', 0),
      (v_billing_board_id, 'Scheduled Job',     'in_progress',      '#3b82f6', 1),
      (v_billing_board_id, 'In Progress',       'build_phase',      '#06b6d4', 2),
      (v_billing_board_id, 'Complete',          'completed',        '#10b981', 3),
      (v_billing_board_id, 'Invoicing',         'invoicing',        '#8b5cf6', 4),
      (v_billing_board_id, 'Pending Payment',   'pending_payment',  '#f59e0b', 5),
      (v_billing_board_id, 'Paid & Closed',     'completed',        '#22c55e', 6);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.create_default_boards_for_company IS
  'Creates all four default kanban boards (Retail, Insurance, Production, Billing) for a
   company, including role-scoped visibility so each team sees the right board.';
