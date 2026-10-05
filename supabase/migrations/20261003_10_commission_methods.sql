-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- COMMISSION METHODS: percent of the project total, or a profit split (e.g. 10/50/50).
--
--   percent_total  Commission = Project Value x the salesperson's rate (self-generated, company lead, or custom).
--                  This is what payroll has always done, so it stays the default for every company.
--   profit_split   The company takes an off-the-top percentage of the project total (default 10%). The profit that is
--                  left (Project Value - that overhead - the job's real costs) is split between sales and the
--                  company (default 50/50). Commission = the sales share of that profit.
--
-- The method is a company setting, and any salesperson can be put on a different one (some on percent of total,
-- a couple on a profit split, commercial reps on their own numbers). A salesperson's blank settings fall back to
-- the company's.
--
-- JOB COSTS are always tied to a job: a cost line belongs to one customer (material, subcontractor, labor, other).
-- Only a manager-level or project role, or Office Staff, can see or enter them. When the manager or project manager
-- has entered the material and subcontractor costs, they mark the job's costs COMPLETE. Under a profit split a job
-- becomes payable only once the first payment is collected AND the costs are marked complete.
--
-- One server function (commission_payroll_jobs) works out every job's bucket and amount, so the web and mobile
-- apps always show identical numbers.
--
-- Safe to run more than once. Adds columns, a table, functions and triggers; changes no existing row.

-- ---------------------------------------------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------------------------------------------
alter table public.companies
  add column if not exists commission_method text not null default 'percent_total',
  add column if not exists commission_overhead_pct numeric not null default 10,
  add column if not exists commission_split_sales_pct numeric not null default 50;

alter table public.companies drop constraint if exists companies_commission_method_check;
alter table public.companies add constraint companies_commission_method_check
  check (commission_method in ('percent_total', 'profit_split'));
alter table public.companies drop constraint if exists companies_commission_pcts_check;
alter table public.companies add constraint companies_commission_pcts_check
  check (commission_overhead_pct between 0 and 100 and commission_split_sales_pct between 0 and 100);

-- Per salesperson. Blank (null) means "use the company's setting".
alter table public.team_members
  add column if not exists commission_method text,
  add column if not exists commission_overhead_pct numeric,
  add column if not exists commission_split_sales_pct numeric;

alter table public.team_members drop constraint if exists team_members_commission_method_check;
alter table public.team_members add constraint team_members_commission_method_check
  check (commission_method is null or commission_method in ('percent_total', 'profit_split'));
alter table public.team_members drop constraint if exists team_members_commission_pcts_check;
alter table public.team_members add constraint team_members_commission_pcts_check
  check ((commission_overhead_pct is null or commission_overhead_pct between 0 and 100)
     and (commission_split_sales_pct is null or commission_split_sales_pct between 0 and 100));

-- Only an owner or admin may change commission settings (rates, and now the method and split), as before.
create or replace function public.guard_team_member_admin_fields()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is not null
     and (new.commission_rate_self_gen    is distinct from old.commission_rate_self_gen
       or new.commission_rate_company     is distinct from old.commission_rate_company
       or new.commission_rate_custom      is distinct from old.commission_rate_custom
       or new.commission_method           is distinct from old.commission_method
       or new.commission_overhead_pct     is distinct from old.commission_overhead_pct
       or new.commission_split_sales_pct  is distinct from old.commission_split_sales_pct
       or new.custom_permissions          is distinct from old.custom_permissions)
     and not public.is_company_admin(old.company_id) then
    raise exception 'Only a company owner or admin can change commission rates or permissions'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

create or replace function public.trg_guard_company_commission_settings()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is not null
     and (new.commission_method          is distinct from old.commission_method
       or new.commission_overhead_pct    is distinct from old.commission_overhead_pct
       or new.commission_split_sales_pct is distinct from old.commission_split_sales_pct)
     and not public.is_company_admin(old.id) then
    raise exception 'Only a company owner or admin can change the commission method.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_company_commission_settings on public.companies;
create trigger trg_guard_company_commission_settings
  before update on public.companies
  for each row
  execute function public.trg_guard_company_commission_settings();

-- ---------------------------------------------------------------------------------------------------------------
-- Job costs (always tied to one customer's job)
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.can_manage_job_costs(p_role text)
 returns boolean
 language sql
 immutable
as $function$
  select p_role in ('owner', 'admin', 'manager', 'sales_manager', 'production_manager', 'project_manager', 'office_staff');
$function$;

create table if not exists public.job_costs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  customer_id  uuid not null references public.customers(id) on delete cascade,
  category     text not null check (category in ('material', 'subcontractor', 'labor', 'other')),
  description  text,
  vendor       text,
  amount       numeric not null check (amount >= 0),
  entered_by   uuid references public.team_members(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists job_costs_customer_idx on public.job_costs (customer_id);
create index if not exists job_costs_company_idx on public.job_costs (company_id);

-- The company always comes from the customer, so a cost line can never be filed under the wrong company.
create or replace function public.trg_job_costs_fill()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_company uuid;
begin
  select company_id into v_company from public.customers where id = new.customer_id;
  if v_company is null then
    raise exception 'That job does not exist.';
  end if;
  new.company_id := v_company;
  if tg_op = 'INSERT' and new.entered_by is null then
    select tm.id into new.entered_by from public.team_members tm
    where tm.user_id = auth.uid() and tm.company_id = v_company and tm.is_active limit 1;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists trg_job_costs_fill on public.job_costs;
create trigger trg_job_costs_fill
  before insert or update on public.job_costs
  for each row
  execute function public.trg_job_costs_fill();

alter table public.job_costs enable row level security;

drop policy if exists job_costs_all on public.job_costs;
create policy job_costs_all on public.job_costs
  for all
  using (exists (
    select 1 from public.team_members tm
    where tm.user_id = auth.uid() and tm.company_id = job_costs.company_id and tm.is_active
      and public.can_manage_job_costs(tm.role)))
  with check (exists (
    select 1 from public.team_members tm
    where tm.user_id = auth.uid() and tm.company_id = job_costs.company_id and tm.is_active
      and public.can_manage_job_costs(tm.role)));

grant select, insert, update, delete on public.job_costs to authenticated;

-- "Costs complete": the manager or project manager says the material and subcontractor costs are in.
alter table public.customers add column if not exists costs_confirmed_at timestamptz;
alter table public.customers add column if not exists costs_confirmed_by uuid references public.team_members(id) on delete set null;

create or replace function public.trg_guard_costs_confirmed()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_role text;
  v_member uuid;
begin
  if tg_op = 'UPDATE'
     and new.costs_confirmed_at is not distinct from old.costs_confirmed_at
     and new.costs_confirmed_by is not distinct from old.costs_confirmed_by then
    return new;
  end if;
  if tg_op = 'INSERT' and new.costs_confirmed_at is null then
    return new;
  end if;

  if auth.uid() is not null then
    select tm.role, tm.id into v_role, v_member
    from public.team_members tm
    where tm.user_id = auth.uid() and tm.company_id = new.company_id and tm.is_active
    limit 1;
    if v_role is null or not public.can_manage_job_costs(v_role) then
      raise exception 'Only a manager, project manager or financial user can mark job costs complete.';
    end if;
  end if;

  if new.costs_confirmed_at is not null then
    if not exists (select 1 from public.job_costs jc where jc.customer_id = new.id) then
      raise exception 'Enter at least one job cost (even a $0 line) before marking costs complete.';
    end if;
    if new.costs_confirmed_by is null then
      new.costs_confirmed_by := v_member;
    end if;
  else
    new.costs_confirmed_by := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_costs_confirmed on public.customers;
create trigger trg_guard_costs_confirmed
  before insert or update of costs_confirmed_at, costs_confirmed_by
  on public.customers
  for each row
  execute function public.trg_guard_costs_confirmed();

-- ---------------------------------------------------------------------------------------------------------------
-- Which method / numbers apply to a salesperson (their own setting, else the company's)
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.member_commission_method(p_member uuid, p_company uuid)
 returns text
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select coalesce(
    (select tm.commission_method from public.team_members tm where tm.id = p_member),
    (select co.commission_method from public.companies co where co.id = p_company),
    'percent_total');
$function$;

-- ---------------------------------------------------------------------------------------------------------------
-- Commission paid guard: first payment AND (profit split) costs complete
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.trg_guard_commission_paid()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_role text;
  v_member uuid;
begin
  if tg_op = 'UPDATE'
     and new.commission_paid_at     is not distinct from old.commission_paid_at
     and new.commission_paid_by     is not distinct from old.commission_paid_by
     and new.commission_paid_amount is not distinct from old.commission_paid_amount
     and new.commission_paid_rate   is not distinct from old.commission_paid_rate then
    return new;
  end if;
  if tg_op = 'INSERT' and new.commission_paid_at is null then
    return new;
  end if;

  if auth.uid() is not null then
    select tm.role, tm.id into v_role, v_member
    from public.team_members tm
    where tm.user_id = auth.uid() and tm.company_id = new.company_id and tm.is_active
    limit 1;
    if v_role is null or not public.can_mark_commission_paid(v_role) then
      raise exception 'Only an owner, admin, manager or financial user can mark commission paid.';
    end if;
  end if;

  if new.commission_paid_at is not null
     and (tg_op = 'INSERT' or old.commission_paid_at is null) then
    -- No first payment collected yet: pending down payment.
    if not coalesce(new.deposit_paid, false)
       and not exists (select 1 from public.payments p where p.customer_id = new.id and coalesce(p.amount, 0) > 0) then
      raise exception 'Commission cannot be paid until the first payment is collected (pending down payment).';
    end if;
    -- A profit split needs the job costs entered and marked complete first.
    if public.member_commission_method(new.assigned_to, new.company_id) = 'profit_split'
       and new.costs_confirmed_at is null then
      raise exception 'Commission on a profit split cannot be paid until the job costs are entered and marked complete (pending costs).';
    end if;
  end if;

  if new.commission_paid_at is not null and new.commission_paid_by is null and v_member is not null then
    new.commission_paid_by := v_member;
  end if;
  if new.commission_paid_at is null then
    new.commission_paid_by := null;
    new.commission_paid_amount := null;
    new.commission_paid_rate := null;
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------------------------------------------
-- The payroll: every sold job with its bucket inputs and commission, worked out once for both apps.
--   Paid               commission_paid_at is set
--   Pending down pay.  no payment collected yet
--   Pending costs      profit split, payment collected, costs not yet marked complete
--   Owed               everything else
-- The apps pick the bucket from the columns below.
-- ---------------------------------------------------------------------------------------------------------------
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
    round(
      case when x.method = 'profit_split'
           then greatest(coalesce(c.project_value, 0) - coalesce(c.project_value, 0) * x.overhead / 100 - x.costs, 0) * x.split / 100
           else coalesce(c.project_value, 0) * x.rate / 100 end, 2),
    c.commission_paid_at,
    c.commission_paid_amount,
    c.commission_paid_rate
  from public.customers c
  join public.companies co on co.id = c.company_id
  left join public.team_members tm on tm.id = c.assigned_to
  cross join lateral (
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
