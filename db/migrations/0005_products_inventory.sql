-- =============================================================================
-- 0005 — PRODUTOS, CATALOGO OPTICO, PRECOS E ESTOQUE
-- =============================================================================
-- Este e o dominio COMERCIAL/TECNICO. Nada aqui pertence a receita clinica
-- (ADR-001). O catalogo descreve o que a otica VENDE; a receita descreve o que
-- o paciente PRECISA.
-- =============================================================================

create table public.product_categories (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  parent_id         uuid references public.product_categories(id),
  code              text not null,
  label             text not null,
  sort_order        integer not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint product_categories_code_unique unique (tenant_id, code)
);

create table public.brands (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  name              text not null,
  manufacturer_name text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint brands_name_unique unique (tenant_id, name)
);

create table public.suppliers (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  trade_name        text not null,
  legal_name        text,
  tax_document      text,
  phone             text,
  email             citext,
  contact_name      text,
  -- ADR-006: fornecedor tambem tem cadastro rapido, nas MESMAS tabelas
  record_status     text not null default 'complete'
                    check (record_status in ('quick','complete')),
  is_active         boolean not null default true,
  created_by        uuid references public.app_users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint suppliers_document_valid check (public.is_valid_cnpj(tax_document))
);

create unique index suppliers_document_unique
  on public.suppliers (tenant_id, public.digits_only(tax_document))
  where tax_document is not null and public.digits_only(tax_document) <> ''
    and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Produto (raiz) — enum de codigo em product_kind porque muda comportamento
-- -----------------------------------------------------------------------------
create table public.products (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  sku               text,
  gtin              text,
  name              text not null,
  product_kind      text not null
                    check (product_kind in ('frame','sunglass','lens','contact_lens',
                                            'accessory','service','lens_treatment')),
  category_id       uuid references public.product_categories(id),
  brand_id          uuid references public.brands(id),
  supplier_id       uuid references public.suppliers(id),
  unit              text not null default 'UN',
  tracks_stock      boolean not null default true,
  -- lente surfacada nao tem estoque proprio: e produzida por laboratorio
  is_made_to_order  boolean not null default false,
  cost_price        numeric(12,2) check (cost_price is null or cost_price >= 0),
  list_price        numeric(12,2) check (list_price is null or list_price >= 0),
  ncm_code          text,
  cest_code         text,
  record_status     text not null default 'complete'
                    check (record_status in ('quick','complete')),
  is_active         boolean not null default true,
  created_by        uuid references public.app_users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint products_id_tenant_unique unique (id, tenant_id),
  constraint products_stock_consistency
    check (not (is_made_to_order and tracks_stock))
);

create unique index products_sku_unique
  on public.products (tenant_id, sku) where sku is not null and deleted_at is null;
create index products_kind_idx on public.products (tenant_id, product_kind) where deleted_at is null;
create index products_name_idx on public.products (tenant_id, name);

-- Atributos especificos de armacao
create table public.frame_attributes (
  product_id        uuid primary key references public.products(id) on delete cascade,
  material          text,                          -- acetato, metal, TR90...
  color             text,
  shape             text,
  gender_target     text check (gender_target in ('female','male','unisex','kids')),
  lens_width_mm     numeric(4,1),                  -- aro (horizontal box)
  bridge_mm         numeric(4,1),                  -- ponte
  temple_mm         numeric(4,1),                  -- haste
  vertical_box_mm   numeric(4,1),
  diagonal_mm       numeric(4,1),
  rim_type          text check (rim_type in ('full_rim','semi_rimless','rimless')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.frame_attributes is
  'Medidas da armacao. Combinadas com as medidas de montagem da O.S. definem '
  'diametro e descentracao da lente — nada disso pertence a receita.';

-- -----------------------------------------------------------------------------
-- Catalogo optico de lentes
-- -----------------------------------------------------------------------------
create table public.lens_types (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid references public.tenants(id) on delete cascade, -- NULL = plataforma
  code              text not null,
  label             text not null,
  -- estagio canonico: dirige regras (ex.: exige adicao, exige altura de montagem)
  vision_design     text not null
                    check (vision_design in ('single_vision','bifocal','trifocal',
                                             'progressive','occupational','contact')),
  requires_addition boolean not null default false,
  requires_fitting_height boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create unique index lens_types_scope_code_unique
  on public.lens_types (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

create table public.lens_materials (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid references public.tenants(id) on delete cascade,
  code              text not null,
  label             text not null,
  default_refractive_index numeric(4,3),
  abbe_number       numeric(4,1),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create unique index lens_materials_scope_code_unique
  on public.lens_materials (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

create table public.lens_treatments (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid references public.tenants(id) on delete cascade,
  code              text not null,
  label             text not null,
  treatment_group   text not null default 'coating'
                    check (treatment_group in ('coating','tint','photochromic','polarized',
                                               'filter','hardening','other')),
  is_billable       boolean not null default true,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create unique index lens_treatments_scope_code_unique
  on public.lens_treatments (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

-- Atributos de um produto-lente do catalogo (o que a otica pode vender)
create table public.lens_attributes (
  product_id            uuid primary key references public.products(id) on delete cascade,
  lens_type_id          uuid not null references public.lens_types(id),
  lens_material_id      uuid not null references public.lens_materials(id),
  refractive_index      numeric(4,3) not null check (refractive_index between 1.400 and 2.200),
  design                text not null default 'spherical'
                        check (design in ('spherical','aspheric','bi_aspheric','freeform','digital')),
  manufacturer_name     text,
  product_line          text,
  supply_mode           text not null default 'surfaced'
                        check (supply_mode in ('stock','surfaced')),
  diameter_mm           numeric(4,1),
  base_curve            numeric(4,2),
  sphere_min_dpt        numeric(5,2),
  sphere_max_dpt        numeric(5,2),
  cylinder_min_dpt      numeric(5,2),
  cylinder_max_dpt      numeric(5,2),
  addition_min_dpt      numeric(4,2),
  addition_max_dpt      numeric(4,2),
  default_laboratory_id uuid references public.laboratories(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint lens_attributes_sphere_range
    check (sphere_min_dpt is null or sphere_max_dpt is null or sphere_min_dpt <= sphere_max_dpt),
  constraint lens_attributes_addition_range
    check (addition_min_dpt is null or addition_max_dpt is null
           or addition_min_dpt <= addition_max_dpt)
);

-- Tratamentos disponiveis para um produto-lente (o que PODE ser combinado)
create table public.lens_product_treatments (
  product_id        uuid not null references public.products(id) on delete cascade,
  treatment_id      uuid not null references public.lens_treatments(id) on delete cascade,
  extra_price       numeric(12,2) not null default 0,
  primary key (product_id, treatment_id)
);

-- -----------------------------------------------------------------------------
-- Tabelas de preco (por tenant, opcionalmente restritas a filiais)
-- -----------------------------------------------------------------------------
create table public.price_tables (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  code              text not null,
  label             text not null,
  is_default        boolean not null default false,
  valid_from        date,
  valid_to          date,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint price_tables_code_unique unique (tenant_id, code),
  constraint price_tables_period check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create unique index price_tables_single_default
  on public.price_tables (tenant_id) where is_default and is_active;

create table public.price_table_branches (
  price_table_id    uuid not null references public.price_tables(id) on delete cascade,
  branch_id         uuid not null references public.branches(id) on delete cascade,
  primary key (price_table_id, branch_id)
);

create table public.price_table_items (
  id                uuid primary key default gen_random_uuid(),
  price_table_id    uuid not null references public.price_tables(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete cascade,
  price             numeric(12,2) not null check (price >= 0),
  max_discount_percent numeric(5,2) not null default 0
                    check (max_discount_percent between 0 and 100),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint price_table_items_unique unique (price_table_id, product_id)
);

alter table public.customer_branch_profiles
  add constraint customer_branch_profiles_price_table_fk
  foreign key (price_table_id) references public.price_tables(id);

-- -----------------------------------------------------------------------------
-- Estoque por filial + reserva (item 12: "armacao reservada/baixada")
-- -----------------------------------------------------------------------------
create table public.stock_balances (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  branch_id         uuid not null references public.branches(id) on delete cascade,
  product_id        uuid not null,
  quantity          numeric(14,3) not null default 0,
  reserved_quantity numeric(14,3) not null default 0,
  updated_at        timestamptz not null default now(),
  constraint stock_balances_product_fk
    foreign key (product_id, tenant_id) references public.products(id, tenant_id) on delete cascade,
  constraint stock_balances_unique unique (branch_id, product_id),
  constraint stock_balances_non_negative check (quantity >= 0 and reserved_quantity >= 0),
  constraint stock_balances_reserve_limit check (reserved_quantity <= quantity)
);

create table public.stock_movements (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  branch_id         uuid not null references public.branches(id) on delete cascade,
  product_id        uuid not null,
  movement_kind     text not null
                    check (movement_kind in ('purchase_in','sale_out','reserve','release_reserve',
                                             'transfer_in','transfer_out','adjustment',
                                             'return_in','loss','lab_out','lab_in')),
  quantity          numeric(14,3) not null check (quantity > 0),
  direction         smallint not null check (direction in (-1, 0, 1)),
  unit_cost         numeric(12,2),
  -- origem do movimento sem acoplamento rigido entre modulos
  related_entity    text,
  related_entity_id uuid,
  notes             text,
  performed_by      uuid references public.app_users(id),
  occurred_at       timestamptz not null default now(),
  constraint stock_movements_product_fk
    foreign key (product_id, tenant_id) references public.products(id, tenant_id) on delete cascade
);

create index stock_movements_product_idx
  on public.stock_movements (branch_id, product_id, occurred_at desc);
create index stock_movements_related_idx
  on public.stock_movements (related_entity, related_entity_id);

create trigger product_categories_set_updated_at before update on public.product_categories
  for each row execute function public.tg_set_updated_at();
create trigger brands_set_updated_at before update on public.brands
  for each row execute function public.tg_set_updated_at();
create trigger suppliers_set_updated_at before update on public.suppliers
  for each row execute function public.tg_set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function public.tg_set_updated_at();
create trigger frame_attributes_set_updated_at before update on public.frame_attributes
  for each row execute function public.tg_set_updated_at();
create trigger lens_attributes_set_updated_at before update on public.lens_attributes
  for each row execute function public.tg_set_updated_at();
create trigger price_tables_set_updated_at before update on public.price_tables
  for each row execute function public.tg_set_updated_at();
create trigger price_table_items_set_updated_at before update on public.price_table_items
  for each row execute function public.tg_set_updated_at();
