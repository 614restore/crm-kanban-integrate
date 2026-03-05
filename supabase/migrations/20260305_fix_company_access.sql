-- Fix company access: Create SECURITY DEFINER RPCs to bypass RLS issues
-- and clean up duplicate companies from trigger/app double-creation.

-- 1) RPC to fetch the current user's company (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_my_company()
RETURNS SETOF public.companies
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.*
  FROM public.companies c
  JOIN public.profiles p ON p.company_id = c.id
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_company() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_company() TO authenticated;

-- 2) RPC to update company (bypasses RLS)
CREATE OR REPLACE FUNCTION public.update_my_company(
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip text DEFAULT NULL,
  p_logo_url text DEFAULT NULL
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
    name       = COALESCE(p_name, name),
    phone      = COALESCE(p_phone, phone),
    email      = COALESCE(p_email, email),
    website    = COALESCE(p_website, website),
    address    = COALESCE(p_address, address),
    city       = COALESCE(p_city, city),
    state      = COALESCE(p_state, state),
    zip        = COALESCE(p_zip, zip),
    logo_url   = COALESCE(p_logo_url, logo_url),
    updated_at = now()
  WHERE id = v_company_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_company(text,text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_company(text,text,text,text,text,text,text,text,text) TO authenticated;

-- 3) Fix handle_new_user trigger to NOT auto-create a company
--    (app handles company creation in setupNewUser to avoid duplicates)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'owner')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
