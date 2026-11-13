-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- DELETING A CUSTOMER WITH A QUOTE FAILED ("Failed to delete 1 contact", HTTP 409).
--
-- Quotes (and documents) carry the customer twice, customer_id and contact_id, and the BEFORE INSERT OR
-- UPDATE trigger trg_sync_contact_customer copies one into the other when it is empty. Deleting a
-- customer makes quotes_customer_id_fkey (ON DELETE SET NULL) clear customer_id; the trigger then copied
-- the deleted id straight back from contact_id, the foreign key rejected it, and the delete failed.
--
-- Now, when an UPDATE clears customer_id that was set before (the customer was deleted or the link was
-- removed), contact_id is cleared too instead of being copied back. Inserts and all other updates work
-- as before. The quote itself is kept; trg_customer_delete_archives_quotes still archives it.
--
-- Replaces one function. No data changes. Safe to run more than once.

begin;

create or replace function public.sync_contact_customer_id()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' and old.customer_id is not null and new.customer_id is null then
    new.contact_id := null;
  elsif new.contact_id is null and new.customer_id is not null then
    new.contact_id := new.customer_id;
  elsif new.customer_id is null and new.contact_id is not null then
    new.customer_id := new.contact_id;
  end if;
  return new;
end;
$function$;

commit;
