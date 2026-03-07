-- ============================================================
-- COMPANY ISOLATION DIAGNOSTIC & FIX
-- Run this in Supabase SQL Editor to check and fix the issue
-- where two accounts are linked to the same company.
-- ============================================================

-- STEP 1: See all users and which company they belong to
SELECT
  p.id AS profile_id,
  p.email,
  p.first_name,
  p.last_name,
  p.role,
  p.company_id,
  c.name AS company_name,
  c.email AS company_email
FROM profiles p
LEFT JOIN companies c ON c.id = p.company_id
ORDER BY c.name, p.role;

-- ============================================================
-- If the above shows two accounts sharing the same company_id
-- and you want Account B (Jeff AccountDos) to have its own
-- separate company, run STEP 2 below.
--
-- REPLACE the email below with Jeff AccountDos's actual email.
-- ============================================================

-- STEP 2: Create a new company for Jeff AccountDos
-- (Only run this if you want them fully separated)

DO $$
DECLARE
  v_user_email TEXT := 'jeff_accountdos@example.com';  -- CHANGE THIS to the actual email
  v_profile_id UUID;
  v_new_company_id UUID;
BEGIN
  -- Find the profile
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE email = v_user_email;

  IF v_profile_id IS NULL THEN
    RAISE NOTICE 'Profile not found for email: %', v_user_email;
    RETURN;
  END IF;

  -- Create a new company for this user
  INSERT INTO companies (name, email, created_at, updated_at)
  VALUES ('My Company', v_user_email, now(), now())
  RETURNING id INTO v_new_company_id;

  -- Update the profile to point to the new company
  UPDATE profiles
  SET company_id = v_new_company_id,
      role = 'owner',
      updated_at = now()
  WHERE id = v_profile_id;

  RAISE NOTICE 'Created company % for user % (profile %)',
    v_new_company_id, v_user_email, v_profile_id;
END $$;

-- STEP 3: Verify the fix
SELECT
  p.email,
  p.role,
  p.company_id,
  c.name AS company_name
FROM profiles p
LEFT JOIN companies c ON c.id = p.company_id
ORDER BY c.name;
