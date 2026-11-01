-- Settings for the storm history a rep opens straight from a customer: how far
-- around the property to search, how far back, the wind and hail thresholds, and
-- a switch to hide the action entirely. The 15-minute storm alerts keep their
-- own radius and wind settings; these only drive the per-customer lookup.

alter table public.companies
  add column if not exists storm_history_enabled       boolean not null default true,
  add column if not exists storm_history_radius_miles  numeric(5,1) not null default 10,
  add column if not exists storm_history_months        integer not null default 12,
  add column if not exists storm_history_min_wind_mph  integer not null default 0,
  add column if not exists storm_history_min_hail_in    numeric(4,2) not null default 0;

alter table public.companies drop constraint if exists companies_storm_history_radius_check;
alter table public.companies add constraint companies_storm_history_radius_check
  check (storm_history_radius_miles >= 0.5 and storm_history_radius_miles <= 50);

alter table public.companies drop constraint if exists companies_storm_history_months_check;
alter table public.companies add constraint companies_storm_history_months_check
  check (storm_history_months >= 1 and storm_history_months <= 60);

comment on column public.companies.storm_history_enabled is
  'Shows the Storm action on a customer, which opens storm history for their address.';

-- The settings RPC gains the five new values. The old seven-argument version is
-- dropped first: keeping both would make a seven-argument call ambiguous. Mobile
-- and web both call it with named arguments, so the defaults cover older callers.
drop function if exists public.update_my_storm_alert_settings(uuid, boolean, integer, numeric, integer, text[], boolean);

create or replace function public.update_my_storm_alert_settings(
  p_company_id uuid,
  p_enabled boolean,
  p_area_radius_miles integer,
  p_contact_radius_miles numeric,
  p_min_wind_mph integer,
  p_contact_alert_roles text[],
  p_email_enabled boolean,
  p_history_enabled boolean default null,
  p_history_radius_miles numeric default null,
  p_history_months integer default null,
  p_history_min_wind_mph integer default null,
  p_history_min_hail_in numeric default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from public.team_members tm
     where tm.company_id = p_company_id
       and tm.user_id = auth.uid()
       and tm.is_active
       and public.is_manager_role(tm.role)
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
            where r in ('owner', 'admin', 'sales_manager', 'sales_rep', 'production_manager', 'project_manager',
                        'field_tech', 'office_staff', 'subcontractor', 'canvasser', 'field_contractor',
                        'manager', 'sales', 'salesperson', 'member', 'production', 'billing', 'canvas')
         ),
         storm_email_enabled        = coalesce(p_email_enabled, storm_email_enabled),
         storm_history_enabled      = coalesce(p_history_enabled, storm_history_enabled),
         storm_history_radius_miles = coalesce(p_history_radius_miles, storm_history_radius_miles),
         storm_history_months       = coalesce(p_history_months, storm_history_months),
         storm_history_min_wind_mph = coalesce(p_history_min_wind_mph, storm_history_min_wind_mph),
         storm_history_min_hail_in  = coalesce(p_history_min_hail_in, storm_history_min_hail_in)
   where id = p_company_id;
end;
$function$;

-- Make the API see the new columns and the new signature right away.
notify pgrst, 'reload schema';
