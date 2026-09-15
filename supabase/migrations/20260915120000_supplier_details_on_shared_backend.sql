-- Supplier detail columns the TrussCTR Suppliers screen writes and reads,
-- missing on the shared TrussCTR/TrussCENTER backend (llamtjsquoqlejznmyjl).
-- Saving a supplier failed with:
--   Could not find the 'account_number' column of 'suppliers' in the schema cache
--
-- Additive. suppliers held 0 rows when this was written, TrussCENTER mobile does
-- not read it, and QuoteMGR has no suppliers table. Types follow the original
-- TrussCTR definition in 20260306000002_missing_tables.sql.

alter table public.suppliers
  add column if not exists city           text,
  add column if not exists state          text,
  add column if not exists zip            text,
  add column if not exists website        text,
  add column if not exists account_number text,
  add column if not exists payment_terms  text;

-- Make the API see the new columns right away.
notify pgrst, 'reload schema';
