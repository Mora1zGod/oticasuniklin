-- =============================================================================
-- 0003 — CLIENTE: AGREGADOR NORMALIZADO, PF/PJ, RELACIONAMENTOS
-- =============================================================================
-- Itens 4, 5, 6, 7 e 9 do briefing.
--   * O cliente e ponto central de NAVEGACAO, nao uma tabela gigante (ADR-004).
--   * PF e PJ resolvidos com perfil 1:1 especializado (ADR-005).
--   * Responsavel/dependente em tabela N:N (ADR-003).
--   * Cadastro rapido usa as MESMAS tabelas e as MESMAS validacoes (ADR-006).
--   * Cliente pertence ao TENANT, com filial de origem registrada (ADR-008).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Validadores de documento — usados igualmente pelo cadastro rapido e completo
-- -----------------------------------------------------------------------------
create or replace function public.digits_only(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
$$;

create or replace function public.is_valid_cpf(p_value text)
returns boolean
language plpgsql
immutable
as $$
declare
  v text := public.digits_only(p_value);
  s integer;
  d1 integer;
  d2 integer;
  i integer;
begin
  if v = '' then
    return true;  -- ausencia e tratada por NOT NULL / regra de negocio, nao aqui
  end if;
  if length(v) <> 11 then
    return false;
  end if;
  if v ~ '^(.)\1{10}$' then
    return false;
  end if;

  s := 0;
  for i in 1..9 loop
    s := s + substr(v, i, 1)::int * (11 - i);
  end loop;
  d1 := 11 - (s % 11);
  if d1 >= 10 then d1 := 0; end if;

  s := 0;
  for i in 1..10 loop
    s := s + substr(v, i, 1)::int * (12 - i);
  end loop;
  d2 := 11 - (s % 11);
  if d2 >= 10 then d2 := 0; end if;

  return substr(v, 10, 1)::int = d1 and substr(v, 11, 1)::int = d2;
end;
$$;

create or replace function public.is_valid_cnpj(p_value text)
returns boolean
language plpgsql
immutable
as $$
declare
  v text := public.digits_only(p_value);
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s integer;
  d1 integer;
  d2 integer;
  i integer;
begin
  if v = '' then
    return true;
  end if;
  if length(v) <> 14 then
    return false;
  end if;
  if v ~ '^(.)\1{13}$' then
    return false;
  end if;

  s := 0;
  for i in 1..12 loop
    s := s + substr(v, i, 1)::int * w1[i];
  end loop;
  d1 := s % 11;
  d1 := case when d1 < 2 then 0 else 11 - d1 end;

  s := 0;
  for i in 1..13 loop
    s := s + substr(v, i, 1)::int * w2[i];
  end loop;
  d2 := s % 11;
  d2 := case when d2 < 2 then 0 else 11 - d2 end;

  return substr(v, 13, 1)::int = d1 and substr(v, 14, 1)::int = d2;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cliente (nucleo enxuto — o historico fica nas tabelas satelite)
-- -----------------------------------------------------------------------------
create table public.customers (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,

  -- enum de codigo: muda comportamento (perfil fiscal, campos obrigatorios)
  party_type            text not null check (party_type in ('individual','company')),

  code                  text,                      -- codigo legivel por humano
  display_name          text not null,             -- nome/razao social para busca e listagem
  status                text not null default 'active'
                        check (status in ('active','inactive','blocked','merged')),

  -- ADR-006: mesmo registro, mesmas regras; muda so o nivel de completude exigido
  record_status         text not null default 'quick'
                        check (record_status in ('quick','complete')),

  -- ADR-008: cliente e do TENANT; a filial e proveniencia, nao dono
  created_at_branch_id  uuid references public.branches(id),
  preferred_branch_id   uuid references public.branches(id),

  origin_entry_id       uuid references public.catalog_entries(id),  -- catalogo 'customer_origin'
  notes                 text,

  -- consolidacao de duplicados (nunca deletar historico)
  merged_into_customer_id uuid references public.customers(id),

  created_by            uuid references public.app_users(id),
  updated_by            uuid references public.app_users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,

  constraint customers_id_tenant_unique unique (id, tenant_id),
  constraint customers_merge_consistency
    check ((status = 'merged') = (merged_into_customer_id is not null)),
  constraint customers_no_self_merge
    check (merged_into_customer_id is null or merged_into_customer_id <> id)
);

create unique index customers_code_unique
  on public.customers (tenant_id, code) where code is not null and deleted_at is null;
create index customers_tenant_name_idx
  on public.customers (tenant_id, display_name) where deleted_at is null;
create index customers_created_branch_idx
  on public.customers (created_at_branch_id) where deleted_at is null;

comment on table public.customers is
  'Agregador de navegacao do cliente. Historicos ficam nas tabelas satelite '
  '(contatos, enderecos, receitas, orcamentos, vendas, O.S., financeiro).';
comment on column public.customers.created_at_branch_id is
  'Filial onde o cadastro nasceu. NAO limita a visibilidade: o cliente pertence '
  'ao tenant e e atendido em qualquer filial (ADR-008).';

-- -----------------------------------------------------------------------------
-- Perfil Pessoa Fisica (1:1 opcional)
-- -----------------------------------------------------------------------------
create table public.individual_profiles (
  customer_id           uuid primary key references public.customers(id) on delete cascade,
  tenant_id             uuid not null,
  cpf                   text,
  national_id           text,                      -- RG
  national_id_issuer    text,
  birth_date            date,
  gender                text check (gender in ('female','male','other','undisclosed')),
  marital_status_entry_id uuid references public.catalog_entries(id),  -- catalogo 'marital_status'
  profession_entry_id   uuid references public.catalog_entries(id),    -- catalogo 'profession'
  mother_name           text,
  father_name           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint individual_profiles_customer_fk
    foreign key (customer_id, tenant_id) references public.customers(id, tenant_id) on delete cascade,
  constraint individual_profiles_cpf_valid check (public.is_valid_cpf(cpf)),
  constraint individual_profiles_birth_sane
    check (birth_date is null or (birth_date > date '1900-01-01' and birth_date <= current_date))
);

-- ADR-008: CPF unico POR TENANT (nao por filial) — evita cliente duplicado na rede
create unique index individual_profiles_cpf_unique
  on public.individual_profiles (tenant_id, public.digits_only(cpf))
  where cpf is not null and public.digits_only(cpf) <> '';

-- -----------------------------------------------------------------------------
-- Perfil Pessoa Juridica (1:1 opcional)
-- -----------------------------------------------------------------------------
create table public.company_profiles (
  customer_id           uuid primary key references public.customers(id) on delete cascade,
  tenant_id             uuid not null,
  cnpj                  text,
  legal_name            text,
  trade_name            text,
  state_registration    text,
  state_registration_exempt boolean not null default false,
  municipal_registration text,
  tax_regime            text check (tax_regime in ('simples_nacional','lucro_presumido',
                                                   'lucro_real','mei','imune','isento')),
  icms_taxpayer         boolean not null default false,
  suframa_code          text,
  founded_on            date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint company_profiles_customer_fk
    foreign key (customer_id, tenant_id) references public.customers(id, tenant_id) on delete cascade,
  constraint company_profiles_cnpj_valid check (public.is_valid_cnpj(cnpj)),
  constraint company_profiles_ie_consistency
    check (not (state_registration_exempt and state_registration is not null))
);

create unique index company_profiles_cnpj_unique
  on public.company_profiles (tenant_id, public.digits_only(cnpj))
  where cnpj is not null and public.digits_only(cnpj) <> '';

-- Garante que o perfil corresponde ao party_type do cliente
create or replace function public.tg_customer_profile_matches_type()
returns trigger
language plpgsql
as $$
declare
  v_type text;
  v_expected text := case tg_table_name
                       when 'individual_profiles' then 'individual'
                       when 'company_profiles' then 'company'
                     end;
begin
  select party_type into v_type from public.customers where id = new.customer_id;
  if v_type is distinct from v_expected then
    raise exception 'Perfil % incompativel com party_type=% do cliente %',
      tg_table_name, v_type, new.customer_id;
  end if;
  return new;
end;
$$;

create trigger individual_profiles_type_guard
  before insert or update on public.individual_profiles
  for each row execute function public.tg_customer_profile_matches_type();
create trigger company_profiles_type_guard
  before insert or update on public.company_profiles
  for each row execute function public.tg_customer_profile_matches_type();

-- -----------------------------------------------------------------------------
-- Contatos e enderecos (normalizados — item 4)
-- -----------------------------------------------------------------------------
create table public.customer_contacts (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references public.customers(id) on delete cascade,
  tenant_id             uuid not null,
  kind                  text not null
                        check (kind in ('mobile','landline','whatsapp','email','instagram','other')),
  value                 text not null,
  label                 text,
  is_primary            boolean not null default false,
  accepts_marketing     boolean not null default false,
  verified_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  constraint customer_contacts_customer_fk
    foreign key (customer_id, tenant_id) references public.customers(id, tenant_id) on delete cascade
);

create unique index customer_contacts_primary_unique
  on public.customer_contacts (customer_id, kind) where is_primary and deleted_at is null;
create index customer_contacts_value_idx on public.customer_contacts (tenant_id, value);

create table public.customer_addresses (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references public.customers(id) on delete cascade,
  tenant_id             uuid not null,
  kind                  text not null default 'residential'
                        check (kind in ('residential','commercial','billing','delivery','other')),
  zip_code              text,
  street                text,
  street_number         text,
  complement            text,
  district              text,
  city                  text,
  state_code            char(2),
  country_code          char(2) not null default 'BR',
  is_primary            boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  constraint customer_addresses_customer_fk
    foreign key (customer_id, tenant_id) references public.customers(id, tenant_id) on delete cascade
);

create unique index customer_addresses_primary_unique
  on public.customer_addresses (customer_id) where is_primary and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Relacionamentos cliente <-> cliente (item 5 / ADR-003)
-- -----------------------------------------------------------------------------
create table public.customer_relationships (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  customer_id             uuid not null,          -- o dependente / parte A
  related_customer_id     uuid not null,          -- o responsavel / parte B
  relationship_entry_id   uuid not null references public.catalog_entries(id), -- 'relationship_type'
  is_financial_responsible boolean not null default false,
  is_legal_guardian       boolean not null default false,
  is_pickup_authorized    boolean not null default false,
  valid_from              date not null default current_date,
  valid_to                date,
  notes                   text,
  created_by              uuid references public.app_users(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint customer_relationships_a_fk
    foreign key (customer_id, tenant_id) references public.customers(id, tenant_id) on delete cascade,
  constraint customer_relationships_b_fk
    foreign key (related_customer_id, tenant_id) references public.customers(id, tenant_id) on delete cascade,
  constraint customer_relationships_distinct check (customer_id <> related_customer_id),
  constraint customer_relationships_period check (valid_to is null or valid_to >= valid_from)
);

create unique index customer_relationships_unique
  on public.customer_relationships (customer_id, related_customer_id, relationship_entry_id)
  where valid_to is null;
create index customer_relationships_related_idx
  on public.customer_relationships (related_customer_id);

comment on table public.customer_relationships is
  'Vinculo cliente->cliente (filho, responsavel, conjuge...). Substitui o campo '
  'unico responsible_customer_id: um cliente pode ter varios responsaveis e um '
  'responsavel pode responder por varios dependentes (ADR-003). NAO existe '
  'entidade Familia.';

-- -----------------------------------------------------------------------------
-- Perfil do cliente POR FILIAL (item 9) — preferencias, nao propriedade
-- -----------------------------------------------------------------------------
create table public.customer_branch_profiles (
  id                        uuid primary key default gen_random_uuid(),
  customer_id               uuid not null,
  tenant_id                 uuid not null,
  branch_id                 uuid not null references public.branches(id) on delete cascade,
  preferred_salesperson_id  uuid references public.app_users(id),
  price_table_id            uuid,                  -- FK adicionada em 0005
  agreement_entry_id        uuid references public.catalog_entries(id),  -- 'customer_agreement'
  first_interaction_at      timestamptz,
  last_interaction_at       timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint customer_branch_profiles_customer_fk
    foreign key (customer_id, tenant_id) references public.customers(id, tenant_id) on delete cascade,
  constraint customer_branch_profiles_unique unique (customer_id, branch_id)
);

comment on table public.customer_branch_profiles is
  'Vendedor preferencial, tabela de preco e convenio POR FILIAL. Permite que a '
  'rede veja o mesmo cliente em varias unidades sem duplica-lo (ADR-008).';

-- -----------------------------------------------------------------------------
-- Anexos, comunicacoes, consentimento LGPD e auditoria (item 4)
-- -----------------------------------------------------------------------------
create table public.customer_attachments (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null,
  tenant_id             uuid not null,
  kind                  text not null default 'other'
                        check (kind in ('prescription','document','photo','contract','other')),
  storage_path          text not null,             -- Supabase Storage
  file_name             text not null,
  mime_type             text,
  byte_size             bigint,
  uploaded_by           uuid references public.app_users(id),
  created_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  constraint customer_attachments_customer_fk
    foreign key (customer_id, tenant_id) references public.customers(id, tenant_id) on delete cascade
);

create table public.customer_communications (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null,
  tenant_id             uuid not null,
  branch_id             uuid references public.branches(id),
  channel               text not null
                        check (channel in ('whatsapp','sms','email','phone','in_person','system')),
  direction             text not null check (direction in ('inbound','outbound')),
  subject               text,
  body                  text,
  -- origem do disparo (ex.: O.S. pronta) sem acoplar a tabela de O.S.
  related_entity        text,
  related_entity_id     uuid,
  occurred_at           timestamptz not null default now(),
  created_by            uuid references public.app_users(id),
  created_at            timestamptz not null default now(),
  constraint customer_communications_customer_fk
    foreign key (customer_id, tenant_id) references public.customers(id, tenant_id) on delete cascade
);

create index customer_communications_customer_idx
  on public.customer_communications (customer_id, occurred_at desc);

create table public.customer_consents (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null,
  tenant_id             uuid not null,
  purpose               text not null
                        check (purpose in ('data_processing','marketing','health_data',
                                           'image_use','third_party_sharing')),
  granted               boolean not null,
  granted_at            timestamptz not null default now(),
  revoked_at            timestamptz,
  source                text,
  evidence_path         text,
  constraint customer_consents_customer_fk
    foreign key (customer_id, tenant_id) references public.customers(id, tenant_id) on delete cascade
);

create index customer_consents_customer_idx on public.customer_consents (customer_id, purpose);

create table public.customer_audit_events (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null,
  tenant_id             uuid not null,
  event_type            text not null,
  entity_name           text,
  entity_id             uuid,
  before_data           jsonb,
  after_data            jsonb,
  performed_by          uuid references public.app_users(id),
  performed_at          timestamptz not null default now(),
  constraint customer_audit_events_customer_fk
    foreign key (customer_id, tenant_id) references public.customers(id, tenant_id) on delete cascade
);

create index customer_audit_events_customer_idx
  on public.customer_audit_events (customer_id, performed_at desc);

-- -----------------------------------------------------------------------------
-- Cadastro rapido x completo: MESMAS regras, exigencias por contexto (ADR-006)
-- -----------------------------------------------------------------------------
create or replace function public.customer_missing_fields(
  p_customer_id uuid,
  p_requirement text default 'complete'
)
returns text[]
language plpgsql
stable
as $$
declare
  c            public.customers%rowtype;
  ind          public.individual_profiles%rowtype;
  comp         public.company_profiles%rowtype;
  missing      text[] := '{}';
  has_contact  boolean;
  has_address  boolean;
begin
  select * into c from public.customers where id = p_customer_id;
  if not found then
    raise exception 'Cliente % nao encontrado', p_customer_id;
  end if;

  select exists (
    select 1 from public.customer_contacts
    where customer_id = p_customer_id and deleted_at is null
  ) into has_contact;

  select exists (
    select 1 from public.customer_addresses
    where customer_id = p_customer_id and deleted_at is null
  ) into has_address;

  -- Nivel 'quick': o minimo para nao criar lixo no banco
  if coalesce(trim(c.display_name), '') = '' then
    missing := missing || 'display_name';
  end if;
  if not has_contact then
    missing := missing || 'contact';
  end if;

  if p_requirement = 'quick' then
    return missing;
  end if;

  -- Nivel 'complete' / 'fiscal' / 'credit'
  if c.party_type = 'individual' then
    select * into ind from public.individual_profiles where customer_id = p_customer_id;
    if not found or coalesce(public.digits_only(ind.cpf), '') = '' then
      missing := missing || 'cpf';
    end if;
    if found and ind.birth_date is null then
      missing := missing || 'birth_date';
    end if;
  else
    select * into comp from public.company_profiles where customer_id = p_customer_id;
    if not found or coalesce(public.digits_only(comp.cnpj), '') = '' then
      missing := missing || 'cnpj';
    end if;
    if found and coalesce(trim(comp.legal_name), '') = '' then
      missing := missing || 'legal_name';
    end if;
    if found and not comp.state_registration_exempt
       and coalesce(trim(comp.state_registration), '') = '' then
      missing := missing || 'state_registration';
    end if;
  end if;

  if not has_address then
    missing := missing || 'address';
  end if;

  if p_requirement = 'credit' then
    if not exists (
      select 1 from public.customer_consents
      where customer_id = p_customer_id and purpose = 'data_processing'
        and granted and revoked_at is null
    ) then
      missing := missing || 'consent_data_processing';
    end if;
  end if;

  return missing;
end;
$$;

comment on function public.customer_missing_fields(uuid, text) is
  'Fonte unica de verdade das exigencias de cadastro. Cadastro rapido e cadastro '
  'completo chamam a MESMA funcao, mudando apenas o nivel exigido (ADR-006).';

create or replace function public.tg_customer_promotion_guard()
returns trigger
language plpgsql
as $$
declare
  gaps text[];
begin
  if new.record_status = 'complete'
     and (tg_op = 'INSERT' or old.record_status is distinct from 'complete') then
    gaps := public.customer_missing_fields(new.id, 'complete');
    if array_length(gaps, 1) > 0 then
      raise exception 'Cadastro incompleto: faltam %', array_to_string(gaps, ', ')
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create constraint trigger customers_promotion_guard
  after insert or update of record_status on public.customers
  deferrable initially deferred
  for each row execute function public.tg_customer_promotion_guard();

-- -----------------------------------------------------------------------------
-- Visao de navegacao (a TELA agrega; o BANCO permanece normalizado — item 4)
-- -----------------------------------------------------------------------------
create or replace view public.v_customer_overview as
select
  c.id,
  c.tenant_id,
  c.party_type,
  c.display_name,
  c.status,
  c.record_status,
  c.created_at_branch_id,
  bo.trade_name                                as created_at_branch_name,
  coalesce(ind.cpf, comp.cnpj)                 as tax_document,
  ind.birth_date,
  (select cc.value from public.customer_contacts cc
    where cc.customer_id = c.id and cc.kind in ('mobile','whatsapp')
      and cc.deleted_at is null
    order by cc.is_primary desc, cc.created_at limit 1) as primary_phone,
  (select cc.value from public.customer_contacts cc
    where cc.customer_id = c.id and cc.kind = 'email' and cc.deleted_at is null
    order by cc.is_primary desc, cc.created_at limit 1) as primary_email,
  public.customer_missing_fields(c.id, 'complete') as pending_fields
from public.customers c
left join public.individual_profiles ind on ind.customer_id = c.id
left join public.company_profiles comp on comp.customer_id = c.id
left join public.branches bo on bo.id = c.created_at_branch_id
where c.deleted_at is null;

create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.tg_set_updated_at();
create trigger individual_profiles_set_updated_at before update on public.individual_profiles
  for each row execute function public.tg_set_updated_at();
create trigger company_profiles_set_updated_at before update on public.company_profiles
  for each row execute function public.tg_set_updated_at();
create trigger customer_contacts_set_updated_at before update on public.customer_contacts
  for each row execute function public.tg_set_updated_at();
create trigger customer_addresses_set_updated_at before update on public.customer_addresses
  for each row execute function public.tg_set_updated_at();
create trigger customer_relationships_set_updated_at before update on public.customer_relationships
  for each row execute function public.tg_set_updated_at();
create trigger customer_branch_profiles_set_updated_at before update on public.customer_branch_profiles
  for each row execute function public.tg_set_updated_at();
