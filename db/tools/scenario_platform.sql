-- =============================================================================
-- CENARIO: a plataforma e as lojas clientes
-- =============================================================================
-- Prova, contra o banco, as quatro afirmacoes que sustentam o white label:
--
--   1. a otica dona cadastra lojas e entra nelas;
--   2. a loja cliente nao enxerga outra loja nem a dona;
--   3. cabecalho forjado nao muda a otica de quem nao tem acesso a ela;
--   4. a mensalidade da plataforma so existe para a dona.
--
-- Roda dentro do validate.sh, depois dos outros cenarios.
-- =============================================================================

begin;

-- Identidades ------------------------------------------------------------------
-- Os UUIDs sao fixos para o cenario poder afirmar coisas sobre eles.
insert into auth.users (id, email) values
  ('11110000-0000-0000-0000-000000000001', 'dona@uniklin.com'),
  ('11110000-0000-0000-0000-000000000002', 'gerente@tudobom.com')
on conflict (id) do nothing;

-- A otica dona da plataforma ---------------------------------------------------
select public.bootstrap_tenant(
  'plataforma-uniklin', 'Uniklin Tecnologia LTDA', 'Uniklin',
  'Matriz', 'Dona da plataforma', null,
  '11110000-0000-0000-0000-000000000001'
) as tenant_dona \gset

update public.tenants set is_platform_owner = true where id = :'tenant_dona';

commit;

-- =============================================================================
-- 1. A dona cadastra duas lojas clientes
-- =============================================================================
begin;

select set_config('request.jwt.claims',
  json_build_object('sub', '11110000-0000-0000-0000-000000000001',
                    'role', 'authenticated')::text, true);

select public.create_client_tenant('tudobom', 'Ótica Tudo Bom') as loja_a \gset
select public.create_client_tenant('boavista', 'Ótica Boa Vista') as loja_b \gset

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from public.tenants where provider_tenant_id is not null;
  if v_count <> 2 then
    raise exception '[1] FALHOU: esperava 2 lojas clientes, achei %', v_count;
  end if;
  raise notice '[1] OK — a dona cadastrou duas lojas clientes';
end;
$$;

commit;

-- =============================================================================
-- 2. A dona entra na loja: o endereco escolhe a otica
-- =============================================================================
begin;

select set_config('request.jwt.claims',
  json_build_object('sub', '11110000-0000-0000-0000-000000000001',
                    'role', 'authenticated')::text, true);

-- Sem cabecalho: continua na propria otica.
do $$
begin
  perform set_config('request.headers', '{}', true);
  if (select t.slug from public.tenants t where t.id = public.current_tenant_id())
     <> 'plataforma-uniklin' then
    raise exception '[2] FALHOU: sem endereco deveria abrir a otica da dona';
  end if;

  -- Com o endereco da loja: abre a loja.
  perform set_config('request.headers', '{"x-tenant-slug":"tudobom"}', true);
  if (select t.slug from public.tenants t where t.id = public.current_tenant_id())
     <> 'tudobom' then
    raise exception '[2] FALHOU: a dona deveria abrir a loja pelo endereco dela';
  end if;

  raise notice '[2] OK — o endereco escolhe a otica, e a dona entra na loja';
end;
$$;

commit;

-- =============================================================================
-- 3. A loja cliente e uma ilha
-- =============================================================================
begin;

-- Um gerente que existe SO na loja A.
insert into public.app_users (auth_user_id, tenant_id, full_name, email, is_tenant_admin)
values ('11110000-0000-0000-0000-000000000002',
        (select id from public.tenants where slug = 'tudobom'),
        'Gerente Tudo Bom', 'gerente@tudobom.com', true);

select set_config('request.jwt.claims',
  json_build_object('sub', '11110000-0000-0000-0000-000000000002',
                    'role', 'authenticated')::text, true);

do $$
declare
  v_slug text;
  v_visiveis integer;
begin
  perform set_config('request.headers', '{}', true);

  select t.slug into v_slug from public.tenants t where t.id = public.current_tenant_id();
  if v_slug <> 'tudobom' then
    raise exception '[3] FALHOU: o gerente deveria estar na loja dele, esta em %', v_slug;
  end if;

  -- Cabecalho forjado apontando para a outra loja: nao pode mudar nada.
  perform set_config('request.headers', '{"x-tenant-slug":"boavista"}', true);
  select t.slug into v_slug from public.tenants t where t.id = public.current_tenant_id();
  if v_slug <> 'tudobom' then
    raise exception
      '[3] FALHOU: cabecalho forjado levou o gerente para %, deveria ficar em tudobom',
      v_slug;
  end if;

  perform set_config('request.headers', '{}', true);

  -- E ele nao pode cadastrar loja nenhuma.
  begin
    perform public.create_client_tenant('invasao', 'Loja Invadida');
    raise exception '[3] FALHOU: a loja cliente conseguiu cadastrar outra loja';
  exception when insufficient_privilege then
    null;
  end;

  -- Nem enxergar a mensalidade de ninguem.
  select count(*) into v_visiveis from public.platform_invoices;
  if v_visiveis <> 0 then
    raise exception '[3] FALHOU: a loja cliente viu % cobranca(s) da plataforma',
      v_visiveis;
  end if;

  raise notice '[3] OK — a loja cliente nao ve outra loja, nao cadastra e nao ve cobranca';
end;
$$;

rollback;

-- =============================================================================
-- 4. A cobranca da assinatura pertence a dona
-- =============================================================================
begin;

select set_config('request.jwt.claims',
  json_build_object('sub', '11110000-0000-0000-0000-000000000001',
                    'role', 'authenticated')::text, true);
select set_config('request.headers', '{}', true);

insert into public.platform_invoices
  (provider_tenant_id, client_tenant_id, reference_month, due_date, amount)
values (
  (select id from public.tenants where slug = 'plataforma-uniklin'),
  (select id from public.tenants where slug = 'tudobom'),
  date_trunc('month', current_date)::date,
  (date_trunc('month', current_date) + interval '9 days')::date,
  249.90
);

do $$
declare
  v_total numeric;
begin
  select sum(amount) into v_total from public.platform_invoices;
  if coalesce(v_total, 0) <> 249.90 then
    raise exception '[4] FALHOU: a dona deveria ver a cobranca que emitiu';
  end if;
  raise notice '[4] OK — a mensalidade existe para a dona e so para ela';
end;
$$;

commit;

-- Encerra o cenario sem deixar as identidades de teste para tras.
begin;
select set_config('request.jwt.claims', null, true);
select set_config('request.headers', null, true);
commit;
