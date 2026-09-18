-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
-- Backend for the Pricing & Materials settings tab, ported from QuoteMGR's
-- SettingsHub. Safe to run more than once.

-- ── Price update notices (QuoteMGR migration 20260731_company_price_updates.sql) ──
-- Owners/admins post a notice when the price list changes; clients track
-- per-user dismissal in localStorage, so no read-receipt rows are needed here.
CREATE TABLE IF NOT EXISTS public.company_price_updates (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  updated_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name      text        NOT NULL,
  message          text,
  price_list_name  text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_price_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team can read price updates" ON public.company_price_updates;
CREATE POLICY "team can read price updates" ON public.company_price_updates
  FOR SELECT USING (company_id IN (SELECT public.get_my_company_ids()));

DROP POLICY IF EXISTS "owners and admins can send price updates" ON public.company_price_updates;
CREATE POLICY "owners and admins can send price updates" ON public.company_price_updates
  FOR INSERT WITH CHECK (
    company_id IN (SELECT public.get_my_company_ids()) AND public.is_company_admin(company_id)
  );

-- ── Price list import history ────────────────────────────────────────────────
-- QuoteMGR created this table directly on its live project (no migration file
-- in its repo); columns and usage inferred from PriceListImporter.tsx, which
-- inserts {company_id, price_list_name, original_filename, item_count} and
-- reads back id, price_list_name, original_filename, item_count, imported_at.
CREATE TABLE IF NOT EXISTS public.price_list_imports (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  imported_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  price_list_name    text        NOT NULL,
  original_filename  text,
  item_count         integer     NOT NULL DEFAULT 0,
  imported_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_list_imports_company_imported_idx
  ON public.price_list_imports (company_id, imported_at DESC);

ALTER TABLE public.price_list_imports ENABLE ROW LEVEL SECURITY;

-- Matches QuoteMGR's live policy name and shape (from its RLS-inline-queries
-- fix migration): any company member can read and write their own history.
DROP POLICY IF EXISTS "price_list_imports_company_access" ON public.price_list_imports;
DROP POLICY IF EXISTS price_list_imports_all ON public.price_list_imports;
CREATE POLICY price_list_imports_all ON public.price_list_imports
  FOR ALL
  USING (company_id IN (SELECT public.get_my_company_ids()))
  WITH CHECK (company_id IN (SELECT public.get_my_company_ids()));

NOTIFY pgrst, 'reload schema';
