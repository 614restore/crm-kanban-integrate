-- Copied from QuoteMGR (20260309000002_invoices_workorders, 20260722 display_only/is_additional,
-- 20260814 RLS). QuoteMGR invoices and change orders both live in invoice_line_items;
-- change orders are rows with is_additional = true.
-- Target: shared backend llamtjsquoqlejznmyjl. Additive only.
create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  sort_order int not null default 0,
  display_only boolean not null default false,
  is_additional boolean not null default false
);
create index if not exists invoice_line_items_invoice_idx on public.invoice_line_items(invoice_id);

alter table public.invoice_line_items enable row level security;

drop policy if exists invoice_line_items_select on public.invoice_line_items;
drop policy if exists invoice_line_items_insert on public.invoice_line_items;
drop policy if exists invoice_line_items_update on public.invoice_line_items;
drop policy if exists invoice_line_items_delete on public.invoice_line_items;
create policy invoice_line_items_select on public.invoice_line_items
  for select to authenticated using (exists (select 1 from public.invoices
    where invoices.id = invoice_line_items.invoice_id
      and invoices.company_id in (select get_my_company_ids())));
create policy invoice_line_items_insert on public.invoice_line_items
  for insert to authenticated with check (exists (select 1 from public.invoices
    where invoices.id = invoice_line_items.invoice_id
      and invoices.company_id in (select get_my_company_ids())));
create policy invoice_line_items_update on public.invoice_line_items
  for update to authenticated using (exists (select 1 from public.invoices
    where invoices.id = invoice_line_items.invoice_id
      and invoices.company_id in (select get_my_company_ids())));
create policy invoice_line_items_delete on public.invoice_line_items
  for delete to authenticated using (exists (select 1 from public.invoices
    where invoices.id = invoice_line_items.invoice_id
      and invoices.company_id in (select get_my_company_ids())));

-- Numbering helpers. QuoteMGR's are SECURITY DEFINER and accept any company id, which
-- reveals another company's counts. As SECURITY INVOKER the count runs under the
-- caller's RLS, so it only counts their own company's rows.
create or replace function public.get_next_invoice_number(p_company_id uuid)
returns text language sql stable security invoker set search_path = public as $$
  select 'INV-' || lpad(
    (coalesce((select count(*) from public.invoices where company_id = p_company_id), 0) + 1)::text,
    4, '0');
$$;
create or replace function public.get_next_work_order_number(p_company_id uuid)
returns text language sql stable security invoker set search_path = public as $$
  select 'WO-' || lpad(
    (coalesce((select count(*) from public.work_orders where company_id = p_company_id), 0) + 1)::text,
    4, '0');
$$;
revoke all on function public.get_next_invoice_number(uuid) from public, anon;
revoke all on function public.get_next_work_order_number(uuid) from public, anon;
grant execute on function public.get_next_invoice_number(uuid) to authenticated;
grant execute on function public.get_next_work_order_number(uuid) to authenticated;
