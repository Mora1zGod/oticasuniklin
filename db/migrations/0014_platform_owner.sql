-- =============================================================================
-- 0014 — PLATAFORMA: A ÓTICA QUE ATENDE AS OUTRAS
-- =============================================================================
-- Até aqui todo tenant era igual: uma ótica, isolada das demais. Agora existe
-- UMA ótica diferente — a dona da plataforma (a Uniklin) — que cadastra as
-- lojas clientes, entra nelas para dar suporte e cobra pela assinatura.
--
-- A distinção que isto preserva: "ser cliente da plataforma" não é um nível de
-- permissão dentro da ótica; é uma relação ENTRE óticas. Por isso não virou uma
-- permissão nova no papel do usuário, e sim uma marca no tenant e um vínculo de
-- acesso explícito.
--
-- O isolamento continua sendo o mesmo de sempre: um usuário só enxerga a ótica
-- em que ele tem cadastro. A dona da plataforma enxerga as clientes porque
-- ganha cadastro nelas quando as cria — não porque a RLS abriu uma exceção.
-- Nenhuma loja cliente enxerga outra, nem a dona.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Quem é a dona da plataforma
-- -----------------------------------------------------------------------------
alter table public.tenants
  add column if not exists is_platform_owner boolean not null default false;

comment on column public.tenants.is_platform_owner is
  'Otica que opera a plataforma: cadastra as lojas clientes, entra nelas para '
  'suporte e emite as cobrancas. Apenas uma por instalacao.';

-- Duas donas seria uma instalação sem dono.
create unique index if not exists tenants_single_platform_owner
  on public.tenants ((true)) where is_platform_owner;

-- A ótica cliente sabe quem a criou: é o que liga a cobrança ao contrato.
alter table public.tenants
  add column if not exists provider_tenant_id uuid references public.tenants(id);

comment on column public.tenants.provider_tenant_id is
  'Otica dona da plataforma que cadastrou esta loja. Nulo na propria dona.';

-- -----------------------------------------------------------------------------
-- 2. Um login pode pertencer a mais de uma ótica
-- -----------------------------------------------------------------------------
-- Esta é a mudança de fundo. Antes `auth_user_id` era único: um e-mail, uma
-- ótica. A dona da plataforma precisa existir dentro das lojas que atende, sem
-- ter um e-mail diferente para cada uma.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'app_users_auth_user_id_key'
      and conrelid = 'public.app_users'::regclass
  ) then
    alter table public.app_users drop constraint app_users_auth_user_id_key;
  end if;
end;
$$;

create unique index if not exists app_users_auth_tenant_unique
  on public.app_users (auth_user_id, tenant_id) where auth_user_id is not null;

-- -----------------------------------------------------------------------------
-- 3. Qual ótica está aberta agora
-- -----------------------------------------------------------------------------
-- Com mais de uma ótica por login, "o tenant do usuário" deixou de ser único.
-- Quem decide é o ENDEREÇO: cada ótica tem o seu (uniklin.com/nomedaotica), e o
-- app manda esse identificador no cabeçalho `x-tenant-slug`.
--
-- O cabeçalho escolhe, mas não autoriza: a função só aceita a ótica em que o
-- usuário realmente tem cadastro ativo. Cabeçalho forjado não abre porta
-- nenhuma — cai no acesso que a pessoa já tinha.
create or replace function public.requested_tenant_slug()
returns text
language sql
stable
as $$
  select nullif(
    current_setting('request.headers', true)::json ->> 'x-tenant-slug',
    ''
  );
$$;

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id
  from public.app_users u
  left join public.tenants t on t.id = u.tenant_id
  where u.auth_user_id = auth.uid()
    and u.is_active
    and u.deleted_at is null
  -- A ótica pedida vem primeiro; sem pedido válido, a própria do usuário.
  order by (t.slug::text is not distinct from public.requested_tenant_slug()) desc,
           u.created_at
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
  left join public.tenants t on t.id = u.tenant_id
  where u.auth_user_id = auth.uid()
    and u.is_active
    and u.deleted_at is null
  order by (t.slug::text is not distinct from public.requested_tenant_slug()) desc,
           u.created_at
  limit 1;
$$;

/** Esta sessão está numa ótica que opera a plataforma? */
create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select t.is_platform_owner
       from public.tenants t
      where t.id = public.current_tenant_id()),
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- 4. As óticas que este login alcança
-- -----------------------------------------------------------------------------
-- O seletor de ótica do app lê daqui. Devolve só o que a pessoa já podia
-- acessar, então não vaza nada de ninguém.
create or replace function public.my_tenants()
returns table (
  tenant_id uuid,
  slug text,
  trade_name text,
  is_platform_owner boolean,
  is_tenant_admin boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select t.id, t.slug::text, t.trade_name, t.is_platform_owner, u.is_tenant_admin
  from public.app_users u
  join public.tenants t on t.id = u.tenant_id
  where u.auth_user_id = auth.uid()
    and u.is_active and u.deleted_at is null
    and t.deleted_at is null
  order by t.is_platform_owner desc, t.trade_name;
$$;

-- -----------------------------------------------------------------------------
-- 5. A dona enxerga as lojas que atende
-- -----------------------------------------------------------------------------
-- Só o cadastro da loja — nome, endereço, situação. Nada de cliente, venda,
-- receita ou financeiro das lojas: para isso a dona entra na loja, e lá vale a
-- RLS normal.
-- Reaplicável: rodar esta migration duas vezes não pode falhar.
drop policy if exists tenants_platform_owner_read on public.tenants;
create policy tenants_platform_owner_read on public.tenants
  for select
  using (
    public.is_platform_owner()
    and (provider_tenant_id = public.current_tenant_id() or is_platform_owner)
  );

drop policy if exists tenants_platform_owner_update on public.tenants;
create policy tenants_platform_owner_update on public.tenants
  for update
  using (public.is_platform_owner() and provider_tenant_id = public.current_tenant_id())
  with check (public.is_platform_owner() and provider_tenant_id = public.current_tenant_id());

-- -----------------------------------------------------------------------------
-- 6. Cadastrar uma loja cliente
-- -----------------------------------------------------------------------------
-- Cria a ótica, a filial matriz, os papéis padrão e os catálogos — e dá ao
-- criador um cadastro de administrador dentro dela, que é o que lhe permite
-- entrar para configurar e dar suporte.
create or replace function public.create_client_tenant(
  p_slug         text,
  p_trade_name   text,
  p_legal_name   text default null,
  p_tax_document text default null,
  p_branch_name  text default 'Matriz'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_provider  uuid := public.current_tenant_id();
  v_tenant    uuid;
  v_app_user  uuid;
  v_role      uuid;
  v_branch    uuid;
  v_me        public.app_users%rowtype;
begin
  if not public.is_platform_owner() then
    raise exception 'Apenas a otica que opera a plataforma pode cadastrar lojas.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_me from public.app_users where id = public.current_app_user_id();
  if not coalesce(v_me.is_tenant_admin, false) then
    raise exception 'Apenas um administrador da plataforma pode cadastrar lojas.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.tenants (slug, legal_name, trade_name, tax_document, provider_tenant_id)
  values (p_slug, coalesce(p_legal_name, p_trade_name), p_trade_name,
          p_tax_document, v_provider)
  returning id into v_tenant;

  -- A filial vem antes: os catálogos padrão precisam dela (tabela de preço).
  insert into public.branches (tenant_id, code, legal_name, trade_name)
  values (v_tenant, 'MATRIZ', coalesce(p_legal_name, p_trade_name), p_branch_name)
  returning id into v_branch;

  perform public.seed_tenant_roles(v_tenant);
  perform public.seed_tenant_defaults(v_tenant, v_branch);

  -- O criador entra como administrador da loja: é assim que ele volta lá para
  -- configurar a identidade visual e dar suporte.
  insert into public.app_users (auth_user_id, tenant_id, full_name, email, is_tenant_admin)
  values (v_me.auth_user_id, v_tenant, v_me.full_name, v_me.email, true)
  returning id into v_app_user;

  select id into v_role from public.roles
   where tenant_id = v_tenant and code = 'admin';

  insert into public.user_branch_access (app_user_id, branch_id, role_id, is_default_branch)
  values (v_app_user, v_branch, v_role, true);

  return v_tenant;
end;
$$;

comment on function public.create_client_tenant(text, text, text, text, text) is
  'Cadastra uma loja cliente da plataforma e deixa o criador como administrador '
  'dela. Recusa quem nao opera a plataforma.';

-- -----------------------------------------------------------------------------
-- 7. Cobrança da assinatura
-- -----------------------------------------------------------------------------
-- Dinheiro que a plataforma cobra da loja. É de OUTRA natureza que o
-- `receivables`, que é o dinheiro que a loja cobra do cliente dela: mistura-los
-- faria o financeiro da loja mostrar a própria mensalidade como se fosse venda.
create table if not exists public.platform_invoices (
  id                 uuid primary key default gen_random_uuid(),
  provider_tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_tenant_id   uuid not null references public.tenants(id) on delete cascade,

  reference_month    date not null,                 -- sempre dia 1 do mês
  due_date           date not null,
  amount             numeric(12,2) not null check (amount > 0),
  paid_amount        numeric(12,2) not null default 0 check (paid_amount >= 0),
  status             text not null default 'open'
                     check (status in ('open','paid','overdue','cancelled')),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint platform_invoices_month_unique
    unique (client_tenant_id, reference_month),
  constraint platform_invoices_paid_limit check (paid_amount <= amount),
  constraint platform_invoices_month_is_first_day
    check (date_trunc('month', reference_month)::date = reference_month)
);

create index if not exists platform_invoices_client_idx
  on public.platform_invoices (client_tenant_id, reference_month desc);

comment on table public.platform_invoices is
  'Mensalidade que a plataforma cobra da loja cliente. Nao se confunde com '
  'receivables, que e o que a loja cobra dos clientes dela.';

drop trigger if exists platform_invoices_set_updated_at on public.platform_invoices;
create trigger platform_invoices_set_updated_at before update on public.platform_invoices
  for each row execute function public.tg_set_updated_at();

-- Valor combinado com cada loja.
alter table public.tenants
  add column if not exists subscription_amount numeric(12,2)
    check (subscription_amount is null or subscription_amount >= 0),
  add column if not exists subscription_due_day smallint
    check (subscription_due_day is null or subscription_due_day between 1 and 28);

comment on column public.tenants.subscription_amount is
  'Mensalidade combinada com esta loja. Nulo = sem cobranca automatica.';

alter table public.platform_invoices enable row level security;
alter table public.platform_invoices force row level security;

-- Só a dona vê e mexe. A loja cliente não enxerga a própria cobrança por aqui —
-- o que ela deve à plataforma não é assunto da operação dela.
drop policy if exists platform_invoices_owner_all on public.platform_invoices;
create policy platform_invoices_owner_all on public.platform_invoices
  for all
  using (public.is_platform_owner() and provider_tenant_id = public.current_tenant_id())
  with check (public.is_platform_owner() and provider_tenant_id = public.current_tenant_id());

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on public.platform_invoices to authenticated;
    grant execute on function public.create_client_tenant(text, text, text, text, text)
      to authenticated;
    grant execute on function public.my_tenants() to authenticated;
    grant execute on function public.is_platform_owner() to authenticated;
  end if;
end;
$$;
