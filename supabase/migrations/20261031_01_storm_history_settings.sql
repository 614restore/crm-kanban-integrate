-- Customer storm history settings. Target: llamtjsquoqlejznmyjl (shared TrussCTR/TrussCENTER backend).
--
-- The phone app's Customers list has a Storm swipe action that opens storm history
-- around the customer's address. These company settings decide what it shows:
--   storm_history_months         how far back to look (1-120 months, default 12)
--   storm_history_radius_miles   distance around the address (0.5-100 miles, default 10)
--   storm_history_min_wind_mph   hide wind reports below this speed (0 = show all)
--   storm_history_min_hail_in    hide hail below this diameter in inches (0 = show all)
-- Owners, admins and managers change them (web Settings → Notifications, or the
-- phone app's Storm Alerts settings). Additive only; safe to run more than once.

alter table public.companies
  add column if not exists storm_history_months       integer      not null default 12,
  add column if not exists storm_history_radius_miles numeric(5,2) not null default 10,
  add column if not exists storm_history_min_wind_mph integer      not null default 0,
  add column if not exists storm_history_min_hail_in  numeric(4,2) not null default 0;

do $$ begin
  alter table public.companies add constraint companies_storm_history_months_check
    check (storm_history_months between 1 and 120);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.companies add constraint companies_storm_history_radius_check
    check (storm_history_radius_miles between 0.5 and 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.companies add constraint companies_storm_history_min_wind_check
    check (storm_history_min_wind_mph between 0 and 150);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.companies add constraint companies_storm_history_min_hail_check
    check (storm_history_min_hail_in between 0 and 6);
exception when duplicate_object then null; end $$;

create or replace function public.update_my_storm_history_settings(
  p_company_id   uuid,
  p_months       integer,
  p_radius_miles numeric,
  p_min_wind_mph integer,
  p_min_hail_in  numeric
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
    raise exception 'Only owners, admins and managers can change storm history settings';
  end if;

  update public.companies
     set storm_history_months       = coalesce(p_months, storm_history_months),
         storm_history_radius_miles = coalesce(p_radius_miles, storm_history_radius_miles),
         storm_history_min_wind_mph = coalesce(p_min_wind_mph, storm_history_min_wind_mph),
         storm_history_min_hail_in  = coalesce(p_min_hail_in, storm_history_min_hail_in)
   where id = p_company_id;
end;
$$;

revoke all on function public.update_my_storm_history_settings(uuid, integer, numeric, integer, numeric) from public, anon;
grant execute on function public.update_my_storm_history_settings(uuid, integer, numeric, integer, numeric) to authenticated;

notify pgrst, 'reload schema';
