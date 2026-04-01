-- Seed default kanban boards for companies that have none.
-- Also updates handle_new_user to create boards on signup so new companies
-- always start with fully-populated boards (including the 'retail' status).

-- ── Helper: create the two default boards for a given company ────────────────
CREATE OR REPLACE FUNCTION public.create_default_boards_for_company(p_company_id uuid)
RETURNS void AS $$
DECLARE
  v_retail_board_id uuid;
  v_insurance_board_id uuid;
BEGIN
  -- Retail / Cash-Job Pipeline
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

  -- Insurance / Claims Pipeline
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Back-fill: any company that has zero boards gets the two defaults ─────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.id
    FROM public.companies c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_boards kb WHERE kb.company_id = c.id
    )
  LOOP
    PERFORM public.create_default_boards_for_company(r.id);
  END LOOP;
END;
$$;

-- ── Update handle_new_user to also create boards on signup ───────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id uuid;
  v_company_name text;
BEGIN
  -- 1. Upsert profile row
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'owner')
  )
  ON CONFLICT (id) DO UPDATE
    SET email      = EXCLUDED.email,
        first_name = CASE WHEN profiles.first_name = '' THEN EXCLUDED.first_name ELSE profiles.first_name END,
        last_name  = CASE WHEN profiles.last_name  = '' THEN EXCLUDED.last_name  ELSE profiles.last_name  END;

  -- 2. If a company_id was passed (team member joining), link and stop
  IF NEW.raw_user_meta_data->>'company_id' IS NOT NULL THEN
    UPDATE public.profiles
      SET company_id = (NEW.raw_user_meta_data->>'company_id')::uuid,
          role       = COALESCE(NEW.raw_user_meta_data->>'role', 'sales')
    WHERE id = NEW.id AND company_id IS NULL;
    RETURN NEW;
  END IF;

  -- 3. Skip if profile already linked to a company (idempotency)
  SELECT company_id INTO v_company_id
    FROM public.profiles WHERE id = NEW.id;
  IF v_company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 4. Derive a company name
  v_company_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'company_name', ''),
    SPLIT_PART(NEW.email, '@', 1) || '''s Company'
  );

  -- 5. Create the company with a 14-day trial
  INSERT INTO public.companies (name, email, subscription_plan, subscription_status, trial_ends_at)
  VALUES (
    v_company_name,
    NEW.email,
    'trial',
    'trialing',
    NOW() + INTERVAL '14 days'
  )
  RETURNING id INTO v_company_id;

  -- 6. Link company to profile
  UPDATE public.profiles
    SET company_id = v_company_id,
        role       = 'owner'
  WHERE id = NEW.id;

  -- 7. Seed default lead sources
  INSERT INTO public.lead_sources (company_id, name, is_custom)
  VALUES
    (v_company_id, 'Website',     false),
    (v_company_id, 'Referral',    false),
    (v_company_id, 'Google Ads',  false),
    (v_company_id, 'Social Media',false),
    (v_company_id, 'Direct Mail', false)
  ON CONFLICT DO NOTHING;

  -- 8. Seed default kanban boards
  PERFORM public.create_default_boards_for_company(v_company_id);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user error for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.create_default_boards_for_company IS
  'Creates the two default kanban boards (Retail + Insurance pipelines) for a company,
   including a Retail (Cash Job) column so contacts with status=retail are always visible.';

COMMENT ON FUNCTION public.handle_new_user IS
  'Runs on every new auth.users row. Creates profile + company + lead sources + default
   kanban boards automatically so both web and mobile signups are fully functional.';
