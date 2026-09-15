-- Columns the TrussCTR web screens write that the shared TrussCTR/TrussCENTER
-- backend (llamtjsquoqlejznmyjl) lacks. Saves failed with
--   Could not find the 'X' column of 'Y' in the schema cache
--
-- Additive except one relaxed check constraint (communications.direction also
-- allows 'internal'). All of these tables held 0 rows when this was written and
-- the TrussCENTER mobile app does not read them, except team_members, which only
-- gains nullable/defaulted columns. QuoteMGR has none of these tables or
-- columns, so the definitions follow the original TrussCTR migrations
-- (20260307000003_v2_pm_features.sql, 20260309000001_add_commission_subcontractor.sql,
-- fix-3-prod-errors-20260309.sql) adjusted to what the code writes today.
--
-- Screens fixed in code instead (llamt already has an equivalent column):
-- audit logs (data jsonb), document scanner (url/size), invite acceptance
-- (status), kanban column names (name).

-- ── Change orders: ChangeOrderModal and the /sign-change-order page ──────────
alter table public.change_orders
  add column if not exists title          text,
  add column if not exists subtotal       numeric(12,2) not null default 0,
  add column if not exists tax            numeric(12,2) not null default 0,
  add column if not exists total          numeric(12,2) not null default 0,
  add column if not exists items          jsonb not null default '[]'::jsonb,
  add column if not exists notes          text,
  add column if not exists created_by     uuid,
  add column if not exists sign_token     text,
  add column if not exists sent_at        timestamptz,
  add column if not exists signed_by_name text,
  add column if not exists signature_data text,
  add column if not exists signed_ip      text;

create unique index if not exists change_orders_sign_token_key
  on public.change_orders (sign_token) where sign_token is not null;
create index if not exists change_orders_contact_idx
  on public.change_orders (contact_id);

-- ── Communications: activity log, inspections, communication hub ────────────
-- user_id is the auth user who logged the entry (the web app's profile id).
-- author_id stays for team_members-based writers. No foreign key, so a stale
-- or demo id never blocks a timeline note.
alter table public.communications
  add column if not exists user_id uuid,
  add column if not exists subject text;

alter table public.communications drop constraint if exists communications_direction_check;
alter table public.communications add constraint communications_direction_check
  check (direction = any (array['inbound'::text, 'outbound'::text, 'internal'::text]));

-- ── Companies: Settings → Features toggles ──────────────────────────────────
alter table public.companies
  add column if not exists features jsonb;

-- ── Crew schedule ───────────────────────────────────────────────────────────
-- crew_member_id holds either a team member's user id or a subcontractor_crews
-- id, so it has no foreign key. scheduled_date stays timestamptz; the screen
-- compares on its date part.
alter table public.crew_schedules
  add column if not exists crew_member_id   uuid,
  add column if not exists subcontractor_id uuid,
  add column if not exists job_id           uuid,
  add column if not exists title            text,
  add column if not exists start_time       time,
  add column if not exists end_time         time,
  add column if not exists status           text not null default 'scheduled',
  add column if not exists created_by       uuid;

alter table public.crew_schedules drop constraint if exists crew_schedules_status_check;
alter table public.crew_schedules add constraint crew_schedules_status_check
  check (status in ('scheduled', 'in_progress', 'completed', 'cancelled'));

create index if not exists crew_schedules_company_date_idx
  on public.crew_schedules (company_id, scheduled_date);

alter table public.subcontractor_crews
  add column if not exists notes text;

-- ── Equipment ───────────────────────────────────────────────────────────────
-- assigned_to holds a team member's user id or, from "Assign to job", a
-- contact id, so it has no foreign key.
alter table public.equipment
  add column if not exists category         text not null default 'tool',
  add column if not exists make             text,
  add column if not exists model            text,
  add column if not exists year             integer,
  add column if not exists serial_number    text,
  add column if not exists license_plate    text,
  add column if not exists vin              text,
  add column if not exists purchase_date    date,
  add column if not exists purchase_price   numeric(12,2),
  add column if not exists last_maintenance date,
  add column if not exists next_maintenance date,
  add column if not exists assigned_to      uuid,
  add column if not exists created_by       uuid;

alter table public.equipment drop constraint if exists equipment_category_check;
alter table public.equipment add constraint equipment_category_check
  check (category in ('tool', 'vehicle', 'machinery', 'other'));

create index if not exists equipment_company_idx on public.equipment (company_id);

-- ── Pipeline boards: create/edit board ──────────────────────────────────────
alter table public.kanban_boards
  add column if not exists visible_to text[] not null default '{}',
  add column if not exists created_by uuid,
  add column if not exists is_default boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.kanban_columns
  add column if not exists status text;

-- ── Team: commission rates, custom permissions, UI prefs ────────────────────
alter table public.team_members
  add column if not exists commission_rate_self_gen numeric(5,2) default 0,
  add column if not exists commission_rate_company  numeric(5,2) default 0,
  add column if not exists commission_rate_custom   numeric(5,2) default 0,
  add column if not exists custom_permissions       jsonb,
  add column if not exists ui_prefs                 jsonb;

-- team_members_update_self lets people edit their own row. Keep commission
-- rates and permissions owner/admin-only, like role changes in
-- update_team_member_profile. Service-role calls (no auth.uid()) pass.
create or replace function public.guard_team_member_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and (new.commission_rate_self_gen is distinct from old.commission_rate_self_gen
       or new.commission_rate_company  is distinct from old.commission_rate_company
       or new.commission_rate_custom   is distinct from old.commission_rate_custom
       or new.custom_permissions       is distinct from old.custom_permissions)
     and not public.is_company_admin(old.company_id) then
    raise exception 'Only a company owner or admin can change commission rates or permissions'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_team_member_admin_fields on public.team_members;
create trigger trg_guard_team_member_admin_fields
  before update on public.team_members
  for each row
  execute function public.guard_team_member_admin_fields();

-- profiles is the web app's view over team_members. Same columns in the same
-- order, new ones appended, so updates through it keep working.
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
  tm.updated_at,
  tm.commission_rate_self_gen,
  tm.commission_rate_company,
  tm.commission_rate_custom,
  tm.custom_permissions,
  tm.ui_prefs
from public.team_members tm
where tm.user_id is not null;

-- Make the API see the new columns right away.
notify pgrst, 'reload schema';
