-- Per-company, sequential quote numbers.
--
-- Until now each app made its number from the clock: 'QT-' || year || '-' ||
-- the last 4 digits of the current millisecond timestamp. So a brand-new
-- company's first quote could read QT-2026-0080 (which looks like other
-- customers' volume), numbers weren't in order, and two quotes could share a
-- number. This hands out QT-<year>-0001, -0002, ... per company, per prefix
-- (QT quotes, IC inspection-only, IN invoice-mode), per year.
--
-- Existing quotes keep their numbers (quotes are never renumbered). A company
-- that already has quotes this year starts its counter at that count, and any
-- number already taken is skipped, so the new sequence never collides with an
-- old clock-based number.
--
-- Shared backend: TrussCTR web, QuoteMGR and the mobile apps all write to
-- public.quotes. Each client calls next_quote_number() and falls back to its old
-- clock-based number if the function isn't there yet, so this can be applied
-- before or after any client ships.

create table if not exists public.quote_number_counters (
  company_id uuid    not null references public.companies(id) on delete cascade,
  prefix     text    not null,
  year       integer not null,
  last_value integer not null default 0,
  primary key (company_id, prefix, year)
);

-- Only reached through next_quote_number() below.
alter table public.quote_number_counters enable row level security;
revoke all on table public.quote_number_counters from public, anon, authenticated;

create or replace function public.next_quote_number(p_company_id uuid, p_prefix text default 'QT')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := upper(coalesce(nullif(trim(p_prefix), ''), 'QT'));
  v_year   integer := extract(year from now())::integer;
  v_next   integer;
  v_number text;
begin
  if p_company_id is null or p_company_id not in (select public.get_my_company_ids()) then
    raise exception 'not a member of this company' using errcode = '42501';
  end if;
  if v_prefix !~ '^[A-Z]{1,4}$' then
    raise exception 'invalid quote number prefix' using errcode = '22023';
  end if;

  -- First number of the year for this company: start after the quotes it
  -- already has with this prefix this year.
  insert into public.quote_number_counters (company_id, prefix, year, last_value)
  select p_company_id, v_prefix, v_year, count(*)::integer
  from public.quotes q
  where q.company_id = p_company_id
    and q.quote_number like v_prefix || '-' || v_year || '-%'
  on conflict (company_id, prefix, year) do nothing;

  -- The row lock taken by this update serialises concurrent callers.
  loop
    update public.quote_number_counters
       set last_value = last_value + 1
     where company_id = p_company_id and prefix = v_prefix and year = v_year
    returning last_value into v_next;

    v_number := v_prefix || '-' || v_year || '-' || lpad(v_next::text, 4, '0');

    exit when not exists (
      select 1 from public.quotes q
      where q.company_id = p_company_id and q.quote_number = v_number
    );
  end loop;

  return v_number;
end;
$$;

revoke all on function public.next_quote_number(uuid, text) from public, anon;
grant execute on function public.next_quote_number(uuid, text) to authenticated;
