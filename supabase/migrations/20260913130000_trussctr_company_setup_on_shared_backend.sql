-- TrussCTR on the shared backend: sign-up, company settings, team profiles and
-- password resets.
-- Target: llamtjsquoqlejznmyjl. Additive: new columns, one view column appended,
-- a trigger that fills member names, and five functions TrussCTR calls that only
-- existed on the retired backend, rewritten for team_members + companies (here
-- `profiles` is a read-only view over team_members, so the old versions, which
-- wrote to profiles, cannot simply be re-run).

-- ── 1. Columns the web app writes ─────────────────────────────────────────────
alter table public.team_members add column if not exists must_change_password boolean not null default false;
alter table public.team_members add column if not exists updated_at timestamptz not null default now();
alter table public.companies add column if not exists tax_id text;

-- ── 2. profiles ───────────────────────────────────────────────────────────────
-- must_change_password becomes the real column (temp-password-reset sets it,
-- confirm-password-change clears it) and updated_at is appended so those
-- functions' updates succeed. Existing columns keep their names and order.
create or replace view public.profiles
with (security_invoker = true)
as
select
  tm.user_id as id,
  tm.company_id,
  tm.email,
  tm.full_name,
  tm.first_name,
  tm.last_name,
  tm.role,
  tm.phone,
  tm.avatar_url,
  tm.is_active,
  tm.must_change_password,
  false as is_limited_account,
  tm.created_at,
  tm.updated_at
from public.team_members tm
where tm.user_id is not null;

-- ── 3. Member names ───────────────────────────────────────────────────────────
-- Sign-up and the add-member function write full_name only, while the web app
-- lists and orders people by first_name/last_name. Fill whichever side is missing.
create or replace function public.fill_team_member_names()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.full_name is not null and btrim(new.full_name) <> '' then
    new.first_name := coalesce(new.first_name, split_part(btrim(new.full_name), ' ', 1));
    new.last_name  := coalesce(new.last_name, nullif(regexp_replace(btrim(new.full_name), '^\S+\s*', ''), ''));
  elsif new.first_name is not null or new.last_name is not null then
    new.full_name := nullif(btrim(coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, '')), '');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fill_team_member_names on public.team_members;
create trigger trg_fill_team_member_names
  before insert on public.team_members
  for each row execute function public.fill_team_member_names();

-- ── 4. update_my_company ──────────────────────────────────────────────────────
-- Same arguments TrussCTR sends. Owners and admins only, matching the
-- companies update policy. TrussCTR field names map onto the shared columns.
create or replace function public.update_my_company(
  p_name text default null,
  p_phone text default null,
  p_email text default null,
  p_website text default null,
  p_address text default null,
  p_city text default null,
  p_state text default null,
  p_zip text default null,
  p_logo_url text default null,
  p_tagline text default null,
  p_contractor_license text default null,
  p_tax_id text default null,
  p_from_email text default null,
  p_from_name text default null
)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := (select id from public.get_my_company());
  v_result public.companies;
begin
  if v_company_id is null then
    raise exception 'No company found for the current user';
  end if;
  if not public.is_company_admin(v_company_id) then
    raise exception 'Only owners and admins can change company details';
  end if;

  update public.companies set
    name               = coalesce(p_name, name),
    phone              = coalesce(p_phone, phone),
    email              = coalesce(p_email, email),
    website            = coalesce(p_website, website),
    address            = coalesce(p_address, address),
    city               = coalesce(p_city, city),
    state              = coalesce(p_state, state),
    zip                = coalesce(p_zip, zip),
    logo_url           = coalesce(p_logo_url, logo_url),
    about_tagline      = coalesce(p_tagline, about_tagline),
    license_number     = coalesce(p_contractor_license, license_number),
    tax_id             = coalesce(p_tax_id, tax_id),
    quote_sender_email = coalesce(p_from_email, quote_sender_email),
    quote_sender_name  = coalesce(p_from_name, quote_sender_name),
    updated_at         = now()
  where id = v_company_id
  returning * into v_result;

  return v_result;
end;
$$;

-- ── 5. set_my_company_logo ────────────────────────────────────────────────────
create or replace function public.set_my_company_logo(p_logo_url text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := (select id from public.get_my_company());
  v_logo_url text;
begin
  if v_company_id is null then
    raise exception 'No company found for the current user';
  end if;
  if not public.is_company_admin(v_company_id) then
    raise exception 'Only owners and admins can change the company logo';
  end if;

  update public.companies
  set logo_url = p_logo_url, updated_at = now()
  where id = v_company_id
  returning logo_url into v_logo_url;

  return v_logo_url;
end;
$$;

-- ── 6. start_fresh_workspace ──────────────────────────────────────────────────
-- A new, empty company owned by the caller. Their current membership is
-- deactivated rather than deleted, so the old company's data is untouched.
create or replace function public.start_fresh_workspace()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.team_members;
  v_email text;
  v_company_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_member
  from public.team_members
  where user_id = v_uid and is_active = true
  limit 1;

  v_email := coalesce(nullif(btrim(v_member.email), ''), (select email from auth.users where id = v_uid));

  insert into public.companies (name, email)
  values (coalesce(nullif(split_part(v_email, '@', 1), ''), 'My') || '''s Company', v_email)
  returning id into v_company_id;

  update public.team_members
  set is_active = false, updated_at = now()
  where user_id = v_uid and is_active = true;

  insert into public.team_members (company_id, user_id, email, full_name, first_name, last_name, phone, avatar_url, role, is_active)
  values (v_company_id, v_uid, v_email, v_member.full_name, v_member.first_name, v_member.last_name,
          v_member.phone, v_member.avatar_url, 'owner', true);

  return v_company_id;
end;
$$;

-- ── 7. delete_my_account ──────────────────────────────────────────────────────
-- Deleting the auth user cascades to team_members. A company left with no
-- members at all is removed with it.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_company_ids uuid[];
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(array_agg(distinct company_id), '{}') into v_company_ids
  from public.team_members
  where user_id = v_uid;

  delete from auth.users where id = v_uid;

  delete from public.companies c
  where c.id = any(v_company_ids)
    and not exists (select 1 from public.team_members tm where tm.company_id = c.id);
end;
$$;

-- ── 8. update_team_member_profile ─────────────────────────────────────────────
-- p_profile_id is the auth user id (profiles.id). Anyone may edit their own name
-- and phone. Changing someone else needs an owner or admin in the same company.
-- The retired backend's version let anyone set their own role, so any user could
-- make themselves an owner; that is closed here, and only an owner can create
-- or change an owner.
create or replace function public.update_team_member_profile(
  p_profile_id uuid,
  p_first_name text default null,
  p_last_name text default null,
  p_email text default null,
  p_role text default null,
  p_department text default null,
  p_phone text default null,
  p_is_active boolean default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target public.team_members;
  v_is_self boolean;
  v_caller_is_owner boolean;
  v_result public.profiles;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_target
  from public.team_members
  where user_id = p_profile_id
    and company_id in (select public.get_my_company_ids())
  order by is_active desc
  limit 1;

  if v_target.id is null then
    raise exception 'Cannot update profiles outside your company';
  end if;

  v_is_self := p_profile_id = v_uid;
  v_caller_is_owner := exists (
    select 1 from public.team_members
    where company_id = v_target.company_id and user_id = v_uid and role = 'owner' and is_active = true
  );

  if not v_is_self and not public.is_company_admin(v_target.company_id) then
    raise exception 'Only owners and admins can update other team members';
  end if;

  if v_is_self and ((p_role is not null and p_role is distinct from v_target.role)
                 or (p_is_active is not null and p_is_active is distinct from v_target.is_active)) then
    raise exception 'You cannot change your own role or active status';
  end if;

  if not v_caller_is_owner
     and ((p_role = 'owner' and v_target.role is distinct from 'owner')
          or (v_target.role = 'owner' and ((p_role is not null and p_role <> 'owner') or p_is_active = false))) then
    raise exception 'Only an owner can add or change an owner';
  end if;

  update public.team_members set
    first_name = coalesce(p_first_name, first_name),
    last_name  = coalesce(p_last_name, last_name),
    full_name  = case
                   when p_first_name is not null or p_last_name is not null
                     then nullif(btrim(coalesce(p_first_name, first_name, '') || ' ' || coalesce(p_last_name, last_name, '')), '')
                   else full_name
                 end,
    email      = coalesce(p_email, email),
    role       = coalesce(p_role, role),
    phone      = coalesce(p_phone, phone),
    is_active  = coalesce(p_is_active, is_active),
    updated_at = now()
  where id = v_target.id;

  select * into v_result
  from public.profiles
  where id = p_profile_id and company_id = v_target.company_id
  limit 1;

  return v_result;
end;
$$;

-- ── 9. Who can call these ─────────────────────────────────────────────────────
revoke all on function public.update_my_company(text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.set_my_company_logo(text) from public, anon;
revoke all on function public.start_fresh_workspace() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.update_team_member_profile(uuid, text, text, text, text, text, text, boolean) from public, anon;
revoke all on function public.fill_team_member_names() from public, anon, authenticated;

grant execute on function public.update_my_company(text, text, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.set_my_company_logo(text) to authenticated;
grant execute on function public.start_fresh_workspace() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.update_team_member_profile(uuid, text, text, text, text, text, text, boolean) to authenticated;
