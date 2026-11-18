-- Credits and charges applied to a job after the quote was signed, each with a
-- reason attached. The case that prompted it: a homeowner bought some of the
-- material themselves, so the amount owed dropped and the office needed that
-- written down rather than quietly editing the signed quote.
--
-- The signed quote is left alone. The customer's receipt shows the project
-- total, the adjustments, and the adjusted total, so the arithmetic is visible
-- rather than a number that silently disagrees with what they signed.

create table if not exists public.quote_adjustments (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  quote_id    uuid not null references public.quotes(id)    on delete cascade,
  -- Negative is a credit (owed goes down), positive is an extra charge.
  amount      numeric(12,2) not null,
  -- The whole point of the feature: an adjustment without a reason is not
  -- allowed, so this is not null AND cannot be blank.
  note        text not null,
  created_by  uuid references auth.users(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  constraint quote_adjustments_note_not_blank check (btrim(note) <> ''),
  constraint quote_adjustments_amount_not_zero check (amount <> 0)
);

-- Both sides of the foreign keys get indexed: every read is by quote, and
-- company_id is what the policies filter on.
create index if not exists idx_quote_adjustments_quote_id   on public.quote_adjustments (quote_id);
create index if not exists idx_quote_adjustments_company_id on public.quote_adjustments (company_id);

comment on column public.quote_adjustments.amount is
  'Negative is a credit against the job; positive is an extra charge.';

alter table public.quote_adjustments enable row level security;

-- Anyone in the company can see them: they change what a customer owes, so the
-- figure has to be explainable by whoever is looking at the job.
drop policy if exists quote_adjustments_select on public.quote_adjustments;
create policy quote_adjustments_select on public.quote_adjustments
  for select to authenticated
  using (company_id in (select public.get_my_company_ids()));

-- Writing one moves money owed, so it is owners, admins and managers only.
-- is_manager_role is the single place to widen or narrow that later.
drop policy if exists quote_adjustments_write on public.quote_adjustments;
create policy quote_adjustments_write on public.quote_adjustments
  for all to authenticated
  using (
    company_id in (select public.get_my_company_ids())
    and exists (
      select 1 from public.team_members tm
       where tm.company_id = quote_adjustments.company_id
         and tm.user_id = auth.uid()
         and tm.is_active
         and public.is_manager_role(tm.role)
    )
  )
  with check (
    company_id in (select public.get_my_company_ids())
    and exists (
      select 1 from public.team_members tm
       where tm.company_id = quote_adjustments.company_id
         and tm.user_id = auth.uid()
         and tm.is_active
         and public.is_manager_role(tm.role)
    )
  );

-- One place for "what do the adjustments add up to", so the apps and the
-- receipt cannot drift apart. security invoker, so row level security still
-- decides which rows are visible.
create or replace function public.quote_adjustments_total(p_quote_id uuid)
returns numeric
language sql
stable
security invoker
set search_path to 'public'
as $function$
  select coalesce(sum(amount), 0)::numeric
    from public.quote_adjustments
   where quote_id = p_quote_id;
$function$;

-- New functions no longer inherit an execute grant: the anon lockdown removed
-- the PUBLIC default, so say who may call this. Not anon — a customer reading
-- a quote through a share link goes through the portal functions instead.
revoke execute on function public.quote_adjustments_total(uuid) from public;
grant execute on function public.quote_adjustments_total(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
