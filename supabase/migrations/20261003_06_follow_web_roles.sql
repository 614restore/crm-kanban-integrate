-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- ROLES: make the database speak the same role names as the web app.
--
-- Before: team_members.role could only be owner, admin, manager, salesperson, sales, member or
-- canvasser, so adding someone on the web app as a Sales Manager, Production Manager, Project Manager,
-- Office Staff, Sales Rep, Field Tech/Crew or Subcontractor was refused by the database and that person
-- could not exist.
--
-- After: the database accepts the web app's full role list (and keeps the older names so every existing
-- user keeps working). Mobile follows the same list.
--
-- The database also has role checks of its own (who can edit other people's notes and quote line items,
-- who can invite people, who can change auto-countersign and storm alert settings, who can write
-- material orders). Those only knew "owner, admin, manager", so a Sales Manager would have been offered
-- powers on the web app that the database then refused. They now go through two small functions:
--
--   is_manager_role(role)  owner, admin, manager (older name), sales_manager, production_manager
--   is_project_role(role)  the above plus project_manager (who runs jobs and material orders)
--
-- Unchanged on purpose: is_company_admin (owner, admin) still guards commission rates, per-person
-- permissions and editing other team members, and billing events stay owner/admin only.
--
-- Safe to run more than once. No person's role and no data changes.

-- 1) The role names the database accepts -------------------------------------------------------------

alter table public.team_members drop constraint if exists team_members_role_check;
alter table public.team_members add constraint team_members_role_check check (role = any (array[
  -- the web app's roles
  'owner', 'admin', 'sales_manager', 'sales_rep', 'production_manager', 'project_manager',
  'field_tech', 'office_staff', 'subcontractor', 'canvasser', 'field_contractor',
  -- older names, still accepted so existing users keep working
  'manager', 'sales', 'salesperson', 'member', 'production', 'billing', 'canvas'
]::text[]));

alter table public.team_invites drop constraint if exists team_invites_role_check;
alter table public.team_invites add constraint team_invites_role_check check (role = any (array[
  'admin', 'sales_manager', 'sales_rep', 'production_manager', 'project_manager',
  'field_tech', 'office_staff', 'subcontractor', 'canvasser', 'field_contractor',
  'manager', 'sales', 'salesperson', 'member', 'production', 'billing', 'canvas'
]::text[]));

-- 2) Role groups -------------------------------------------------------------------------------------

create or replace function public.is_manager_role(p_role text)
 returns boolean
 language sql
 immutable
as $function$
  select p_role in ('owner', 'admin', 'manager', 'sales_manager', 'production_manager');
$function$;

create or replace function public.is_project_role(p_role text)
 returns boolean
 language sql
 immutable
as $function$
  select p_role in ('owner', 'admin', 'manager', 'sales_manager', 'production_manager', 'project_manager');
$function$;

-- 3) Database functions that checked "owner, admin, manager" ------------------------------------------

create or replace function public.set_company_auto_countersign(p_enabled boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_company uuid;
begin
  select tm.company_id into v_company
    from public.team_members tm
   where (tm.user_id = auth.uid() or tm.id = auth.uid())
     and tm.is_active
     and public.is_manager_role(tm.role)
   limit 1;
  if v_company is null then
    raise exception 'Only an owner, admin or manager can change this';
  end if;
  update public.companies set auto_countersign_enabled = p_enabled where id = v_company;
end;
$function$;

create or replace function public.update_my_storm_alert_settings(p_company_id uuid, p_enabled boolean, p_area_radius_miles integer, p_contact_radius_miles numeric, p_min_wind_mph integer, p_contact_alert_roles text[], p_email_enabled boolean)
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
         storm_email_enabled        = coalesce(p_email_enabled, storm_email_enabled)
   where id = p_company_id;
end;
$function$;

-- 4) Row-level security that checked "owner, admin, manager" ------------------------------------------

drop policy if exists material_orders_write on public.material_orders;
create policy material_orders_write on public.material_orders
  for all
  using (
    company_id in (select get_my_company_ids())
    and exists (select 1 from public.team_members tm
                 where tm.company_id = material_orders.company_id and tm.user_id = auth.uid()
                   and tm.is_active = true and public.is_project_role(tm.role))
  )
  with check (
    company_id in (select get_my_company_ids())
    and exists (select 1 from public.team_members tm
                 where tm.company_id = material_orders.company_id and tm.user_id = auth.uid()
                   and tm.is_active = true and public.is_project_role(tm.role))
  );

drop policy if exists notes_delete on public.notes;
create policy notes_delete on public.notes
  for delete
  using (
    company_id in (select get_my_company_ids())
    and exists (select 1 from public.team_members tm
                 where tm.company_id = notes.company_id and tm.user_id = auth.uid()
                   and (tm.id = notes.author_id or public.is_manager_role(tm.role)))
  );

drop policy if exists quote_line_items_insert on public.quote_line_items;
create policy quote_line_items_insert on public.quote_line_items
  for insert
  with check (exists (
    select 1 from public.quotes q join public.team_members tm on tm.company_id = q.company_id
     where q.id = quote_line_items.quote_id and tm.user_id = auth.uid() and tm.is_active = true
       and q.status <> all (array['viewed', 'signed'])
       and (q.created_by = tm.id or public.is_manager_role(tm.role))));

drop policy if exists quote_line_items_update on public.quote_line_items;
create policy quote_line_items_update on public.quote_line_items
  for update
  using (exists (
    select 1 from public.quotes q join public.team_members tm on tm.company_id = q.company_id
     where q.id = quote_line_items.quote_id and tm.user_id = auth.uid() and tm.is_active = true
       and q.status <> all (array['viewed', 'signed'])
       and (q.created_by = tm.id or public.is_manager_role(tm.role))));

drop policy if exists quote_line_items_delete on public.quote_line_items;
create policy quote_line_items_delete on public.quote_line_items
  for delete
  using (exists (
    select 1 from public.quotes q join public.team_members tm on tm.company_id = q.company_id
     where q.id = quote_line_items.quote_id and tm.user_id = auth.uid() and tm.is_active = true
       and q.status <> all (array['viewed', 'signed'])
       and (q.created_by = tm.id or public.is_manager_role(tm.role))));

drop policy if exists team_members_can_invite on public.team_invites;
create policy team_members_can_invite on public.team_invites
  for insert
  with check (
    company_id in (select get_my_company_ids())
    and exists (select 1 from public.team_members tm
                 where tm.company_id = team_invites.company_id and tm.user_id = auth.uid()
                   and tm.is_active = true and public.is_manager_role(tm.role))
  );

drop policy if exists team_members_can_cancel_invite on public.team_invites;
create policy team_members_can_cancel_invite on public.team_invites
  for delete
  using (
    company_id in (select get_my_company_ids())
    and exists (select 1 from public.team_members tm
                 where tm.company_id = team_invites.company_id and tm.user_id = auth.uid()
                   and tm.is_active = true and public.is_manager_role(tm.role))
  );

notify pgrst, 'reload schema';
