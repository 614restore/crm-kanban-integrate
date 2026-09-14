-- Storm alerts. Target: llamtjsquoqlejznmyjl (shared TrussCTR/TrussCENTER backend).
--
-- Every 15 minutes pg_cron calls the storm-alerts edge function, which checks
-- National Weather Service storm reports and NOAA radar hail against:
--   - each company's office address (companies.storm_area_radius_miles, 50 by default):
--     one alert to everyone on the team
--   - each contact's address (companies.storm_contact_radius_miles, 3 by default):
--     an alert to the rep assigned to that contact, plus any roles the company adds
-- Alerts go to the notification bell (web and mobile) and by email.
--
-- Deploy the function before running this, with:
--   supabase functions deploy storm-alerts --no-verify-jwt --project-ref llamtjsquoqlejznmyjl
-- The cron job authenticates with a random secret kept in Vault; nobody needs to copy it.

-- ── Company settings and office location ──────────────────────────────────────
alter table public.companies
  add column if not exists storm_alerts_enabled       boolean      not null default true,
  add column if not exists storm_area_radius_miles    integer      not null default 50,
  add column if not exists storm_contact_radius_miles numeric(5,2) not null default 3,
  add column if not exists storm_min_wind_mph         integer      not null default 35,
  add column if not exists storm_contact_alert_roles  text[]       not null default '{}',
  add column if not exists storm_email_enabled        boolean      not null default true,
  add column if not exists latitude                   double precision,
  add column if not exists longitude                  double precision,
  add column if not exists geocoded_address           text,
  add column if not exists geocode_attempted_at       timestamptz;

do $$ begin
  alter table public.companies add constraint companies_storm_area_radius_check
    check (storm_area_radius_miles between 1 and 250);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.companies add constraint companies_storm_contact_radius_check
    check (storm_contact_radius_miles between 0.5 and 25);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.companies add constraint companies_storm_min_wind_check
    check (storm_min_wind_mph between 20 and 150);
exception when duplicate_object then null; end $$;

-- ── Contact locations ─────────────────────────────────────────────────────────
alter table public.customers
  add column if not exists latitude             double precision,
  add column if not exists longitude            double precision,
  add column if not exists geocoded_address     text,
  add column if not exists geocode_attempted_at timestamptz;

create index if not exists customers_company_located_idx
  on public.customers (company_id) where latitude is not null;

-- An address edit clears the saved location so the alert job looks it up again.
create or replace function public.reset_geocode_on_address_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.address, new.city, new.state, new.zip) is distinct from (old.address, old.city, old.state, old.zip) then
    new.latitude := null;
    new.longitude := null;
    new.geocoded_address := null;
    new.geocode_attempted_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists customers_reset_geocode on public.customers;
create trigger customers_reset_geocode
  before update of address, city, state, zip on public.customers
  for each row execute function public.reset_geocode_on_address_change();

drop trigger if exists companies_reset_geocode on public.companies;
create trigger companies_reset_geocode
  before update of address, city, state, zip on public.companies
  for each row execute function public.reset_geocode_on_address_change();

-- ── Which storm reports have already been alerted ─────────────────────────────
create table if not exists public.storm_alert_log (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  scope       text not null check (scope in ('contact', 'area')),
  event_key   text not null,
  created_at  timestamptz not null default now(),
  constraint storm_alert_log_unique unique nulls not distinct (company_id, scope, customer_id, event_key)
);

create index if not exists storm_alert_log_company_created_idx
  on public.storm_alert_log (company_id, created_at desc);

-- No policies: only the storm-alerts function (service role) reads or writes it.
alter table public.storm_alert_log enable row level security;

-- ── Notification columns the alerts use (no-ops where they already exist) ─────
alter table public.notifications
  add column if not exists data         jsonb,
  add column if not exists related_type text,
  add column if not exists related_id   text;

-- ── Settings: owners, admins and managers ─────────────────────────────────────
create or replace function public.update_my_storm_alert_settings(
  p_company_id           uuid,
  p_enabled              boolean,
  p_area_radius_miles    integer,
  p_contact_radius_miles numeric,
  p_min_wind_mph         integer,
  p_contact_alert_roles  text[],
  p_email_enabled        boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.team_members tm
     where tm.company_id = p_company_id
       and tm.user_id = auth.uid()
       and tm.is_active
       and tm.role in ('owner', 'admin', 'manager')
  ) then
    raise exception 'Only owners, admins and managers can change storm alert settings';
  end if;

  update public.companies
     set storm_alerts_enabled       = coalesce(p_enabled, storm_alerts_enabled),
         storm_area_radius_miles    = coalesce(p_area_radius_miles, storm_area_radius_miles),
         storm_contact_radius_miles = coalesce(p_contact_radius_miles, storm_contact_radius_miles),
         storm_min_wind_mph         = coalesce(p_min_wind_mph, storm_min_wind_mph),
         storm_contact_alert_roles  = array(
           select distinct r from unnest(coalesce(p_contact_alert_roles, '{}'::text[])) r
            where r in ('owner', 'admin', 'manager', 'member', 'salesperson', 'sales', 'canvasser')
         ),
         storm_email_enabled        = coalesce(p_email_enabled, storm_email_enabled)
   where id = p_company_id;
end;
$$;

revoke all on function public.update_my_storm_alert_settings(uuid, boolean, integer, numeric, integer, text[], boolean) from public, anon;
grant execute on function public.update_my_storm_alert_settings(uuid, boolean, integer, numeric, integer, text[], boolean) to authenticated;

-- ── Schedule: every 15 minutes ────────────────────────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'storm_alerts_cron_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'storm_alerts_cron_secret',
      'Sent by the storm-alerts cron job so only it can run the storm-alerts function'
    );
  end if;
end $$;

-- The function checks the header it receives against the Vault secret.
create or replace function public.storm_alerts_secret_matches(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from vault.decrypted_secrets
     where name = 'storm_alerts_cron_secret'
       and decrypted_secret = p_secret
  );
$$;

revoke all on function public.storm_alerts_secret_matches(text) from public, anon, authenticated;
grant execute on function public.storm_alerts_secret_matches(text) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'storm-alerts';

select cron.schedule(
  'storm-alerts',
  '*/15 * * * *',
  $cron$
    select net.http_post(
      url := 'https://llamtjsquoqlejznmyjl.supabase.co/functions/v1/storm-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-storm-alerts-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'storm_alerts_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $cron$
);
