-- Quick setup script for first-time users
-- Run this in Supabase SQL Editor if you get "Unable to determine company context" error

DO $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_email TEXT;
BEGIN
  -- Get the first authenticated user
  SELECT id, email INTO v_user_id, v_email
  FROM auth.users
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;

  -- Check if user already has a company
  SELECT company_id INTO v_company_id
  FROM profiles
  WHERE id = v_user_id;

  IF v_company_id IS NOT NULL THEN
    RAISE NOTICE 'User already has company: %', v_company_id;
    RETURN;
  END IF;

  -- Create a new company
  INSERT INTO companies (name, email, created_at, updated_at)
  VALUES (
    COALESCE(SPLIT_PART(v_email, '@', 1), 'My Company') || '''s Company',
    v_email,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_company_id;

  -- L-- Quick setup script for first-time users
-- Run this in Supabase SQL Editor if you get "Una  updated_at = NOW()
  WHERE id = v_user_id;

DO $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_email TEXT;
BEGIN
  -- Get they tDe set  v_usEC  v_company_id Up.  v_email TEXT;
BEGe BEGIN
  -- Gete,  --Se  SELECT id, email INTO v_user_id, vth  FROM auth.users
  ORDER BY created_at
LEF  ORDER BY creat c  LIMIT 1;

  IF v_user_iRD
  IF v_urea    RAISE EXCEPIT 1;
