-- Automatic countersigning for the salesperson who created a quote.
--
-- Each team member draws a signature once in Settings. When a customer signs a
-- quote through the emailed link, the quote owner's saved signature is applied as
-- the contractor countersignature in the same step; the executed copy then goes to
-- the homeowner and the job is flagged ready for the down payment.
--
-- Same data model as QuoteMGR's 20260830_auto_countersign, minus the company-wide
-- switch: adopting a signature is the consent, and is recorded with it.

-- ── Saved signature (one per team member) ────────────────────────────────────
alter table public.team_members
  add column if not exists signature_data text,
  add column if not exists signature_adopted_at timestamptz;

comment on column public.team_members.signature_adopted_at is
  'When the member drew this signature and consented to its automatic use. NULL means it must never be applied automatically.';

-- ── Quote bookkeeping ────────────────────────────────────────────────────────
alter table public.quotes
  add column if not exists countersigned_copy_sent_at timestamptz,
  add column if not exists fully_executed_at timestamptz;

-- ── Saving a signature: the member's own row only ────────────────────────────
-- Goes through a function rather than a direct update so it works whatever the
-- table's row-level policies allow, and so the signature and the consent
-- timestamp can never be written apart.
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
   where id = auth.uid() or user_id = auth.uid();
  return v_adopted;
end;
$$;

revoke all on function public.set_my_signature(text) from public, anon;
grant execute on function public.set_my_signature(text) to authenticated;

-- ── Apply the countersignature the moment the customer signs ─────────────────
create or replace function public.quotes_auto_countersign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_signed boolean;
  v_was_customer_signed boolean;
  v_sig text;
  v_name text;
begin
  v_customer_signed := new.status = 'signed'
                       or new.signed_at is not null
                       or new.contingency_signed_at is not null;
  v_was_customer_signed := old.status = 'signed'
                           or old.signed_at is not null
                           or old.contingency_signed_at is not null;

  -- Only at the moment the customer signs, and only for a remote signature: the
  -- customer's emailed link runs without a login, while on-site signing happens
  -- inside the rep's own session, where they sign in person.
  if v_customer_signed and not v_was_customer_signed
     and new.contractor_signature_data is null
     and auth.uid() is null
     and new.created_by is not null then
    select tm.signature_data, tm.full_name
      into v_sig, v_name
      from public.team_members tm
     where tm.id = new.created_by
       and tm.signature_data is not null
       and tm.signature_adopted_at is not null;
    if v_sig is not null then
      new.contractor_signature_data := v_sig;
      new.contractor_signed_by := coalesce(v_name, 'Company Representative');
      new.contractor_signed_at := now();
    end if;
  end if;

  -- Stamp the moment the quote BECOMES fully executed. Quotes that were already
  -- signed by both parties before this existed are left alone, so editing one later
  -- never re-fires the alerts or moves its contact again.
  if v_customer_signed and new.contractor_signature_data is not null
     and not (v_was_customer_signed and old.contractor_signature_data is not null)
     and new.fully_executed_at is null then
    new.fully_executed_at := now();
  end if;

  return new;
exception when others then
  -- Never block the customer's signature over the countersign.
  return new;
end;
$$;

drop trigger if exists trg_quotes_auto_countersign on public.quotes;
create trigger trg_quotes_auto_countersign
  before update on public.quotes
  for each row execute function public.quotes_auto_countersign();

-- ── Once fully executed: move the job forward and tell the team ──────────────
create or replace function public.quotes_executed_effects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
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

  -- The job is sold: the contact moves to the signed stage (never backwards).
  begin
    update public.contacts
       set status = 'signed', status_changed_at = now()
     where id = new.customer_id
       and status not in ('signed', 'approved', 'signed_won', 'scheduled', 'ordering_material',
                          'in_progress', 'build_phase', 'cleanup', 'invoicing', 'pending_payment',
                          'completed', 'paid', 'lost', 'cancelled');
  exception when others then null;
  end;

  -- Project management: a signed, countersigned job is ready to start.
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

  -- The salesperson who countersigned by hand later (an automatic one already got
  -- the "signed and countersigned" alert) still needs to hear it is done.
  if old.contractor_signature_data is null
     and (old.status = 'signed' or old.signed_at is not null or old.contingency_signed_at is not null) then
    begin
      if new.created_by is not null
         and exists (select 1 from public.profiles p where p.id = new.created_by) then
        insert into public.notifications
          (company_id, user_id, type, title, message, related_type, related_id, data)
        values
          (new.company_id, new.created_by, 'quote_executed', '✅ Countersigned — collect the down payment',
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
