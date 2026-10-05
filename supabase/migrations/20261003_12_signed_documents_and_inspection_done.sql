-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- SIGNED DOCUMENTS AND INSPECTION DONE: fixes found while tracing a field report on an inspection report with a
-- signed contingency agreement.
--
-- 1. Sending (or the customer signing) an inspection report is meant to mark the inspection complete. The trigger
--    that does it only did so for customers whose added_by was filled in, which web-created customers never have,
--    so the inspection stayed "not done" and the Scheduled list kept offering "Start". It no longer needs
--    added_by, and it also closes the customer's due inspection appointment so every screen agrees.
--
-- 2. The countersigned_copy_sent_at stamp was being written the moment the CUSTOMER signed (the customer's browser
--    reported a "countersigned" event before anyone on the team had signed), which then blocked the real
--    fully-executed copy from being emailed when the salesperson countersigned. The app and the send-quote-alert
--    function are fixed; this clears the wrong stamps already written (a stamp with no contractor signature, or
--    from before the contractor signed). It sends nothing; re-sending an executed copy is a deliberate action.
--
-- 3. The Documents entry for a signed agreement was only a link to the customer-facing signing page. Where the quote
--    now has an executed PDF (signed_pdf_url, set when it is countersigned) the entry is pointed at that PDF so it
--    can be opened and read, with both signatures.
--
-- Safe to run more than once. Changes no row other than the ones described.

create or replace function public.mark_inspection_completed_on_send()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_member_id uuid;
begin
  if new.project_type = 'inspection_report'
     and new.status in ('sent', 'signed')
     and (old.status is null or old.status not in ('sent', 'signed'))
     and new.customer_id is not null
  then
    select id into v_member_id from public.team_members
    where user_id = auth.uid() and company_id = new.company_id and is_active = true
    limit 1;

    update public.customers
    set inspection_completed = true,
        inspection_completed_at = now(),
        inspection_completed_by = v_member_id
    where id = new.customer_id and inspection_completed = false;

    -- The inspection that was booked for this customer has happened. Only appointments that are due (today
    -- or earlier) are closed, so one booked for another day is left alone.
    update public.appointments
    set status = 'completed'
    where customer_id = new.customer_id
      and type = 'inspection'
      and status = 'scheduled'
      and start_time::date <= current_date;
  end if;
  return new;
end;
$function$;

-- 2. Wrong "executed copy sent" stamps.
update public.quotes
   set countersigned_copy_sent_at = null
 where countersigned_copy_sent_at is not null
   and (contractor_signed_at is null or countersigned_copy_sent_at < contractor_signed_at);

-- 3. Documents entries that only link to the signing page, where an executed PDF now exists.
update public.documents d
   set url = q.signed_pdf_url
  from public.quotes q
 where d.type = 'signed'
   and q.share_token is not null
   and d.url = 'https://trussctr.614restore.com/?token=' || q.share_token
   and q.signed_pdf_url is not null
   and q.contractor_signed_at is not null;

notify pgrst, 'reload schema';
