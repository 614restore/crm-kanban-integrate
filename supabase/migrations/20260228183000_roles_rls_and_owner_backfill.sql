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
