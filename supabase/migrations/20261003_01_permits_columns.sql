-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- The web app's Permits page (and the new mobile one) saves a permit type, issuing authority,
-- description, approval / expiry / inspection dates, a fee and notes. The `permits` table on this
-- database only has contact_id, applied_date, status, permit_number and jurisdiction, so saving a
-- permit from the web app failed with "column does not exist". This adds the missing columns.
--
-- Safe to run more than once. Adds nullable columns only; no existing row or value changes.

alter table public.permits add column if not exists permit_type        text;
alter table public.permits add column if not exists issuing_authority  text;
alter table public.permits add column if not exists description        text;
alter table public.permits add column if not exists approved_date      timestamptz;
alter table public.permits add column if not exists expires_date       timestamptz;
alter table public.permits add column if not exists inspection_date    timestamptz;
alter table public.permits add column if not exists fee                numeric;
alter table public.permits add column if not exists notes              text;

notify pgrst, 'reload schema';
