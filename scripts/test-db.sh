#!/usr/bin/env bash
# Runs the Supabase migrations and their tests on a throwaway local Postgres.
# Needs Postgres 15+ binaries (initdb, pg_ctl, psql) on the machine.
set -euo pipefail
BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
PORT="${PG_PORT:-54329}"
# Postgres refuses to run as root: use the postgres user in that case.
if [ "$(id -u)" = "0" ]; then
  chown -R postgres "$TMP"
  run() { su postgres -s /bin/sh -c "$(printf "%q " "$@")"; }
else
  run() { "$@"; }
fi
cleanup() { run "$BIN/pg_ctl" -D "$TMP/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
run "$BIN/initdb" -D "$TMP/data" -A trust -U postgres >/dev/null
run "$BIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP" -l "$TMP/log" start -w >/dev/null
PSQL=("$BIN/psql" -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/supabase/sql-tests/auth_shim.sql"
# pg_net is a Supabase extension: the shim above stands in for it.
for f in "$ROOT"/supabase/migrations/*.sql; do grep -v "create extension if not exists pg_net" "$f" | "${PSQL[@]}"; done
for t in social push; do
  "${PSQL[@]}" -o /dev/null -f "$ROOT/supabase/sql-tests/${t}_test.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'
done
echo "All database tests passed."
