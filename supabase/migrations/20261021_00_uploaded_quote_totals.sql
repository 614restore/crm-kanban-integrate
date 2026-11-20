-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- UPLOADED QUOTES CARRY A TOTAL. A quote that was made somewhere else and uploaded to a customer's Documents
-- (a PDF of an estimate, a quote from another system) used to be just a file: it had no amount, so it could
-- never reach the customer's Project Value, and nothing recorded whether the customer had signed it.
--
-- Three columns on documents:
--   quote_total         the quote's total amount, as typed by the person uploading it
--   quote_signed        the customer has signed this quote (checked off by hand: the file is not a TrussCTR quote)
--   counts_toward_total whether the amount should be included in the customer's Project Value
--
-- Rule (agreed): an uploaded quote adds to Project Value only when it is BOTH marked signed AND set to count
-- toward the total. That matches in-app quotes, where only signed ones count. It is added to the total of the
-- customer's signed in-app quotes, the same way several signed quotes already sum. An unsigned or uncounted
-- upload just records its amount.
--
-- As before, if nothing priced is signed the Project Value is left alone, so a total a person typed by hand is
-- never wiped. The consequence: un-counting or deleting the only counted upload leaves the last total in place;
-- a person corrects it on the customer's details.
--
-- Safe to run more than once. Existing documents are unchanged (all three columns default to "not counted").

alter table public.documents
  add column if not exists quote_total numeric(12, 2),
  add column if not exists quote_signed boolean not null default false,
  add column if not exists counts_toward_total boolean not null default false;

alter table public.documents
  drop constraint if exists documents_quote_total_nonnegative;
alter table public.documents
  add constraint documents_quote_total_nonnegative check (quote_total is null or quote_total >= 0);

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

  -- Signed quotes made in the app...
  select coalesce(sum(public.quote_selected_total(q)), 0)
    into v_total
  from public.quotes q
  where q.customer_id = p_customer_id
    and q.status = 'signed'
    and coalesce(q.project_type, '') <> 'inspection_report';

  -- ...plus uploaded quotes that are signed and marked to count.
  v_total := v_total + coalesce((
    select sum(d.quote_total)
    from public.documents d
    where d.customer_id = p_customer_id
      and d.quote_signed is true
      and d.counts_toward_total is true
      and d.quote_total is not null
  ), 0);

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

create or replace function public.trg_document_sets_project_value()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if tg_op = 'DELETE' then
    if old.counts_toward_total is true and old.quote_signed is true then
      perform public.recompute_customer_project_value(old.customer_id);
    end if;
    return null;
  end if;

  if tg_op = 'INSERT' then
    if new.counts_toward_total is true and new.quote_signed is true then
      perform public.recompute_customer_project_value(new.customer_id);
    end if;
    return null;
  end if;

  -- UPDATE: recompute when the document counted before or counts now.
  if (new.counts_toward_total is true and new.quote_signed is true)
     or (old.counts_toward_total is true and old.quote_signed is true) then
    perform public.recompute_customer_project_value(new.customer_id);
    if old.customer_id is distinct from new.customer_id then
      perform public.recompute_customer_project_value(old.customer_id);
    end if;
  end if;
  return null;
end;
$function$;

drop trigger if exists trg_document_sets_project_value on public.documents;
create trigger trg_document_sets_project_value
  after insert or delete or update of quote_total, quote_signed, counts_toward_total, customer_id
  on public.documents
  for each row
  execute function public.trg_document_sets_project_value();

notify pgrst, 'reload schema';
