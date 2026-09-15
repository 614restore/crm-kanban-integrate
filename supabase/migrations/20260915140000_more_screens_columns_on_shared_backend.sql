-- Columns the TrussCTR web screens under More write that the shared
-- TrussCTR/TrussCENTER backend (llamtjsquoqlejznmyjl) lacks: Work Orders,
-- Expenses, Automation, Settings → Lead Sources and Projects. Found by comparing
-- every reachable save in the web app with the live columns.
--
-- Additive except one relaxed check constraint: work_orders.status also allows
-- 'completed', 'on_hold' and 'ready_to_invoice', which the web app and the
-- TrussCENTER mobile app both already send ('complete' stays allowed for
-- QuoteMGR-shaped rows). expenses, automations, lead_sources, projects and
-- work_orders held 0 rows when this was written; the mobile app reads
-- work_orders but only gains nullable columns. QuoteMGR has none of these
-- columns. Types follow the original TrussCTR migrations.

-- ── Work orders ─────────────────────────────────────────────────────────────
-- assigned_to stays a single team member (mobile, QuoteMGR). The web app assigns
-- several people; their user ids go in assigned_user_ids and the first one is
-- also written to assigned_to.
alter table public.work_orders
  add column if not exists title             text,
  add column if not exists description       text,
  add column if not exists priority          text not null default 'medium',
  add column if not exists assigned_user_ids uuid[] not null default '{}',
  add column if not exists estimated_hours   numeric(8,2),
  add column if not exists actual_hours      numeric(8,2),
  add column if not exists labor_cost        numeric(12,2) default 0,
  add column if not exists material_cost     numeric(12,2) default 0,
  add column if not exists total_cost        numeric(12,2) default 0,
  add column if not exists address           text,
  add column if not exists city              text,
  add column if not exists state             text,
  add column if not exists zip               text,
  add column if not exists attachments       jsonb not null default '[]'::jsonb,
  add column if not exists materials         jsonb,
  add column if not exists started_at        timestamptz,
  add column if not exists signed_by         text,
  add column if not exists signature_data    text,
  add column if not exists sign_token        text,
  add column if not exists created_by        uuid;

alter table public.work_orders drop constraint if exists work_orders_status_check;
alter table public.work_orders add constraint work_orders_status_check
  check (status = any (array['scheduled', 'in_progress', 'complete', 'completed', 'cancelled', 'on_hold', 'ready_to_invoice']));

create unique index if not exists work_orders_sign_token_key
  on public.work_orders (sign_token) where sign_token is not null;

-- ── Expenses ────────────────────────────────────────────────────────────────
alter table public.expenses
  add column if not exists job_id            uuid,
  add column if not exists job_name          text,
  add column if not exists contact_name      text,
  add column if not exists receipt_url       text,
  add column if not exists status            text not null default 'pending',
  add column if not exists submitted_by      uuid,
  add column if not exists submitted_by_name text,
  add column if not exists submitted_at      timestamptz not null default now(),
  add column if not exists approved_by       uuid,
  add column if not exists approved_by_name  text,
  add column if not exists approved_at       timestamptz,
  add column if not exists notes             text,
  add column if not exists mileage           numeric(10,2),
  add column if not exists location          text,
  add column if not exists vendor            text,
  add column if not exists payment_method    text not null default 'card',
  add column if not exists reimbursable      boolean not null default false;

create index if not exists expenses_company_date_idx on public.expenses (company_id, date);

-- ── Automations ─────────────────────────────────────────────────────────────
alter table public.automations
  add column if not exists trigger_event       text,
  add column if not exists action_type         text,
  add column if not exists is_active           boolean not null default true,
  add column if not exists message_body        text,
  add column if not exists recipients          jsonb,
  add column if not exists trigger_delay_hours integer,
  add column if not exists created_by          uuid;

-- ── Lead sources ────────────────────────────────────────────────────────────
alter table public.lead_sources
  add column if not exists is_custom  boolean not null default false,
  add column if not exists created_by uuid;

-- ── Projects ────────────────────────────────────────────────────────────────
alter table public.projects
  add column if not exists project_number          text,
  add column if not exists estimate_id             uuid,
  add column if not exists description             text,
  add column if not exists priority                text not null default 'medium',
  add column if not exists completed_date          date,
  add column if not exists estimated_budget        numeric(12,2) default 0,
  add column if not exists actual_cost             numeric(12,2) default 0,
  add column if not exists material_cost           numeric(12,2) default 0,
  add column if not exists subcontractor_cost      numeric(12,2) default 0,
  add column if not exists labor_cost              numeric(12,2) default 0,
  add column if not exists other_cost              numeric(12,2) default 0,
  add column if not exists material_cost_goal      numeric(12,2) default 0,
  add column if not exists subcontractor_cost_goal numeric(12,2) default 0,
  add column if not exists labor_cost_goal         numeric(12,2) default 0,
  add column if not exists other_cost_goal         numeric(12,2) default 0,
  add column if not exists address                 text,
  add column if not exists city                    text,
  add column if not exists state                   text,
  add column if not exists zip                     text,
  add column if not exists project_manager_id      uuid,
  add column if not exists tags                    text[] not null default '{}',
  add column if not exists created_by              uuid;

-- Make the API see the new columns right away.
notify pgrst, 'reload schema';
