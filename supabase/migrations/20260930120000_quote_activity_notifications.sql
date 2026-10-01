-- Quote activity alerts for the salesperson who owns the quote.
--
-- Everything the customer does with a quote (opens it, views it, picks an option,
-- starts signing, signs) is logged to quote_notifications. The CRM bell reads the
-- notifications table, and nothing wrote quote activity there -- so the salesperson
-- was never told. This copies each quote_notifications row to a notification
-- addressed to the quote's creator, on every occurrence (no first-time-only logic).

-- The log itself: normally already present; created only if this database lacks it.
create table if not exists public.quote_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete cascade,
  event_type text not null,
  message text not null,
  actor_name text,
  actor_email text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.quote_notifications enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'quote_notifications') then
    create policy quote_notifications_company_read on public.quote_notifications
      for select using (company_id = public.get_my_company_id());
  end if;
end $$;

-- The log must accept every event the app records, not just viewed/signed. Any older
-- check on event_type is replaced (whatever it was named); NOT VALID leaves existing
-- rows alone and applies the rule to new ones.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.quote_notifications'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%event_type%'
  loop
    execute format('alter table public.quote_notifications drop constraint %I', c.conname);
  end loop;
  alter table public.quote_notifications
    add constraint quote_notifications_event_type_check
    check (event_type in (
      'viewed', 'report_opened', 'tier_selected', 'signing_started', 'signed',
      'countersigned', 'email_opened', 'email_clicked'
    )) not valid;
end $$;

create or replace function public.notify_quote_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
  who text;
  v_title text;
  v_message text;
  v_type text;
begin
  if new.quote_id is null then
    return new;
  end if;
  -- Email-level events are not customer actions on the quote itself.
  if new.event_type not in ('viewed', 'report_opened', 'tier_selected', 'signing_started', 'signed') then
    return new;
  end if;

  select qt.id, qt.company_id, qt.created_by, qt.customer_id, qt.quote_number,
         (qt.contractor_signature_data is not null) as countersigned
    into q
    from public.quotes qt
   where qt.id = new.quote_id;
  if not found or q.created_by is null then
    return new;
  end if;

  -- notifications.user_id references profiles: only address a real profile.
  if not exists (select 1 from public.profiles p where p.id = q.created_by) then
    return new;
  end if;

  who := coalesce(nullif(new.actor_name, ''), 'Your customer');

  if new.event_type = 'signed' then
    -- A signature can be logged by both the signing RPC and the alert function.
    if exists (
      select 1 from public.notifications n
       where n.user_id = q.created_by and n.type = 'quote_signed'
         and n.related_id::text = q.customer_id::text
         and n.data ->> 'quote_id' = q.id::text
         and n.created_at > now() - interval '2 minutes'
    ) then
      return new;
    end if;
    v_type    := 'quote_signed';
    if q.countersigned then
      v_title   := '✅ Quote Signed & Countersigned';
      v_message := who || ' signed Quote ' || q.quote_number
                   || ' and your saved signature was applied. Reach out to collect the down payment and start the next steps.';
    else
      v_title   := '✍️ Quote Signed — countersign it';
      v_message := who || ' signed Quote ' || q.quote_number
                   || '. Countersign it, then reach out to start the next steps.';
    end if;
  elsif new.event_type = 'report_opened' then
    v_type    := 'quote_viewed';
    v_title   := '📷 Report Opened';
    v_message := who || ' opened the photo report for Quote ' || q.quote_number || '.';
  elsif new.event_type = 'tier_selected' then
    v_type    := 'quote_activity';
    v_title   := '🎯 Option Selected';
    v_message := new.message;
  elsif new.event_type = 'signing_started' then
    v_type    := 'quote_activity';
    v_title   := '✍️ Signing Started';
    v_message := who || ' started signing Quote ' || q.quote_number || '.';
  else
    v_type    := 'quote_viewed';
    v_title   := '📬 Quote Opened';
    v_message := who || ' opened Quote ' || q.quote_number || '.';
  end if;

  insert into public.notifications
    (company_id, user_id, type, title, message, related_type, related_id, data)
  values
    (q.company_id, q.created_by, v_type, v_title, v_message,
     case when q.customer_id is not null then 'customer' end,
     q.customer_id,
     jsonb_build_object('quote_id', q.id, 'quote_number', q.quote_number, 'event_type', new.event_type));

  return new;
exception when others then
  -- An alert problem must never block the customer's view or signature.
  return new;
end;
$$;

drop trigger if exists trg_notify_quote_creator on public.quote_notifications;
create trigger trg_notify_quote_creator
  after insert on public.quote_notifications
  for each row execute function public.notify_quote_creator();
