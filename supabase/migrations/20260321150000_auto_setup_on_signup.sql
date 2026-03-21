-- Auto-create company + default data for any new user on signup.
-- This makes mobile signups fully functional on the web app without any
-- mobile-side code changes. The web app's ensureUserHasCompany() still
-- runs but is a no-op when company_id is already set.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id uuid;
  v_company_name text;
BEGIN
  -- 1. Upsert profile row (trigger may fire before email confirmation)
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

  -- 2. If a company_id was passed in metadata (team member joining), link and stop
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

  -- 4. Derive a company name from metadata or email
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

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user error for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger (function is already replaced above)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS
  'Runs on every new auth.users row. Creates profile + company + lead sources
   automatically so mobile signups work on the web app without extra setup calls.';
