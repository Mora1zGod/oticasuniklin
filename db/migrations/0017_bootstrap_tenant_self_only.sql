-- =============================================================================
-- 0017 — CRIAR A PRÓPRIA ÓTICA, E SÓ A PRÓPRIA
-- =============================================================================
-- Duas coisas, achadas ao investigar um "permission denied for function
-- bootstrap_tenant" que barrou um cliente na tela de primeiro acesso.
--
-- 1. O ACESSO À FUNÇÃO
--
-- A 0010 tira a função do alcance geral e devolve só para quem está logado:
--
--     revoke all ... from public;
--     grant execute ... to authenticated;
--
-- Se o `revoke` chega e o `grant` não — instalação por partes, migration que
-- parou no meio, instalador antigo — a função fica inalcançável para todo
-- mundo, e ninguém mais consegue criar a primeira ótica. O bloco abaixo repõe o
-- acesso em qualquer versão da função que exista no banco, sem depender de a
-- assinatura ser exatamente esta.
--
-- 2. O PARÂMETRO QUE ACEITAVA O NOME DE OUTRA PESSOA
--
-- A função recebia `p_auth_user_id` e usava `coalesce(p_auth_user_id,
-- auth.uid())`. O parâmetro existe para os cenários de teste rodarem sem sessão
-- de verdade. Só que ele também chegava ao aplicativo: qualquer pessoa logada
-- podia chamar a função passando o identificador de OUTRA e criar uma ótica em
-- nome dela — que ficaria como administradora de algo que não pediu, e ainda
-- perderia o direito de criar a própria ("Este usuario ja pertence a uma
-- otica").
--
-- Agora o parâmetro só vale quando é o próprio usuário, ou quando não há sessão
-- nenhuma (que é o caso do cenário de teste, onde `auth.uid()` é nulo). Em
-- sessão de gente de verdade, criar ótica em nome dos outros passa a ser
-- recusado explicitamente.
-- =============================================================================

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

  -- Quem tem sessão só cria ótica para si. O parâmetro continua existindo para
  -- os cenarios de teste, que rodam sem sessao (auth.uid() nulo).
  if auth.uid() is not null and v_auth_id <> auth.uid() then
    raise exception 'Voce so pode criar uma otica para si mesmo.'
      using errcode = 'insufficient_privilege';
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

-- -----------------------------------------------------------------------------
-- O acesso das funções que o aplicativo chama
-- -----------------------------------------------------------------------------
-- Percorre as assinaturas existentes em vez de repetir cada uma à mão: assim o
-- bloco continua valendo se alguma função ganhar um parâmetro no futuro, e não
-- falha num banco onde uma delas ainda não exista.
do $$
declare
  f record;
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    return;
  end if;

  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'bootstrap_tenant',         -- primeiro acesso: cria a própria ótica
        'current_session_context',  -- em qual ótica a sessão está
        'branding_for_login',       -- a marca na tela de login (anônimo também)
        'my_tenants',               -- as óticas que este login alcança
        'is_platform_owner',
        'create_client_tenant',     -- a dona cadastra uma loja
        'set_active_tenant',        -- em qual ótica trabalhar agora
        'resolve_catalog',
        'take_prescription_snapshot'
      )
  loop
    execute format('grant execute on function %s to authenticated', f.assinatura);
  end loop;

  -- A marca do login precisa aparecer ANTES de alguém entrar.
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'branding_for_login'
  loop
    execute format('grant execute on function %s to anon', f.assinatura);
  end loop;
end;
$$;
