-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- PAYMENTS: finish "only owners and managers can delete a payment".
--
-- 20261021_01 replaced "payments_company_isolation" with per-command policies, but the live database also
-- had a hand-added policy that is not in the repo:
--
--   payments_all  FOR ALL  using / with check (company_id in (select get_my_company_ids()))
--
-- Policies are permissive, so payments_all still let any company member delete. This drops it. Because it
-- matched the company through get_my_company_ids() (team membership) while the 01 policies match through
-- profiles.company_id, the select / insert / update policies now accept either, so nobody loses the read,
-- add or edit access payments_all gave them. Delete accepts either company match too, and still requires
-- an active owner / admin / manager / sales_manager / production_manager team_members row in the
-- payment's company.
--
-- Safe to run more than once. No data changes. Ends by listing the policies left on payments, and fails
-- (rolling everything back) if any policy other than payments_delete would still allow a delete.

begin;

drop policy if exists payments_all on public.payments;

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select
  using (
    company_id in (select company_id from public.profiles where id = auth.uid())
    or company_id in (select get_my_company_ids())
  );

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert
  with check (
    company_id in (select company_id from public.profiles where id = auth.uid())
    or company_id in (select get_my_company_ids())
  );

drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments
  for update
  using (
    company_id in (select company_id from public.profiles where id = auth.uid())
    or company_id in (select get_my_company_ids())
  )
  with check (
    company_id in (select company_id from public.profiles where id = auth.uid())
    or company_id in (select get_my_company_ids())
  );

drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments
  for delete
  using (
    (company_id in (select company_id from public.profiles where id = auth.uid())
     or company_id in (select get_my_company_ids()))
    and exists (select 1 from public.team_members tm
                 where tm.company_id = payments.company_id and tm.user_id = auth.uid()
                   and tm.is_active = true and public.is_manager_role(tm.role))
  );

-- A warning is easy to miss in the CLI output, so a policy that would still allow other roles to delete
-- stops the migration instead.
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
    raise exception 'payments still has other policies that allow DELETE: %. Nothing was changed.', v_names;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';

select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'payments' order by 1;
