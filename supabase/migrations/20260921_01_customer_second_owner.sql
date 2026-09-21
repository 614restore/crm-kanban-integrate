-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
-- RUN THIS BEFORE deploying the test/quotemgr-sync build.
--
-- A second property owner on the customer record, as in QuoteMGR: the quote
-- builder, the contingency agreement, the signed document and the PDFs name both
-- owners. The ported code selects and saves these columns, so they must exist.
-- Additive and safe to run more than once. Existing rows are left null.
alter table public.customers
  add column if not exists second_first_name text,
  add column if not exists second_last_name  text,
  add column if not exists second_phone      text,
  add column if not exists second_email      text;

notify pgrst, 'reload schema';
