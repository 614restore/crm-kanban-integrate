-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- Project Value is the real figure behind a job: it feeds the pipeline totals, reports, sales analytics
-- and commission payroll. Until now nothing ever set it from a quote.
--
-- Rule: when a customer signs (accepts) a quote, Project Value becomes the total of the tier they
-- selected. If a customer has signed more than one priced quote, it is the sum of them. This is done
-- here in the database, so it happens the same way whichever app, or whichever signing link, signs it.
--
--   * The total is worked out the same way the mobile app's getFullQuoteTotal does: the selected tier
--     ('all' adds all three), the manual override totals when a quote uses them, and, when no tier was
--     chosen, the primary visible tier.
--   * Inspection reports carry no price and are ignored. An insurance job's signed contingency also has
--     no price, so its Project Value stays empty until a person types the total once the scope arrives
--     (on the customer's details, by sales or the project manager).
--   * A value a person types is never overwritten by anything except a later quote being signed or
--     re-priced, which is a new fact about the job.
--   * If there is no signed priced quote the value is left alone (so a typed insurance total stays).
--
-- Safe to run more than once. It also fills in Project Value for customers who already have a signed
-- priced quote and no value, and corrects ones whose value differs from their signed quotes.

create or replace function public.quote_selected_total(p public.quotes)
 returns numeric
 language sql
 stable
as $function$
  with t as (
    select
      case when p.use_manual_totals is true then coalesce(p.manual_good_total,   p.good_total,   0) else coalesce(p.good_total,   0) end as good,
      case when p.use_manual_totals is true then coalesce(p.manual_better_total, p.better_total, 0) else coalesce(p.better_total, 0) end as better,
      case when p.use_manual_totals is true then coalesce(p.manual_best_total,   p.best_total,   0) else coalesce(p.best_total,   0) end as best
  )
  select case p.selected_tier
           when 'all'    then good + better + best
           when 'good'   then good
           when 'better' then better
           when 'best'   then best
           else case when p.include_best is true then best
                     when p.include_better is true then better
                     else good end
         end
  from t
$function$;

create or replace function public.recompute_customer_project_value(p_customer_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_total numeric;
begin
  if p_customer_id is null then
    return;
  end if;

  select coalesce(sum(public.quote_selected_total(q)), 0)
    into v_total
  from public.quotes q
  where q.customer_id = p_customer_id
    and q.status = 'signed'
    and coalesce(q.project_type, '') <> 'inspection_report';

  -- Nothing priced has been signed: leave the value alone (it may be a total a person typed).
  if v_total <= 0 then
    return;
  end if;

  update public.customers
     set project_value = v_total
   where id = p_customer_id
     and project_value is distinct from v_total;
end;
$function$;

create or replace function public.trg_quote_sets_project_value()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    if new.status = 'signed' then
      perform public.recompute_customer_project_value(new.customer_id);
    end if;
  elsif new.status = 'signed' or old.status = 'signed' then
    perform public.recompute_customer_project_value(new.customer_id);
    if old.customer_id is distinct from new.customer_id then
      perform public.recompute_customer_project_value(old.customer_id);
    end if;
  end if;
  return null;
end;
$function$;

drop trigger if exists trg_quote_sets_project_value on public.quotes;
create trigger trg_quote_sets_project_value
  after insert or update of status, selected_tier, good_total, better_total, best_total,
    manual_good_total, manual_better_total, manual_best_total, use_manual_totals,
    include_better, include_best, customer_id
  on public.quotes
  for each row
  execute function public.trg_quote_sets_project_value();

-- Fill in customers who already have a signed priced quote.
do $backfill$
declare
  r record;
begin
  for r in
    select distinct customer_id
    from public.quotes
    where status = 'signed' and customer_id is not null
  loop
    perform public.recompute_customer_project_value(r.customer_id);
  end loop;
end
$backfill$;

notify pgrst, 'reload schema';
