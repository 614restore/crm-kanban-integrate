-- Ensure company names are human-readable and never stored as raw emails.

-- Backfill existing company names that look like emails.
UPDATE public.companies
SET name =
  trim(
    initcap(
      replace(replace(replace(split_part(name, '@', 1), '.', ' '), '_', ' '), '-', ' ')
    )
  ) || ' Company',
  updated_at = now()
WHERE name IS NOT NULL
  AND name ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$';

-- Keep signup trigger defaults aligned with clean company naming.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
  v_company_base text;
BEGIN
  v_company_base := COALESCE(split_part(NEW.email, '@', 1), 'My');
  v_company_base := trim(replace(replace(replace(v_company_base, '.', ' '), '_', ' '), '-', ' '));

  INSERT INTO public.companies (name, email)
  VALUES (
    initcap(COALESCE(NULLIF(v_company_base, ''), 'My')) || ' Company',
    NEW.email
  )
  RETURNING id INTO v_company_id;

  INSERT INTO public.profiles (id, email, company_id, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    v_company_id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'owner')
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
