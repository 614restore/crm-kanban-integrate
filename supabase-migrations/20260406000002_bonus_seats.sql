-- Allows platform admin (you) to grant extra seats to a company
-- without requiring them to change their subscription plan.
-- Update via Supabase Table Editor: set bonus_seats = N for the company row.

alter table public.companies
  add column if not exists bonus_seats integer not null default 0;

comment on column public.companies.bonus_seats is
  'Extra seats granted by platform admin on top of the subscription plan limit.';
