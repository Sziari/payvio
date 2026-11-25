#!/usr/bin/env bash
# Runs the migrations + RLS tests against a throwaway Postgres database.
# Usage: PGPORT=5433 PGHOST=/tmp PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=payvio_test
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d $DB -f supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d $DB -f "$f"
done
psql -q -v ON_ERROR_STOP=1 -d $DB -f supabase/seed.sql >/dev/null
psql -v ON_ERROR_STOP=1 -d $DB -f supabase/tests/rls_test.sql 2>&1 | grep -v "new row violates\|permission denied\|^$" || true
