-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- QUOTES OF DELETED CUSTOMERS: archive them.
--
-- Deleting a customer left their quotes behind. The web dashboard then showed them by the signer's typed
-- name ("Johnny Wick signed IC-2026-005") and the phone showed a bare quote number, so the two apps looked
-- like they had different customers. 12 such quotes were found (6 signed).
--
-- 1) A BEFORE DELETE trigger on customers archives that customer's quotes. It has to run before the
--    delete: quotes_customer_id_fkey is ON DELETE SET NULL, which would clear customer_id first and leave
--    no way to tell which quotes were theirs. Quotes made on web also carry the id in contact_id, so both
--    columns are matched.
-- 2) A one-time backfill archives the existing quotes whose customer no longer exists (customer_id, or
--    contact_id when customer_id is empty, points at no customer).
--
-- Archiving is not deleting: is_archived = true hides a quote from both apps and can be undone. Quotes
-- with neither id set are left alone (they may never have had a customer). Safe to run more than once.
-- Ends by listing the quotes the backfill archived on this run.

begin;

create or replace function public.trg_customer_delete_archives_quotes()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update public.quotes
     set is_archived = true, updated_at = now()
   where is_archived = false
     and (customer_id = old.id or contact_id = old.id);
  return old;
end;
$function$;

drop trigger if exists trg_customer_delete_archives_quotes on public.customers;
create trigger trg_customer_delete_archives_quotes
  before delete on public.customers
  for each row
  execute function public.trg_customer_delete_archives_quotes();

create temp table archived_quotes on commit drop as
with orphans as (
  update public.quotes q
     set is_archived = true, updated_at = now()
   where q.is_archived = false
     and coalesce(q.customer_id, q.contact_id) is not null
     and not exists (select 1 from public.customers c where c.id = coalesce(q.customer_id, q.contact_id))
  returning q.quote_number, q.status, q.signed_by, q.created_at
)
select * from orphans;

-- Shown before commit drops the temp table.
select quote_number, status, coalesce(signed_by, '') as signed_by, created_at::date as created
  from archived_quotes order by created_at;

commit;

notify pgrst, 'reload schema';
