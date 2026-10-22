-- Stub of the parts of Supabase the migration touches
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema auth to authenticated;
create table public.companies (id uuid primary key);
create table public.profiles (id uuid primary key, company_id uuid references companies(id), role text);
create table public.team_members (id uuid primary key default gen_random_uuid(), user_id uuid, company_id uuid, role text, is_active boolean default true);
create table public.payments (id uuid primary key default gen_random_uuid(), company_id uuid not null references companies(id), amount numeric(12,2) not null check (amount > 0), notes text);
alter table public.payments enable row level security;
-- the policy as created by 20260406000001_payments_table.sql
create policy "payments_company_isolation" on payments for all using (company_id in (select company_id from profiles where id = auth.uid()));
grant select, insert, update, delete on all tables in schema public to authenticated;
-- company A: manager M, sales_rep R, owner O whose team_members row is inactive (I); company B: manager X
insert into companies values ('a0000000-0000-0000-0000-00000000000a'), ('b0000000-0000-0000-0000-00000000000b');
insert into profiles values
 ('00000000-0000-0000-0000-0000000000a1','a0000000-0000-0000-0000-00000000000a','sales_rep'),
 ('00000000-0000-0000-0000-0000000000a2','a0000000-0000-0000-0000-00000000000a','manager'),  -- rep who set profiles.role=manager on themselves
 ('00000000-0000-0000-0000-0000000000a3','a0000000-0000-0000-0000-00000000000a','manager'),
 ('00000000-0000-0000-0000-0000000000a4','a0000000-0000-0000-0000-00000000000a','owner'),
 ('00000000-0000-0000-0000-0000000000b1','b0000000-0000-0000-0000-00000000000b','manager');
insert into team_members (user_id, company_id, role, is_active) values
 ('00000000-0000-0000-0000-0000000000a1','a0000000-0000-0000-0000-00000000000a','sales_rep', true),
 ('00000000-0000-0000-0000-0000000000a2','a0000000-0000-0000-0000-00000000000a','sales_rep', true),
 ('00000000-0000-0000-0000-0000000000a3','a0000000-0000-0000-0000-00000000000a','sales_manager', true),
 ('00000000-0000-0000-0000-0000000000a4','a0000000-0000-0000-0000-00000000000a','owner', false),
 ('00000000-0000-0000-0000-0000000000b1','b0000000-0000-0000-0000-00000000000b','manager', true);
