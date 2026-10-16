-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- COMMISSION STAYS ON PAYROLL UNTIL IT IS CHECKED OFF AS PAID.
--
-- Commission Payroll used to list a job only while the job's last change fell inside the chosen dates, and
-- only for a short list of statuses, so a job could drop off payroll without anyone having paid the
-- commission. Now a sold job stays on payroll until someone checks it off as paid.
--
-- This adds the "commission paid" stamp to a job (a customer record): when it was paid, by whom, and the
-- amount and rate at that moment (so changing a Project Value or rate later does not rewrite what was paid).
--
-- Who may check a job off, or take it back: owner, admin, manager (and the manager-level roles Sales
-- Manager and Production Manager) and Office Staff (the financial role). It is enforced here in the
-- database, so it holds whichever app is used and whatever the app shows. A salesperson cannot mark their
-- own commission paid.
--
-- COMMISSION RUNS ON THE FIRST PAYMENT. A job whose customer has had no payment collected is "pending down
-- payment" and cannot be checked off as paid. A payment is a receipt for the customer (the payments table) or a
-- deposit recorded on the customer. Taking a job back to Owed is always allowed.
--
-- Safe to run more than once. Adds columns, an index, a function and a trigger; it changes no existing
-- row, so every job starts out unpaid.

alter table public.customers add column if not exists commission_paid_at     timestamptz;
alter table public.customers add column if not exists commission_paid_by     uuid references public.team_members(id) on delete set null;
alter table public.customers add column if not exists commission_paid_amount numeric;
alter table public.customers add column if not exists commission_paid_rate   numeric;

create index if not exists customers_commission_unpaid_idx
  on public.customers (company_id) where commission_paid_at is null;

create or replace function public.can_mark_commission_paid(p_role text)
 returns boolean
 language sql
 immutable
as $function$
  select p_role in ('owner', 'admin', 'manager', 'sales_manager', 'production_manager', 'office_staff');
$function$;

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
  -- Only when the paid stamp is actually being set, changed or cleared.
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

  -- A server-side job (no signed-in user) is allowed; a person must have the right role.
  if auth.uid() is not null then
    select tm.role, tm.id into v_role, v_member
    from public.team_members tm
    where tm.user_id = auth.uid() and tm.company_id = new.company_id and tm.is_active
    limit 1;
    if v_role is null or not public.can_mark_commission_paid(v_role) then
      raise exception 'Only an owner, admin, manager or financial user can mark commission paid.';
    end if;
  end if;

  -- No first payment collected yet: the job is pending its down payment and cannot be paid.
  if new.commission_paid_at is not null
     and (tg_op = 'INSERT' or old.commission_paid_at is null)
     and not coalesce(new.deposit_paid, false)
     and not exists (select 1 from public.payments p where p.customer_id = new.id and coalesce(p.amount, 0) > 0) then
    raise exception 'Commission cannot be paid until the first payment is collected (pending down payment).';
  end if;

  -- The database records who checked it off, so the apps do not have to send it.
  if new.commission_paid_at is not null and new.commission_paid_by is null and v_member is not null then
    new.commission_paid_by := v_member;
  end if;
  -- Taking it back clears the whole stamp.
  if new.commission_paid_at is null then
    new.commission_paid_by := null;
    new.commission_paid_amount := null;
    new.commission_paid_rate := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_commission_paid on public.customers;
create trigger trg_guard_commission_paid
  before insert or update of commission_paid_at, commission_paid_by, commission_paid_amount, commission_paid_rate
  on public.customers
  for each row
  execute function public.trg_guard_commission_paid();

notify pgrst, 'reload schema';
