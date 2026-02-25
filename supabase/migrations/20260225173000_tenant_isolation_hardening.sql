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
