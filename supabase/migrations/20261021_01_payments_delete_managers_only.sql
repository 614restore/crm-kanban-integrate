-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- PAYMENTS: only owners and managers can delete a payment.
--
-- Before: the only policy on public.payments was "payments_company_isolation" (FOR ALL), so any member
-- of the company could delete a payment through the API, even though the web app only shows the Delete
-- button to owners and managers (CAN_DELETE_PAYMENTS in src/components/crm/CustomerPayments.tsx).
--
-- After: that one policy becomes four, one per command.
--   payments_select / payments_insert / payments_update  exactly what "payments_company_isolation" allowed
--                                                        (the payment's company is the caller's profile company)
--   payments_delete                                      the same, and the caller is an active team member of
--                                                        the payment's company whose role passes
--                                                        is_manager_role(): owner, admin, manager,
--                                                        sales_manager, production_manager
--
-- The role comes from team_members.role, like every other role check in the database
-- (see 20261003_06_follow_web_roles.sql). profiles.role is not used: a user can edit their own profile row.
--
-- The mobile app (TrussCENTER) only reads payments and never deletes them; its edge functions use the
-- service role, which RLS does not apply to.
--
-- Safe to run more than once. No data changes. Other policies on payments are left alone; any that would
-- still let other roles delete are reported as a warning at the end.

begin;

-- 1) is_manager_role() comes from 20261003_06_follow_web_roles.sql. Create it only if it is missing so a
--    live definition is never overwritten.
do $$
begin
  if to_regprocedure('public.is_manager_role(text)') is null then
    execute $f$
      create function public.is_manager_role(p_role text)
       returns boolean
       language sql
       immutable
      as $body$
        select p_role in ('owner', 'admin', 'manager', 'sales_manager', 'production_manager');
      $body$
    $f$;
  end if;
end $$;

-- 2) Replace the FOR ALL policy with per-command policies --------------------------------------------

drop policy if exists "payments_company_isolation" on public.payments;

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select
  using (company_id in (select company_id from public.profiles where id = auth.uid()));

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert
  with check (company_id in (select company_id from public.profiles where id = auth.uid()));

drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments
  for update
  using (company_id in (select company_id from public.profiles where id = auth.uid()))
  with check (company_id in (select company_id from public.profiles where id = auth.uid()));

drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments
  for delete
  using (
    company_id in (select company_id from public.profiles where id = auth.uid())
    and exists (select 1 from public.team_members tm
                 where tm.company_id = payments.company_id and tm.user_id = auth.uid()
                   and tm.is_active = true and public.is_manager_role(tm.role))
  );

-- 3) Report other permissive policies that would still allow a delete -------------------------------

do $$
declare
  v_names text;
begin
  select string_agg(format('%I (%s)', policyname, cmd), ', ') into v_names
    from pg_policies
   where schemaname = 'public' and tablename = 'payments'
     and permissive = 'PERMISSIVE' and cmd in ('ALL', 'DELETE')
     and policyname <> 'payments_delete';
  if v_names is not null then
    raise warning 'payments still has other policies that allow DELETE, so non-managers may still delete: %', v_names;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
