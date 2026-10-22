#!/usr/bin/env bash
# Tests 20261021_02_payments_drop_payments_all.sql against a throwaway LOCAL Postgres (never Supabase).
# Recreates the live database's hand-added payments_all policy and get_my_company_ids(), applies 01 then 02
# (02 twice), and runs the same checks as run.sh plus team-membership and "another delete policy" cases.
# Usage: supabase/tests/payments_delete_rls/run_02.sh   (needs postgresql@14 from Homebrew)
set -euo pipefail
cd "$(dirname "$0")"
export PATH=/opt/homebrew/opt/postgresql@14/bin:$PATH PGHOST=127.0.0.1 PGPORT=55440 PGUSER=postgres
M1=../../migrations/20261021_01_payments_delete_managers_only.sql
M2=../../migrations/20261021_02_payments_drop_payments_all.sql
DATA=$(mktemp -d)
initdb -D "$DATA" -U postgres -A trust >/dev/null
pg_ctl -D "$DATA" -o "-p $PGPORT -k '' -h 127.0.0.1" -l "$DATA/log" -w start >/dev/null
trap 'pg_ctl -D "$DATA" -m fast stop >/dev/null; rm -rf "$DATA"' EXIT
p() { psql -v ON_ERROR_STOP=1 -q "$@"; }

live_extras() {
  p -d "$1" <<'SQL'
-- As on the live database: team-membership company lookup, and the hand-added FOR ALL policy.
create function public.get_my_company_ids() returns setof uuid language sql stable security definer as $$
  select company_id from public.team_members where user_id = auth.uid() and is_active = true
$$;
create policy payments_all on public.payments for all
  using (company_id in (select get_my_company_ids()))
  with check (company_id in (select get_my_company_ids()));
-- T: no profile company, active sales_rep team member of company A (reaches A only through team membership)
insert into public.profiles values ('00000000-0000-0000-0000-0000000000a5', null, 'sales_rep');
insert into public.team_members (user_id, company_id, role, is_active)
  values ('00000000-0000-0000-0000-0000000000a5', 'a0000000-0000-0000-0000-00000000000a', 'sales_rep', true);
SQL
}

createdb s01; p -d s01 -f setup.sql; live_extras s01
echo "### After 01 only, as live now: payments_all still lets a sales_rep delete"
p -d s01 -f "$M1" 2>/dev/null
p -d s01 -v expect_rep_delete=1 -f test.sql

createdb main; p -d main -f setup.sql; live_extras main
echo "### After 01 then 02 (02 applied twice)"
p -d main -f "$M1" 2>/dev/null
p -d main -f "$M2" >/dev/null 2>&1; p -d main -f "$M2" 2>/dev/null
p -d main -v expect_rep_delete=0 -f test.sql

echo "### Team-membership-only user (no profile company)"
p -d main <<'SQL'
create temp table r2 (check_name text, ok boolean);
create or replace function pg_temp.try(u text, sql text) returns int language plpgsql as $$
declare n int;
begin
  begin
    perform set_config('test.uid', u, true);
    execute 'set local role authenticated';
    execute sql; get diagnostics n = row_count;
    raise exception 'rc:%', n;
  exception when others then
    if sqlerrm like 'rc:%' then return substr(sqlerrm, 4)::int; end if;
    return -1;
  end;
end $$;
insert into payments (id, company_id, amount) values ('22222222-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 50);
insert into r2 values
 ('team-only rep still reads company A',   pg_temp.try('00000000-0000-0000-0000-0000000000a5', $q$select * from payments where id = '22222222-0000-0000-0000-000000000001'$q$) = 1),
 ('team-only rep still inserts into A',    pg_temp.try('00000000-0000-0000-0000-0000000000a5', $q$insert into payments (company_id, amount) values ('a0000000-0000-0000-0000-00000000000a', 9)$q$) = 1),
 ('team-only rep still updates in A',      pg_temp.try('00000000-0000-0000-0000-0000000000a5', $q$update payments set notes = 'y' where id = '22222222-0000-0000-0000-000000000001'$q$) = 1),
 ('team-only rep cannot delete',           pg_temp.try('00000000-0000-0000-0000-0000000000a5', $q$delete from payments where id = '22222222-0000-0000-0000-000000000001'$q$) = 0);
select check_name, case when ok then 'PASS' else 'FAIL' end from r2;
select count(*) filter (where not ok) as failures from r2;
SQL

echo "### Another hand-added delete policy stops 02 and changes nothing"
createdb guard; p -d guard -f setup.sql; live_extras guard; p -d guard -f "$M1" 2>/dev/null
p -d guard -c "create policy extra_delete on public.payments for delete using (true)"
if p -d guard -f "$M2" >/dev/null 2>"$DATA/guard.err"; then echo "FAIL: 02 ran despite extra_delete"; exit 1; fi
grep -o "payments still has other policies that allow DELETE: [^.]*" "$DATA/guard.err"
p -d guard -At -c "select string_agg(policyname, ',' order by policyname) from pg_policies where tablename = 'payments'" \
  | sed 's/^/policies left unchanged: /'
