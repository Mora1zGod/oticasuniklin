-- =============================================================================
-- 0016 — A ÓTICA ABERTA DEIXA DE DEPENDER DO CABEÇALHO
-- =============================================================================
-- A 0014 fez a escolha da ótica viajar num cabeçalho da requisição
-- (`x-tenant-slug`). Era a solução mais simples, e está errada: o cabeçalho é
-- transporte, e transporte se perde.
--
-- Perdeu-se duas vezes. No Storage, que fala com o banco por conta própria e
-- não repassa cabeçalho nenhum (0015). E no caminho normal do aplicativo: em
-- produção, a requisição sai do navegador COM o cabeçalho e chega ao banco sem
-- ele. O efeito era mudo e perigoso — a pessoa abria o endereço da loja, o
-- sistema abria a ótica dela mesma, e ela editava a marca errada acreditando
-- estar na certa.
--
-- A correção tira a escolha do transporte e coloca onde ela não se perde: no
-- banco, ligada ao usuário. Continua não sendo uma autorização — `set_active_
-- tenant` só aceita ótica em que a pessoa já tem cadastro ativo, exatamente
-- como o cabeçalho já fazia. O que muda é que agora a escolha CHEGA.
--
-- O cabeçalho continua valendo quando chega, e vem primeiro: onde o transporte
-- funciona, cada aba pode estar numa ótica diferente. A escolha guardada é o
-- que segura o caso em que ele não chega — e é o único caminho no Storage.
-- =============================================================================

create table if not exists public.active_tenant (
  auth_user_id uuid primary key,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  updated_at   timestamptz not null default now()
);

comment on table public.active_tenant is
  'Em qual otica cada login esta trabalhando agora. Nao concede acesso: so '
  'registra uma escolha entre as oticas que a pessoa ja alcanca.';

alter table public.active_tenant enable row level security;
alter table public.active_tenant force row level security;

-- Cada um enxerga só a própria escolha, e nem precisa: quem escreve é a função.
drop policy if exists active_tenant_self_read on public.active_tenant;
create policy active_tenant_self_read on public.active_tenant
  for select using (auth_user_id = auth.uid());

/**
 * Passa a trabalhar nesta ótica.
 *
 * Recusa ótica em que o usuário não tenha cadastro ativo — é a mesma trava que
 * o cabeçalho tinha, agora num lugar que não depende de transporte.
 */
create or replace function public.set_active_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (
    select 1 from public.app_users u
    where u.auth_user_id = auth.uid()
      and u.tenant_id = p_tenant_id
      and u.is_active
      and u.deleted_at is null
  ) then
    raise exception 'Voce nao tem cadastro nesta otica.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.active_tenant (auth_user_id, tenant_id)
  values (auth.uid(), p_tenant_id)
  on conflict (auth_user_id) do update
    set tenant_id = excluded.tenant_id, updated_at = now();
end;
$$;

-- -----------------------------------------------------------------------------
-- Qual ótica está aberta agora
-- -----------------------------------------------------------------------------
-- Três fontes, nesta ordem, e todas limitadas ao que a pessoa já alcança:
--   1. o endereço pedido no cabeçalho — quando chega, manda, e permite abas
--      diferentes em óticas diferentes;
--   2. a escolha guardada — o que sobra quando o cabeçalho se perde, e o único
--      caminho dentro do Storage;
--   3. a ótica mais antiga da pessoa, que é a dela.
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
  left join public.active_tenant a on a.auth_user_id = u.auth_user_id
  where u.auth_user_id = auth.uid()
    and u.is_active
    and u.deleted_at is null
  order by (t.slug::text is not distinct from public.requested_tenant_slug()) desc,
           (a.tenant_id is not distinct from u.tenant_id) desc,
           u.created_at
  limit 1;
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
  left join public.active_tenant a on a.auth_user_id = u.auth_user_id
  where u.auth_user_id = auth.uid()
    and u.is_active
    and u.deleted_at is null
  order by (t.slug::text is not distinct from public.requested_tenant_slug()) desc,
           (a.tenant_id is not distinct from u.tenant_id) desc,
           u.created_at
  limit 1;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on public.active_tenant to authenticated;
    grant execute on function public.set_active_tenant(uuid) to authenticated;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- O contexto da sessão passa a respeitar a ótica aberta
-- -----------------------------------------------------------------------------
-- Aqui estava o furo de verdade. Esta função é o que o aplicativo lê para saber
-- em qual ótica está, e ela escolhia o cadastro assim:
--
--     select * into v_user from app_users where auth_user_id = auth.uid() ...
--
-- Sem ordem nenhuma. Enquanto um login pertencia a UMA ótica, a consulta só
-- podia achar uma linha e a falta de ordem não aparecia. A 0014 permitiu vários
-- cadastros por login e esta função ficou para trás: com mais de uma linha,
-- `select into` fica com a primeira que vier, sem erro e sem critério.
--
-- Era por isso que abrir o endereço da loja não levava a lugar nenhum: não
-- importava o que o endereço pedisse, o contexto vinha da linha que o banco
-- devolvesse primeiro — quase sempre a ótica mais antiga, a da própria pessoa.
--
-- Agora o cadastro vem de `current_app_user_id()`, a função que já sabe
-- escolher: o endereço pedido, depois a escolha guardada, depois a mais antiga.
-- Um só lugar decide em qual ótica a sessão está, e todo o resto pergunta a ele.
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
  where id = public.current_app_user_id();

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
