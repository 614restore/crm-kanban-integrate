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
