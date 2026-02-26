-- Add secure RPC for "Start fresh workspace" to avoid RLS insert restriction loops.

CREATE OR REPLACE FUNCTION public.start_fresh_workspace()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_company_name text;
  v_new_company_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.email
  INTO v_email
  FROM public.profiles p
  WHERE p.id = v_uid
  LIMIT 1;

  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    v_email := 'user-' || v_uid::text || '@example.com';
  END IF;

  v_company_name := split_part(v_email, '@', 1) || '''s Company';

  INSERT INTO public.companies (
    name,
    email,
    phone,
    address,
    city,
    state,
    zip,
    website
  )
  VALUES (
    v_company_name,
    v_email,
    '',
    '',
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO v_new_company_id;

  UPDATE public.profiles
  SET company_id = v_new_company_id,
      updated_at = now()
  WHERE id = v_uid;

  RETURN v_new_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_fresh_workspace() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_fresh_workspace() TO authenticated;
