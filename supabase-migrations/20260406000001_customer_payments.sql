-- Customer payments table
-- Tracks all payments linked to a specific contact, optional work order,
-- the company, and the user who processed the payment.

create table if not exists public.payments (
  id                     uuid primary key default gen_random_uuid(),
  contact_id             uuid not null references public.contacts(id) on delete cascade,
  work_order_id          uuid references public.work_orders(id) on delete set null,
  company_id             uuid not null references public.companies(id) on delete cascade,
  amount                 numeric(10, 2) not null check (amount > 0),
  payment_method         text not null default 'cash'
                           check (payment_method in (
                             'cash', 'check', 'credit_card', 'ach',
                             'insurance_check', 'stripe_payment_link', 'other'
                           )),
  reference_number       text,
  notes                  text,
  processed_by           uuid references auth.users(id) on delete set null,
  processed_by_name      text,
  stripe_payment_link_id text,
  stripe_payment_link_url text,
  payment_date           timestamptz not null default now(),
  created_at             timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists payments_contact_id_idx    on public.payments(contact_id);
create index if not exists payments_company_id_idx    on public.payments(company_id);
create index if not exists payments_work_order_id_idx on public.payments(work_order_id);
create index if not exists payments_payment_date_idx  on public.payments(payment_date desc);

-- Row level security
alter table public.payments enable row level security;

create policy "Users can view payments for their company"
  on public.payments for select
  using (
    company_id in (
      select company_id from public.profiles where id = auth.uid()
    )
  );

create policy "Users can insert payments for their company"
  on public.payments for insert
  with check (
    company_id in (
      select company_id from public.profiles where id = auth.uid()
    )
  );

create policy "Users can delete their own company payments"
  on public.payments for delete
  using (
    company_id in (
      select company_id from public.profiles where id = auth.uid()
    )
  );
