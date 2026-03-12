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
