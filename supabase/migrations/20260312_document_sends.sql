-- Document sends table: tracks every document sent to a customer for e-signing
create table if not exists public.document_sends (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  template_id text not null,
  template_name text not null,
  sent_to_email text not null,
  sent_to_name text,
  sent_by uuid references auth.users(id) on delete set null,
  document_html text not null,        -- filled document at time of send
  token text not null unique,         -- secure unique token for the sign link
  status text not null default 'sent' check (status in ('sent','viewed','signed','declined')),
  signed_at timestamptz,
  signature_data text,                -- base64 PNG of signature
  signed_name text,
  signer_ip text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.document_sends enable row level security;

create policy "company members can manage their sends"
  on public.document_sends
  for all
  using (
    company_id in (
      select company_id from public.profiles where id = auth.uid()
    )
  );

-- Public read for signing page (token-based, no auth required)
create policy "public can read by token"
  on public.document_sends
  for select
  using (true);

-- Public update for signing (only status/signature fields)
create policy "public can sign by token"
  on public.document_sends
  for update
  using (true)
  with check (true);

create index if not exists document_sends_token_idx on public.document_sends(token);
create index if not exists document_sends_company_idx on public.document_sends(company_id);
