#!/usr/bin/env bash
# =============================================================================
# Valida as migrations em um Postgres descartavel e roda o cenario do item 12.
#
#   ./db/tools/validate.sh                 # usa PGPORT/PGHOST do ambiente
#   PGPORT=5433 PGHOST=/tmp ./db/tools/validate.sh
#
# Requer: psql (client) apontando para um Postgres 14+ vazio.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB="${DB:-oticas_validate}"
PSQL="psql -v ON_ERROR_STOP=1 -q"

echo "==> recriando banco $DB"
$PSQL -d postgres -c "drop database if exists $DB" >/dev/null
$PSQL -d postgres -c "create database $DB" >/dev/null

echo "==> shim do Supabase (somente validacao local)"
$PSQL -d "$DB" -f "$ROOT/db/tools/supabase_shim.sql" >/dev/null

echo "==> migrations"
for f in "$ROOT"/db/migrations/*.sql; do
  echo "    - $(basename "$f")"
  $PSQL -d "$DB" -f "$f" >/dev/null
done

echo "==> seeds"
for f in "$ROOT"/db/seeds/*.sql; do
  echo "    - $(basename "$f")"
  $PSQL -d "$DB" -f "$f" >/dev/null
done

echo "==> cenario de validacao (item 12 do briefing)"
$PSQL -d "$DB" -f "$ROOT/db/tools/scenario_item12.sql"

echo "==> OK"
