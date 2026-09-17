#!/usr/bin/env bash
# =============================================================================
# Aplica o schema em um Postgres REAL (Supabase), com controle de versao.
#
#   DATABASE_URL="postgresql://postgres.<ref>:<senha>@<host>:5432/postgres" \
#     ./db/tools/deploy.sh
#
# A connection string esta no painel do Supabase em:
#   Project Settings -> Database -> Connection string -> URI
#
# Idempotente: registra o que ja foi aplicado em public.schema_migrations e
# roda apenas o que falta. Cada migration roda dentro de uma transacao — se
# falhar, nada daquela migration fica aplicado pela metade.
#
# Flags:
#   --dry-run   mostra o que seria aplicado, sem aplicar
#   --seeds     tambem aplica db/seeds (idempotentes; seguro repetir)
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DRY_RUN=false
WITH_SEEDS=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --seeds)   WITH_SEEDS=true ;;
    *) echo "flag desconhecida: $arg" >&2; exit 2 ;;
  esac
done

if [[ -z "${DATABASE_URL:-}" ]]; then
  cat >&2 <<'MSG'
ERRO: defina DATABASE_URL.

  export DATABASE_URL="postgresql://postgres.<ref>:<senha>@<host>:5432/postgres"
  ./db/tools/deploy.sh --seeds

Pegue a URI em: Supabase -> Project Settings -> Database -> Connection string.
MSG
  exit 1
fi

PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q --no-psqlrc)

echo "==> testando conexao"
SERVER=$("${PSQL[@]}" -tAc "select current_database() || ' @ ' || inet_server_addr()::text" 2>/dev/null || true)
if [[ -z "$SERVER" ]]; then
  SERVER=$("${PSQL[@]}" -tAc "select current_database()")
fi
echo "    conectado: $SERVER"

# Guarda-corpo: o schema `auth` do Supabase precisa existir. Se nao existir, a
# 0001 falharia no meio — melhor avisar antes.
HAS_AUTH=$("${PSQL[@]}" -tAc "select count(*) from information_schema.schemata where schema_name = 'auth'")
if [[ "$HAS_AUTH" == "0" ]]; then
  cat >&2 <<'MSG'
ERRO: este banco nao tem o schema `auth` do Supabase.

As migrations referenciam auth.users e auth.uid(). Aponte a DATABASE_URL para um
projeto Supabase real. (Para validar num Postgres comum use db/tools/validate.sh,
que carrega o shim de desenvolvimento.)
MSG
  exit 1
fi

echo "==> registro de versoes"
"${PSQL[@]}" -c "
  create table if not exists public.schema_migrations (
    version     text primary key,
    applied_at  timestamptz not null default now(),
    checksum    text
  );" >/dev/null

apply_file() {
  local file="$1" version="$2" checksum
  checksum=$(sha256sum "$file" | cut -d' ' -f1)

  local applied
  applied=$("${PSQL[@]}" -tAc \
    "select checksum from public.schema_migrations where version = '$version'")

  if [[ -n "$applied" ]]; then
    if [[ "$applied" != "$checksum" ]]; then
      echo "    ! $version JA APLICADA com conteudo diferente do arquivo atual." >&2
      echo "      Nao reaplique: crie uma nova migration com a alteracao." >&2
      return 1
    fi
    echo "    = $version (ja aplicada)"
    return 0
  fi

  if [[ "$DRY_RUN" == true ]]; then
    echo "    + $version (seria aplicada)"
    return 0
  fi

  echo "    + $version"
  "${PSQL[@]}" --single-transaction -f "$file" >/dev/null
  "${PSQL[@]}" -c \
    "insert into public.schema_migrations (version, checksum)
     values ('$version', '$checksum')" >/dev/null
}

echo "==> migrations"
for f in "$ROOT"/db/migrations/*.sql; do
  apply_file "$f" "$(basename "$f" .sql)"
done

if [[ "$WITH_SEEDS" == true ]]; then
  echo "==> seeds de plataforma (idempotentes)"
  for f in "$ROOT"/db/seeds/*.sql; do
    if [[ "$DRY_RUN" == true ]]; then
      echo "    + $(basename "$f") (seria aplicado)"
    else
      echo "    + $(basename "$f")"
      "${PSQL[@]}" --single-transaction -f "$f" >/dev/null
    fi
  done
fi

if [[ "$DRY_RUN" == true ]]; then
  echo "==> dry-run: nada foi alterado"
  exit 0
fi

echo "==> conferencia"
"${PSQL[@]}" -c "
  select
    (select count(*) from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE') as tabelas,
    (select count(*) from pg_policies where schemaname = 'public') as policies,
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity) as com_rls,
    (select count(*) from public.schema_migrations) as migrations;"

# Nenhuma tabela de negocio pode ficar sem RLS em producao.
UNPROTECTED=$("${PSQL[@]}" -tAc "
  select string_agg(c.relname, ', ' order by c.relname)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and not c.relrowsecurity
    and c.relname <> 'schema_migrations';")

if [[ -n "$UNPROTECTED" ]]; then
  echo "    ! ATENCAO: tabelas sem RLS: $UNPROTECTED" >&2
else
  echo "    RLS habilitado em todas as tabelas de negocio."
fi

echo "==> OK — schema no ar"
