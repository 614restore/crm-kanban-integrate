-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- Money events, handled once in the database so web and mobile behave identically.
--
-- 1. Invoice sent / paid moves the customer along the pipeline. An invoice goes to the customer BEFORE
--    payment (that is how the customer learns the total), so:
--      invoice status -> sent : customer moves to "Pending Payment" (pipeline stage: Final Payment)
--      invoice status -> paid : customer moves to "Completed"       (pipeline stage: Closed)
--    The web app did this only when an invoice was changed on the web, and mobile did not do it at all.
--    Both moves are forward-only (a customer is never moved backwards by this).
--
-- 2. Receipts count as payments received. A receipt is a row in `payments` (recorded from either app).
--    When the receipts recorded against a quote cover that quote's invoice total, the invoice is marked
--    paid (which then completes the customer, by rule 1). Receipts recorded before the invoice exists are
--    counted when the invoice is created.
--
-- 3. One definition of "collected" and "outstanding": company_financial_summary(). Both apps' financial
--    screens read it, so the numbers match. Receipts are included; amounts that were tracked the older
--    way (a customer's deposit / final-payment fields, or an invoice marked paid by hand) are included
--    only where no receipt covers them, so nothing is counted twice.
--
-- Safe to run more than once. Adds functions and triggers only; it changes no existing row by itself.

-- Receipts recorded against an invoice: by its quote when it has one, otherwise by its customer.
create or replace function public.invoice_receipts_total(p_invoice uuid)
 returns numeric
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select coalesce(sum(p.amount), 0)
  from public.invoices i
  join public.payments p
    on p.company_id = i.company_id
   and (
        (i.quote_id is not null and p.quote_id = i.quote_id)
     or (i.quote_id is null     and p.quote_id is null and p.customer_id = i.customer_id)
   )
  where i.id = p_invoice
$function$;

-- If the receipts cover the invoice, it is paid. Only ever moves an unpaid invoice to paid.
create or replace function public.recompute_invoice_payments(p_invoice uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_inv public.invoices%rowtype;
begin
  select * into v_inv from public.invoices where id = p_invoice;
  if not found then return; end if;
  if v_inv.status in ('paid', 'cancelled') then return; end if;
  if coalesce(v_inv.total, 0) <= 0 then return; end if;

  if public.invoice_receipts_total(p_invoice) >= v_inv.total then
    update public.invoices
       set status = 'paid',
           paid_at = coalesce(paid_at, now())
     where id = p_invoice;
  end if;
end;
$function$;

-- Receipts changed: re-check the invoice(s) they apply to.
create or replace function public.trg_payment_checks_invoice()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  p public.payments;
begin
  p := case when tg_op = 'DELETE' then old else new end;
  for r in
    select i.id
    from public.invoices i
    where i.company_id = p.company_id
      and (
           (p.quote_id is not null and i.quote_id = p.quote_id)
        or (p.quote_id is null and i.quote_id is null and i.customer_id = p.customer_id)
      )
  loop
    perform public.recompute_invoice_payments(r.id);
  end loop;
  return null;
end;
$function$;

drop trigger if exists trg_payment_checks_invoice on public.payments;
create trigger trg_payment_checks_invoice
  after insert or update of amount, quote_id, customer_id or delete
  on public.payments
  for each row
  execute function public.trg_payment_checks_invoice();

-- Invoice created / status changed: move the customer, and pick up receipts recorded earlier.
create or replace function public.trg_invoice_moves_customer()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_customer uuid := coalesce(new.customer_id, new.contact_id);
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'sent' then
      perform public.advance_customer_status(v_customer, 'pending_payment');
      perform public.advance_customer_pipeline_stage(v_customer, 'final_payment');
    elsif new.status = 'paid' then
      perform public.advance_customer_status(v_customer, 'completed');
      perform public.advance_customer_pipeline_stage(v_customer, 'closed');
    end if;
  end if;

  -- A deposit may have been received before this invoice existed.
  if tg_op = 'INSERT' and new.status not in ('paid', 'cancelled') then
    perform public.recompute_invoice_payments(new.id);
  end if;
  return null;
end;
$function$;

drop trigger if exists trg_invoice_moves_customer on public.invoices;
create trigger trg_invoice_moves_customer
  after insert or update of status
  on public.invoices
  for each row
  execute function public.trg_invoice_moves_customer();

-- One definition of the money figures, for both apps.
create or replace function public.company_financial_summary(p_company_id uuid default null)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_company uuid;
  v_receipts numeric;
  v_receipts_count integer;
  v_inv_uncovered numeric;
  v_legacy_collected numeric;
  v_inv_balance numeric;
  v_legacy_pending numeric;
  v_paid numeric;
  v_sent numeric;
  v_overdue numeric;
  v_draft numeric;
begin
  v_company := coalesce(
    p_company_id,
    (select tm.company_id from public.team_members tm where tm.user_id = auth.uid() and tm.is_active order by tm.created_at limit 1)
  );
  if v_company is null or v_company not in (select get_my_company_ids()) then
    raise exception 'Not allowed';
  end if;

  select coalesce(sum(amount), 0), count(*) into v_receipts, v_receipts_count
  from public.payments where company_id = v_company;

  -- Invoices marked paid by hand, with no receipt behind them.
  select coalesce(sum(i.total), 0) into v_inv_uncovered
  from public.invoices i
  where i.company_id = v_company and i.status = 'paid'
    and public.invoice_receipts_total(i.id) = 0;

  -- Customers tracked the older way (deposit / final payment fields): only where no receipt or invoice covers them.
  select coalesce(sum(
           case when c.deposit_paid then coalesce(c.deposit_amount, 0) else 0 end
         + case when c.final_payment_paid then coalesce(c.final_payment_amount, 0) else 0 end), 0)
    into v_legacy_collected
  from public.customers c
  where c.company_id = v_company
    and not exists (select 1 from public.payments p where p.customer_id = c.id)
    and not exists (select 1 from public.invoices i where i.company_id = v_company and coalesce(i.customer_id, i.contact_id) = c.id);

  -- What customers still owe on invoices that have gone out.
  select coalesce(sum(greatest(0, i.total - greatest(coalesce(i.deposit_paid, 0), public.invoice_receipts_total(i.id)))), 0)
    into v_inv_balance
  from public.invoices i
  where i.company_id = v_company and i.status in ('sent', 'overdue');

  select coalesce(sum(coalesce(c.final_payment_amount, 0)), 0) into v_legacy_pending
  from public.customers c
  where c.company_id = v_company and not c.final_payment_paid and coalesce(c.final_payment_amount, 0) > 0
    and not exists (select 1 from public.invoices i where i.company_id = v_company and coalesce(i.customer_id, i.contact_id) = c.id);

  select
    coalesce(sum(i.total) filter (where i.status = 'paid'), 0),
    coalesce(sum(greatest(0, i.total - greatest(coalesce(i.deposit_paid, 0), public.invoice_receipts_total(i.id)))) filter (where i.status = 'sent'), 0),
    coalesce(sum(greatest(0, i.total - greatest(coalesce(i.deposit_paid, 0), public.invoice_receipts_total(i.id)))) filter (where i.status = 'overdue'), 0),
    coalesce(sum(i.total) filter (where i.status = 'draft'), 0)
    into v_paid, v_sent, v_overdue, v_draft
  from public.invoices i where i.company_id = v_company;

  return jsonb_build_object(
    'company_id', v_company,
    'receipts_total', v_receipts,
    'receipts_count', v_receipts_count,
    'total_collected', v_receipts + v_inv_uncovered + v_legacy_collected,
    'total_outstanding', v_inv_balance + v_legacy_pending,
    'invoices_paid', v_paid,
    'invoices_sent_balance', v_sent,
    'invoices_overdue_balance', v_overdue,
    'invoices_draft', v_draft
  );
end;
$function$;

revoke all on function public.company_financial_summary(uuid) from public, anon;
grant execute on function public.company_financial_summary(uuid) to authenticated;
revoke all on function public.invoice_receipts_total(uuid) from public, anon;
revoke all on function public.recompute_invoice_payments(uuid) from public, anon;

notify pgrst, 'reload schema';
