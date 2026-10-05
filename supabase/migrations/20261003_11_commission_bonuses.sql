-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- COMMISSION BONUSES (contests and one-off adjustments).
--
-- Teams run contests that earn extra commission. A bonus is a line on one job (a customer):
--   flat     an extra dollar amount ("$250 for the weekend blitz")
--   percent  extra percentage points of the project total ("+1% on every sale in June")
-- Each has a reason. The bonuses on a job are added to its commission under either method (percent of total or
-- profit split). A negative value takes commission off (a correction). The commission never goes below $0.
--
-- Who may add, change or delete bonuses: the people who may pay commission (owner, admin, manager, sales manager,
-- production manager, office staff). A salesperson cannot give themselves a bonus. Once a job's commission is
-- marked paid its bonuses are locked (the paid amount is saved), so take the job back to Owed to change them.
--
-- commission_payroll_jobs now returns base_amount and bonus as well as the total amount, so the apps show the
-- same figures.
--
-- Safe to run more than once. Adds a table, a function and triggers; changes no existing row.

create table if not exists public.commission_adjustments (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  customer_id  uuid not null references public.customers(id) on delete cascade,
  kind         text not null check (kind in ('flat', 'percent')),
  value        numeric not null check (value between -1000000000 and 1000000000),
  reason       text,
  created_by   uuid references public.team_members(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists commission_adjustments_customer_idx on public.commission_adjustments (customer_id);
create index if not exists commission_adjustments_company_idx on public.commission_adjustments (company_id);

-- The company comes from the customer, the person from the signed-in user, and a paid job is locked.
create or replace function public.trg_commission_adjustments_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_customer uuid;
  v_company uuid;
  v_paid timestamptz;
begin
  v_customer := case when tg_op = 'DELETE' then old.customer_id else new.customer_id end;
  select company_id, commission_paid_at into v_company, v_paid from public.customers where id = v_customer;
  -- A job that is being deleted takes its bonuses with it (cascade); nothing to guard.
  if v_company is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if v_paid is not null then
    raise exception 'This job''s commission is already paid. Take it back to Owed before changing its bonus.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.company_id := v_company;
  if tg_op = 'INSERT' and new.created_by is null then
    select tm.id into new.created_by from public.team_members tm
    where tm.user_id = auth.uid() and tm.company_id = v_company and tm.is_active limit 1;
  end if;
  if new.kind = 'percent' and new.value not between -100 and 100 then
    raise exception 'A percentage bonus must be between -100 and 100.';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_commission_adjustments_guard on public.commission_adjustments;
create trigger trg_commission_adjustments_guard
  before insert or update or delete on public.commission_adjustments
  for each row
  execute function public.trg_commission_adjustments_guard();

alter table public.commission_adjustments enable row level security;

drop policy if exists commission_adjustments_all on public.commission_adjustments;
create policy commission_adjustments_all on public.commission_adjustments
  for all
  using (exists (
    select 1 from public.team_members tm
    where tm.user_id = auth.uid() and tm.company_id = commission_adjustments.company_id and tm.is_active
      and public.can_mark_commission_paid(tm.role)))
  with check (exists (
    select 1 from public.team_members tm
    where tm.user_id = auth.uid() and tm.company_id = commission_adjustments.company_id and tm.is_active
      and public.can_mark_commission_paid(tm.role)));

grant select, insert, update, delete on public.commission_adjustments to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- The payroll function, now with bonuses. (The result columns change, so the old one is dropped first.)
-- ---------------------------------------------------------------------------------------------------------------
drop function if exists public.commission_payroll_jobs(uuid);

create or replace function public.commission_payroll_jobs(p_company_id uuid)
 returns table (
   customer_id uuid,
   first_name text,
   last_name text,
   address text,
   city text,
   state text,
   status text,
   lead_source text,
   assigned_to uuid,
   project_value numeric,
   updated_at timestamptz,
   method text,
   costs_total numeric,
   costs_confirmed boolean,
   has_payment boolean,
   overhead_pct numeric,
   split_pct numeric,
   rate_used numeric,
   base_amount numeric,
   bonus numeric,
   amount numeric,
   commission_paid_at timestamptz,
   commission_paid_amount numeric,
   commission_paid_rate numeric
 )
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_role text;
begin
  select tm.role into v_role
  from public.team_members tm
  where tm.user_id = auth.uid() and tm.company_id = p_company_id and tm.is_active
  limit 1;
  if v_role is null or v_role not in ('owner', 'admin', 'manager', 'sales_manager', 'office_staff') then
    raise exception 'You do not have access to Commission Payroll.' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.first_name::text,
    c.last_name::text,
    c.address::text,
    c.city::text,
    c.state::text,
    c.status::text,
    c.lead_source::text,
    c.assigned_to,
    coalesce(c.project_value, 0)::numeric,
    c.updated_at,
    x.method,
    x.costs,
    (c.costs_confirmed_at is not null),
    x.paid_in,
    x.overhead,
    x.split,
    x.rate,
    x.base,
    x.bonus,
    round(greatest(x.base + x.bonus, 0), 2),
    c.commission_paid_at,
    c.commission_paid_amount,
    c.commission_paid_rate
  from public.customers c
  join public.companies co on co.id = c.company_id
  left join public.team_members tm on tm.id = c.assigned_to
  cross join lateral (
    select
      y.method, y.costs, y.paid_in, y.overhead, y.split, y.rate,
      round(
        case when y.method = 'profit_split'
             then greatest(coalesce(c.project_value, 0) - coalesce(c.project_value, 0) * y.overhead / 100 - y.costs, 0) * y.split / 100
             else coalesce(c.project_value, 0) * y.rate / 100 end, 2) as base,
      round(coalesce((
        select sum(case when a.kind = 'percent' then coalesce(c.project_value, 0) * a.value / 100 else a.value end)
        from public.commission_adjustments a where a.customer_id = c.id), 0), 2) as bonus
    from (
      select
        coalesce(tm.commission_method, co.commission_method) as method,
        (select coalesce(sum(jc.amount), 0) from public.job_costs jc where jc.customer_id = c.id) as costs,
        (coalesce(c.deposit_paid, false)
          or exists (select 1 from public.payments p where p.customer_id = c.id and coalesce(p.amount, 0) > 0)) as paid_in,
        coalesce(tm.commission_overhead_pct, co.commission_overhead_pct) as overhead,
        coalesce(tm.commission_split_sales_pct, co.commission_split_sales_pct) as split,
        case
          when coalesce(tm.commission_method, co.commission_method) = 'profit_split'
            then coalesce(tm.commission_split_sales_pct, co.commission_split_sales_pct)
          when coalesce(tm.commission_rate_custom, 0) > 0 then tm.commission_rate_custom
          when c.lead_source = 'Self Generated' then coalesce(tm.commission_rate_self_gen, 0)
          else coalesce(tm.commission_rate_company, 0)
        end as rate
    ) y
  ) x
  where c.company_id = p_company_id
    and coalesce(c.project_value, 0) > 0
    and (c.commission_paid_at is not null
         or c.status in ('signed', 'ordering_material', 'scheduled', 'in_progress', 'build_phase', 'cleanup',
                         'punch_list', 'invoicing', 'pending_payment', 'completed', 'paid'));
end;
$function$;

grant execute on function public.commission_payroll_jobs(uuid) to authenticated;

notify pgrst, 'reload schema';
