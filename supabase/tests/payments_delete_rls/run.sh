#!/usr/bin/env bash
# Tests 20261021_01_payments_delete_managers_only.sql against a throwaway LOCAL Postgres (never Supabase).
# Usage: supabase/tests/payments_delete_rls/run.sh   (needs postgresql@14 from Homebrew)
set -euo pipefail
cd "$(dirname "$0")"
export PATH=/opt/homebrew/opt/postgresql@14/bin:$PATH PGHOST=127.0.0.1 PGPORT=55439 PGUSER=postgres
MIG=../../migrations/20261021_01_payments_delete_managers_only.sql
DATA=$(mktemp -d)
initdb -D "$DATA" -U postgres -A trust >/dev/null
pg_ctl -D "$DATA" -o "-p $PGPORT -k '' -h 127.0.0.1" -l "$DATA/log" -w start >/dev/null
trap 'pg_ctl -D "$DATA" -m fast stop >/dev/null; rm -rf "$DATA"' EXIT
p() { psql -v ON_ERROR_STOP=1 -q "$@"; }
for d in before after; do createdb $d; p -d $d -f setup.sql; done
echo "### Before the migration (any member can delete)"; p -d before -v expect_rep_delete=1 -f test.sql
echo "### After the migration, applied twice"; p -d after -f $MIG 2>/dev/null; p -d after -f $MIG 2>/dev/null
p -d after -v expect_rep_delete=0 -f test.sql
