-- Bring-your-own AI keys. Target: llamtjsquoqlejznmyjl.
--
-- Every company uses its own AI provider key, so free-tier limits (Groq) are
-- never shared across companies. Keys resolve, server-side only:
--   1. the signed-in user's personal key (user_ai_configs)
--   2. the company's key (ai_configurations), set by an owner or admin for the team
-- There is no platform-wide key.
--
-- From QuoteMGR (read-only reference): 20260730_user_ai_configs.sql and
-- 20260420100001_add_upsert_my_ai_config_rpc.sql. Changes from QuoteMGR:
--   - Only owners and admins can read or change the company key. QuoteMGR let any
--     active member overwrite it, and any member could read it directly.
--   - get_my_ai_config returns the personal config when there is one, else the
--     company config, with keys masked.
--   - QuoteMGR's email-match fallback in upsert_my_ai_config is left out: it lets
--     a session claim a team_members row by email alone.

-- ── Personal keys ─────────────────────────────────────────────────────────────
create table if not exists public.user_ai_configs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  provider         text not null default 'groq',
  api_key          text not null,
  model            text not null default 'llama-3.3-70b-versatile',
  enabled          boolean not null default true,
  vision_provider  text,
  vision_api_key   text,
  vision_model     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id)
);

alter table public.user_ai_configs enable row level security;

drop policy if exists "user_ai_configs_self" on public.user_ai_configs;
create policy "user_ai_configs_self"
  on public.user_ai_configs for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.upsert_my_user_ai_config(
  p_provider        text,
  p_api_key         text,
  p_model           text,
  p_enabled         boolean default true,
  p_vision_provider text    default null,
  p_vision_api_key  text    default null,
  p_vision_model    text    default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.user_ai_configs (
    user_id, provider, api_key, model, enabled,
    vision_provider, vision_api_key, vision_model, updated_at
  )
  values (
    v_user_id, p_provider, p_api_key, p_model, p_enabled,
    p_vision_provider, p_vision_api_key, p_vision_model, now()
  )
  on conflict (user_id) do update set
    provider        = excluded.provider,
    api_key         = excluded.api_key,
    model           = excluded.model,
    enabled         = excluded.enabled,
    vision_provider = excluded.vision_provider,
    vision_api_key  = excluded.vision_api_key,
    vision_model    = excluded.vision_model,
    updated_at      = now();
end;
$$;

revoke all on function public.upsert_my_user_ai_config(text, text, text, boolean, text, text, text) from public, anon;
grant execute on function public.upsert_my_user_ai_config(text, text, text, boolean, text, text, text) to authenticated;

-- ── Company key: owners and admins only ───────────────────────────────────────
create or replace function public.upsert_my_ai_config(
  p_company_id      uuid,
  p_provider        text,
  p_api_key         text,
  p_model           text,
  p_enabled         boolean,
  p_vision_provider text,
  p_vision_api_key  text,
  p_vision_model    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_company_admin(p_company_id) then
    raise exception 'Only owners and admins can set the company AI key';
  end if;

  insert into public.ai_configurations (
    company_id, provider, api_key, model, enabled,
    vision_provider, vision_api_key, vision_model, updated_at
  ) values (
    p_company_id, p_provider, p_api_key, p_model, p_enabled,
    p_vision_provider, p_vision_api_key, p_vision_model, now()
  )
  on conflict (company_id) do update set
    provider        = excluded.provider,
    api_key         = excluded.api_key,
    model           = excluded.model,
    enabled         = excluded.enabled,
    vision_provider = excluded.vision_provider,
    vision_api_key  = excluded.vision_api_key,
    vision_model    = excluded.vision_model,
    updated_at      = excluded.updated_at;
end;
$$;

revoke all on function public.upsert_my_ai_config(uuid, text, text, text, boolean, text, text, text) from public, anon;
grant execute on function public.upsert_my_ai_config(uuid, text, text, text, boolean, text, text, text) to authenticated;

drop policy if exists ai_configurations_select on public.ai_configurations;
drop policy if exists ai_configurations_insert on public.ai_configurations;
drop policy if exists ai_configurations_update on public.ai_configurations;
drop policy if exists ai_configurations_delete on public.ai_configurations;

create policy ai_configurations_select on public.ai_configurations
  for select to authenticated using (public.is_company_admin(company_id));
create policy ai_configurations_insert on public.ai_configurations
  for insert to authenticated with check (public.is_company_admin(company_id));
create policy ai_configurations_update on public.ai_configurations
  for update to authenticated using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));
create policy ai_configurations_delete on public.ai_configurations
  for delete to authenticated using (public.is_company_admin(company_id));

-- ── What the app sees: personal config first, else the company's, keys masked ─
create or replace function public.get_my_ai_config(p_company_id uuid)
returns setof public.ai_configurations
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.company_id, c.provider, c.api_key, c.model, c.enabled, c.created_at,
         c.updated_at, c.vision_provider, c.vision_api_key, c.vision_model, c.is_approved
  from (
    select u.id, p_company_id as company_id, u.provider,
           case when coalesce(u.api_key, '') <> '' then '********' end as api_key,
           u.model, u.enabled, u.created_at, u.updated_at, u.vision_provider,
           case when coalesce(u.vision_api_key, '') <> '' then '********' end as vision_api_key,
           u.vision_model, true as is_approved, 0 as priority
    from public.user_ai_configs u
    where u.user_id = auth.uid()
      and p_company_id in (select public.get_my_company_ids())
    union all
    select a.id, a.company_id, a.provider,
           case when coalesce(a.api_key, '') <> '' then '********' end,
           a.model, a.enabled, a.created_at, a.updated_at, a.vision_provider,
           case when coalesce(a.vision_api_key, '') <> '' then '********' end,
           a.vision_model, a.is_approved, 1
    from public.ai_configurations a
    where a.company_id = p_company_id
      and p_company_id in (select public.get_my_company_ids())
  ) c
  order by c.priority
  limit 1;
$$;

revoke all on function public.get_my_ai_config(uuid) from public, anon;
grant execute on function public.get_my_ai_config(uuid) to authenticated;
