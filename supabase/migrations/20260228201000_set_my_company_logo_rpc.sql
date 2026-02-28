-- Reliable company logo setter for tenant-safe fallback writes.

CREATE OR REPLACE FUNCTION public.set_my_company_logo(p_logo_url text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_logo_url text;
BEGIN
  SELECT public.get_my_company_id() INTO v_company_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No company context available for current user';
  END IF;

  UPDATE public.companies
  SET logo_url = p_logo_url,
      updated_at = now()
  WHERE id = v_company_id
  RETURNING logo_url INTO v_logo_url;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company record not found for current user';
  END IF;

  RETURN v_logo_url;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_company_logo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_company_logo(text) TO authenticated;
