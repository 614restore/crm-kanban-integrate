-- ============================================================================
-- CRITICAL: Execute this SQL in Supabase SQL Editor to fix 500 errors
-- ============================================================================
-- Copy this entire script and paste it into Supabase → SQL Editor → New Query
-- Then click "Run"
-- ============================================================================

-- Step 1: Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view profiles in their company" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Managers can update team members" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Step 3: Create NEW policies with explicit table references

-- Policy 1: Users can SELECT their own profile + team profiles
CREATE POLICY "select_own_and_team_profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  profiles.id = auth.uid()
  OR
  profiles.company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

-- Policy 2: Users can UPDATE only their own profile
CREATE POLICY "update_own_profile"
ON profiles FOR UPDATE
TO authenticated
USING (profiles.id = auth.uid())
WITH CHECK (profiles.id = auth.uid());

-- Policy 3: Users can INSERT only their own profile (signup)
CREATE POLICY "insert_own_profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Step 4: Verify policies are applied
SELECT 
  policyname,
  qual,
  with_check,
  cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
