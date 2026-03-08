-- ============================================================
-- TRUSSCTR SUPABASE FULL BACKUP — 2026-03-08
-- 27 SQL files: schema, triggers, account mgmt, all migrations
-- To restore: run each section in order in Supabase SQL Editor
-- ============================================================


-- --------------------------------------------------------
-- FILE: supabase/setup.sql
-- --------------------------------------------------------
-- Complete database setup script for CRM
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (be careful in production!)
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS lead_sources CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS communications CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS kanban_columns CASCADE;
DROP TABLE IF EXISTS kanban_boards CASCADE;
DROP TABLE IF EXISTS automations CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- Companies table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'sales',
  avatar_url TEXT,
  department TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone1 TEXT,
  phone2 TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  status TEXT DEFAULT 'lead',
  lead_source TEXT,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  project_type TEXT,
  project_value DECIMAL,
  is_retail BOOLEAN DEFAULT false,
  retail_notes TEXT,
  insurance_company TEXT,
  policy_number TEXT,
  claim_number TEXT,
  adjuster_name TEXT,
  adjuster_phone TEXT,
  adjuster_email TEXT,
  deductible DECIMAL,
  deposit_amount DECIMAL,
  deposit_paid BOOLEAN DEFAULT false,
  deposit_date TIMESTAMPTZ,
  final_payment_amount DECIMAL,
  final_payment_paid BOOLEAN DEFAULT false,
  final_payment_date TIMESTAMPTZ,
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs table
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  scheduled_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  estimated_value DECIMAL,
  actual_value DECIMAL,
  assigned_team TEXT[],
  materials TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments table
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  type TEXT,
  status TEXT DEFAULT 'scheduled',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  invoice_number TEXT UNIQUE,
  amount DECIMAL NOT NULL,
  tax_amount DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice items table
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL NOT NULL,
  unit_price DECIMAL NOT NULL,
  total DECIMAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Communications table
CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  direction TEXT NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  size TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kanban boards table
CREATE TABLE kanban_boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  visible_to TEXT[],
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kanban columns table
CREATE TABLE kanban_columns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID REFERENCES kanban_boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead sources table
CREATE TABLE lead_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automations table
CREATE TABLE automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  action_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities table
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_assigned ON contacts(assigned_to);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_appointments_contact ON appointments(contact_id);
CREATE INDEX idx_appointments_company ON appointments(company_id);
CREATE INDEX idx_appointments_start ON appointments(start_time);
CREATE INDEX idx_invoices_contact ON invoices(contact_id);
CREATE INDEX idx_activities_contact ON activities(contact_id);
CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_contact ON jobs(contact_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kanban_boards_updated_at
  BEFORE UPDATE ON kanban_boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automations_updated_at
  BEFORE UPDATE ON automations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can view company profiles"
  ON profiles FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Companies policies
CREATE POLICY "Users can view their company"
  ON companies FOR SELECT
  USING (
    id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company"
  ON companies FOR UPDATE
  USING (
    id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert companies"
  ON companies FOR INSERT
  WITH CHECK (true);

-- Contacts policies
CREATE POLICY "Users can view company contacts"
  ON contacts FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert company contacts"
  ON contacts FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update company contacts"
  ON contacts FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete company contacts"
  ON contacts FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Apply same pattern for other tables
CREATE POLICY "Users can manage company appointments"
  ON appointments FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage company invoices"
  ON invoices FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage company lead sources"
  ON lead_sources FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage company activities"
  ON activities FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage company jobs"
  ON jobs FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage company communications"
  ON communications FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage company documents"
  ON documents FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage company boards"
  ON kanban_boards FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage board columns"
  ON kanban_columns FOR ALL
  USING (
    board_id IN (
      SELECT id FROM kanban_boards WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage company automations"
  ON automations FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Success message
SELECT 'Database setup complete! ✅' as status;


-- --------------------------------------------------------
-- FILE: supabase/02_triggers.sql
-- --------------------------------------------------------
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
    COALESCE(NEW.raw_user_meta_data->>'role', 'owner')
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


-- --------------------------------------------------------
-- FILE: supabase/03_account_management.sql
-- --------------------------------------------------------
-- Account management helpers
-- Run this in Supabase SQL Editor to enable client-side delete-account via RPC.

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.profiles
  WHERE id = v_user_id;

  -- Deleting auth.users cascades to profiles (profiles.id REFERENCES auth.users(id) ON DELETE CASCADE)
  DELETE FROM auth.users
  WHERE id = v_user_id;

  -- Optional cleanup: if the deleted user was the last member in the company, remove the company.
  IF v_company_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE company_id = v_company_id)
  THEN
    DELETE FROM public.companies WHERE id = v_company_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;


-- --------------------------------------------------------
-- FILE: supabase/reset_fresh_install.sql
-- --------------------------------------------------------
-- ========================================
-- FRESH INSTALL RESET SCRIPT
-- ========================================
-- This script completely wipes all data and resets the database
-- to a fresh state as if the app was just installed.
--
-- WARNING: This deletes ALL data including users, companies, contacts, etc.
-- Only run this if you want to start completely fresh!
-- ========================================

-- Step 1: Delete all data (cascades will handle related records)
DO $$ 
BEGIN
  RAISE NOTICE '🧹 Starting fresh install reset...';
END $$;

-- Delete all auth users (this cascades to profiles via FK)
DELETE FROM auth.users;

-- Delete all remaining data in order of dependencies
DELETE FROM invoice_items;
DELETE FROM invoices;
DELETE FROM activities;
DELETE FROM communications;
DELETE FROM documents;
DELETE FROM appointments;
DELETE FROM jobs;
DELETE FROM contacts;
DELETE FROM kanban_columns;
DELETE FROM kanban_boards;
DELETE FROM lead_sources;
DELETE FROM automations;
DELETE FROM profiles;
DELETE FROM companies;

DO $$ 
BEGIN
  RAISE NOTICE '✅ All data deleted';
END $$;

-- Step 2: Reset sequences (if any exist)
-- This ensures new records start from ID 1
-- Note: We're using UUIDs so no sequences to reset

-- Step 3: Verify the database is clean
DO $$ 
DECLARE
  v_user_count INT;
  v_company_count INT;
  v_profile_count INT;
  v_contact_count INT;
BEGIN
  SELECT COUNT(*) INTO v_user_count FROM auth.users;
  SELECT COUNT(*) INTO v_company_count FROM companies;
  SELECT COUNT(*) INTO v_profile_count FROM profiles;
  SELECT COUNT(*) INTO v_contact_count FROM contacts;
  
  RAISE NOTICE '📊 Verification:';
  RAISE NOTICE '  - Users: %', v_user_count;
  RAISE NOTICE '  - Companies: %', v_company_count;
  RAISE NOTICE '  - Profiles: %', v_profile_count;
  RAISE NOTICE '  - Contacts: %', v_contact_count;
  
  IF v_user_count = 0 AND v_company_count = 0 AND v_profile_count = 0 AND v_contact_count = 0 THEN
    RAISE NOTICE '✅ Database is completely clean!';
  ELSE
    RAISE WARNING '⚠️  Some data may still exist';
  END IF;
END $$;

-- Step 4: Ensure triggers are in place for new signups
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    RAISE NOTICE '✅ Auto-signup trigger is installed';
  ELSE
    RAISE WARNING '⚠️  Auto-signup trigger not found! Run 02_triggers.sql';
  END IF;
END $$;

-- Final summary
SELECT '
========================================
🎉 FRESH INSTALL COMPLETE!
========================================

Your database is now completely clean.

Next steps:
1. Go to your app: https://614restore.github.io/crm-kanban-integrate/
2. Click "Sign Up" to create a new account
3. A company will be automatically created for you
4. Start using the app!

First user will automatically:
  ✅ Get a company created
  ✅ Be assigned as admin
  ✅ Have full access to all features
========================================
' as "🎊 STATUS";


-- --------------------------------------------------------
-- FILE: supabase/migrations/001_add_custom_permissions.sql
-- --------------------------------------------------------
-- Add custom_permissions column to profiles table
-- This allows per-user permission overrides beyond their default role permissions

-- Add the column (JSONB for flexible permission storage)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS custom_permissions JSONB;

-- Add a comment describing the column
COMMENT ON COLUMN profiles.custom_permissions IS 'Stores custom permission overrides for this user. Format: {"category_name": "permission_level"}. Example: {"contacts_leads": "full", "invoicing": "create"}';

-- Create an index for better query performance when filtering by permissions
CREATE INDEX IF NOT EXISTS idx_profiles_custom_permissions 
ON profiles USING GIN (custom_permissions);

-- Update RLS policy to allow users to update their own custom_permissions
-- Only allow owners and admins to modify other users' permissions
CREATE POLICY "Users can view all profiles in their company"
ON profiles FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE company_id = profiles.company_id
  )
);

CREATE POLICY "Owners and admins can update team member permissions"
ON profiles FOR UPDATE
USING (
  -- User is updating themselves
  auth.uid() = id
  OR
  -- User is an owner or admin in the same company
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE company_id = profiles.company_id 
    AND role IN ('owner', 'admin', 'sales_manager', 'production_manager', 'manager')
  )
);


-- --------------------------------------------------------
-- FILE: supabase/migrations/002_fix_rls_policies.sql
-- --------------------------------------------------------
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


-- --------------------------------------------------------
-- FILE: supabase/migrations/20260225152000_launch_hardening.sql
-- --------------------------------------------------------
-- Launch hardening migration
-- Safe to run multiple times.

-- 1) Delete-account RPC required by Settings > Security
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.profiles
  WHERE id = v_user_id;

  DELETE FROM auth.users
  WHERE id = v_user_id;

  IF v_company_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE company_id = v_company_id)
  THEN
    DELETE FROM public.companies WHERE id = v_company_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- 2) Realtime publication hardening
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'public.contacts',
    'public.appointments',
    'public.invoices',
    'public.lead_sources',
    'public.kanban_boards',
    'public.kanban_columns',
    'public.profiles',
    'public.communications',
    'public.documents',
    'public.automations'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname || '.' || tablename = tbl
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE ' || tbl;
    END IF;

    EXECUTE 'ALTER TABLE ' || tbl || ' REPLICA IDENTITY FULL';
  END LOOP;
END $$;


-- --------------------------------------------------------
-- FILE: supabase/migrations/20260225160000_storage_buckets_policies.sql
-- --------------------------------------------------------
-- Storage buckets + policies for upload features
-- Safe to run multiple times.

-- Buckets used by the app
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('company-logos', 'company-logos', true),
  ('avatars', 'avatars', true),
  ('projectceo-documents', 'projectceo-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow public read for app buckets'
  ) THEN
    CREATE POLICY "Allow public read for app buckets"
      ON storage.objects
      FOR SELECT
      USING (bucket_id IN ('company-logos', 'avatars', 'projectceo-documents'));
  END IF;
END $$;

-- Insert access for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow authenticated insert for app buckets'
  ) THEN
    CREATE POLICY "Allow authenticated insert for app buckets"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id IN ('company-logos', 'avatars', 'projectceo-documents'));
  END IF;
END $$;

-- Update access for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow authenticated update for app buckets'
  ) THEN
    CREATE POLICY "Allow authenticated update for app buckets"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id IN ('company-logos', 'avatars', 'projectceo-documents'))
      WITH CHECK (bucket_id IN ('company-logos', 'avatars', 'projectceo-documents'));
  END IF;
END $$;

-- Delete access for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow authenticated delete for app buckets'
  ) THEN
    CREATE POLICY "Allow authenticated delete for app buckets"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id IN ('company-logos', 'avatars', 'projectceo-documents'));
  END IF;
END $$;


-- --------------------------------------------------------
-- FILE: supabase/migrations/20260225173000_tenant_isolation_hardening.sql
-- --------------------------------------------------------
-- Tenant isolation hardening for CRM Kanban Integrate
-- Applies strict company-scoped RLS and private document storage access.

-- Helper: current user's company id (bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.company_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_company_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_company_id() TO authenticated;

-- Ensure RLS is enabled on key tables
ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.kanban_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.kanban_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invites ENABLE ROW LEVEL SECURITY;

-- Reset policies for tables with company_id so drift cannot leave permissive policies behind.
DO $$
DECLARE
  tbl record;
  pol record;
BEGIN
  FOR tbl IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'company_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('companies', 'profiles')
  LOOP
    FOR pol IN
      SELECT p.policyname
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = tbl.table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl.table_name);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (company_id = public.get_my_company_id())',
      tbl.table_name || '_tenant_select',
      tbl.table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id())',
      tbl.table_name || '_tenant_insert',
      tbl.table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id()) WITH CHECK (company_id = public.get_my_company_id())',
      tbl.table_name || '_tenant_update',
      tbl.table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (company_id = public.get_my_company_id())',
      tbl.table_name || '_tenant_delete',
      tbl.table_name
    );
  END LOOP;
END $$;

-- Companies policies (single-company access for each authenticated user)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companies'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.companies', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY companies_select_own
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (id = public.get_my_company_id());

CREATE POLICY companies_update_own
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (id = public.get_my_company_id())
  WITH CHECK (id = public.get_my_company_id());

CREATE POLICY companies_insert_authenticated
  ON public.companies
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.get_my_company_id() IS NULL);

-- Profiles policies (own profile + same-company visibility)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY profiles_select_own_or_company
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR company_id = public.get_my_company_id());

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Kanban columns are scoped through board ownership.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'kanban_columns'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.kanban_columns', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY kanban_columns_select_tenant
  ON public.kanban_columns
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.kanban_boards b
      WHERE b.id = kanban_columns.board_id
        AND b.company_id = public.get_my_company_id()
    )
  );

CREATE POLICY kanban_columns_insert_tenant
  ON public.kanban_columns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.kanban_boards b
      WHERE b.id = kanban_columns.board_id
        AND b.company_id = public.get_my_company_id()
    )
  );

CREATE POLICY kanban_columns_update_tenant
  ON public.kanban_columns
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.kanban_boards b
      WHERE b.id = kanban_columns.board_id
        AND b.company_id = public.get_my_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.kanban_boards b
      WHERE b.id = kanban_columns.board_id
        AND b.company_id = public.get_my_company_id()
    )
  );

CREATE POLICY kanban_columns_delete_tenant
  ON public.kanban_columns
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.kanban_boards b
      WHERE b.id = kanban_columns.board_id
        AND b.company_id = public.get_my_company_id()
    )
  );

-- Invoice items are scoped through invoice ownership.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invoice_items'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.invoice_items', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY invoice_items_select_tenant
  ON public.invoice_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.company_id = public.get_my_company_id()
    )
  );

CREATE POLICY invoice_items_insert_tenant
  ON public.invoice_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.company_id = public.get_my_company_id()
    )
  );

CREATE POLICY invoice_items_update_tenant
  ON public.invoice_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.company_id = public.get_my_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.company_id = public.get_my_company_id()
    )
  );

CREATE POLICY invoice_items_delete_tenant
  ON public.invoice_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.company_id = public.get_my_company_id()
    )
  );

-- Storage hardening for confidential documents.
INSERT INTO storage.buckets (id, name, public)
VALUES ('projectceo-documents', 'projectceo-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Reset storage object policies so no leftover permissive public policy remains.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Keep avatars/logos publicly readable if desired.
CREATE POLICY storage_public_read_assets
  ON storage.objects
  FOR SELECT
  USING (bucket_id IN ('company-logos', 'avatars'));

CREATE POLICY storage_authenticated_write_assets
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('company-logos', 'avatars'));

CREATE POLICY storage_authenticated_update_assets
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('company-logos', 'avatars'))
  WITH CHECK (bucket_id IN ('company-logos', 'avatars'));

CREATE POLICY storage_authenticated_delete_assets
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id IN ('company-logos', 'avatars'));

-- Company-only access for confidential documents bucket.
CREATE POLICY storage_docs_select_tenant
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'projectceo-documents'
    AND split_part(name, '/', 1) = public.get_my_company_id()::text
  );

CREATE POLICY storage_docs_insert_tenant
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'projectceo-documents'
    AND split_part(name, '/', 1) = public.get_my_company_id()::text
  );

CREATE POLICY storage_docs_update_tenant
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'projectceo-documents'
    AND split_part(name, '/', 1) = public.get_my_company_id()::text
  )
  WITH CHECK (
    bucket_id = 'projectceo-documents'
    AND split_part(name, '/', 1) = public.get_my_company_id()::text
  );

CREATE POLICY storage_docs_delete_tenant
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'projectceo-documents'
    AND split_part(name, '/', 1) = public.get_my_company_id()::text
  );


-- --------------------------------------------------------
-- FILE: supabase/migrations/20260226015000_storage_asset_tenant_write_hardening.sql
-- --------------------------------------------------------
-- Harden avatar/logo writes so users can only write inside allowed tenant paths.
-- Keeps public-read behavior for compatibility with current app URLs.

-- Remove broad write policies created by prior migration.
DROP POLICY IF EXISTS storage_authenticated_write_assets ON storage.objects;
DROP POLICY IF EXISTS storage_authenticated_update_assets ON storage.objects;
DROP POLICY IF EXISTS storage_authenticated_delete_assets ON storage.objects;

-- Avatar bucket: each user can only write/update/delete under "<auth.uid()>/..."
CREATE POLICY storage_avatars_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY storage_avatars_update_own
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY storage_avatars_delete_own
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- Company logo bucket: company members can write/update/delete under "<company_id>/..."
CREATE POLICY storage_company_logos_insert_tenant
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND split_part(name, '/', 1) = public.get_my_company_id()::text
  );

CREATE POLICY storage_company_logos_update_tenant
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND split_part(name, '/', 1) = public.get_my_company_id()::text
  )
  WITH CHECK (
    bucket_id = 'company-logos'
    AND split_part(name, '/', 1) = public.get_my_company_id()::text
  );

CREATE POLICY storage_company_logos_delete_tenant
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND split_part(name, '/', 1) = public.get_my_company_id()::text
  );


-- --------------------------------------------------------
-- FILE: supabase/migrations/20260226033000_start_fresh_workspace_rpc.sql
-- --------------------------------------------------------
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


-- --------------------------------------------------------
-- FILE: supabase/migrations/20260228183000_roles_rls_and_owner_backfill.sql
-- --------------------------------------------------------
-- Role/RLS hardening and owner backfill
-- 1) Ensure there is always at least one owner per company.
-- 2) Enable and tighten RLS on optional role tables if present.

-- Backfill owner role for existing companies that currently have no owner.
WITH companies_missing_owner AS (
  SELECT p.company_id
  FROM public.profiles p
  WHERE p.company_id IS NOT NULL
  GROUP BY p.company_id
  HAVING COALESCE(bool_or(p.role = 'owner'), false) = false
), first_member AS (
  SELECT DISTINCT ON (p.company_id)
    p.id,
    p.company_id
  FROM public.profiles p
  JOIN companies_missing_owner cmo ON cmo.company_id = p.company_id
  WHERE p.company_id IS NOT NULL
  ORDER BY p.company_id, p.created_at ASC, p.id ASC
)
UPDATE public.profiles p
SET role = 'owner', updated_at = now()
FROM first_member fm
WHERE p.id = fm.id;

-- Keep auth-trigger defaults aligned for direct signups that provide no role metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
BEGIN
  INSERT INTO public.companies (name, email)
  VALUES (
    COALESCE(NEW.email, 'New User') || '''s Company',
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

-- Optional tables from some environments: lock them down if they exist.
DO $$
DECLARE
  tbl text;
  pol record;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['role_definitions', 'team_members'] LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

      FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tbl
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
      END LOOP;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'company_id'
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (company_id = public.get_my_company_id())',
          tbl || '_tenant_select',
          tbl
        );

        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id())',
          tbl || '_tenant_insert',
          tbl
        );

        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id()) WITH CHECK (company_id = public.get_my_company_id())',
          tbl || '_tenant_update',
          tbl
        );

        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (company_id = public.get_my_company_id())',
          tbl || '_tenant_delete',
          tbl
        );
      END IF;
    END IF;
  END LOOP;
END $$;


-- --------------------------------------------------------
-- FILE: supabase/migrations/20260228195000_company_name_defaults.sql
-- --------------------------------------------------------
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


-- --------------------------------------------------------
-- FILE: supabase/migrations/20260228201000_set_my_company_logo_rpc.sql
-- --------------------------------------------------------
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


-- --------------------------------------------------------
-- FILE: supabase/migrations/20260305_company_profile_fields.sql
-- --------------------------------------------------------
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


-- --------------------------------------------------------
-- FILE: supabase/migrations/20260305_fix_all_rls_recursion.sql
-- --------------------------------------------------------
-- =============================================================================
-- FIX: Eliminate recursive RLS on profiles table
-- 
-- ROOT CAUSE: The profiles SELECT policy used a subquery on profiles itself:
--   profiles.company_id IN (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
-- This triggers RLS recursion. Since get_my_company_id() also queries profiles,
-- every table's RLS policy that calls get_my_company_id() also hangs.
--
-- FIX: Replace ALL profiles policies to use get_my_company_id() which is
-- SECURITY DEFINER and bypasses RLS. This fixes all 70+ database operations.
-- =============================================================================

-- Step 1: Ensure get_my_company_id() exists and is SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.company_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_company_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_company_id() TO authenticated;

-- Step 2: Drop ALL existing profiles policies (they have recursive subqueries)
DO $$
DECLARE 
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    RAISE NOTICE 'Dropped profiles policy: %', pol.policyname;
  END LOOP;
END $$;

-- Step 3: Create non-recursive profiles policies using get_my_company_id()

-- SELECT: own profile OR same company (via SECURITY DEFINER function, no recursion)
CREATE POLICY profiles_select_safe
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR company_id = public.get_my_company_id()
  );

-- INSERT: only your own profile (signup)
CREATE POLICY profiles_insert_own
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: own profile always; managers can update same-company members
-- Uses get_my_company_id() to avoid recursion
CREATE POLICY profiles_update_safe
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR (
      company_id = public.get_my_company_id()
      AND public.get_my_role() IN ('owner', 'admin', 'sales_manager', 'production_manager')
    )
  )
  WITH CHECK (
    id = auth.uid()
    OR company_id = public.get_my_company_id()
  );

-- Step 4: Create get_my_role() helper (SECURITY DEFINER, no recursion)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- Step 5: Fix companies policies too (ensure they use get_my_company_id)
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companies'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.companies', pol.policyname);
    RAISE NOTICE 'Dropped companies policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY companies_select_own
  ON public.companies FOR SELECT TO authenticated
  USING (id = public.get_my_company_id());

CREATE POLICY companies_update_own
  ON public.companies FOR UPDATE TO authenticated
  USING (id = public.get_my_company_id())
  WITH CHECK (id = public.get_my_company_id());

CREATE POLICY companies_insert_new
  ON public.companies FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NULL);

-- Step 6: Rebuild all tenant-scoped table policies using get_my_company_id()
-- This ensures contacts, jobs, appointments, invoices, etc. all work
DO $$
DECLARE
  tbl RECORD;
  pol RECORD;
BEGIN
  FOR tbl IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'company_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('companies', 'profiles')
  LOOP
    -- Drop existing policies
    FOR pol IN
      SELECT p.policyname FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = tbl.table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl.table_name);
    END LOOP;

    -- Recreate with get_my_company_id()
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (company_id = public.get_my_company_id())',
      tbl.table_name || '_tenant_select', tbl.table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (company_id = public.get_my_company_id())',
      tbl.table_name || '_tenant_insert', tbl.table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (company_id = public.get_my_company_id()) WITH CHECK (company_id = public.get_my_company_id())',
      tbl.table_name || '_tenant_update', tbl.table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (company_id = public.get_my_company_id())',
      tbl.table_name || '_tenant_delete', tbl.table_name
    );
    
    RAISE NOTICE 'Rebuilt policies for: %', tbl.table_name;
  END LOOP;
END $$;

-- Step 7: Fix kanban_columns (no company_id, scoped via board FK)
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kanban_columns'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.kanban_columns', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY kanban_columns_select
  ON public.kanban_columns FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kanban_boards b
    WHERE b.id = kanban_columns.board_id
      AND b.company_id = public.get_my_company_id()
  ));

CREATE POLICY kanban_columns_insert
  ON public.kanban_columns FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kanban_boards b
    WHERE b.id = kanban_columns.board_id
      AND b.company_id = public.get_my_company_id()
  ));

CREATE POLICY kanban_columns_update
  ON public.kanban_columns FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kanban_boards b
    WHERE b.id = kanban_columns.board_id
      AND b.company_id = public.get_my_company_id()
  ));

CREATE POLICY kanban_columns_delete
  ON public.kanban_columns FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kanban_boards b
    WHERE b.id = kanban_columns.board_id
      AND b.company_id = public.get_my_company_id()
  ));

-- Step 8: Fix invoice_items (no company_id, scoped via invoice FK)
DO $$
DECLARE pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoice_items') THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'invoice_items'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.invoice_items', pol.policyname);
    END LOOP;

    EXECUTE 'CREATE POLICY invoice_items_select ON public.invoice_items FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id AND i.company_id = public.get_my_company_id()))';
    EXECUTE 'CREATE POLICY invoice_items_insert ON public.invoice_items FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id AND i.company_id = public.get_my_company_id()))';
    EXECUTE 'CREATE POLICY invoice_items_update ON public.invoice_items FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id AND i.company_id = public.get_my_company_id()))';
    EXECUTE 'CREATE POLICY invoice_items_delete ON public.invoice_items FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id AND i.company_id = public.get_my_company_id()))';
      
    RAISE NOTICE 'Rebuilt policies for: invoice_items';
  END IF;
END $$;

-- Step 9: Clean up orphan companies
DELETE FROM public.companies
WHERE id NOT IN (SELECT DISTINCT company_id FROM public.profiles WHERE company_id IS NOT NULL);

-- Verification
DO $$
DECLARE
  pol RECORD;
  cnt integer := 0;
BEGIN
  RAISE NOTICE '=== All RLS Policies After Fix ===';
  FOR pol IN
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  LOOP
    RAISE NOTICE '  [%] % (%)', pol.tablename, pol.policyname, pol.cmd;
    cnt := cnt + 1;
  END LOOP;
  RAISE NOTICE 'Total policies: %', cnt;
END $$;


-- --------------------------------------------------------
-- FILE: supabase/migrations/20260306_fix_company_access.sql
-- --------------------------------------------------------
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

-- 4) RPC to update a team member's profile (bypasses RLS for managers)
--    Only allows updates to members in the same company.
--    Only owner/admin/sales_manager/production_manager can update others.
CREATE OR REPLACE FUNCTION public.update_team_member_profile(
  p_profile_id uuid,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_company_id uuid;
  v_caller_role text;
  v_target_company_id uuid;
  v_result public.profiles;
BEGIN
  -- Get caller's company and role
  SELECT company_id, role INTO v_caller_company_id, v_caller_role
  FROM public.profiles WHERE id = auth.uid();

  -- Get target's company
  SELECT company_id INTO v_target_company_id
  FROM public.profiles WHERE id = p_profile_id;

  -- Self-update is always allowed
  IF p_profile_id = auth.uid() THEN
    UPDATE public.profiles SET
      first_name  = COALESCE(p_first_name, first_name),
      last_name   = COALESCE(p_last_name, last_name),
      email       = COALESCE(p_email, email),
      role        = COALESCE(p_role, role),
      department  = COALESCE(p_department, department),
      phone       = COALESCE(p_phone, phone),
      is_active   = COALESCE(p_is_active, is_active),
      updated_at  = now()
    WHERE id = p_profile_id
    RETURNING * INTO v_result;
    RETURN v_result;
  END IF;

  -- For updating others: must be same company and have manager+ role
  IF v_caller_company_id IS NULL OR v_caller_company_id != v_target_company_id THEN
    RAISE EXCEPTION 'Cannot update profiles outside your company';
  END IF;

  IF v_caller_role NOT IN ('owner', 'admin', 'sales_manager', 'production_manager') THEN
    RAISE EXCEPTION 'Insufficient permissions to update team members';
  END IF;

  UPDATE public.profiles SET
    first_name  = COALESCE(p_first_name, first_name),
    last_name   = COALESCE(p_last_name, last_name),
    email       = COALESCE(p_email, email),
    role        = COALESCE(p_role, role),
    department  = COALESCE(p_department, department),
    phone       = COALESCE(p_phone, phone),
    is_active   = COALESCE(p_is_active, is_active),
    updated_at  = now()
  WHERE id = p_profile_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_team_member_profile(uuid,text,text,text,text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_team_member_profile(uuid,text,text,text,text,text,text,boolean) TO authenticated;


-- --------------------------------------------------------
-- FILE: supabase/migrations/20260306_missing_tables.sql
-- --------------------------------------------------------
-- Missing tables migration: estimates, estimate_items, projects, work_orders,
-- suppliers, material_orders, material_order_items

-- ─── ESTIMATES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estimates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  estimate_number TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',
  items           JSONB DEFAULT '[]',
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax             NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  validity_date   DATE,
  valid_until     DATE,
  notes           TEXT,
  terms_and_conditions TEXT,
  terms           TEXT,
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  declined_at     TIMESTAMPTZ,
  signed_by       TEXT,
  signature_data  TEXT,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estimates_tenant_select" ON estimates FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "estimates_tenant_insert" ON estimates FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "estimates_tenant_update" ON estimates FOR UPDATE USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "estimates_tenant_delete" ON estimates FOR DELETE USING (company_id = get_my_company_id());

-- ─── PROJECTS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_number      TEXT NOT NULL,
  name                TEXT NOT NULL,
  contact_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  estimate_id         UUID REFERENCES estimates(id) ON DELETE SET NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'planning',
  priority            TEXT NOT NULL DEFAULT 'medium',
  start_date          DATE,
  end_date            DATE,
  completed_date      DATE,
  estimated_budget    NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_cost         NUMERIC(12,2) NOT NULL DEFAULT 0,
  address             TEXT,
  city                TEXT,
  state               TEXT,
  zip                 TEXT,
  project_manager_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes               TEXT,
  tags                TEXT[] DEFAULT '{}',
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_tenant_select" ON projects FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "projects_tenant_insert" ON projects FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "projects_tenant_update" ON projects FOR UPDATE USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "projects_tenant_delete" ON projects FOR DELETE USING (company_id = get_my_company_id());

-- ─── WORK ORDERS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  work_order_number   TEXT NOT NULL,
  project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
  contact_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  priority            TEXT NOT NULL DEFAULT 'medium',
  scheduled_date      DATE,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  assigned_to         UUID[] DEFAULT '{}',
  estimated_hours     NUMERIC(8,2),
  actual_hours        NUMERIC(8,2),
  labor_cost          NUMERIC(12,2) NOT NULL DEFAULT 0,
  material_cost       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost          NUMERIC(12,2) NOT NULL DEFAULT 0,
  address             TEXT,
  city                TEXT,
  state               TEXT,
  zip                 TEXT,
  notes               TEXT,
  attachments         TEXT[] DEFAULT '{}',
  checklist_items     JSONB DEFAULT '[]',
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_orders_tenant_select" ON work_orders FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "work_orders_tenant_insert" ON work_orders FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "work_orders_tenant_update" ON work_orders FOR UPDATE USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "work_orders_tenant_delete" ON work_orders FOR DELETE USING (company_id = get_my_company_id());

-- ─── SUPPLIERS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  contact_name    TEXT,
  email           TEXT,
  phone           TEXT,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  zip             TEXT,
  website         TEXT,
  account_number  TEXT,
  payment_terms   TEXT,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_tenant_select" ON suppliers FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "suppliers_tenant_insert" ON suppliers FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "suppliers_tenant_update" ON suppliers FOR UPDATE USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "suppliers_tenant_delete" ON suppliers FOR DELETE USING (company_id = get_my_company_id());

-- ─── MATERIAL ORDERS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS material_orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id             UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  contact_id              UUID REFERENCES contacts(id) ON DELETE SET NULL,
  job_id                  UUID REFERENCES jobs(id) ON DELETE SET NULL,
  order_number            TEXT,
  order_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date  DATE,
  actual_delivery_date    DATE,
  status                  TEXT NOT NULL DEFAULT 'pending',
  subtotal                NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax                     NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping                NUMERIC(12,2) NOT NULL DEFAULT 0,
  total                   NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes                   TEXT,
  created_by              UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE material_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "material_orders_tenant_select" ON material_orders FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "material_orders_tenant_insert" ON material_orders FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "material_orders_tenant_update" ON material_orders FOR UPDATE USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "material_orders_tenant_delete" ON material_orders FOR DELETE USING (company_id = get_my_company_id());

-- ─── MATERIAL ORDER ITEMS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS material_order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES material_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit        TEXT NOT NULL DEFAULT 'each',
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total       NUMERIC(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE material_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "material_order_items_select" ON material_order_items FOR SELECT USING (
  order_id IN (SELECT id FROM material_orders WHERE company_id = get_my_company_id())
);
CREATE POLICY "material_order_items_insert" ON material_order_items FOR INSERT WITH CHECK (
  order_id IN (SELECT id FROM material_orders WHERE company_id = get_my_company_id())
);
CREATE POLICY "material_order_items_update" ON material_order_items FOR UPDATE USING (
  order_id IN (SELECT id FROM material_orders WHERE company_id = get_my_company_id())
);
CREATE POLICY "material_order_items_delete" ON material_order_items FOR DELETE USING (
  order_id IN (SELECT id FROM material_orders WHERE company_id = get_my_company_id())
);

-- ─── UPDATED_AT TRIGGERS ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

DO $$ BEGIN
  CREATE TRIGGER update_estimates_updated_at BEFORE UPDATE ON estimates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TRIGGER update_material_orders_updated_at BEFORE UPDATE ON material_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

SELECT '✅ Missing tables created: estimates, projects, work_orders, suppliers, material_orders' as status;


-- --------------------------------------------------------
-- FILE: supabase/migrations/20260307_company_integrations.sql
-- --------------------------------------------------------
-- Company Integrations table
-- Stores per-company integration credentials and settings.
-- Credentials stored as JSONB; access controlled by RLS (company members only).

CREATE TABLE IF NOT EXISTS company_integrations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,          -- e.g. 'hailtrace', 'stripe', 'twilio'
  is_active        BOOLEAN NOT NULL DEFAULT true,
  credentials      JSONB NOT NULL DEFAULT '{}',
  settings         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, integration_type)
);

-- Index for fast per-company lookups
CREATE INDEX IF NOT EXISTS idx_company_integrations_company_id
  ON company_integrations (company_id);

-- RLS
ALTER TABLE company_integrations ENABLE ROW LEVEL SECURITY;

-- Members of the company can read their own integrations
CREATE POLICY "company_members_read_integrations"
  ON company_integrations FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Only owners/admins can write integration settings
CREATE POLICY "company_admins_write_integrations"
  ON company_integrations FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_company_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_company_integrations_updated_at ON company_integrations;
CREATE TRIGGER trg_company_integrations_updated_at
  BEFORE UPDATE ON company_integrations
  FOR EACH ROW EXECUTE FUNCTION update_company_integrations_updated_at();


-- --------------------------------------------------------
-- FILE: supabase/migrations/20260307_notifications_table.sql
-- --------------------------------------------------------
-- Migration: Create notifications table for in-app alerts
-- Supports: unassigned appointment alerts, @mention notifications, general alerts

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- target user (NULL = company-wide)
  type TEXT NOT NULL DEFAULT 'info',  -- 'info', 'warning', 'error', 'success', 'unassigned_appointment', 'mention'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,         -- appointment_id, contact_id, etc.
  related_type TEXT,        -- 'appointment', 'contact', 'job', etc.
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 3. RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_tenant_select ON notifications;
DROP POLICY IF EXISTS notifications_tenant_insert ON notifications;
DROP POLICY IF EXISTS notifications_tenant_update ON notifications;
DROP POLICY IF EXISTS notifications_tenant_delete ON notifications;

CREATE POLICY notifications_tenant_select ON notifications
  FOR SELECT USING (company_id = public.get_my_company_id());

CREATE POLICY notifications_tenant_insert ON notifications
  FOR INSERT WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY notifications_tenant_update ON notifications
  FOR UPDATE USING (company_id = public.get_my_company_id());

CREATE POLICY notifications_tenant_delete ON notifications
  FOR DELETE USING (company_id = public.get_my_company_id());


-- --------------------------------------------------------
-- FILE: supabase/migrations/20260307_v2_pm_features.sql
-- --------------------------------------------------------
-- TrussCTR v2 — Project Manager Features
-- Tables: crew_schedules, change_orders, permits, equipment, equipment_assignments
-- Also adds is_archived to contacts

-- ─────────────────────────────────────────────
-- 1. Contact archiving
-- ─────────────────────────────────────────────
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_contacts_is_archived ON contacts (company_id, is_archived);

-- ─────────────────────────────────────────────
-- 2. Crew Schedules
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crew_schedules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  crew_member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id         UUID REFERENCES jobs(id) ON DELETE SET NULL,
  contact_id     UUID REFERENCES contacts(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  notes          TEXT,
  scheduled_date DATE NOT NULL,
  start_time     TIME,
  end_time       TIME,
  status         TEXT NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','in-progress','completed','cancelled')),
  created_by     UUID REFERENCES profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crew_schedules_company_date
  ON crew_schedules (company_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_crew_schedules_member
  ON crew_schedules (crew_member_id, scheduled_date);

ALTER TABLE crew_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_members_crew_schedules"
  ON crew_schedules FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ─────────────────────────────────────────────
-- 3. Change Orders
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS change_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  change_order_number TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','signed','approved','rejected','void')),
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax             NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  items           JSONB NOT NULL DEFAULT '[]',
  sign_token      UUID DEFAULT gen_random_uuid(),
  signed_at       TIMESTAMPTZ,
  signed_by_name  TEXT,
  signed_ip       TEXT,
  signature_data  TEXT,
  sent_at         TIMESTAMPTZ,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_orders_company
  ON change_orders (company_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_contact
  ON change_orders (contact_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_change_orders_sign_token
  ON change_orders (sign_token);

ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_members_change_orders"
  ON change_orders FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
-- Public read for signing (by token — app logic handles this)

-- ─────────────────────────────────────────────
-- 4. Permits
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,
  job_id           UUID REFERENCES jobs(id) ON DELETE SET NULL,
  permit_number    TEXT,
  permit_type      TEXT NOT NULL DEFAULT 'building',
  issuing_authority TEXT,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('not-required','pending','applied','approved','inspected','closed','expired','denied')),
  applied_date     DATE,
  approved_date    DATE,
  expires_date     DATE,
  inspection_date  DATE,
  fee              NUMERIC(10,2),
  notes            TEXT,
  documents        JSONB NOT NULL DEFAULT '[]',
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permits_company
  ON permits (company_id);
CREATE INDEX IF NOT EXISTS idx_permits_contact
  ON permits (contact_id);

ALTER TABLE permits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_members_permits"
  ON permits FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ─────────────────────────────────────────────
-- 5. Equipment / Assets
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL DEFAULT 'tool'
                      CHECK (category IN ('tool','vehicle','machinery','other')),
  make              TEXT,
  model             TEXT,
  year              INT,
  serial_number     TEXT,
  license_plate     TEXT,
  vin               TEXT,
  status            TEXT NOT NULL DEFAULT 'available'
                      CHECK (status IN ('available','in-use','maintenance','retired')),
  purchase_date     DATE,
  purchase_price    NUMERIC(12,2),
  last_maintenance  DATE,
  next_maintenance  DATE,
  notes             TEXT,
  assigned_to       UUID REFERENCES profiles(id),
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_company
  ON equipment (company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_status
  ON equipment (company_id, status);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_members_equipment"
  ON equipment FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ─────────────────────────────────────────────
-- 6. Equipment Assignments (assign to jobs/projects)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  equipment_id  UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  job_id        UUID REFERENCES jobs(id) ON DELETE SET NULL,
  contact_id    UUID REFERENCES contacts(id) ON DELETE SET NULL,
  assigned_by   UUID REFERENCES profiles(id),
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  returned_at   TIMESTAMPTZ,
  notes         TEXT
);

CREATE INDEX IF NOT EXISTS idx_equipment_assignments_equipment
  ON equipment_assignments (equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_assignments_job
  ON equipment_assignments (job_id);

ALTER TABLE equipment_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_members_equipment_assignments"
  ON equipment_assignments FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ─────────────────────────────────────────────
-- updated_at triggers (shared function reuse)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crew_schedules_updated_at') THEN
    CREATE TRIGGER trg_crew_schedules_updated_at
      BEFORE UPDATE ON crew_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_change_orders_updated_at') THEN
    CREATE TRIGGER trg_change_orders_updated_at
      BEFORE UPDATE ON change_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_permits_updated_at') THEN
    CREATE TRIGGER trg_permits_updated_at
      BEFORE UPDATE ON permits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_equipment_updated_at') THEN
    CREATE TRIGGER trg_equipment_updated_at
      BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


-- --------------------------------------------------------
-- FILE: supabase/migrations/20260308_expenses_table.sql
-- --------------------------------------------------------
-- Expenses table for tracking business expenses, receipts, and reimbursements
-- Supports tenant isolation via company_id

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Other',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  job_name TEXT DEFAULT '',
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  contact_name TEXT DEFAULT '',
  receipt_url TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'reimbursed')),
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by_name TEXT DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by_name TEXT DEFAULT '',
  approved_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  mileage NUMERIC(10,2),
  location TEXT DEFAULT '',
  vendor TEXT DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'card', 'check', 'company_card')),
  reimbursable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_expenses_company_id ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_submitted_by ON expenses(submitted_by);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies using the existing get_my_company_id() helper
CREATE POLICY "expenses_select" ON expenses
  FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE USING (company_id = get_my_company_id());

CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE USING (company_id = get_my_company_id());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;

-- Storage bucket for expense receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for expense receipts
CREATE POLICY "expense_receipts_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "expense_receipts_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "expense_receipts_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);


-- --------------------------------------------------------
-- FILE: supabase/migrations/20260308_insurance_claims_supplements_material_orders.sql
-- --------------------------------------------------------
-- Migration: insurance_claims + supplements tables, plus missing material_orders columns
-- Fixes: insurance claim/supplement save failures and material order save failures

-- ─── INSURANCE CLAIMS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_claims (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  claim_number      TEXT NOT NULL,
  insurance_company TEXT NOT NULL,
  adjuster_name     TEXT,
  adjuster_phone    TEXT,
  adjuster_email    TEXT,
  claim_amount      NUMERIC(12,2),
  approved_amount   NUMERIC(12,2),
  deductible        NUMERIC(12,2),
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','inspection_scheduled','inspection_complete',
                                        'approved','denied','supplement_in_progress','closed')),
  inspection_date   DATE,
  loss_date         DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_company ON insurance_claims (company_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_contact ON insurance_claims (contact_id);

ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insurance_claims_tenant_select" ON insurance_claims FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());
CREATE POLICY "insurance_claims_tenant_insert" ON insurance_claims FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "insurance_claims_tenant_update" ON insurance_claims FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "insurance_claims_tenant_delete" ON insurance_claims FOR DELETE TO authenticated
  USING (company_id = get_my_company_id());

DO $$ BEGIN
  CREATE TRIGGER update_insurance_claims_updated_at
    BEFORE UPDATE ON insurance_claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── SUPPLEMENTS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  claim_id           UUID NOT NULL REFERENCES insurance_claims(id) ON DELETE CASCADE,
  supplement_number  TEXT NOT NULL,
  description        TEXT NOT NULL,
  amount_requested   NUMERIC(12,2),
  amount_approved    NUMERIC(12,2),
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','submitted','approved','denied','partial')),
  submitted_date     DATE,
  approved_date      DATE,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplements_claim ON supplements (claim_id);
CREATE INDEX IF NOT EXISTS idx_supplements_company ON supplements (company_id);

ALTER TABLE supplements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplements_tenant_select" ON supplements FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());
CREATE POLICY "supplements_tenant_insert" ON supplements FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "supplements_tenant_update" ON supplements FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "supplements_tenant_delete" ON supplements FOR DELETE TO authenticated
  USING (company_id = get_my_company_id());

DO $$ BEGIN
  CREATE TRIGGER update_supplements_updated_at
    BEFORE UPDATE ON supplements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── MATERIAL ORDERS — add missing columns ────────────────────────────────────
ALTER TABLE material_orders
  ADD COLUMN IF NOT EXISTS project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachments TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_material_orders_project ON material_orders (project_id);

SELECT '✅ Created insurance_claims, supplements; patched material_orders with project_id + attachments' AS status;


-- --------------------------------------------------------
-- FILE: supabase-migrations/add-signing-tokens.sql
-- --------------------------------------------------------
-- Migration: Add sign_token to estimates and signature fields to work_orders
-- Purpose: Enable customer-facing signing links for estimates and crew sign-off on work orders

-- Estimates: add sign_token for secure public signing links
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS sign_token TEXT;
CREATE INDEX IF NOT EXISTS idx_estimates_sign_token ON estimates(sign_token) WHERE sign_token IS NOT NULL;

-- Work orders: add signature fields for crew/customer sign-off on completion
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS signed_by TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS signature_data TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS sign_token TEXT;
CREATE INDEX IF NOT EXISTS idx_work_orders_sign_token ON work_orders(sign_token) WHERE sign_token IS NOT NULL;


-- --------------------------------------------------------
-- FILE: supabase-migrations/add-subscription-plans.sql
-- --------------------------------------------------------
-- Add subscription fields to companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS subscription_plan text DEFAULT 'trial' CHECK (subscription_plan IN ('trial','starter','professional','enterprise')),
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trialing' CHECK (subscription_status IN ('active','past_due','canceled','trialing')),
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT (NOW() + INTERVAL '14 days'),
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

COMMENT ON COLUMN public.companies.subscription_plan IS 'TrussCTR subscription plan tier';
COMMENT ON COLUMN public.companies.trial_ends_at IS '14-day free trial expiry';


-- --------------------------------------------------------
-- FILE: supabase-migrations/add-suppliers-orders-estimates.sql
-- --------------------------------------------------------
-- Migration: Add Suppliers, Material Orders, Estimates, Projects, and Work Orders tables
-- Created: 2026-03-02
-- Description: Creates tables for supplier management, material orders, customer estimates, project tracking, and work orders

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SUPPLIERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  website TEXT,
  account_number TEXT,
  payment_terms TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- Create trigger for suppliers updated_at
CREATE OR REPLACE FUNCTION update_suppliers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER suppliers_updated_at_trigger
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_suppliers_updated_at();

-- RLS Policies for suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view suppliers from their company
CREATE POLICY "Users can view suppliers from their company"
  ON suppliers FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert suppliers for their company
CREATE POLICY "Users can insert suppliers for their company"
  ON suppliers FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update suppliers from their company
CREATE POLICY "Users can update suppliers from their company"
  ON suppliers FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete suppliers from their company
CREATE POLICY "Users can delete suppliers from their company"
  ON suppliers FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- MATERIAL ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS material_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  order_date DATE NOT NULL,
  delivery_date DATE,
  expected_delivery_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'delivered', 'cancelled')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax NUMERIC(10,2) DEFAULT 0,
  shipping NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  tracking_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for material_orders
CREATE INDEX IF NOT EXISTS idx_material_orders_company_id ON material_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_material_orders_supplier_id ON material_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_material_orders_status ON material_orders(status);
CREATE INDEX IF NOT EXISTS idx_material_orders_order_number ON material_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_material_orders_order_date ON material_orders(order_date DESC);

-- Create trigger for material_orders updated_at
CREATE OR REPLACE FUNCTION update_material_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER material_orders_updated_at_trigger
  BEFORE UPDATE ON material_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_material_orders_updated_at();

-- RLS Policies for material_orders
ALTER TABLE material_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view material orders from their company
CREATE POLICY "Users can view material orders from their company"
  ON material_orders FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert material orders for their company
CREATE POLICY "Users can insert material orders for their company"
  ON material_orders FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update material orders from their company
CREATE POLICY "Users can update material orders from their company"
  ON material_orders FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete material orders from their company
CREATE POLICY "Users can delete material orders from their company"
  ON material_orders FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- ESTIMATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  estimate_number TEXT NOT NULL,
  title TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  validity_date DATE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'declined')),
  notes TEXT,
  terms_and_conditions TEXT,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  signed_by TEXT,
  signature_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for estimates
CREATE INDEX IF NOT EXISTS idx_estimates_company_id ON estimates(company_id);
CREATE INDEX IF NOT EXISTS idx_estimates_contact_id ON estimates(contact_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_estimate_number ON estimates(estimate_number);
CREATE INDEX IF NOT EXISTS idx_estimates_validity_date ON estimates(validity_date);
CREATE INDEX IF NOT EXISTS idx_estimates_created_at ON estimates(created_at DESC);

-- Create unique constraint for estimate number per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_estimates_company_number 
  ON estimates(company_id, estimate_number);

-- Create trigger for estimates updated_at
CREATE OR REPLACE FUNCTION update_estimates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER estimates_updated_at_trigger
  BEFORE UPDATE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_estimates_updated_at();

-- RLS Policies for estimates
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view estimates from their company
CREATE POLICY "Users can view estimates from their company"
  ON estimates FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert estimates for their company
CREATE POLICY "Users can insert estimates for their company"
  ON estimates FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update estimates from their company
CREATE POLICY "Users can update estimates from their company"
  ON estimates FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete estimates from their company
CREATE POLICY "Users can delete estimates from their company"
  ON estimates FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- UPDATE PROFILES TABLE (Add work_email)
-- ============================================
-- Add work_email column to profiles if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'work_email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN work_email TEXT;
  END IF;
END $$;

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_number TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  description TEXT,
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  start_date DATE,
  end_date DATE,
  completed_date DATE,
  estimated_budget NUMERIC(10,2) DEFAULT 0,
  actual_cost NUMERIC(10,2) DEFAULT 0,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  project_manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  tags TEXT[],
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for projects
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_contact_id ON projects(contact_id);
CREATE INDEX IF NOT EXISTS idx_projects_estimate_id ON projects(estimate_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_priority ON projects(priority);
CREATE INDEX IF NOT EXISTS idx_projects_project_manager_id ON projects(project_manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects(start_date);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- Create unique constraint for project number per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_company_number 
  ON projects(company_id, project_number);

-- Create trigger for projects updated_at
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at_trigger
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();

-- RLS Policies for projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view projects from their company
CREATE POLICY "Users can view projects from their company"
  ON projects FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert projects for their company
CREATE POLICY "Users can insert projects for their company"
  ON projects FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update projects from their company
CREATE POLICY "Users can update projects from their company"
  ON projects FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete projects from their company
CREATE POLICY "Users can delete projects from their company"
  ON projects FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- WORK ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  work_order_number TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'on_hold')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  scheduled_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  assigned_to UUID[] DEFAULT '{}',
  estimated_hours NUMERIC(5,2),
  actual_hours NUMERIC(5,2),
  labor_cost NUMERIC(10,2) DEFAULT 0,
  material_cost NUMERIC(10,2) DEFAULT 0,
  total_cost NUMERIC(10,2) DEFAULT 0,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  attachments TEXT[],
  checklist_items JSONB DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for work_orders
CREATE INDEX IF NOT EXISTS idx_work_orders_company_id ON work_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_project_id ON work_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_contact_id ON work_orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_date ON work_orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_to ON work_orders USING GIN(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_orders_created_at ON work_orders(created_at DESC);

-- Create unique constraint for work order number per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_orders_company_number 
  ON work_orders(company_id, work_order_number);

-- Create trigger for work_orders updated_at
CREATE OR REPLACE FUNCTION update_work_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_orders_updated_at_trigger
  BEFORE UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_work_orders_updated_at();

-- RLS Policies for work_orders
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view work orders from their company
CREATE POLICY "Users can view work orders from their company"
  ON work_orders FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert work orders for their company
CREATE POLICY "Users can insert work orders for their company"
  ON work_orders FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update work orders from their company
CREATE POLICY "Users can update work orders from their company"
  ON work_orders FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete work orders from their company
CREATE POLICY "Users can delete work orders from their company"
  ON work_orders FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- HELPFUL VIEWS (Optional)
-- ============================================

-- View: Active suppliers with order count
CREATE OR REPLACE VIEW active_suppliers_with_stats AS
SELECT 
  s.*,
  COUNT(mo.id) as order_count,
  COALESCE(SUM(mo.total), 0) as total_ordered
FROM suppliers s
LEFT JOIN material_orders mo ON s.id = mo.supplier_id
WHERE s.is_active = true
GROUP BY s.id;

-- View: Estimates with customer details
CREATE OR REPLACE VIEW estimates_with_customer AS
SELECT 
  e.*,
  c.first_name,
  c.last_name,
  c.email as customer_email,
  c.phone as customer_phone
FROM estimates e
JOIN contacts c ON e.contact_id = c.id;

-- View: Pending estimates (not expired)
CREATE OR REPLACE VIEW pending_estimates AS
SELECT *
FROM estimates
WHERE status IN ('sent', 'viewed')
  AND validity_date >= CURRENT_DATE;

-- View: Active projects with budget tracking
CREATE OR REPLACE VIEW active_projects_with_stats AS
SELECT 
  p.*,
  c.first_name || ' ' || c.last_name as customer_name,
  c.email as customer_email,
  COUNT(wo.id) as work_order_count,
  COALESCE(SUM(wo.total_cost), 0) as total_work_order_cost,
  p.estimated_budget - p.actual_cost as budget_remaining
FROM projects p
JOIN contacts c ON p.contact_id = c.id
LEFT JOIN work_orders wo ON p.id = wo.project_id
WHERE p.status NOT IN ('completed', 'cancelled')
GROUP BY p.id, c.first_name, c.last_name, c.email;

-- View: Work orders with project and customer details
CREATE OR REPLACE VIEW work_orders_with_details AS
SELECT 
  wo.*,
  c.first_name || ' ' || c.last_name as customer_name,
  c.phone as customer_phone,
  p.name as project_name,
  p.project_number
FROM work_orders wo
JOIN contacts c ON wo.contact_id = c.id
LEFT JOIN projects p ON wo.project_id = p.id;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant usage on views
GRANT SELECT ON active_suppliers_with_stats TO authenticated;
GRANT SELECT ON estimates_with_customer TO authenticated;
GRANT SELECT ON pending_estimates TO authenticated;
GRANT SELECT ON active_projects_with_stats TO authenticated;
GRANT SELECT ON work_orders_with_details TO authenticated;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================

DO $$ 
BEGIN
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE 'Created tables: suppliers, material_orders, estimates, projects, work_orders';
  RAISE NOTICE 'Added RLS policies for all tables';
  RAISE NOTICE 'Created indexes for performance';
  RAISE NOTICE 'Added helpful views for reporting';
  RAISE NOTICE 'Next step: Test the tables in your application';
END $$;


-- --------------------------------------------------------
-- FILE: supabase-migrations/ai-configuration.sql
-- --------------------------------------------------------
-- AI Configuration Tables for Supabase
-- Handles secure storage and team permissions

-- AI Configuration table
CREATE TABLE IF NOT EXISTS ai_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google')),
  api_key_encrypted TEXT NOT NULL,
  organization_id TEXT,
  region TEXT,
  model TEXT NOT NULL,
  max_tokens INTEGER DEFAULT 1000,
  temperature DECIMAL DEFAULT 0.3,
  system_prompt TEXT,
  features JSONB DEFAULT '{
    "customerSupport": true,
    "emailDrafting": true,
    "contractAnalysis": false,
    "estimateReview": true,
    "leadScoring": true
  }',
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approval_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_ai_per_company_user UNIQUE (company_id, user_id, provider)
);

-- AI Access Approvals table for team permissions
CREATE TABLE IF NOT EXISTS ai_access_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id),
  ai_config_id UUID NOT NULL REFERENCES ai_configurations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  access_level TEXT NOT NULL DEFAULT 'read' CHECK (access_level IN ('read', 'write', 'admin')),
  approved_by UUID REFERENCES auth.users(id),
  approval_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_approval UNIQUE (ai_config_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_configs_company ON ai_configurations(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_configs_user ON ai_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_configs_approved ON ai_configurations(is_approved);
CREATE INDEX IF NOT EXISTS idx_ai_access_config ON ai_access_approvals(ai_config_id);
CREATE INDEX IF NOT EXISTS idx_ai_access_user ON ai_access_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_access_company ON ai_access_approvals(company_id);

-- Row-Level Security Policies
-- Enable RLS
ALTER TABLE ai_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_access_approvals ENABLE ROW LEVEL SECURITY;

-- Companies can view their own AI configurations
CREATE POLICY "Users can view company ai_configurations" ON ai_configurations
  FOR SELECT USING (
    auth.uid() = company_id OR
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.company_id = ai_configurations.company_id
      AND team_members.user_id = auth.uid()
      AND team_members.is_approved = true
    )
  );

-- Users can only insert their own configurations
CREATE POLICY "Users can create their own ai_configurations" ON ai_configurations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins and config owners can update
CREATE POLICY "Admins and config owners can update ai_configurations" ON ai_configurations
  FOR UPDATE USING (
    auth.uid() = user_id OR
    auth.uid() = approved_by OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.company_id = ai_configurations.company_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('admin', 'owner')
    )
  );

-- Only approved configurations or creator can view access approvals
CREATE POLICY "View ai_access_approvals" ON ai_access_approvals
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() = approved_by OR
    EXISTS (
      SELECT 1 FROM ai_configurations
      WHERE ai_configurations.id = ai_access_approvals.ai_config_id
      AND (ai_configurations.user_id = auth.uid() OR ai_configurations.is_approved = true)
    )
  );

-- Admins and config owners can manage access
CREATE POLICY "Manage ai_access_approvals" ON ai_access_approvals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM ai_configurations
      WHERE ai_configurations.id = ai_access_approvals.ai_config_id
      AND (ai_configurations.user_id = auth.uid() OR ai_configurations.approved_by = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.company_id = ai_access_approvals.company_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('admin', 'owner')
    )
  );

