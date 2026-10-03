-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- Insurance scope of work: a contractor uploads the carrier's scope / estimate for an insurance job, the
-- AI reads it and finds the claim total, and the person reviews the figures and (if they agree) applies
-- one as the customer's Project Value.
--
-- This table holds one row per uploaded scope: where the file is (the private `documents` bucket, under
-- the customer's id so the existing storage rules apply), what the AI found, and what was applied.
-- Nothing here changes a customer's Project Value by itself; that only happens when a person applies a
-- figure in the app.
--
-- Safe to run more than once. Adds a new table only.

create table if not exists public.insurance_scopes (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  customer_id      uuid not null references public.customers(id) on delete cascade,
  claim_id         uuid references public.insurance_claims(id) on delete set null,
  file_path        text not null,            -- in the private `documents` bucket: <customer_id>/insurance-scope/...
  file_name        text not null,
  file_type        text,
  file_size        bigint,
  uploaded_by      uuid,                     -- the team member who uploaded it
  uploaded_by_name text,
  status           text not null default 'uploaded'
                     check (status in ('uploaded', 'read', 'failed', 'applied')),
  extracted        jsonb,                    -- everything the AI reported, for the review screen
  total_rcv        numeric,                  -- replacement cost value
  total_acv        numeric,                  -- actual cash value
  deductible       numeric,
  net_claim        numeric,                  -- what the carrier pays after depreciation and deductible
  error            text,
  applied_total    numeric,                  -- the figure a person chose as Project Value
  applied_label    text,                     -- which figure it was (RCV, ACV, net, or typed)
  applied_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists insurance_scopes_customer_idx on public.insurance_scopes (customer_id, created_at desc);
create index if not exists insurance_scopes_company_idx  on public.insurance_scopes (company_id);

alter table public.insurance_scopes enable row level security;

drop policy if exists insurance_scopes_sel on public.insurance_scopes;
create policy insurance_scopes_sel on public.insurance_scopes
  for select to authenticated
  using (company_id in (select get_my_company_ids()));

drop policy if exists insurance_scopes_ins on public.insurance_scopes;
create policy insurance_scopes_ins on public.insurance_scopes
  for insert to authenticated
  with check (
    company_id in (select get_my_company_ids())
    and exists (select 1 from public.customers c where c.id = customer_id and c.company_id = insurance_scopes.company_id)
  );

drop policy if exists insurance_scopes_upd on public.insurance_scopes;
create policy insurance_scopes_upd on public.insurance_scopes
  for update to authenticated
  using (company_id in (select get_my_company_ids()))
  with check (company_id in (select get_my_company_ids()));

drop policy if exists insurance_scopes_del on public.insurance_scopes;
create policy insurance_scopes_del on public.insurance_scopes
  for delete to authenticated
  using (company_id in (select get_my_company_ids()));

grant select, insert, update, delete on public.insurance_scopes to authenticated;

notify pgrst, 'reload schema';
