-- =============================================================================
-- 0015 — A DONA DA PLATAFORMA CONSEGUE TROCAR A LOGO DA LOJA QUE ATENDE
-- =============================================================================
-- Sintoma: dentro de uma loja cliente, salvar a identidade visual com uma
-- imagem nova era recusado — "violates row-level security".
--
-- Causa: a 0014 fez a escolha da ótica depender do ENDEREÇO, que chega ao banco
-- no cabeçalho `x-tenant-slug`. Isso vale para o PostgREST, que repassa os
-- cabeçalhos da requisição. O Storage é OUTRO serviço: ele fala com o banco por
-- conta própria e não leva esse cabeçalho junto. Lá dentro,
-- `requested_tenant_slug()` volta nulo e `current_tenant_id()` devolve a
-- primeira ótica do usuário — a dona da plataforma. A pasta era a da loja, a
-- policy comparava com a ótica errada, e negava.
--
-- Correção: a policy do arquivo não deve perguntar "qual ótica está aberta
-- agora?", que é uma noção de sessão do aplicativo. Deve perguntar o que é
-- verificável só pelo cadastro: "esta pasta é de uma ótica que você administra?"
-- Não depende de cabeçalho nenhum, e por isso funciona em qualquer serviço.
--
-- O que NÃO muda: a loja cliente continua enxergando só a pasta dela, porque só
-- tem cadastro na própria ótica. Ninguém ganha acesso novo — o que muda é que a
-- dona, que já é administradora dentro da loja (a 0014 a cadastra assim ao
-- criar), deixa de ser barrada por um detalhe de transporte.
-- =============================================================================

/**
 * Esta pasta do bucket pertence a uma ótica que este usuário administra?
 *
 * Mora numa função, e não repetida em três policies, porque as três respondem
 * exatamente à mesma pergunta — e uma delas divergir das outras seria um furo.
 */
create or replace function public.administra_tenant(p_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.app_users u
    where u.auth_user_id = auth.uid()
      and u.is_active
      and u.deleted_at is null
      and u.is_tenant_admin
      and u.tenant_id::text = p_tenant_id
  );
$$;

comment on function public.administra_tenant(text) is
  'Usuario e administrador da otica informada. Nao depende do cabecalho do '
  'endereco, entao vale tambem no Storage, que nao o repassa.';

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    -- Leitura segue pública: a logo precisa aparecer antes do login.
    drop policy if exists "branding_admin_write"  on storage.objects;
    drop policy if exists "branding_admin_update" on storage.objects;
    drop policy if exists "branding_admin_delete" on storage.objects;

    execute $pol$
      create policy "branding_admin_write" on storage.objects
        for insert to authenticated
        with check (
          bucket_id = 'branding'
          and public.administra_tenant((storage.foldername(name))[1])
        )
    $pol$;

    execute $pol$
      create policy "branding_admin_update" on storage.objects
        for update to authenticated
        using (
          bucket_id = 'branding'
          and public.administra_tenant((storage.foldername(name))[1])
        )
        with check (
          bucket_id = 'branding'
          and public.administra_tenant((storage.foldername(name))[1])
        )
    $pol$;

    execute $pol$
      create policy "branding_admin_delete" on storage.objects
        for delete to authenticated
        using (
          bucket_id = 'branding'
          and public.administra_tenant((storage.foldername(name))[1])
        )
    $pol$;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.administra_tenant(text) to authenticated;
  end if;
end;
$$;
