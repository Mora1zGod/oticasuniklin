-- =============================================================================
-- 0002 — CATALOGOS: LISTAS CONFIGURAVEIS x ENUMS DE CODIGO
-- =============================================================================
-- Decisao ADR-010 (item 11 do briefing): nenhum enum do sistema legado foi
-- copiado. Cada lista foi classificada em 3 categorias:
--
--   (a) ENUM DE CODIGO      -> o valor muda o COMPORTAMENTO do software.
--                              Nao pode ser criado pelo usuario. Ex.: party_type,
--                              sale_status, prescription_status.
--   (b) CATALOGO GENERICO   -> lista puramente descritiva, sem comportamento.
--                              Vive em public.catalog_entries. Ex.: profissao,
--                              origem do cliente, grau de parentesco.
--   (c) TABELA DEDICADA     -> a lista carrega REGRAS/atributos proprios.
--                              Ex.: formas de pagamento, situacoes de O.S.,
--                              tabelas de preco, laboratorios.
--
-- Escopo de (b) e (c): tenant_id NULL = semente da plataforma (visivel a todos,
-- somente leitura); tenant_id preenchido = item criado pelo tenant.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- (b) Catalogo generico
-- -----------------------------------------------------------------------------
create table public.catalog_definitions (
  key               text primary key,
  label             text not null,
  description       text,
  -- 'platform'  = so a plataforma cria itens
  -- 'tenant'    = so o tenant cria itens
  -- 'both'      = plataforma semeia, tenant estende
  scope             text not null default 'both'
                    check (scope in ('platform', 'tenant', 'both')),
  allows_custom     boolean not null default true,
  created_at        timestamptz not null default now()
);

create table public.catalog_entries (
  id                uuid primary key default gen_random_uuid(),
  catalog_key       text not null references public.catalog_definitions(key),
  tenant_id         uuid references public.tenants(id) on delete cascade,
  code              text not null,
  label             text not null,
  sort_order        integer not null default 0,
  is_active         boolean not null default true,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

-- Um mesmo `code` pode existir uma vez na plataforma e uma vez por tenant
-- (o tenant sobrescreve o rotulo sem perder a referencia semantica).
create unique index catalog_entries_scope_unique
  on public.catalog_entries (
    catalog_key,
    coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    code
  );

create index catalog_entries_lookup_idx
  on public.catalog_entries (catalog_key, tenant_id)
  where is_active and deleted_at is null;

comment on table public.catalog_entries is
  'Listas descritivas sem comportamento (profissao, origem, parentesco, tipo de '
  'documento...). tenant_id NULL = semente global da plataforma.';

-- Resolve a lista efetiva de um catalogo para o tenant corrente:
-- itens do tenant sobrepoem itens de plataforma com o mesmo code.
create or replace function public.resolve_catalog(p_catalog_key text, p_tenant_id uuid)
returns table (
  id uuid, code text, label text, sort_order integer, is_platform boolean
)
language sql
stable
as $$
  select distinct on (e.code)
    e.id, e.code, e.label, e.sort_order, (e.tenant_id is null) as is_platform
  from public.catalog_entries e
  where e.catalog_key = p_catalog_key
    and (e.tenant_id = p_tenant_id or e.tenant_id is null)
    and e.is_active
    and e.deleted_at is null
  order by e.code, (e.tenant_id is null)  -- false (tenant) antes de true (plataforma)
$$;

-- -----------------------------------------------------------------------------
-- (c) Tabelas dedicadas — listas que carregam regras
-- -----------------------------------------------------------------------------

-- Formas de pagamento: carregam prazo, taxa, geracao de financeiro, parcelamento
create table public.payment_methods (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  code                  text not null,
  label                 text not null,
  -- comportamento (nao e rotulo, e regra):
  kind                  text not null
                        check (kind in ('cash','debit_card','credit_card','pix',
                                        'bank_slip','store_credit','check',
                                        'transfer','installment_plan','voucher')),
  generates_receivable  boolean not null default false,
  allows_installments   boolean not null default false,
  max_installments      integer not null default 1 check (max_installments >= 1),
  settlement_days       integer not null default 0,
  fee_percent           numeric(6,3) not null default 0,
  requires_acquirer     boolean not null default false,
  requires_customer     boolean not null default false,  -- crediario exige cliente identificado
  chart_account_id      uuid,                            -- FK adicionada em 0008
  is_active             boolean not null default true,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint payment_methods_code_unique unique (tenant_id, code)
);

-- Situacoes de O.S.: carregam maquina de estados e efeitos colaterais
create table public.service_order_statuses (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  code                  text not null,
  label                 text not null,
  -- estagio canonico do produto (o rotulo o tenant muda; o estagio, nao)
  stage                 text not null
                        check (stage in ('draft','awaiting_prescription','awaiting_lab',
                                         'in_production','received_from_lab','assembling',
                                         'quality_check','ready_for_pickup','delivered',
                                         'cancelled')),
  is_initial            boolean not null default false,
  is_final              boolean not null default false,
  blocks_delivery       boolean not null default false,
  notifies_customer     boolean not null default false,
  color_hex             text,
  sort_order            integer not null default 0,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint service_order_statuses_code_unique unique (tenant_id, code)
);

create unique index service_order_statuses_single_initial
  on public.service_order_statuses (tenant_id)
  where is_initial;

-- Transicoes permitidas (a maquina de estados e dado, nao codigo hardcoded)
create table public.service_order_status_transitions (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  from_status_id        uuid not null references public.service_order_statuses(id) on delete cascade,
  to_status_id          uuid not null references public.service_order_statuses(id) on delete cascade,
  required_permission   text,
  constraint so_status_transition_unique unique (from_status_id, to_status_id),
  constraint so_status_transition_not_self check (from_status_id <> to_status_id)
);

-- Laboratorios opticos (surfacagem/montagem)
create table public.laboratories (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  code                  text not null,
  trade_name            text not null,
  legal_name            text,
  tax_document          text,
  contact_name          text,
  phone                 text,
  email                 citext,
  default_lead_days     integer not null default 5,
  integration_kind      text not null default 'manual'
                        check (integration_kind in ('manual','email','api','edi')),
  integration_config    jsonb not null default '{}'::jsonb,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint laboratories_code_unique unique (tenant_id, code)
);

-- Prescritores (medico oftalmologista / optometrista)
create table public.prescribers (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  full_name             text not null,
  kind                  text not null default 'ophthalmologist'
                        check (kind in ('ophthalmologist','optometrist','other')),
  council_type          text check (council_type in ('CRM','CRO','CROf','OUTRO')),
  council_number        text,
  council_state         char(2),
  clinic_name           text,
  phone                 text,
  email                 citext,
  notes                 text,
  -- cadastro rapido (ADR-006): registro criado no meio da venda
  record_status         text not null default 'complete'
                        check (record_status in ('quick','complete')),
  is_active             boolean not null default true,
  created_by            uuid references public.app_users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

create unique index prescribers_council_unique
  on public.prescribers (tenant_id, council_type, council_number, council_state)
  where council_number is not null and deleted_at is null;

create index prescribers_name_idx on public.prescribers (tenant_id, full_name);

create trigger payment_methods_set_updated_at before update on public.payment_methods
  for each row execute function public.tg_set_updated_at();
create trigger service_order_statuses_set_updated_at before update on public.service_order_statuses
  for each row execute function public.tg_set_updated_at();
create trigger laboratories_set_updated_at before update on public.laboratories
  for each row execute function public.tg_set_updated_at();
create trigger prescribers_set_updated_at before update on public.prescribers
  for each row execute function public.tg_set_updated_at();
create trigger catalog_entries_set_updated_at before update on public.catalog_entries
  for each row execute function public.tg_set_updated_at();
