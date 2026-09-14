-- QuoteMGR's quote builder, customer quote page and signing views, on the
-- shared TrussCTR/TrussCENTER backend (llamtjsquoqlejznmyjl). Additive.
--
-- Copied from QuoteMGR migrations (read-only reference):
--   20260808_get_quote_customer_about_fields.sql   get_quote_for_customer
--   20260821_customer_quote_content_rpcs.sql       get_quote_{row,line_items,options,photos}_for_customer
--   20260904_refresh_viewed_at_on_every_view.sql   mark_quote_viewed
--   20260731_user_pricing_overrides.sql            user_pricing_overrides
-- Written here because QuoteMGR has no migration for them:
--   mark_certificate_viewed, get_my_ai_config, ai_usage_log

-- ── Customer quote page: the quote and its company, by share token ────────────
drop function if exists public.get_quote_for_customer(text);

create function public.get_quote_for_customer(share_token text)
returns table (
  id uuid,
  company_id uuid,
  created_by uuid,
  customer_id uuid,
  quote_number text,
  status text,
  project_type text,
  project_description text,
  good_total numeric,
  better_total numeric,
  best_total numeric,
  selected_tier text,
  notes text,
  cover_page_title text,
  include_about_page boolean,
  include_warranty_page boolean,
  include_cancel_notice boolean,
  include_custom_page boolean,
  custom_page_title text,
  custom_page_body text,
  custom_page_file_url text,
  custom_page_file_name text,
  custom_page_file_type text,
  valid_until date,
  signed_at timestamptz,
  signed_by text,
  signature_data text,
  share_token_out text,
  sent_at timestamptz,
  viewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  customer_first_name text,
  customer_last_name text,
  customer_email text,
  customer_phone text,
  customer_address text,
  customer_city text,
  customer_state text,
  customer_zip text,
  creator_full_name text,
  creator_email text,
  creator_phone text,
  company_name text,
  company_email text,
  company_phone text,
  company_address text,
  company_city text,
  company_state text,
  company_zip text,
  company_logo_url text,
  company_logo_zoom numeric,
  company_about_text text,
  company_warranty_text text,
  company_license_number text,
  company_website text,
  company_about_mission text,
  company_about_tagline text,
  company_about_highlights jsonb,
  company_about_showcase_photos jsonb,
  company_about_bg_image_url text,
  company_about_bg_opacity numeric,
  company_about_bg_zoom numeric,
  company_about_process_steps jsonb,
  company_about_page_template text,
  contingency_enabled boolean,
  contingency_signed_by text,
  contingency_signed_at timestamptz,
  contingency_signature_data text,
  contingency_cancel_signature_data text,
  contingency_cancel_signed_at timestamptz,
  contractor_signature_data text,
  contractor_signed_by text,
  contractor_signed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    q.id, q.company_id, q.created_by, q.customer_id, q.quote_number, q.status,
    q.project_type, q.project_description, q.good_total, q.better_total, q.best_total,
    q.selected_tier, q.notes, q.cover_page_title, q.include_about_page,
    q.include_warranty_page, q.include_cancel_notice, q.include_custom_page,
    q.custom_page_title, q.custom_page_body, q.custom_page_file_url,
    q.custom_page_file_name, q.custom_page_file_type, q.valid_until, q.signed_at,
    q.signed_by, q.signature_data, q.share_token, q.sent_at, q.viewed_at,
    q.created_at, q.updated_at,
    c.first_name, c.last_name, c.email, c.phone, c.address, c.city, c.state, c.zip,
    tm.full_name, tm.email, tm.phone,
    co.name, co.email, co.phone, co.address, co.city, co.state, co.zip,
    co.logo_url, co.logo_zoom, co.about_text, co.warranty_text, co.license_number,
    co.website, co.about_mission, co.about_tagline, co.about_highlights,
    co.about_showcase_photos, co.about_bg_image_url, co.about_bg_opacity,
    co.about_bg_zoom, co.about_process_steps, co.about_page_template,
    q.contingency_enabled, q.contingency_signed_by, q.contingency_signed_at,
    q.contingency_signature_data, q.contingency_cancel_signature_data,
    q.contingency_cancel_signed_at, q.contractor_signature_data,
    q.contractor_signed_by, q.contractor_signed_at
  from public.quotes q
  left join public.customers c on c.id = q.customer_id
  left join public.team_members tm on tm.id = q.created_by
  left join public.companies co on co.id = q.company_id
  where q.share_token = get_quote_for_customer.share_token
    and get_quote_for_customer.share_token is not null;
$$;

grant execute on function public.get_quote_for_customer(text) to anon, authenticated;

-- ── Customer quote page: content rows, only for the quote matching the token ──
create or replace function public.get_quote_row_for_customer(share_token text)
returns setof public.quotes
language sql security definer set search_path = public stable
as $$
  select q.* from public.quotes q
  where q.share_token = get_quote_row_for_customer.share_token
    and q.share_token is not null;
$$;

create or replace function public.get_quote_line_items_for_customer(share_token text)
returns setof public.quote_line_items
language sql security definer set search_path = public stable
as $$
  select li.* from public.quote_line_items li
  join public.quotes q on q.id = li.quote_id
  where q.share_token = get_quote_line_items_for_customer.share_token
    and q.share_token is not null;
$$;

create or replace function public.get_quote_options_for_customer(share_token text)
returns setof public.quote_options
language sql security definer set search_path = public stable
as $$
  select o.* from public.quote_options o
  join public.quotes q on q.id = o.quote_id
  where q.share_token = get_quote_options_for_customer.share_token
    and q.share_token is not null;
$$;

create or replace function public.get_quote_photos_for_customer(share_token text)
returns setof public.quote_photos
language sql security definer set search_path = public stable
as $$
  select p.* from public.quote_photos p
  join public.quotes q on q.id = p.quote_id
  where q.share_token = get_quote_photos_for_customer.share_token
    and q.share_token is not null;
$$;

grant execute on function public.get_quote_row_for_customer(text)        to anon, authenticated;
grant execute on function public.get_quote_line_items_for_customer(text) to anon, authenticated;
grant execute on function public.get_quote_options_for_customer(text)    to anon, authenticated;
grant execute on function public.get_quote_photos_for_customer(text)     to anon, authenticated;

-- ── mark_quote_viewed (QuoteMGR's newest version) ─────────────────────────────
create or replace function public.mark_quote_viewed(share_token text)
returns table(was_updated boolean, quote_id uuid, company_id uuid, quote_number text, customer_name text, customer_email text, creator_email text, company_email text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  q record;
begin
  select qt.*, tm.email as creator_email, co.email as company_email, c.email as customer_email,
         concat_ws(' ', c.first_name, c.last_name) as customer_name
  into q
  from public.quotes qt
  left join public.customers c on c.id = qt.customer_id
  left join public.team_members tm on tm.id = qt.created_by
  left join public.companies co on co.id = qt.company_id
  where qt.share_token = mark_quote_viewed.share_token;

  if not found then
    return;
  end if;

  if q.status = 'sent' then
    update public.quotes
      set status = 'viewed',
          viewed_at = now(),
          inspection_report_viewed_at = case
            when q.project_type = 'inspection_report' and q.inspection_report_viewed_at is null then now()
            else q.inspection_report_viewed_at
          end
      where id = q.id;

    begin
      insert into public.quote_notifications (company_id, quote_id, event_type, message, actor_name, actor_email)
        values (q.company_id, q.id, 'viewed',
                'Quote ' || q.quote_number || ' was viewed by ' || coalesce(q.customer_name, 'a customer'),
                q.customer_name, q.customer_email);
    exception when others then null;
    end;

    return query select true, q.id, q.company_id, q.quote_number, q.customer_name, q.customer_email, q.creator_email, q.company_email;
  elsif q.status = 'viewed' then
    update public.quotes set viewed_at = now() where id = q.id;
    return query select false, q.id, q.company_id, q.quote_number, q.customer_name, q.customer_email, q.creator_email, q.company_email;
  else
    return query select false, q.id, q.company_id, q.quote_number, q.customer_name, q.customer_email, q.creator_email, q.company_email;
  end if;
end;
$function$;

grant execute on function public.mark_quote_viewed(text) to anon, authenticated;

-- ── mark_certificate_viewed ───────────────────────────────────────────────────
-- Called when a customer opens a completion certificate link. Stamps the first
-- view only; the dashboard alerts when this goes from empty to set.
create or replace function public.mark_certificate_viewed(share_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.quotes
     set completion_certificate_viewed_at = coalesce(completion_certificate_viewed_at, now())
   where quotes.share_token = mark_certificate_viewed.share_token
     and mark_certificate_viewed.share_token is not null
     and completion_certificate_enabled = true;
end;
$$;

grant execute on function public.mark_certificate_viewed(text) to anon, authenticated;

-- ── Per-user pricing overrides ────────────────────────────────────────────────
create table if not exists public.user_pricing_overrides (
  id           uuid         primary key default gen_random_uuid(),
  user_id      uuid         not null references auth.users(id) on delete cascade,
  company_id   uuid         not null references public.companies(id) on delete cascade,
  item_name    text         not null,
  category     text         not null default 'General',
  good_price   numeric(10,2),
  better_price numeric(10,2),
  best_price   numeric(10,2),
  updated_at   timestamptz  not null default now(),
  unique (user_id, company_id, category, item_name)
);

alter table public.user_pricing_overrides enable row level security;

drop policy if exists "users manage own pricing overrides" on public.user_pricing_overrides;
create policy "users manage own pricing overrides"
  on public.user_pricing_overrides for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid() and company_id in (select public.get_my_company_ids()));

-- ── AI assistant configuration and usage ──────────────────────────────────────
-- The AI helper reads its configuration through get_my_ai_config. Only the
-- caller's own company is returned, and API keys are masked: requests go
-- through a server-side proxy that resolves the key, so the browser only needs
-- to know that one is set.
create or replace function public.get_my_ai_config(p_company_id uuid)
returns setof public.ai_configurations
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id, a.company_id, a.provider,
    case when coalesce(a.api_key, '') <> '' then '********' end,
    a.model, a.enabled, a.created_at, a.updated_at, a.vision_provider,
    case when coalesce(a.vision_api_key, '') <> '' then '********' end,
    a.vision_model, a.is_approved
  from public.ai_configurations a
  where a.company_id = p_company_id
    and p_company_id in (select public.get_my_company_ids())
  limit 1;
$$;

revoke all on function public.get_my_ai_config(uuid) from public, anon;
grant execute on function public.get_my_ai_config(uuid) to authenticated;

create table if not exists public.ai_usage_log (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  user_id        uuid,
  feature        text,
  provider       text,
  model          text,
  input_tokens   integer,
  output_tokens  integer,
  estimated_cost numeric(12,6),
  quote_id       uuid references public.quotes(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists ai_usage_log_company_created_idx on public.ai_usage_log (company_id, created_at desc);

alter table public.ai_usage_log enable row level security;

drop policy if exists ai_usage_log_insert on public.ai_usage_log;
drop policy if exists ai_usage_log_select on public.ai_usage_log;
create policy ai_usage_log_insert on public.ai_usage_log
  for insert to authenticated
  with check (company_id in (select public.get_my_company_ids()));
create policy ai_usage_log_select on public.ai_usage_log
  for select to authenticated
  using (company_id in (select public.get_my_company_ids()));
