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
