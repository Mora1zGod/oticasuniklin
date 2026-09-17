-- =============================================================================
-- CENARIO DE ONBOARDING — o caminho real de "por no ar"
-- =============================================================================
-- Prova que uma otica nova consegue: nascer, logar, ver o proprio contexto,
-- convidar a equipe e operar (vender e abrir O.S.) sem nenhum seed manual.
--
--   [1] usuario do Auth sem otica -> needs_onboarding
--   [2] bootstrap_tenant cria tenant + matriz + admin + padroes
--   [3] current_session_context devolve tenant, filiais e permissoes
--   [4] a otica nova ja consegue vender e abrir O.S. (padroes semeados)
--   [5] convite aceito no signup vira acesso automaticamente
--   [6] RLS isola: o convidado so enxerga a propria otica
-- =============================================================================
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'dono@oticacentral.com.br'),
  ('10000000-0000-0000-0000-000000000002', 'vendedora@oticacentral.com.br'),
  ('10000000-0000-0000-0000-000000000003', 'estranho@ninguem.com');

-- [1] usuario autenticado que ainda nao pertence a nenhuma otica
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
do $$
begin
  if public.current_session_context() ->> 'status' <> 'needs_onboarding' then
    raise exception '[1] FALHOU: usuario sem otica deveria cair no onboarding';
  end if;
  raise notice '[1] OK — usuario sem otica cai no onboarding';
end;
$$;

-- [2] a otica nasce
-- psql nao interpola :'var' dentro de bloco dollar-quoted; o id trafega em
-- tabela temporaria de sessao.
create temp table _bootstrap as
select public.bootstrap_tenant(
  'otica-central', 'Otica Central LTDA', 'Otica Central',
  'Matriz - Centro', 'Gabriel Moura', '11222333000181'
) as tenant_id;

do $$
declare
  v_tenant uuid := (select tenant_id from _bootstrap);
  v_count  integer;
begin
  select count(*) into v_count from public.service_order_statuses where tenant_id = v_tenant;
  if v_count <> 9 then
    raise exception '[2] FALHOU: % situacoes de O.S. (esperado 9)', v_count;
  end if;

  select count(*) into v_count from public.payment_methods where tenant_id = v_tenant;
  if v_count <> 6 then
    raise exception '[2] FALHOU: % formas de pagamento (esperado 6)', v_count;
  end if;

  select count(*) into v_count from public.chart_accounts where tenant_id = v_tenant;
  if v_count <> 6 then
    raise exception '[2] FALHOU: % contas no plano de contas (esperado 6)', v_count;
  end if;

  select count(*) into v_count from public.roles where tenant_id = v_tenant;
  if v_count <> 3 then
    raise exception '[2] FALHOU: % papeis (esperado 3)', v_count;
  end if;

  select count(*) into v_count from public.service_order_status_transitions where tenant_id = v_tenant;
  if v_count < 7 then
    raise exception '[2] FALHOU: % transicoes de status (esperado >= 7)', v_count;
  end if;

  raise notice '[2] OK — otica criada com padroes (status, pagamento, contas, papeis, precos)';
end;
$$;

-- [3] contexto de sessao do admin
do $$
declare
  ctx jsonb := public.current_session_context();
begin
  if ctx ->> 'status' <> 'ready' then
    raise exception '[3] FALHOU: status=%', ctx ->> 'status';
  end if;
  if (ctx -> 'branches') = '[]'::jsonb then
    raise exception '[3] FALHOU: admin sem filial acessivel';
  end if;
  if not (ctx -> 'permissions' ? 'admin.manage') then
    raise exception '[3] FALHOU: admin sem permissao admin.manage';
  end if;
  if not (ctx -> 'permissions' ? 'clinical.prescription.write') then
    raise exception '[3] FALHOU: admin sem permissao de receita';
  end if;
  raise notice '[3] OK — contexto de sessao: tenant + % filial(is) + % permissoes',
    jsonb_array_length(ctx -> 'branches'), jsonb_array_length(ctx -> 'permissions');
end;
$$;

commit;

-- [4] a otica nova consegue operar imediatamente
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

do $$
declare
  v_branch   uuid;
  v_customer uuid;
  v_sale     uuid;
  v_os       uuid;
  v_status   uuid;
  v_pix      uuid;
begin
  select (b ->> 'id')::uuid into v_branch
  from jsonb_array_elements(public.current_session_context() -> 'branches') b
  limit 1;

  insert into public.customers (tenant_id, party_type, display_name, created_at_branch_id)
  values (public.current_tenant_id(), 'individual', 'Cliente Teste', v_branch)
  returning id into v_customer;

  insert into public.customer_contacts (customer_id, tenant_id, kind, value, is_primary)
  values (v_customer, public.current_tenant_id(), 'whatsapp', '+5568999990000', true);

  insert into public.sales (tenant_id, branch_id, number, sale_type, customer_id, status, total_amount)
  values (public.current_tenant_id(), v_branch,
          public.next_document_number(v_branch, 'sale'),
          'identified', v_customer, 'confirmed', 100.00)
  returning id into v_sale;

  select id into v_pix from public.payment_methods
  where tenant_id = public.current_tenant_id() and code = 'pix';

  insert into public.sale_payments (sale_id, tenant_id, payment_method_id, amount, paid_at)
  values (v_sale, public.current_tenant_id(), v_pix, 100.00, now());

  select id into v_status from public.service_order_statuses
  where tenant_id = public.current_tenant_id() and is_initial;

  insert into public.service_orders (tenant_id, branch_id, number, customer_id, sale_id,
                                     status_id, frame_source, frame_description)
  values (public.current_tenant_id(), v_branch,
          public.next_document_number(v_branch, 'service_order'),
          v_customer, v_sale, v_status, 'customer_own', 'Armacao do cliente')
  returning id into v_os;

  raise notice '[4] OK — otica nova vendeu e abriu O.S. sem nenhum seed manual';
end;
$$;

-- [4b] O cadastro rapido reporta pendencias sem quebrar, e a promocao para
-- completo e barrada enquanto faltar campo (ADR-006).
do $$
declare
  v_customer uuid;
  v_gaps     text[];
  v_failed   boolean := false;
begin
  select id into v_customer from public.customers
  where display_name = 'Cliente Teste' limit 1;

  v_gaps := public.customer_missing_fields(v_customer, 'complete');
  if not (v_gaps @> array['cpf','address']) then
    raise exception '[4b] FALHOU: pendencias esperadas (cpf, address), vieram %', v_gaps;
  end if;

  if array_length(public.customer_missing_fields(v_customer, 'quick'), 1) is not null then
    raise exception '[4b] FALHOU: no nivel quick o cadastro ja esta completo';
  end if;

  -- customers_promotion_guard e um constraint trigger DEFERIDO: a checagem
  -- acontece no COMMIT. Para o app isso e transparente (o PostgREST commita e
  -- devolve 400); aqui forcamos a checagem com SET CONSTRAINTS IMMEDIATE.
  begin
    update public.customers set record_status = 'complete' where id = v_customer;
    set constraints public.customers_promotion_guard immediate;
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception '[4b] FALHOU: promoveu para completo com pendencias';
  end if;
  -- desfaz a promocao indevida que ficou pendente na transacao
  update public.customers set record_status = 'quick' where id = v_customer;

  raise notice '[4b] OK — pendencias reportadas (%) e promocao barrada',
    array_to_string(v_gaps, ', ');
end;
$$;
commit;

-- [5] convite vira acesso no signup
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

insert into public.user_invitations (tenant_id, email, full_name, role_id, branch_ids, is_salesperson)
select public.current_tenant_id(), 'vendedora@oticacentral.com.br', 'Maria Vendedora',
       (select id from public.roles where tenant_id = public.current_tenant_id() and code = 'sales'),
       array(select b.id from public.branches b where b.tenant_id = public.current_tenant_id()),
       true;
commit;

-- o signup do convidado dispara o trigger em auth.users
insert into auth.users (id, email)
values ('10000000-0000-0000-0000-000000000004', 'vendedora@oticacentral.com.br')
on conflict do nothing;

-- (o e-mail ja existia em auth.users acima; simula o signup real do convidado)
do $$
declare
  v_user public.app_users%rowtype;
begin
  select * into v_user from public.app_users
  where auth_user_id = '10000000-0000-0000-0000-000000000004';

  if not found then
    raise exception '[5] FALHOU: convite aceito nao criou o acesso da vendedora';
  end if;
  if not v_user.is_salesperson then
    raise exception '[5] FALHOU: vendedora sem flag is_salesperson';
  end if;
  if not exists (select 1 from public.user_branch_access where app_user_id = v_user.id) then
    raise exception '[5] FALHOU: vendedora sem acesso a filial';
  end if;
  if not exists (select 1 from public.user_invitations
                 where accepted_user_id = v_user.id and accepted_at is not null) then
    raise exception '[5] FALHOU: convite nao foi marcado como aceito';
  end if;
  raise notice '[5] OK — convite aceito no signup virou acesso com papel e filial';
end;
$$;

-- [6] RLS: o convidado enxerga a propria otica; um estranho nao enxerga nada
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
do $$
declare
  v_customers integer;
  ctx jsonb := public.current_session_context();
begin
  if ctx ->> 'status' <> 'ready' then
    raise exception '[6] FALHOU: vendedora deveria ter contexto pronto';
  end if;
  if ctx -> 'permissions' ? 'admin.manage' then
    raise exception '[6] FALHOU: vendedora nao pode ter admin.manage';
  end if;
  select count(*) into v_customers from public.customers;
  if v_customers <> 1 then
    raise exception '[6] FALHOU: vendedora viu % clientes (esperado 1)', v_customers;
  end if;
  raise notice '[6] OK — vendedora ve a otica dela, sem permissao de admin';
end;
$$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
do $$
declare
  v_customers integer;
begin
  if public.current_session_context() ->> 'status' <> 'needs_onboarding' then
    raise exception '[6] FALHOU: estranho sem convite deveria cair no onboarding';
  end if;
  select count(*) into v_customers from public.customers;
  if v_customers <> 0 then
    raise exception '[6] FALHOU: estranho enxergou % clientes (esperado 0)', v_customers;
  end if;
  raise notice '[6] OK — usuario sem otica nao enxerga dado de ninguem';
end;
$$;
commit;
