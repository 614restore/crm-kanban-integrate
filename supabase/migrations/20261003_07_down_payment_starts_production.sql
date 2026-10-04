-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- A down payment hands the job from sales to production.
--
-- When a receipt is recorded for a customer who is SOLD (status Signed or Approved, shown on the Sales
-- Board as Approval / Sold and on the Project Board as Sold / New), the customer moves to
-- ORDERING MATERIAL. That is the Pre-Production column on the Sales Board and the Ordering Material
-- column on the Project Board, so production picks the job up. From there the job moves along
-- (Scheduled, In Progress, Punch List, Completed) and the Sales Board shows each of those too, because
-- both boards read the same customer status.
--
-- Only a customer who is currently Signed or Approved is moved. A payment taken earlier in the sale
-- (before it is signed) or later in the job (during the build, at final payment) changes nothing here,
-- and the move is forward-only. It is done in the database so it happens the same way whether the receipt
-- was recorded on the web app or the mobile app.
--
-- Safe to run more than once. Adds a function and a trigger only; it changes no existing row by itself.

create or replace function public.trg_down_payment_starts_production()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_customer uuid := coalesce(new.customer_id, new.contact_id);
  v_status text;
begin
  if v_customer is null or coalesce(new.amount, 0) <= 0 then
    return null;
  end if;

  select status into v_status from public.customers where id = v_customer;
  if v_status in ('signed', 'approved') then
    perform public.advance_customer_status(v_customer, 'ordering_material');
    perform public.advance_customer_pipeline_stage(v_customer, 'scheduling_material');
  end if;
  return null;
end;
$function$;

drop trigger if exists trg_down_payment_starts_production on public.payments;
create trigger trg_down_payment_starts_production
  after insert
  on public.payments
  for each row
  execute function public.trg_down_payment_starts_production();

notify pgrst, 'reload schema';
