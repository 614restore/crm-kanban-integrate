-- Map providers. Target: llamtjsquoqlejznmyjl (shared TrussCTR/TrussCENTER backend).
--
-- Storm Search uses the free OpenStreetMap street map and NOAA radar from the
-- Iowa Environmental Mesonet. Like the AI assistant's keys, a person can add
-- their own map provider, and an owner or admin can add one for the team:
-- personal first, then team, then the free map. A radar tile address can
-- replace the free radar too.
--
-- Map keys load map images in the browser, so they can't be hidden the way AI
-- keys are: anyone on the team can read the team's key. Providers expect this;
-- restrict the key to the app's web address in the provider's dashboard.

create table if not exists public.company_map_settings (
  company_id         uuid primary key references public.companies(id) on delete cascade,
  provider           text not null default 'openstreetmap',
  style              text,
  api_key            text,
  custom_url         text,
  custom_attribution text,
  radar_url          text,
  updated_at         timestamptz not null default now(),
  constraint company_map_settings_provider_check
    check (provider in ('openstreetmap', 'maptiler', 'stadia', 'mapbox', 'thunderforest', 'custom')),
  constraint company_map_settings_urls_check
    check ((custom_url is null or custom_url like 'https://%') and (radar_url is null or radar_url like 'https://%'))
);

alter table public.company_map_settings enable row level security;

drop policy if exists company_map_settings_select on public.company_map_settings;
drop policy if exists company_map_settings_insert on public.company_map_settings;
drop policy if exists company_map_settings_update on public.company_map_settings;
drop policy if exists company_map_settings_delete on public.company_map_settings;

create policy company_map_settings_select on public.company_map_settings
  for select to authenticated using (company_id in (select public.get_my_company_ids()));
create policy company_map_settings_insert on public.company_map_settings
  for insert to authenticated with check (public.is_company_admin(company_id));
create policy company_map_settings_update on public.company_map_settings
  for update to authenticated using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));
create policy company_map_settings_delete on public.company_map_settings
  for delete to authenticated using (public.is_company_admin(company_id));

create table if not exists public.user_map_settings (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  provider           text not null default 'openstreetmap',
  style              text,
  api_key            text,
  custom_url         text,
  custom_attribution text,
  radar_url          text,
  updated_at         timestamptz not null default now(),
  constraint user_map_settings_provider_check
    check (provider in ('openstreetmap', 'maptiler', 'stadia', 'mapbox', 'thunderforest', 'custom')),
  constraint user_map_settings_urls_check
    check ((custom_url is null or custom_url like 'https://%') and (radar_url is null or radar_url like 'https://%'))
);

alter table public.user_map_settings enable row level security;

drop policy if exists user_map_settings_self on public.user_map_settings;
create policy user_map_settings_self on public.user_map_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
