-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- INVOICE SALES TAX: optional, set per company in Settings → Company.
--
-- The New Invoice form added a fixed 8.25% to every invoice. It now adds tax only when the company turns
-- it on here, at the rate it sets. Both default to off / 0, so no company starts charging tax.
--
-- Adds columns only. No data changes. Safe to run more than once. Ends by listing the two columns.

begin;

alter table public.companies
  add column if not exists invoice_tax_enabled boolean not null default false,
  add column if not exists invoice_tax_rate numeric(6,3) not null default 0;

alter table public.companies drop constraint if exists companies_invoice_tax_rate_range;
alter table public.companies
  add constraint companies_invoice_tax_rate_range check (invoice_tax_rate >= 0 and invoice_tax_rate <= 30);

commit;

notify pgrst, 'reload schema';

select column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'companies'
   and column_name in ('invoice_tax_enabled', 'invoice_tax_rate')
 order by 1;
