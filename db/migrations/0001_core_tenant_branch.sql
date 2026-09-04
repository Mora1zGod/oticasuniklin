-- =============================================================================
-- 0001 — NUCLEO: TENANT, FILIAIS, USUARIOS E HELPERS DE RLS
-- =============================================================================
-- Decisao ADR-008: o TENANT (rede/empresa contratante do SaaS) e a fronteira de
-- isolamento. A FILIAL e uma dimensao operacional DENTRO do tenant, nunca uma
-- fronteira de dados de cadastro.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists btree_gist;

-- -----------------------------------------------------------------------------
-- Tenant
-- -----------------------------------------------------------------------------
create table public.tenants (
  id                uuid primary key default gen_random_uuid(),
  slug              citext not null unique,
  legal_name        text not null,
  trade_name        text not null,
  tax_document      text,                       -- CNPJ da matriz
  plan_code         text not null default 'starter',
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

comment on table public.tenants is
  'Empresa contratante do SaaS. Fronteira de isolamento de dados (RLS).';

-- -----------------------------------------------------------------------------
-- Filiais (unidades/lojas do tenant)
-- -----------------------------------------------------------------------------
create table public.branches (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  code              text not null,
  legal_name        text not null,
  trade_name        text not null,
  tax_document      text,                       -- CNPJ proprio da filial
  state_registration text,
  phone             text,
  email             citext,
  zip_code          text,
  street            text,
  street_number     text,
  complement        text,
  district          text,
  city              text,
  state_code        char(2),
  timezone          text not null default 'America/Rio_Branco',
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint branches_code_unique unique (tenant_id, code)
);

create index branches_tenant_idx on public.branches (tenant_id) where deleted_at is null;

comment on table public.branches is
  'Unidade operacional do tenant. NAO e fronteira de cadastro de cliente (ADR-008).';

-- -----------------------------------------------------------------------------
-- Usuarios da aplicacao (espelho de auth.users com vinculo de tenant)
-- -----------------------------------------------------------------------------
create table public.app_users (
  id                uuid primary key default gen_random_uuid(),
  auth_user_id      uuid unique references auth.users(id) on delete set null,
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  full_name         text not null,
  email             citext not null,
  phone             text,
  is_active         boolean not null default true,
  is_tenant_admin   boolean not null default false,
  -- Vendedor: usuario que pode ser atribuido em venda/comissao
  is_salesperson    boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint app_users_email_unique unique (tenant_id, email)
);

create index app_users_tenant_idx on public.app_users (tenant_id) where deleted_at is null;
create index app_users_auth_idx on public.app_users (auth_user_id);

-- -----------------------------------------------------------------------------
-- Papeis e acesso por filial
-- -----------------------------------------------------------------------------
create table public.roles (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid references public.tenants(id) on delete cascade,  -- NULL = papel de plataforma
  code              text not null,
  label             text not null,
  is_system         boolean not null default false,
  created_at        timestamptz not null default now()
);

create unique index roles_scope_code_unique
  on public.roles (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

create table public.role_permissions (
  role_id           uuid not null references public.roles(id) on delete cascade,
  permission_code   text not null,
  primary key (role_id, permission_code)
);

create table public.user_branch_access (
  id                uuid primary key default gen_random_uuid(),
  app_user_id       uuid not null references public.app_users(id) on delete cascade,
  branch_id         uuid not null references public.branches(id) on delete cascade,
  role_id           uuid not null references public.roles(id),
  is_default_branch boolean not null default false,
  created_at        timestamptz not null default now(),
  constraint user_branch_access_unique unique (app_user_id, branch_id)
);

create index user_branch_access_branch_idx on public.user_branch_access (branch_id);

comment on table public.user_branch_access is
  'Define em quais filiais o usuario opera. O cliente e do tenant, mas a '
  'visibilidade operacional pode ser restringida por filial via politicas.';

-- -----------------------------------------------------------------------------
-- Helpers de RLS
-- -----------------------------------------------------------------------------
-- Equivalente generalizado ao padrao public.get_loja_id() usado nos demais
-- projetos, separando TENANT (isolamento) de FILIAL (escopo operacional).

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id
  from public.app_users u
  where u.auth_user_id = auth.uid()
    and u.is_active
    and u.deleted_at is null
  limit 1;
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.tenant_id
  from public.app_users u
  where u.auth_user_id = auth.uid()
    and u.is_active
    and u.deleted_at is null
  limit 1;
$$;

create or replace function public.current_branch_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(array_agg(a.branch_id), '{}'::uuid[])
  from public.user_branch_access a
  join public.app_users u on u.id = a.app_user_id
  where u.auth_user_id = auth.uid()
    and u.is_active
    and u.deleted_at is null;
$$;

create or replace function public.user_can_access_branch(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.user_branch_access a
    join public.app_users u on u.id = a.app_user_id
    where u.auth_user_id = auth.uid()
      and u.is_active
      and u.deleted_at is null
      and a.branch_id = p_branch_id
  ) or exists (
    select 1
    from public.app_users u
    join public.branches b on b.tenant_id = u.tenant_id
    where u.auth_user_id = auth.uid()
      and u.is_tenant_admin
      and u.is_active
      and u.deleted_at is null
      and b.id = p_branch_id
  );
$$;

create or replace function public.has_permission(p_permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.app_users u
    where u.auth_user_id = auth.uid() and u.is_tenant_admin and u.is_active
  ) or exists (
    select 1
    from public.user_branch_access a
    join public.app_users u on u.id = a.app_user_id
    join public.role_permissions rp on rp.role_id = a.role_id
    where u.auth_user_id = auth.uid()
      and u.is_active
      and rp.permission_code = p_permission_code
  );
$$;

-- -----------------------------------------------------------------------------
-- updated_at automatico
-- -----------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tenants_set_updated_at before update on public.tenants
  for each row execute function public.tg_set_updated_at();
create trigger branches_set_updated_at before update on public.branches
  for each row execute function public.tg_set_updated_at();
create trigger app_users_set_updated_at before update on public.app_users
  for each row execute function public.tg_set_updated_at();
