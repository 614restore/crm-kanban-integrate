-- ============================================================================
-- DIAGNOSTIC: Check Team Members in Supabase
-- ============================================================================
-- Run this in Supabase → SQL Editor to see if team members exist
-- ============================================================================

-- 1. Check your user profile and company_id
SELECT 
  id as user_id,
  email,
  first_name,
  last_name,
  role,
  company_id,
  is_active,
  created_at
FROM profiles
WHERE id = auth.uid();

-- 2. Check ALL profiles in your company
SELECT 
  id,
  email,
  first_name,
  last_name,
  role,
  company_id,
  department,
  is_active,
  created_at
FROM profiles
WHERE company_id = (
  SELECT company_id FROM profiles WHERE id = auth.uid()
)
ORDER BY first_name;

-- 3. Check if RLS policies are working
SELECT 
  COUNT(*) as total_team_members,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_members,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_members
FROM profiles
WHERE company_id = (
  SELECT company_id FROM profiles WHERE id = auth.uid()
);

-- 4. Verify RLS policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 5. Test if the query the app uses works
SELECT *
FROM profiles
WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
ORDER BY first_name;

-- ============================================================================
-- EXPECTED RESULTS:
-- ============================================================================
-- Query 1: Should show YOUR profile with a company_id
-- Query 2: Should show ALL team members including yourself
-- Query 3: Should show counts > 0
-- Query 4: Should show the RLS policies created by migration 002
-- Query 5: Should return the same as Query 2 (this is what the app queries)
--
-- If any query returns 0 rows or errors, that's the problem!
-- ============================================================================
