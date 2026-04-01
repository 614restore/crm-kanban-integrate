-- EMERGENCY FIX: Data Not Loading - RLS Issue
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- ============================================================================
-- STEP 1: Check if RLS is blocking your data
-- ============================================================================

-- Check RLS status on all tables
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('companies', 'contacts', 'profiles', 'appointments', 'invoices', 'estimates', 'projects')
ORDER BY tablename;

-- ============================================================================
-- STEP 2: Check if your data actually exists
-- ============================================================================

-- Count records in each table (bypasses RLS)
SELECT 'companies' as table_name, COUNT(*) as record_count FROM companies
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'appointments', COUNT(*) FROM appointments
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'estimates', COUNT(*) FROM estimates
UNION ALL
SELECT 'projects', COUNT(*) FROM projects;

-- ============================================================================
-- STEP 3: Check your profile and company_id
-- ============================================================================

-- Find your profile (replace with your email)
SELECT 
  id as user_id,
  email,
  first_name,
  last_name,
  company_id,
  role
FROM profiles 
WHERE email = 'YOUR_EMAIL_HERE';  -- REPLACE THIS

-- ============================================================================
-- STEP 4: TEMPORARY FIX - Disable RLS (for testing only)
-- ============================================================================

-- WARNING: This removes security temporarily to test if RLS is the issue
-- Only do this on development/test databases, NOT production

ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE estimates DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE communications DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_boards DISABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_columns DISABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE automations DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: If data loads after disabling RLS, add proper policies
-- ============================================================================

-- Enable RLS back (after confirming data loads)
-- ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
-- etc...

-- Then add proper policies:

-- Policy for companies table
CREATE POLICY "Users can view their own company" ON companies
  FOR SELECT
  USING (
    id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own company" ON companies
  FOR UPDATE
  USING (
    id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy for contacts table
CREATE POLICY "Users can view contacts in their company" ON contacts
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy for profiles table
CREATE POLICY "Users can view profiles in their company" ON profiles
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Repeat similar policies for other tables...

-- ============================================================================
-- STEP 6: Alternative - Use RPC functions (bypasses RLS)
-- ============================================================================

-- Create RPC function to get company (already exists in your schema)
CREATE OR REPLACE FUNCTION get_my_company()
RETURNS SETOF companies
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM companies 
  WHERE id = (SELECT company_id FROM profiles WHERE id = auth.uid());
$$;

-- Create RPC function to update company
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
RETURNS companies
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_result companies;
BEGIN
  -- Get user's company_id
  SELECT company_id INTO v_company_id
  FROM profiles
  WHERE id = auth.uid();

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User has no company_id';
  END IF;

  -- Update company
  UPDATE companies
  SET
    name = COALESCE(p_name, name),
    phone = COALESCE(p_phone, phone),
    email = COALESCE(p_email, email),
    website = COALESCE(p_website, website),
    address = COALESCE(p_address, address),
    city = COALESCE(p_city, city),
    state = COALESCE(p_state, state),
    zip = COALESCE(p_zip, zip),
    logo_url = COALESCE(p_logo_url, logo_url),
    tagline = COALESCE(p_tagline, tagline),
    contractor_license = COALESCE(p_contractor_license, contractor_license),
    tax_id = COALESCE(p_tax_id, tax_id),
    from_email = COALESCE(p_from_email, from_email),
    from_name = COALESCE(p_from_name, from_name),
    updated_at = NOW()
  WHERE id = v_company_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_my_company() TO authenticated;
GRANT EXECUTE ON FUNCTION update_my_company(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
