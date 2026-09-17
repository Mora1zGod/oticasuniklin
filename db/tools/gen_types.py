#!/usr/bin/env python3
"""
Gera os tipos TypeScript a partir do schema REAL do banco.

Nada aqui e escrito a mao: o gerador introspecta o Postgres onde as migrations
foram aplicadas (information_schema + pg_catalog) e emite:

  src/types/database.ts  -> tipo `Database` compativel com @supabase/supabase-js
  src/types/domain.ts    -> unioes derivadas dos CHECK, aliases e branded types

Uso:
    PGHOST=... PGPORT=... PGUSER=... DB=oticas_validate python3 db/tools/gen_types.py

O banco precisa ter as migrations aplicadas (rode db/tools/validate.sh antes).
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

DB = os.environ.get("DB", "oticas_validate")
ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "src" / "types"

# ---------------------------------------------------------------------------
# Acesso ao banco
# ---------------------------------------------------------------------------


def query(sql: str) -> list[dict]:
    """Roda a query e devolve as linhas como dicts (via json_agg no proprio Postgres)."""
    wrapped = f"select coalesce(json_agg(t), '[]'::json) from ({sql}) t"
    proc = subprocess.run(
        ["psql", "-d", DB, "-tAc", wrapped],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        sys.exit(f"psql falhou:\n{proc.stderr}")
    return json.loads(proc.stdout.strip() or "[]")


# ---------------------------------------------------------------------------
# Mapa de tipos Postgres -> TypeScript
# ---------------------------------------------------------------------------

TYPE_MAP = {
    "uuid": "string",
    "text": "string",
    "citext": "string",
    "character varying": "string",
    "character": "string",
    "bpchar": "string",
    "name": "string",
    "boolean": "boolean",
    "smallint": "number",
    "integer": "number",
    "bigint": "number",
    "numeric": "number",
    "real": "number",
    "double precision": "number",
    "date": "string",
    "timestamp with time zone": "string",
    "timestamp without time zone": "string",
    "time with time zone": "string",
    "time without time zone": "string",
    "interval": "string",
    "json": "Json",
    "jsonb": "Json",
    "bytea": "string",
    "void": "void",
    "record": "Json",
}


def ts_type(pg_type: str, udt: str = "") -> str:
    if pg_type == "ARRAY":
        inner = udt.lstrip("_")
        base = TYPE_MAP.get(PG_INTERNAL.get(inner, inner), "unknown")
        return f"{base}[]"
    if pg_type == "USER-DEFINED":
        # dominios e tipos de extensao (citext, por exemplo) vem por udt_name
        return TYPE_MAP.get(PG_INTERNAL.get(udt, udt), "unknown")
    return TYPE_MAP.get(pg_type, "unknown")


# nomes internos (pg_type.typname) -> nomes do information_schema
PG_INTERNAL = {
    "int2": "smallint",
    "int4": "integer",
    "int8": "bigint",
    "float4": "real",
    "float8": "double precision",
    "bool": "boolean",
    "varchar": "character varying",
    "timestamptz": "timestamp with time zone",
    "timestamp": "timestamp without time zone",
}


# ---------------------------------------------------------------------------
# Uniões derivadas de CHECK constraints
# ---------------------------------------------------------------------------

# CHECK ((party_type = ANY (ARRAY['individual'::text, 'company'::text])))
ANY_ARRAY = re.compile(
    r"^CHECK \(\(+([a-z_]+) = ANY \(ARRAY\[(.+?)\]\)\)+\)$", re.IGNORECASE | re.DOTALL
)
# CHECK ((eye = 'OD'::text))  -- caso de valor unico
SINGLE_EQ = re.compile(r"^CHECK \(\(+([a-z_]+) = '([^']+)'::[a-z ]+\)+\)$", re.IGNORECASE)
LITERAL = re.compile(r"'((?:[^']|'')*)'::")


def split_top_level(body: str) -> list[str]:
    """Divide os itens de um ARRAY[...] respeitando parenteses e aspas."""
    parts, depth, in_quote, current = [], 0, False, ""
    for ch in body:
        if ch == "'":
            in_quote = not in_quote
        elif not in_quote and ch in "([":
            depth += 1
        elif not in_quote and ch in ")]":
            depth -= 1
        if ch == "," and depth == 0 and not in_quote:
            parts.append(current.strip())
            current = ""
        else:
            current += ch
    if current.strip():
        parts.append(current.strip())
    return parts


def parse_check_union(definition: str) -> tuple[str, list[str]] | None:
    """Extrai (coluna, valores) de um CHECK simples de dominio fechado de TEXTO.

    Ignora CHECKs compostos (mais de uma coluna, IS NULL) e dominios numericos:
    o Postgres formata inteiros negativos como '-1'::integer, e tratar isso como
    literal de string produziria uma uniao errada e incompleta.
    """
    text = " ".join(definition.split())

    m = ANY_ARRAY.match(text)
    if m:
        column, body = m.group(1), m.group(2)
        items = split_top_level(body)
        values = [v.replace("''", "'") for v in LITERAL.findall(body)]
        # todo item precisa ser um literal entre aspas, e de tipo textual
        every_item_quoted = len(values) == len(items) and all(
            item.startswith("'") for item in items
        )
        textual = all(
            re.search(r"::\s*(text|citext|character varying|varchar|bpchar|character)",
                      item)
            for item in items
        )
        if values and every_item_quoted and textual:
            return column, values

    m = SINGLE_EQ.match(text)
    if m:
        return m.group(1), [m.group(2)]

    return None


# ---------------------------------------------------------------------------
# Coleta
# ---------------------------------------------------------------------------


def collect_columns() -> dict[str, list[dict]]:
    rows = query(
        """
        select c.table_name, c.column_name, c.ordinal_position,
               c.data_type, c.udt_name, c.is_nullable, c.column_default,
               c.is_identity, c.is_generated
        from information_schema.columns c
        join information_schema.tables t
          on t.table_schema = c.table_schema and t.table_name = c.table_name
        where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
        order by c.table_name, c.ordinal_position
        """
    )
    out: dict[str, list[dict]] = {}
    for r in rows:
        out.setdefault(r["table_name"], []).append(r)
    return out


def collect_view_columns() -> dict[str, list[dict]]:
    rows = query(
        """
        select c.table_name, c.column_name, c.ordinal_position,
               c.data_type, c.udt_name, c.is_nullable
        from information_schema.columns c
        join information_schema.views v
          on v.table_schema = c.table_schema and v.table_name = c.table_name
        where c.table_schema = 'public'
        order by c.table_name, c.ordinal_position
        """
    )
    out: dict[str, list[dict]] = {}
    for r in rows:
        out.setdefault(r["table_name"], []).append(r)
    return out


def collect_checks() -> dict[tuple[str, str], list[str]]:
    """(tabela, coluna) -> valores permitidos, extraidos dos CHECK do banco."""
    rows = query(
        """
        select rel.relname as table_name,
               pg_get_constraintdef(con.oid) as definition
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public' and con.contype = 'c'
        order by rel.relname
        """
    )
    out: dict[tuple[str, str], list[str]] = {}
    for r in rows:
        parsed = parse_check_union(r["definition"])
        if not parsed:
            continue
        column, values = parsed
        key = (r["table_name"], column)
        if key in out:  # mais de um CHECK na mesma coluna: nao arriscar
            out[key] = []
        else:
            out[key] = values
    return {k: v for k, v in out.items() if v}


def collect_foreign_keys() -> dict[str, list[dict]]:
    rows = query(
        """
        select rel.relname as table_name,
               con.conname as constraint_name,
               (select array_agg(att.attname order by k.ord)
                  from unnest(con.conkey) with ordinality k(attnum, ord)
                  join pg_attribute att
                    on att.attrelid = con.conrelid and att.attnum = k.attnum
               ) as columns,
               fref.relname as referenced_table,
               -- 1:1 quando as colunas da FK sao cobertas por um indice unico
               -- na propria tabela (PK ou unique). O postgrest-js usa isso para
               -- decidir entre objeto e array no embed.
               exists (
                 select 1 from pg_index i
                 where i.indrelid = con.conrelid
                   and i.indisunique
                   and (select array_agg(k order by k) from unnest(i.indkey::int[]) k)
                       = (select array_agg(k order by k) from unnest(con.conkey::int[]) k)
               ) as is_one_to_one,
               (select array_agg(att.attname order by k.ord)
                  from unnest(con.confkey) with ordinality k(attnum, ord)
                  join pg_attribute att
                    on att.attrelid = con.confrelid and att.attnum = k.attnum
               ) as referenced_columns
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_class fref on fref.oid = con.confrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public' and con.contype = 'f'
        order by rel.relname, con.conname
        """
    )
    out: dict[str, list[dict]] = {}
    for r in rows:
        out.setdefault(r["table_name"], []).append(r)
    return out


def collect_functions() -> list[dict]:
    return query(
        """
        select p.proname as name,
               pg_get_function_arguments(p.oid) as args,
               pg_get_function_result(p.oid) as result,
               p.prokind
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        left join pg_depend d
               on d.objid = p.oid and d.deptype = 'e'
        where n.nspname = 'public'
          and p.prokind = 'f'
          and d.objid is null
          and p.proname not like 'tg\\_%'
        order by p.proname
        """
    )


def collect_table_comments() -> dict[str, str]:
    rows = query(
        """
        select rel.relname as table_name,
               obj_description(rel.oid, 'pg_class') as comment
        from pg_class rel
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public'
          and rel.relkind = 'r'
          and obj_description(rel.oid, 'pg_class') is not null
        """
    )
    return {r["table_name"]: " ".join(r["comment"].split()) for r in rows}


# ---------------------------------------------------------------------------
# Emissao
# ---------------------------------------------------------------------------

HEADER = """// ============================================================================
// GERADO AUTOMATICAMENTE — NAO EDITAR A MAO
// ----------------------------------------------------------------------------
// Fonte: schema real em db/migrations/*.sql, introspectado do Postgres.
// Regerar: ./db/tools/validate.sh && python3 db/tools/gen_types.py
// ============================================================================
"""


def pascal(name: str) -> str:
    return "".join(p.capitalize() for p in name.split("_"))


def singularize(word: str) -> str:
    """Singularizacao suficiente para os nomes de tabela deste schema."""
    if word.endswith("ies"):
        return word[:-3] + "y"
    if word.endswith(("sses", "ses", "shes", "ches", "xes", "zes")):
        return word[:-2]
    if word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def domain_alias(table: str, column: str) -> str:
    """Nome do tipo de dominio: <TabelaSingular><Coluna>, sem repetir o prefixo."""
    entity = pascal(singularize(table))
    field = pascal(column)
    if field.startswith(entity):  # products.product_kind -> ProductKind
        return field
    return entity + field


def union_of(values: list[str]) -> str:
    return " | ".join(f"'{v}'" for v in values)


def column_ts(col: dict, checks: dict, table: str) -> str:
    key = (table, col["column_name"])
    if key in checks:
        base = union_of(checks[key])
    else:
        base = ts_type(col["data_type"], col.get("udt_name", ""))
    return f"{base} | null" if col["is_nullable"] == "YES" else base


def optional_on_insert(col: dict) -> bool:
    return (
        col["is_nullable"] == "YES"
        or col.get("column_default") is not None
        or col.get("is_identity") == "YES"
        or col.get("is_generated") == "ALWAYS"
    )


def emit_database(tables, views, checks, fks, functions, comments) -> str:
    out = [HEADER]
    out.append(
        "export type Json =\n"
        "  | string\n  | number\n  | boolean\n  | null\n"
        "  | { [key: string]: Json | undefined }\n  | Json[]\n"
    )
    out.append("export type Database = {")
    out.append("  public: {")

    # ---- Tables ----
    out.append("    Tables: {")
    for table, cols in tables.items():
        if table in comments:
            out.append(f"      /** {comments[table]} */")
        out.append(f"      {table}: {{")
        out.append("        Row: {")
        for c in cols:
            out.append(f"          {c['column_name']}: {column_ts(c, checks, table)}")
        out.append("        }")

        out.append("        Insert: {")
        for c in cols:
            mark = "?" if optional_on_insert(c) else ""
            out.append(f"          {c['column_name']}{mark}: {column_ts(c, checks, table)}")
        out.append("        }")

        out.append("        Update: {")
        for c in cols:
            out.append(f"          {c['column_name']}?: {column_ts(c, checks, table)}")
        out.append("        }")

        rels = fks.get(table, [])
        out.append("        Relationships: [")
        for fk in rels:
            out.append("          {")
            out.append(f"            foreignKeyName: '{fk['constraint_name']}'")
            out.append(
                f"            isOneToOne: {'true' if fk['is_one_to_one'] else 'false'}"
            )
            out.append(f"            columns: [{', '.join(repr(c) for c in fk['columns'])}]")
            out.append(f"            referencedRelation: '{fk['referenced_table']}'")
            out.append(
                f"            referencedColumns: "
                f"[{', '.join(repr(c) for c in fk['referenced_columns'])}]"
            )
            out.append("          },")
        out.append("        ]")
        out.append("      }")
    out.append("    }")

    # ---- Views ----
    out.append("    Views: {")
    for view, cols in views.items():
        out.append(f"      {view}: {{")
        out.append("        Row: {")
        for c in cols:
            nullable = " | null" if c["is_nullable"] == "YES" else ""
            out.append(
                f"          {c['column_name']}: "
                f"{ts_type(c['data_type'], c.get('udt_name', ''))}{nullable}"
            )
        out.append("        }")
        # O postgrest-js exige Relationships tambem nas views (GenericView).
        # Views nao carregam FK declarada: a lista e vazia de proposito.
        out.append("        Relationships: []")
        out.append("      }")
    out.append("    }")

    # ---- Functions ----
    out.append("    Functions: {")
    for fn in functions:
        out.append(f"      /** {fn['name']}({fn['args']}) returns {fn['result']} */")
        out.append(f"      {fn['name']}: {{")
        out.append("        Args: " + fn_args_ts(fn["args"]))
        out.append("        Returns: " + fn_result_ts(fn["result"]))
        out.append("      }")
    out.append("    }")

    out.append("    Enums: { [_ in never]: never }")
    out.append("    CompositeTypes: { [_ in never]: never }")
    out.append("  }")
    out.append("}")
    out.append("")

    # ---- Helpers de acesso (mesmo padrao do supabase gen types) ----
    out.append(
        """
type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row']

export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']

export type Views<T extends keyof PublicSchema['Views']> =
  PublicSchema['Views'][T]['Row']

export type FunctionArgs<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T]['Args']

export type FunctionReturns<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T]['Returns']
""".strip()
    )
    out.append("")
    return "\n".join(out)


ARG_RE = re.compile(
    r"^(?:(?P<mode>VARIADIC|OUT|INOUT|IN)\s+)?(?P<name>[a-z_][a-z0-9_]*)\s+"
    r"(?P<type>[a-z0-9_ \[\]\.]+?)(?:\s+DEFAULT\s+(?P<default>.+))?$",
    re.IGNORECASE,
)


def split_args(args: str) -> list[str]:
    """Divide a lista de argumentos respeitando parenteses de DEFAULT."""
    parts, depth, current = [], 0, ""
    for ch in args:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(current.strip())
            current = ""
        else:
            current += ch
    if current.strip():
        parts.append(current.strip())
    return parts


def normalize_pg_type(raw: str) -> str:
    raw = raw.strip().lower()
    raw = re.sub(r"\(\d+(,\s*\d+)?\)", "", raw)
    if raw.endswith("[]"):
        base = normalize_pg_type(raw[:-2])
        return f"{base}[]"
    return PG_INTERNAL.get(raw, raw)


def pg_to_ts(raw: str) -> str:
    normalized = normalize_pg_type(raw)
    if normalized.endswith("[]"):
        return TYPE_MAP.get(normalized[:-2], "unknown") + "[]"
    return TYPE_MAP.get(normalized, "unknown")


def fn_args_ts(args: str) -> str:
    if not args.strip():
        return "Record<string, never>"
    fields = []
    for part in split_args(args):
        m = ARG_RE.match(part.strip())
        if not m:
            return "Record<string, unknown>"
        default = m.group("default")
        optional = "?" if default else ""
        ts = pg_to_ts(m.group("type"))
        # DEFAULT NULL: o argumento aceita null explicitamente
        if default and re.match(r"^\s*NULL\b", default, re.IGNORECASE):
            ts = f"{ts} | null"
        fields.append(f"{m.group('name')}{optional}: {ts}")
    return "{ " + "; ".join(fields) + " }"


def fn_result_ts(result: str) -> str:
    result = result.strip()
    if result.upper().startswith("TABLE("):
        inner = result[len("TABLE(") : -1]
        fields = []
        for part in split_args(inner):
            name, _, raw = part.strip().partition(" ")
            fields.append(f"{name}: {pg_to_ts(raw)}")
        return "{ " + "; ".join(fields) + " }[]"
    if result.upper().startswith("SETOF "):
        return pg_to_ts(result[6:]) + "[]"
    return pg_to_ts(result)


def emit_domain(tables, checks, comments) -> str:
    """Uniões de dominio + branded types para as distincoes dos ADRs."""
    out = [HEADER]
    out.append(
        "import type { Tables, TablesInsert, Views } from './database'\n\n"
        "// ---------------------------------------------------------------------------\n"
        "// Dominios fechados\n"
        "// ---------------------------------------------------------------------------\n"
        "// O produto usa CHECK em vez de CREATE TYPE ... AS ENUM (ADR-010). Estas\n"
        "// unioes sao extraidas dos proprios CHECK do banco — se a migration mudar,\n"
        "// o tipo muda junto na proxima geracao.\n"
    )

    # Cada dominio e emitido por completo, sem apontar para o alias de outra
    # tabela: unioes identicas sao estruturalmente compativeis em TypeScript, e
    # um alias cruzado esconderia de qual coluna o tipo veio.
    emitted: set[str] = set()
    for (table, column), values in sorted(checks.items()):
        alias = domain_alias(table, column)
        if alias in emitted:
            alias = pascal(singularize(table)) + pascal(column)
        emitted.add(alias)
        out.append(f"export type {alias} = {union_of(values)}")
    out.append("")

    out.append(
        """
// ---------------------------------------------------------------------------
// Branded types — as distincoes que o compilador precisa vigiar
// ---------------------------------------------------------------------------
// ADR-007: DNP clinica, DNP de montagem e DP total sao medidas diferentes.
// Todas sao `numeric(4,1)` no banco, entao o Postgres nao impede trocar uma pela
// outra. Aqui elas sao tipos distintos: passar a DNP da receita onde se espera a
// de montagem vira erro de compilacao.

declare const brand: unique symbol
type Brand<T, B extends string> = T & { readonly [brand]: B }

/** Distancia naso-pupilar PRESCRITA (receita clinica). */
export type PrescribedDnpMm = Brand<number, 'PrescribedDnpMm'>
/** Distancia naso-pupilar AFERIDA contra a armacao escolhida (O.S.). */
export type FittingDnpMm = Brand<number, 'FittingDnpMm'>
/** DP binocular total (medida de montagem/legado). */
export type TotalDpMm = Brand<number, 'TotalDpMm'>
/** Altura de montagem por olho (obrigatoria em multifocal). */
export type FittingHeightMm = Brand<number, 'FittingHeightMm'>

export const prescribedDnp = (mm: number): PrescribedDnpMm => mm as PrescribedDnpMm
export const fittingDnp = (mm: number): FittingDnpMm => mm as FittingDnpMm
export const totalDp = (mm: number): TotalDpMm => mm as TotalDpMm
export const fittingHeight = (mm: number): FittingHeightMm => mm as FittingHeightMm

// ADR-002: o id de uma receita clinica nao e o id do snapshot usado na O.S.
export type PrescriptionId = Brand<string, 'PrescriptionId'>
export type ServiceOrderPrescriptionId = Brand<string, 'ServiceOrderPrescriptionId'>

// ---------------------------------------------------------------------------
// Aliases de leitura
// ---------------------------------------------------------------------------

export type Customer = Tables<'customers'>
export type CustomerInsert = TablesInsert<'customers'>
export type IndividualProfile = Tables<'individual_profiles'>
export type CompanyProfile = Tables<'company_profiles'>
export type CustomerRelationship = Tables<'customer_relationships'>
export type CustomerBranchProfile = Tables<'customer_branch_profiles'>

export type OpticalPrescription = Tables<'optical_prescriptions'>
export type OpticalPrescriptionMeasure = Tables<'optical_prescription_measures'>

export type Quote = Tables<'quotes'>
export type Sale = Tables<'sales'>
export type SaleItem = Tables<'sale_items'>
export type SalePayment = Tables<'sale_payments'>

export type ServiceOrder = Tables<'service_orders'>
export type ServiceOrderPrescription = Tables<'service_order_prescriptions'>
export type ServiceOrderPrescriptionMeasure = Tables<'service_order_prescription_measures'>
export type ServiceOrderFitting = Tables<'service_order_fittings'>
export type ServiceOrderFittingMeasure = Tables<'service_order_fitting_measures'>
export type ServiceOrderLensSpec = Tables<'service_order_lens_specs'>
export type LabOrder = Tables<'lab_orders'>

export type CustomerOverview = Views<'v_customer_overview'>
export type CustomerPrescriptionRow = Views<'v_customer_prescriptions'>
export type ServiceOrderProduction = Views<'v_service_order_production'>

// ---------------------------------------------------------------------------
// Guardas de dominio
// ---------------------------------------------------------------------------

/** ADR-005: estreita o cliente para o perfil correto de PF/PJ. */
export type IdentifiedCustomer<T extends 'individual' | 'company'> = Customer & {
  party_type: T
}

export const isIndividual = (c: Customer): c is IdentifiedCustomer<'individual'> =>
  c.party_type === 'individual'

export const isCompany = (c: Customer): c is IdentifiedCustomer<'company'> =>
  c.party_type === 'company'

/** ADR-009: venda anonima nunca tem cliente; venda identificada sempre tem. */
export type IdentifiedSale = Sale & { sale_type: 'identified'; customer_id: string }
export type AnonymousSale = Sale & { sale_type: 'anonymous'; customer_id: null }
export type TypedSale = IdentifiedSale | AnonymousSale

export const isIdentifiedSale = (s: Sale): s is IdentifiedSale =>
  s.sale_type === 'identified' && s.customer_id !== null

/**
 * ADR-009: so uma venda identificada pode gerar O.S., crediario ou titulo
 * financeiro. Use como porta de entrada desses fluxos.
 */
export function requireIdentifiedSale(sale: Sale): IdentifiedSale {
  if (!isIdentifiedSale(sale)) {
    throw new Error(
      `Venda ${sale.id} e avulsa (anonima): nao pode gerar O.S., crediario ou titulo.`,
    )
  }
  return sale
}
""".strip()
    )
    out.append("")
    return "\n".join(out)


# ---------------------------------------------------------------------------

def main() -> None:
    tables = collect_columns()
    if not tables:
        sys.exit(
            f"Nenhuma tabela encontrada no banco '{DB}'. "
            "Rode ./db/tools/validate.sh antes de gerar os tipos."
        )
    views = collect_view_columns()
    checks = collect_checks()
    fks = collect_foreign_keys()
    functions = collect_functions()
    comments = collect_table_comments()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "database.ts").write_text(
        emit_database(tables, views, checks, fks, functions, comments), encoding="utf-8"
    )
    (OUT_DIR / "domain.ts").write_text(emit_domain(tables, checks, comments), encoding="utf-8")

    print(f"  tabelas .......... {len(tables)}")
    print(f"  views ............ {len(views)}")
    print(f"  funcoes .......... {len(functions)}")
    print(f"  colunas .......... {sum(len(c) for c in tables.values())}")
    print(f"  dominios (CHECK) . {len(checks)}")
    print(f"  gerado em ........ {OUT_DIR.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
