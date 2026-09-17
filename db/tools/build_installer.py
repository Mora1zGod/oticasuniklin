#!/usr/bin/env python3
"""
Gera um instalador único, para colar no SQL Editor do Supabase.

Junta migrations + seeds na ordem, dentro de uma transação, e registra tudo em
public.schema_migrations com o mesmo checksum que o deploy.sh usaria — assim o
deploy.sh continua funcionando depois, sem tentar reaplicar nada.

    python3 db/tools/build_installer.py
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "db" / "dist" / "full_install.sql"

HEADER = """-- =============================================================================
-- INSTALADOR COMPLETO — Óticas Uniklin
-- =============================================================================
-- Gerado por db/tools/build_installer.py. NÃO EDITE ESTE ARQUIVO: altere as
-- migrations em db/migrations e gere de novo.
--
-- Como usar: Supabase → SQL Editor → New query → cole tudo → Run.
--
-- Roda inteiro numa transação: ou aplica tudo, ou não aplica nada.
--
-- É para a INSTALAÇÃO INICIAL. Se o banco já tiver migrations aplicadas, ele
-- para logo no início com uma mensagem clara e não altera nada — para aplicar
-- só o que falta, use db/tools/deploy.sh.
-- =============================================================================

begin;

create table if not exists public.schema_migrations (
  version     text primary key,
  applied_at  timestamptz not null default now(),
  checksum    text
);

do $install_guard$
begin
  if exists (select 1 from public.schema_migrations) then
    raise exception
      'Este banco ja tem migrations aplicadas (%). Use db/tools/deploy.sh para aplicar apenas o que falta.',
      (select string_agg(version, ', ' order by version) from public.schema_migrations);
  end if;
end;
$install_guard$;

"""

FOOTER = """
-- =============================================================================
-- CONFERÊNCIA
-- =============================================================================
do $$
declare
  v_tables   integer;
  v_no_rls   text;
  v_versions integer;
begin
  select count(*) into v_tables
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE';

  select string_agg(c.relname, ', ' order by c.relname) into v_no_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and not c.relrowsecurity and c.relname <> 'schema_migrations';

  select count(*) into v_versions from public.schema_migrations;

  raise notice 'Tabelas: %  ·  Migrations registradas: %', v_tables, v_versions;
  if v_no_rls is not null then
    raise exception 'Tabelas sem RLS: %', v_no_rls;
  end if;
  raise notice 'RLS habilitado em todas as tabelas de negocio.';
end;
$$;

commit;
"""


def block(path: Path, kind: str) -> str:
    version = path.stem
    body = path.read_text(encoding="utf-8")
    checksum = hashlib.sha256(path.read_bytes()).hexdigest()

    # Seeds são idempotentes (on conflict do nothing) e não entram no registro
    # de versões — o deploy.sh também os reaplica a cada execução.
    if kind == "seed":
        return f"\n-- ===== SEED: {path.name} =====\n{body}\n"

    return f"""
-- ===== MIGRATION: {path.name} =====
{body}

insert into public.schema_migrations (version, checksum)
values ('{version}', '{checksum}');
"""


def main() -> None:
    parts = [HEADER]
    migrations = sorted((ROOT / "db" / "migrations").glob("*.sql"))
    seeds = sorted((ROOT / "db" / "seeds").glob("*.sql"))

    for path in migrations:
        parts.append(block(path, "migration"))
    for path in seeds:
        parts.append(block(path, "seed"))

    parts.append(FOOTER)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("".join(parts), encoding="utf-8")

    size = OUT.stat().st_size
    print(f"  {len(migrations)} migrations + {len(seeds)} seeds")
    print(f"  {OUT.relative_to(ROOT)}  ({size / 1024:.0f} KB, {len(OUT.read_text().splitlines())} linhas)")


if __name__ == "__main__":
    main()
