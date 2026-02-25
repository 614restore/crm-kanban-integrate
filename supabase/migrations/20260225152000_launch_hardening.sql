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
