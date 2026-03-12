-- Add extended company profile fields for document templates and email settings
-- These columns allow company info to auto-populate into professional documents

ALTER TABLE companies ADD COLUMN IF NOT EXISTS tagline TEXT DEFAULT '';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contractor_license TEXT DEFAULT '';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tax_id TEXT DEFAULT '';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS from_email TEXT DEFAULT '';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS from_name TEXT DEFAULT '';

-- Ensure the update_my_company RPC accepts the new columns
CREATE OR REPLACE FUNCTION update_my_company(
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_zip TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_tagline TEXT DEFAULT NULL,
  p_contractor_license TEXT DEFAULT NULL,
  p_tax_id TEXT DEFAULT NULL,
  p_from_email TEXT DEFAULT NULL,
  p_from_name TEXT DEFAULT NULL
)
RETURNS SETOF companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT company_id INTO v_company_id
    FROM profiles
   WHERE id = auth.uid();

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No company found for current user';
  END IF;

  RETURN QUERY
  UPDATE companies SET
    name              = COALESCE(p_name, name),
    phone             = COALESCE(p_phone, phone),
    email             = COALESCE(p_email, email),
    website           = COALESCE(p_website, website),
    address           = COALESCE(p_address, address),
    city              = COALESCE(p_city, city),
    state             = COALESCE(p_state, state),
    zip               = COALESCE(p_zip, zip),
    logo_url          = COALESCE(p_logo_url, logo_url),
    tagline           = COALESCE(p_tagline, tagline),
    contractor_license = COALESCE(p_contractor_license, contractor_license),
    tax_id            = COALESCE(p_tax_id, tax_id),
    from_email        = COALESCE(p_from_email, from_email),
    from_name         = COALESCE(p_from_name, from_name),
    updated_at        = NOW()
  WHERE id = v_company_id
  RETURNING *;
END;
$$;
