-- Trigger to automatically create profile when user signs up
-- This ensures every auth.users entry has a corresponding profiles entry

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
  v_company_name TEXT;
BEGIN
  -- Use provided company_name from metadata, or fall back to email-derived name
  v_company_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''),
    SPLIT_PART(NEW.email, '@', 1) || '''s Company'
  );

  -- Create a company for the new user
  INSERT INTO public.companies (name, email)
  VALUES (v_company_name, NEW.email)
  RETURNING id INTO v_company_id;

  -- Create the profile with the new company
  INSERT INTO public.profiles (id, email, company_id, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    v_company_id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- If anything fails, log it but don't block user creation
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Also create default lead sources for new companies
CREATE OR REPLACE FUNCTION public.handle_new_company()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default lead sources
  INSERT INTO public.lead_sources (company_id, name, is_custom)
  VALUES 
    (NEW.id, 'Website', false),
    (NEW.id, 'Referral', false),
    (NEW.id, 'Google Ads', false),
    (NEW.id, 'Social Media', false),
    (NEW.id, 'Direct Mail', false)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't block company creation if lead sources fail
    RAISE WARNING 'Error creating default lead sources: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS on_company_created ON companies;

-- Create the trigger
CREATE TRIGGER on_company_created
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_company();

-- Success message
SELECT '✅ Signup triggers installed! New users will automatically get a company and profile.' as status;
