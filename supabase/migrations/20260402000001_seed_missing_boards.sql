-- Add Production and Billing boards for all existing companies
-- This completes the 4-board setup: Retail, Insurance, Production, Billing

-- First, update the function to create all 4 boards
CREATE OR REPLACE FUNCTION public.create_default_boards_for_company(p_company_id uuid)
RETURNS void AS $$
DECLARE
  v_retail_board_id uuid;
  v_insurance_board_id uuid;
  v_production_board_id uuid;
  v_billing_board_id uuid;
BEGIN
  -- Check if boards already exist to avoid duplicates
  IF EXISTS (SELECT 1 FROM public.kanban_boards WHERE company_id = p_company_id AND type = 'production') AND
     EXISTS (SELECT 1 FROM public.kanban_boards WHERE company_id = p_company_id AND type = 'billing') THEN
    RETURN; -- Already has all boards
  END IF;

  -- Retail / Cash-Job Pipeline (if doesn't exist)
  IF NOT EXISTS (SELECT 1 FROM public.kanban_boards WHERE company_id = p_company_id AND name LIKE '%Retail%') THEN
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
      (v_retail_board_id, 'Retail (Cash Job)',          'retail',        '#a855f7', 7),
      (v_retail_board_id, 'Lost',                       'lost',          '#ef4444', 8);
  END IF;

  -- Insurance / Claims Pipeline (if doesn't exist)
  IF NOT EXISTS (SELECT 1 FROM public.kanban_boards WHERE company_id = p_company_id AND name LIKE '%Insurance%') THEN
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
      (v_insurance_board_id, 'Lost',                       'lost',                 '#ef4444', 8);
  END IF;

  -- Production Board (NEW)
  INSERT INTO public.kanban_boards (company_id, name, type, visible_to, is_default)
  VALUES (p_company_id, 'Production Board', 'production',
          ARRAY['owner','manager','admin','production'], true)
  RETURNING id INTO v_production_board_id;

  INSERT INTO public.kanban_columns (board_id, title, status, color, sort_order) VALUES
    (v_production_board_id, 'Ordering Materials',      'ordering_material', '#f59e0b', 0),
    (v_production_board_id, 'Materials Received',      'materials_ready',   '#8b5cf6', 1),
    (v_production_board_id, 'Scheduled',               'scheduled',         '#3b82f6', 2),
    (v_production_board_id, 'In Progress',             'in_progress',       '#06b6d4', 3),
    (v_production_board_id, 'Build Phase',             'build_phase',       '#14b8a6', 4),
    (v_production_board_id, 'Punch List',              'cleanup',           '#f97316', 5),
    (v_production_board_id, 'Completed',               'completed',         '#22c55e', 6);

  -- Billing Board (NEW)
  INSERT INTO public.kanban_boards (company_id, name, type, visible_to, is_default)
  VALUES (p_company_id, 'Billing Board', 'billing',
          ARRAY['owner','manager','admin','billing'], true)
  RETURNING id INTO v_billing_board_id;

  INSERT INTO public.kanban_columns (board_id, title, status, color, sort_order) VALUES
    (v_billing_board_id, 'Ready for Invoicing',   'invoicing',        '#f59e0b', 0),
    (v_billing_board_id, 'Invoice Sent',          'invoice_sent',     '#8b5cf6', 1),
    (v_billing_board_id, 'Payment Pending',       'pending_payment',  '#06b6d4', 2),
    (v_billing_board_id, 'Paid',                  'paid',             '#22c55e', 3),
    (v_billing_board_id, 'Collection',            'collection',       '#ef4444', 4);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add Production and Billing boards to all existing companies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT c.id
    FROM public.companies c
    WHERE c.id IS NOT NULL
  LOOP
    -- Only add Production board if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM public.kanban_boards WHERE company_id = r.id AND type = 'production') THEN
      INSERT INTO public.kanban_boards (company_id, name, type, visible_to, is_default)
      VALUES (r.id, 'Production Board', 'production',
              ARRAY['owner','manager','admin','production'], true);
      
      INSERT INTO public.kanban_columns (board_id, title, status, color, sort_order) 
      SELECT 
        kb.id,
        col.title,
        col.status,
        col.color,
        col.sort_order
      FROM public.kanban_boards kb,
      (VALUES 
        ('Ordering Materials', 'ordering_material', '#f59e0b', 0),
        ('Materials Received', 'materials_ready', '#8b5cf6', 1),
        ('Scheduled', 'scheduled', '#3b82f6', 2),
        ('In Progress', 'in_progress', '#06b6d4', 3),
        ('Build Phase', 'build_phase', '#14b8a6', 4),
        ('Punch List', 'cleanup', '#f97316', 5),
        ('Completed', 'completed', '#22c55e', 6)
      ) AS col(title, status, color, sort_order)
      WHERE kb.company_id = r.id AND kb.type = 'production';
    END IF;

    -- Only add Billing board if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM public.kanban_boards WHERE company_id = r.id AND type = 'billing') THEN
      INSERT INTO public.kanban_boards (company_id, name, type, visible_to, is_default)
      VALUES (r.id, 'Billing Board', 'billing',
              ARRAY['owner','manager','admin','billing'], true);
      
      INSERT INTO public.kanban_columns (board_id, title, status, color, sort_order)
      SELECT 
        kb.id,
        col.title,
        col.status,
        col.color,
        col.sort_order
      FROM public.kanban_boards kb,
      (VALUES 
        ('Ready for Invoicing', 'invoicing', '#f59e0b', 0),
        ('Invoice Sent', 'invoice_sent', '#8b5cf6', 1),
        ('Payment Pending', 'pending_payment', '#06b6d4', 2),
        ('Paid', 'paid', '#22c55e', 3),
        ('Collection', 'collection', '#ef4444', 4)
      ) AS col(title, status, color, sort_order)
      WHERE kb.company_id = r.id AND kb.type = 'billing';
    END IF;

  END LOOP;
END;
$$;