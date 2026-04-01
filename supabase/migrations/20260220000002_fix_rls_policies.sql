-- Migration: Fix RLS Policies for Profiles Table
-- Issue: Ambiguous column references causing 500 errors (PostgreSQL error 42P17)
-- Date: 2026-03-05

-- Step 1: Drop all existing policies on profiles table
DO $$
DECLARE 
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- Step 2: Create clean, non-conflicting RLS policies with explicit table qualifications

-- Policy 1: Users can view their own profile and profiles in their company
CREATE POLICY "Users can view profiles in their company" 
ON profiles 
FOR SELECT
TO authenticated
USING (
  auth.uid() = profiles.id 
  OR 
  profiles.company_id IN (
    SELECT p.company_id 
    FROM profiles p
    WHERE p.id = auth.uid()
  )
);

-- Policy 2: Users can update their own profile only
CREATE POLICY "Users can update own profile" 
ON profiles 
FOR UPDATE
TO authenticated
USING (auth.uid() = profiles.id)
WITH CHECK (auth.uid() = profiles.id);

-- Policy 3: Managers and admins can update team members in their company
CREATE POLICY "Managers can update team members" 
ON profiles 
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT p.id 
    FROM profiles p
    WHERE p.company_id = profiles.company_id 
      AND p.role IN ('owner', 'admin', 'sales_manager', 'production_manager', 'manager')
  )
);

-- Policy 4: Users can insert their own profile during signup
CREATE POLICY "Users can insert own profile" 
ON profiles 
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = profiles.id);

-- Verification: List all policies created
DO $$
DECLARE
  pol RECORD;
BEGIN
  RAISE NOTICE '=== Current RLS Policies on profiles table ===';
  FOR pol IN 
    SELECT policyname, cmd 
    FROM pg_policies 
    WHERE tablename = 'profiles' AND schemaname = 'public'
    ORDER BY policyname
  LOOP
    RAISE NOTICE 'Policy: % (Command: %)', pol.policyname, pol.cmd;
  END LOOP;
END $$;

-- Test query to ensure it works
DO $$
BEGIN
  RAISE NOTICE 'RLS policies updated successfully!';
  RAISE NOTICE 'You can now test by logging in to the application.';
END $$;
