-- Automatic countersigning: the pieces this database was missing.
--
-- Already here and untouched: sign_quote_customer applies the quote creator's saved
-- signature when companies.auto_countersign_enabled is on, team_members already has
-- signature_data / signature_adopted_at, and quotes.countersigned_copy_sent_at exists.
-- advance_stage_on_quote_status already moves the contact to the signed stage and
-- files the "Signed Agreement" document, so this adds none of that.
--
-- Added here: a way to save a signature and switch the feature on from the app, a
-- stamp for when a quote becomes fully executed, and the alerts for that moment.

alter table public.team_members
  add column if not exists signature_data text,
  add column if not exists signature_adopted_at timestamptz;

alter table public.quotes
  add column if not exists countersigned_copy_sent_at timestamptz,
  add column if not exists fully_executed_at timestamptz;

-- ── Saving a signature: the member's own row only ────────────────────────────
-- A function rather than a direct update, so it works whatever the table's policies
-- allow and the signature and its consent timestamp are always written together.
create or replace function public.set_my_signature(p_signature_data text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adopted timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  v_adopted := case when p_signature_data is null or p_signature_data = '' then null else now() end;
  update public.team_members
     set signature_data = nullif(p_signature_data, ''),
         signature_adopted_at = v_adopted
   where user_id = auth.uid() or id = auth.uid();
  return v_adopted;
end;
$$;

revoke all on function public.set_my_signature(text) from public, anon;
grant execute on function public.set_my_signature(text) to authenticated;

-- ── Company switch: owners, admins and managers ──────────────────────────────
create or replace function public.set_company_auto_countersign(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select tm.company_id into v_company
    from public.team_members tm
   where (tm.user_id = auth.uid() or tm.id = auth.uid())
     and tm.is_active
     and tm.role in ('owner', 'admin', 'manager')
   limit 1;
  if v_company is null then
    raise exception 'Only an owner, admin or manager can change this';
  end if;
  update public.companies set auto_countersign_enabled = p_enabled where id = v_company;
end;
$$;

revoke all on function public.set_company_auto_countersign(boolean) from public, anon;
grant execute on function public.set_company_auto_countersign(boolean) to authenticated;

-- ── Stamp the moment a quote becomes fully executed ──────────────────────────
-- Quotes already signed by both parties are left alone, so editing one later never
-- re-fires the alerts.
create or replace function public.quotes_stamp_fully_executed()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_signed boolean;
  v_was_signed boolean;
begin
  v_signed := new.status = 'signed' or new.signed_at is not null or new.contingency_signed_at is not null;
  v_was_signed := old.status = 'signed' or old.signed_at is not null or old.contingency_signed_at is not null;
  if v_signed and new.contractor_signature_data is not null
     and not (v_was_signed and old.contractor_signature_data is not null)
     and new.fully_executed_at is null then
    new.fully_executed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_quotes_stamp_fully_executed on public.quotes;
create trigger trg_quotes_stamp_fully_executed
  before update on public.quotes
  for each row execute function public.quotes_stamp_fully_executed();

-- ── Once fully executed: tell the team it is ready ───────────────────────────
create or replace function public.quotes_executed_effects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_user uuid;
begin
  if new.fully_executed_at is null or old.fully_executed_at is not null then
    return new;
  end if;

  begin
    select nullif(concat_ws(' ', c.first_name, c.last_name), '')
      into v_name from public.customers c where c.id = new.customer_id;
  exception when others then v_name := null;
  end;
  v_name := coalesce(v_name, 'The customer');

  -- Company-wide, so project management sees a job ready to start.
  begin
    insert into public.notifications
      (company_id, user_id, type, title, message, related_type, related_id, data)
    values
      (new.company_id, null, 'quote_executed', '✅ Contract fully executed',
       v_name || '''s Quote ' || new.quote_number
         || ' is signed by both parties. Ready for the down payment and project start.',
       case when new.customer_id is not null then 'customer' end,
       new.customer_id,
       jsonb_build_object('quote_id', new.id, 'quote_number', new.quote_number));
  exception when others then null;
  end;

  -- A salesperson who countersigned by hand after the customer (an automatic
  -- countersign already got the "signed and countersigned" alert) hears it is done.
  if old.contractor_signature_data is null
     and (old.status = 'signed' or old.signed_at is not null or old.contingency_signed_at is not null) then
    begin
      select tm.user_id into v_user from public.team_members tm where tm.id = new.created_by;
      if v_user is not null and exists (select 1 from public.profiles p where p.id = v_user) then
        insert into public.notifications
          (company_id, user_id, type, title, message, related_type, related_id, data)
        values
          (new.company_id, v_user, 'quote_executed', '✅ Countersigned — collect the down payment',
           'Quote ' || new.quote_number || ' is fully executed. The homeowner has their copy; collect the down payment.',
           case when new.customer_id is not null then 'customer' end,
           new.customer_id,
           jsonb_build_object('quote_id', new.id, 'quote_number', new.quote_number));
      end if;
    exception when others then null;
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_quotes_executed_effects on public.quotes;
create trigger trg_quotes_executed_effects
  after update on public.quotes
  for each row execute function public.quotes_executed_effects();
