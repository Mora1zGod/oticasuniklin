-- =============================================================================
-- 0010 — ONBOARDING: PONTE AUTH -> APP_USERS E BOOTSTRAP DE TENANT
-- =============================================================================
-- Sem esta migration o sistema SOBE MAS NAO FUNCIONA:
--
--   1. Um usuario criado no Supabase Auth nao tem linha em app_users, entao
--      current_tenant_id() devolve NULL e a RLS bloqueia 100% das consultas.
--   2. Um tenant novo nao tem situacao de O.S., forma de pagamento nem plano de
--      contas — nao consegue vender nem abrir O.S.
--
-- Aqui ficam os dois caminhos suportados:
--   * bootstrap_tenant()   -> cria a primeira otica (tenant + filial + admin)
--   * user_invitations     -> convida os demais usuarios da equipe
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permissoes conhecidas pelo produto
-- -----------------------------------------------------------------------------
create table public.permissions (
  code              text primary key,
  label             text not null,
  module            text not null,
  created_at        timestamptz not null default now()
);

insert into public.permissions (code, label, module) values
  ('customer.read',                'Ver clientes',                    'clientes'),
  ('customer.write',               'Criar/editar clientes',           'clientes'),
  ('customer.consent.read',        'Ver consentimentos LGPD',         'clientes'),
  ('customer.consent.write',       'Registrar consentimentos LGPD',   'clientes'),
  ('clinical.prescription.read',   'Ver receitas',                    'optica'),
  ('clinical.prescription.write',  'Registrar receitas',              'optica'),
  ('sale.read',                    'Ver vendas',                      'comercial'),
  ('sale.write',                   'Registrar vendas',                'comercial'),
  ('sale.discount',                'Conceder desconto',               'comercial'),
  ('service_order.read',           'Ver ordens de servico',           'producao'),
  ('service_order.write',          'Criar/editar ordens de servico',  'producao'),
  ('product.read',                 'Ver produtos',                    'produtos'),
  ('product.write',                'Criar/editar produtos',           'produtos'),
  ('stock.write',                  'Movimentar estoque',              'estoque'),
  ('finance.read',                 'Ver financeiro',                  'financeiro'),
  ('finance.write',                'Lancar/baixar financeiro',        'financeiro'),
  ('commission.read',              'Ver comissoes',                   'financeiro'),
  ('admin.manage',                 'Administrar a otica',             'administracao');

alter table public.role_permissions
  add constraint role_permissions_code_fk
  foreign key (permission_code) references public.permissions(code) on update cascade;

-- -----------------------------------------------------------------------------
-- Padroes de um tenant novo (situacoes de O.S., pagamento, contas, preco)
-- -----------------------------------------------------------------------------
create or replace function public.seed_tenant_defaults(
  p_tenant_id uuid,
  p_branch_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status record;
  v_prev   uuid;
  v_price  uuid;
begin
  -- Situacoes de O.S. (rotulo editavel; `stage` canonico fechado — ADR-010)
  insert into public.service_order_statuses
    (tenant_id, code, label, stage, is_initial, is_final, notifies_customer, sort_order)
  values
    (p_tenant_id, 'aberta',    'Aberta',                 'draft',             true,  false, false, 10),
    (p_tenant_id, 'no_lab',    'Enviada ao laboratorio', 'awaiting_lab',      false, false, false, 20),
    (p_tenant_id, 'producao',  'Em producao',            'in_production',     false, false, false, 30),
    (p_tenant_id, 'recebida',  'Recebida do laboratorio','received_from_lab', false, false, false, 40),
    (p_tenant_id, 'montagem',  'Em montagem',            'assembling',        false, false, false, 50),
    (p_tenant_id, 'conferencia','Conferencia final',     'quality_check',     false, false, false, 60),
    (p_tenant_id, 'pronta',    'Pronta para retirada',   'ready_for_pickup',  false, false, true,  70),
    (p_tenant_id, 'entregue',  'Entregue',               'delivered',         false, true,  false, 80),
    (p_tenant_id, 'cancelada', 'Cancelada',              'cancelled',         false, true,  false, 90)
  on conflict (tenant_id, code) do nothing;

  -- Transicoes lineares entre as situacoes ativas, mais cancelamento a partir
  -- de qualquer situacao nao final.
  v_prev := null;
  for v_status in
    select id from public.service_order_statuses
    where tenant_id = p_tenant_id and stage <> 'cancelled'
    order by sort_order
  loop
    if v_prev is not null then
      insert into public.service_order_status_transitions (tenant_id, from_status_id, to_status_id)
      values (p_tenant_id, v_prev, v_status.id)
      on conflict do nothing;
    end if;
    v_prev := v_status.id;
  end loop;

  insert into public.service_order_status_transitions (tenant_id, from_status_id, to_status_id)
  select p_tenant_id, s.id, c.id
  from public.service_order_statuses s
  cross join lateral (
    select id from public.service_order_statuses
    where tenant_id = p_tenant_id and stage = 'cancelled'
  ) c
  where s.tenant_id = p_tenant_id and not s.is_final
  on conflict do nothing;

  -- Plano de contas minimo
  insert into public.chart_accounts (tenant_id, code, label, account_kind) values
    (p_tenant_id, '3.1.01', 'Receita de vendas',            'revenue'),
    (p_tenant_id, '3.1.02', 'Receita de servicos',          'revenue'),
    (p_tenant_id, '4.1.01', 'Custo de mercadoria vendida',  'expense'),
    (p_tenant_id, '4.1.02', 'Servicos de laboratorio',      'expense'),
    (p_tenant_id, '4.2.01', 'Despesas operacionais',        'expense'),
    (p_tenant_id, '4.2.02', 'Taxas de cartao',              'expense')
  on conflict (tenant_id, code) do nothing;

  -- Formas de pagamento (carregam regra — ADR-010 categoria "c")
  insert into public.payment_methods
    (tenant_id, code, label, kind, generates_receivable, allows_installments,
     max_installments, settlement_days, fee_percent, requires_acquirer,
     requires_customer, chart_account_id, sort_order)
  values
    (p_tenant_id, 'dinheiro',  'Dinheiro',           'cash',             false, false, 1,  0,  0.000, false, false,
     (select id from public.chart_accounts where tenant_id = p_tenant_id and code = '3.1.01'), 10),
    (p_tenant_id, 'pix',       'PIX',                'pix',              false, false, 1,  0,  0.000, false, false,
     (select id from public.chart_accounts where tenant_id = p_tenant_id and code = '3.1.01'), 20),
    (p_tenant_id, 'debito',    'Cartao de debito',   'debit_card',       false, false, 1,  1,  1.500, true,  false,
     (select id from public.chart_accounts where tenant_id = p_tenant_id and code = '3.1.01'), 30),
    (p_tenant_id, 'credito',   'Cartao de credito',  'credit_card',      false, true,  12, 30, 3.500, true,  false,
     (select id from public.chart_accounts where tenant_id = p_tenant_id and code = '3.1.01'), 40),
    (p_tenant_id, 'crediario', 'Crediario proprio',  'installment_plan', true,  true,  10, 0,  0.000, false, true,
     (select id from public.chart_accounts where tenant_id = p_tenant_id and code = '3.1.01'), 50),
    (p_tenant_id, 'credito_loja','Credito de loja',  'store_credit',     false, false, 1,  0,  0.000, false, true,
     (select id from public.chart_accounts where tenant_id = p_tenant_id and code = '3.1.01'), 60)
  on conflict (tenant_id, code) do nothing;

  -- Tabela de preco padrao
  insert into public.price_tables (tenant_id, code, label, is_default)
  values (p_tenant_id, 'padrao', 'Tabela padrao', true)
  on conflict (tenant_id, code) do nothing;

  select id into v_price
  from public.price_tables
  where tenant_id = p_tenant_id and code = 'padrao';

  insert into public.price_table_branches (price_table_id, branch_id)
  values (v_price, p_branch_id)
  on conflict do nothing;

  -- Categorias de produto basicas da otica
  insert into public.product_categories (tenant_id, code, label, sort_order) values
    (p_tenant_id, 'armacoes',    'Armacoes',            10),
    (p_tenant_id, 'solares',     'Oculos solares',      20),
    (p_tenant_id, 'lentes',      'Lentes',              30),
    (p_tenant_id, 'contato',     'Lentes de contato',   40),
    (p_tenant_id, 'acessorios',  'Acessorios',          50),
    (p_tenant_id, 'servicos',    'Servicos',            60)
  on conflict (tenant_id, code) do nothing;
end;
$$;

comment on function public.seed_tenant_defaults(uuid, uuid) is
  'Padroes minimos para uma otica nova operar: situacoes de O.S. com transicoes, '
  'formas de pagamento, plano de contas, tabela de preco e categorias.';

-- -----------------------------------------------------------------------------
-- Papeis padrao
-- -----------------------------------------------------------------------------
create or replace function public.seed_tenant_roles(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_sales uuid;
  v_lab   uuid;
begin
  insert into public.roles (tenant_id, code, label, is_system) values
    (p_tenant_id, 'admin',  'Administrador', true),
    (p_tenant_id, 'sales',  'Vendedor',      true),
    (p_tenant_id, 'lab',    'Producao',      true)
  on conflict do nothing;

  select id into v_admin from public.roles where tenant_id = p_tenant_id and code = 'admin';
  select id into v_sales from public.roles where tenant_id = p_tenant_id and code = 'sales';
  select id into v_lab   from public.roles where tenant_id = p_tenant_id and code = 'lab';

  insert into public.role_permissions (role_id, permission_code)
  select v_admin, code from public.permissions
  on conflict do nothing;

  insert into public.role_permissions (role_id, permission_code)
  select v_sales, code from public.permissions
  where code in ('customer.read','customer.write','customer.consent.read','customer.consent.write',
                 'clinical.prescription.read','clinical.prescription.write',
                 'sale.read','sale.write','service_order.read','service_order.write',
                 'product.read','stock.write','commission.read')
  on conflict do nothing;

  insert into public.role_permissions (role_id, permission_code)
  select v_lab, code from public.permissions
  where code in ('service_order.read','service_order.write','clinical.prescription.read',
                 'product.read','stock.write')
  on conflict do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- Bootstrap: cria a primeira otica a partir de um usuario ja autenticado
-- -----------------------------------------------------------------------------
create or replace function public.bootstrap_tenant(
  p_slug            text,
  p_legal_name      text,
  p_trade_name      text,
  p_branch_name     text default 'Matriz',
  p_admin_name      text default null,
  p_tax_document    text default null,
  p_auth_user_id    uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_auth_id  uuid := coalesce(p_auth_user_id, auth.uid());
  v_email    text;
  v_tenant   uuid;
  v_branch   uuid;
  v_role     uuid;
  v_user     uuid;
begin
  if v_auth_id is null then
    raise exception 'bootstrap_tenant exige um usuario autenticado';
  end if;

  select email into v_email from auth.users where id = v_auth_id;
  if v_email is null then
    raise exception 'Usuario % nao existe em auth.users', v_auth_id;
  end if;

  if exists (select 1 from public.app_users where auth_user_id = v_auth_id and deleted_at is null) then
    raise exception 'Este usuario ja pertence a uma otica';
  end if;

  insert into public.tenants (slug, legal_name, trade_name, tax_document)
  values (p_slug, p_legal_name, p_trade_name, p_tax_document)
  returning id into v_tenant;

  insert into public.branches (tenant_id, code, legal_name, trade_name)
  values (v_tenant, 'MATRIZ', p_legal_name, p_branch_name)
  returning id into v_branch;

  perform public.seed_tenant_roles(v_tenant);
  perform public.seed_tenant_defaults(v_tenant, v_branch);

  select id into v_role from public.roles where tenant_id = v_tenant and code = 'admin';

  insert into public.app_users
    (auth_user_id, tenant_id, full_name, email, is_tenant_admin, is_salesperson)
  values
    (v_auth_id, v_tenant, coalesce(p_admin_name, v_email), v_email, true, true)
  returning id into v_user;

  insert into public.user_branch_access (app_user_id, branch_id, role_id, is_default_branch)
  values (v_user, v_branch, v_role, true);

  return v_tenant;
end;
$$;

comment on function public.bootstrap_tenant(text, text, text, text, text, text, uuid) is
  'Cria a primeira otica (tenant + matriz + admin + padroes) para o usuario '
  'autenticado. Chamada uma unica vez, na tela de onboarding.';

revoke all on function public.bootstrap_tenant(text, text, text, text, text, text, uuid) from public;
grant execute on function public.bootstrap_tenant(text, text, text, text, text, text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Convite de equipe: o caminho para os DEMAIS usuarios
-- -----------------------------------------------------------------------------
create table public.user_invitations (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  email             citext not null,
  full_name         text,
  role_id           uuid not null references public.roles(id),
  branch_ids        uuid[] not null default '{}',
  is_salesperson    boolean not null default false,
  invited_by        uuid references public.app_users(id),
  accepted_at       timestamptz,
  accepted_user_id  uuid references public.app_users(id),
  expires_at        timestamptz not null default now() + interval '14 days',
  created_at        timestamptz not null default now()
);

create unique index user_invitations_pending_unique
  on public.user_invitations (tenant_id, email)
  where accepted_at is null;

create index user_invitations_email_idx on public.user_invitations (email)
  where accepted_at is null;

alter table public.user_invitations enable row level security;
alter table public.user_invitations force row level security;
create policy user_invitations_tenant_isolation on public.user_invitations
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Ao confirmar o e-mail no Supabase Auth, o convite vira acesso.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_inv    public.user_invitations%rowtype;
  v_user   uuid;
  v_branch uuid;
begin
  select * into v_inv
  from public.user_invitations
  where email = new.email
    and accepted_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if not found then
    -- Sem convite: o usuario existe no Auth mas ainda nao pertence a nenhuma
    -- otica. A aplicacao o leva para a tela de onboarding (bootstrap_tenant).
    return new;
  end if;

  insert into public.app_users
    (auth_user_id, tenant_id, full_name, email, is_salesperson)
  values
    (new.id, v_inv.tenant_id, coalesce(v_inv.full_name, new.email), new.email,
     v_inv.is_salesperson)
  returning id into v_user;

  foreach v_branch in array v_inv.branch_ids loop
    insert into public.user_branch_access (app_user_id, branch_id, role_id, is_default_branch)
    values (v_user, v_branch, v_inv.role_id,
            v_branch = coalesce(v_inv.branch_ids[1], v_branch))
    on conflict (app_user_id, branch_id) do nothing;
  end loop;

  update public.user_invitations
     set accepted_at = now(), accepted_user_id = v_user
   where id = v_inv.id;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- Sessao: o que o app precisa saber logo apos o login
-- -----------------------------------------------------------------------------
create or replace function public.current_session_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_user   public.app_users%rowtype;
  v_result jsonb;
begin
  select * into v_user
  from public.app_users
  where auth_user_id = auth.uid() and is_active and deleted_at is null;

  if not found then
    -- Usuario autenticado sem otica: o app manda para o onboarding.
    return jsonb_build_object('status', 'needs_onboarding');
  end if;

  select jsonb_build_object(
    'status', 'ready',
    'app_user_id', v_user.id,
    'tenant_id', v_user.tenant_id,
    'full_name', v_user.full_name,
    'email', v_user.email,
    'is_tenant_admin', v_user.is_tenant_admin,
    'is_salesperson', v_user.is_salesperson,
    'tenant', (select jsonb_build_object('id', t.id, 'slug', t.slug, 'trade_name', t.trade_name)
                 from public.tenants t where t.id = v_user.tenant_id),
    'branches', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id, 'code', b.code, 'trade_name', b.trade_name,
               'is_default', a.is_default_branch, 'role', r.code)
             order by b.trade_name)
      from public.user_branch_access a
      join public.branches b on b.id = a.branch_id
      join public.roles r on r.id = a.role_id
      where a.app_user_id = v_user.id and b.deleted_at is null
    ), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(distinct rp.permission_code)
      from public.user_branch_access a
      join public.role_permissions rp on rp.role_id = a.role_id
      where a.app_user_id = v_user.id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.current_session_context() is
  'Contexto da sessao para o app logo apos o login: tenant, filiais acessiveis e '
  'permissoes efetivas. Devolve needs_onboarding quando o usuario do Auth ainda '
  'nao pertence a nenhuma otica.';

grant execute on function public.current_session_context() to authenticated;

-- Catalogo de permissoes e leitura publica autenticada (a UI monta os papeis)
alter table public.permissions enable row level security;
create policy permissions_read on public.permissions for select using (true);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on public.user_invitations to authenticated;
    grant select on public.permissions to authenticated;
  end if;
end;
$$;
