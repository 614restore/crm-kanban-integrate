#!/usr/bin/env bash
# Tests 20261022_01_archive_quotes_of_deleted_customers.sql against a throwaway LOCAL Postgres (never Supabase).
# Usage: supabase/tests/archive_orphan_quotes/run.sh   (needs postgresql@14 from Homebrew)
set -euo pipefail
cd "$(dirname "$0")"
export PATH=/opt/homebrew/opt/postgresql@14/bin:$PATH PGHOST=127.0.0.1 PGPORT=55441 PGUSER=postgres
MIG=../../migrations/20261022_01_archive_quotes_of_deleted_customers.sql
DATA=$(mktemp -d)
initdb -D "$DATA" -U postgres -A trust >/dev/null
pg_ctl -D "$DATA" -o "-p $PGPORT -k '' -h 127.0.0.1" -l "$DATA/log" -w start >/dev/null
trap 'pg_ctl -D "$DATA" -m fast stop >/dev/null; rm -rf "$DATA"' EXIT
p() { psql -v ON_ERROR_STOP=1 -q -d t "$@"; }
createdb t

# Stub of the live tables. Orphans are inserted before the FK exists (as on live, where the FK came later),
# then the FK is added NOT VALID with ON DELETE SET NULL like quotes_customer_id_fkey.
p <<'SQL'
create table customers (id uuid primary key, first_name text);
create table quotes (id uuid primary key default gen_random_uuid(), quote_number text, status text,
  signed_by text, customer_id uuid, contact_id uuid, is_archived boolean not null default false,
  updated_at timestamptz not null default now(), created_at timestamptz not null default now());
insert into customers values ('00000000-0000-0000-0000-00000000000a', 'Kept'), ('00000000-0000-0000-0000-00000000000b', 'ToDelete');
insert into quotes (quote_number, status, signed_by, customer_id, contact_id) values
 ('Q-KEPT',        'signed', 'Kept',        '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a'),
 ('Q-ORPHAN-CUST', 'signed', 'Johnny Wick', '00000000-0000-0000-0000-0000000000f1', null),
 ('Q-ORPHAN-CONT', 'sent',   null,          null,                                   '00000000-0000-0000-0000-0000000000f2'),
 ('Q-NO-CUSTOMER', 'draft',  null,          null,                                   null),
 ('Q-WEB-B',       'signed', 'ToDelete',    '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b'),
 ('Q-MOBILE-B',    'sent',   null,          '00000000-0000-0000-0000-00000000000b', null);
insert into quotes (quote_number, status, customer_id, is_archived) values ('Q-ORPHAN-ALREADY', 'sent', '00000000-0000-0000-0000-0000000000f3', true);
alter table quotes add constraint quotes_customer_id_fkey foreign key (customer_id) references customers(id) on delete set null not valid;
SQL

echo "### Apply (backfill lists what it archived)"; p -f "$MIG"
echo "### Apply again (should archive nothing)"; p -f "$MIG"

p <<'SQL'
delete from customers where id = '00000000-0000-0000-0000-00000000000b';
create temp table r (check_name text, ok boolean);
insert into r values
 ('kept customer''s quote stays',            (select not is_archived from quotes where quote_number = 'Q-KEPT')),
 ('orphan by customer_id archived',          (select is_archived from quotes where quote_number = 'Q-ORPHAN-CUST')),
 ('orphan by contact_id archived',           (select is_archived from quotes where quote_number = 'Q-ORPHAN-CONT')),
 ('quote with no customer ids left alone',   (select not is_archived from quotes where quote_number = 'Q-NO-CUSTOMER')),
 ('deleted customer: web quote archived',    (select is_archived from quotes where quote_number = 'Q-WEB-B')),
 ('deleted customer: mobile quote archived', (select is_archived from quotes where quote_number = 'Q-MOBILE-B')),
 ('FK still clears customer_id on delete',   (select customer_id is null from quotes where quote_number = 'Q-MOBILE-B')),
 ('customer delete still succeeds',          (select count(*) = 0 from customers where id = '00000000-0000-0000-0000-00000000000b'));
select check_name, case when ok then 'PASS' else 'FAIL' end from r;
select count(*) filter (where not ok) as failures from r;
SQL
