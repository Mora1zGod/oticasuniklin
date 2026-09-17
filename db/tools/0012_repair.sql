-- =============================================================================
-- 0012 — CONFERIR E COMPLETAR a identidade visual (white label)
-- =============================================================================
-- Use este script quando a 0012 já foi aplicada (inteira ou pela metade) e o
-- `create table` passa a falhar com "relation already exists".
--
-- Diferente da migration, aqui TUDO é idempotente: pode rodar quantas vezes
-- quiser. Cria só o que falta e no fim imprime o que ficou no lugar.
-- =============================================================================

-- 1. Tabela --------------------------------------------------------------------
create table if not exists public.tenant_branding (
  tenant_id uuid primary key references public.tenants(id) on delete cascade
);

-- Colunas: uma a uma, para completar instalação parcial sem apagar nada.
alter table public.tenant_branding
  add column if not exists company_name         text,
  add column if not exists short_name           text,
  add column if not exists subtitle             text,
  add column if not exists logo_url             text,
  add column if not exists logo_icon_url        text,
  add column if not exists favicon_url          text,
  add column if not exists primary_color        text,
  add column if not exists secondary_color      text,
  add column if not exists accent_color         text,
  add column if not exists background_color     text,
  add column if not exists card_color           text,
  add column if not exists text_color           text,
  add column if not exists login_image_url      text,
  add column if not exists login_background_url text,
  add column if not exists login_headline       text,
  add column if not exists login_highlight      text,
  add column if not exists login_description    text,
  add column if not exists benefit_1            text,
  add column if not exists benefit_2            text,
  add column if not exists benefit_3            text,
  add column if not exists login_footnote       text,
  add column if not exists updated_by           uuid references public.app_users(id),
  add column if not exists created_at           timestamptz not null default now(),
  add column if not exists updated_at           timestamptz not null default now();

-- Cor vazia é ausência de personalização, não string vazia.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tenant_branding_colors_format'
      and conrelid = 'public.tenant_branding'::regclass
  ) then
    alter table public.tenant_branding add constraint tenant_branding_colors_format check (
      (primary_color    is null or primary_color    ~ '^#[0-9a-fA-F]{6}$') and
      (secondary_color  is null or secondary_color  ~ '^#[0-9a-fA-F]{6}$') and
      (accent_color     is null or accent_color     ~ '^#[0-9a-fA-F]{6}$') and
      (background_color is null or background_color ~ '^#[0-9a-fA-F]{6}$') and
      (card_color       is null or card_color       ~ '^#[0-9a-fA-F]{6}$') and
      (text_color       is null or text_color       ~ '^#[0-9a-fA-F]{6}$')
    );
  end if;
end;
$$;

comment on table public.tenant_branding is
  'Identidade visual da otica (white label). Leitura anonima por ser exibida na '
  'tela de login, antes da sessao existir — guarda apenas dado publico.';

drop trigger if exists tenant_branding_set_updated_at on public.tenant_branding;
create trigger tenant_branding_set_updated_at before update on public.tenant_branding
  for each row execute function public.tg_set_updated_at();

-- 2. RLS -----------------------------------------------------------------------
alter table public.tenant_branding enable row level security;
alter table public.tenant_branding force row level security;

-- Recriar é mais seguro que adivinhar o que existe: a regra final é a mesma.
drop policy if exists tenant_branding_public_read   on public.tenant_branding;
drop policy if exists tenant_branding_admin_insert  on public.tenant_branding;
drop policy if exists tenant_branding_admin_update  on public.tenant_branding;
drop policy if exists tenant_branding_admin_delete  on public.tenant_branding;

-- Quem ainda não entrou precisa ver a marca na tela de login.
create policy tenant_branding_public_read on public.tenant_branding
  for select using (true);

create policy tenant_branding_admin_insert on public.tenant_branding
  for insert with check (
    tenant_id = public.current_tenant_id() and public.has_permission('admin.manage')
  );

create policy tenant_branding_admin_update on public.tenant_branding
  for update using (
    tenant_id = public.current_tenant_id() and public.has_permission('admin.manage')
  ) with check (
    tenant_id = public.current_tenant_id() and public.has_permission('admin.manage')
  );

create policy tenant_branding_admin_delete on public.tenant_branding
  for delete using (
    tenant_id = public.current_tenant_id() and public.has_permission('admin.manage')
  );

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on public.tenant_branding to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on public.tenant_branding to authenticated;
  end if;
end;
$$;

-- 3. Resolução do tenant na tela de login --------------------------------------
create or replace function public.branding_for_login(p_slug text default null)
returns table (
  tenant_id uuid,
  slug text,
  trade_name text,
  company_name text,
  short_name text,
  subtitle text,
  logo_url text,
  logo_icon_url text,
  favicon_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  background_color text,
  card_color text,
  text_color text,
  login_image_url text,
  login_background_url text,
  login_headline text,
  login_highlight text,
  login_description text,
  benefit_1 text,
  benefit_2 text,
  benefit_3 text,
  login_footnote text
)
language sql
stable
security definer
set search_path = public
as $$
  with alvo as (
    select t.id, t.slug, t.trade_name
    from public.tenants t
    where t.is_active and t.deleted_at is null
      and (
        (p_slug is not null and t.slug = p_slug::citext)
        or (p_slug is null and (select count(*) from public.tenants x
                                where x.is_active and x.deleted_at is null) = 1)
      )
    limit 1
  )
  select
    a.id, a.slug::text, a.trade_name,
    b.company_name, b.short_name, b.subtitle,
    b.logo_url, b.logo_icon_url, b.favicon_url,
    b.primary_color, b.secondary_color, b.accent_color,
    b.background_color, b.card_color, b.text_color,
    b.login_image_url, b.login_background_url,
    b.login_headline, b.login_highlight, b.login_description,
    b.benefit_1, b.benefit_2, b.benefit_3, b.login_footnote
  from alvo a
  left join public.tenant_branding b on b.tenant_id = a.id;
$$;

comment on function public.branding_for_login(text) is
  'Identidade visual para a tela de login, onde ainda nao ha sessao. Devolve '
  'apenas dado publico de marca; nunca dado operacional.';

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.branding_for_login(text) to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.branding_for_login(text) to authenticated;
  end if;
end;
$$;

-- 4. Storage: bucket das imagens de marca --------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('branding', 'branding', true, 2097152,
            array['image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon'])
    on conflict (id) do update
      set public = true,
          file_size_limit = 2097152,
          allowed_mime_types = array['image/png','image/jpeg','image/webp',
                                     'image/svg+xml','image/x-icon'];

    execute 'drop policy if exists "branding_public_read"  on storage.objects';
    execute 'drop policy if exists "branding_admin_write"  on storage.objects';
    execute 'drop policy if exists "branding_admin_update" on storage.objects';
    execute 'drop policy if exists "branding_admin_delete" on storage.objects';

    -- Leitura pública (a logo aparece antes do login).
    execute $pol$
      create policy "branding_public_read" on storage.objects
        for select using (bucket_id = 'branding')
    $pol$;

    -- Escrita: só administrador, e só dentro da pasta da própria ótica.
    execute $pol$
      create policy "branding_admin_write" on storage.objects
        for insert to authenticated
        with check (
          bucket_id = 'branding'
          and public.has_permission('admin.manage')
          and (storage.foldername(name))[1] = public.current_tenant_id()::text
        )
    $pol$;

    execute $pol$
      create policy "branding_admin_update" on storage.objects
        for update to authenticated
        using (
          bucket_id = 'branding'
          and public.has_permission('admin.manage')
          and (storage.foldername(name))[1] = public.current_tenant_id()::text
        )
    $pol$;

    execute $pol$
      create policy "branding_admin_delete" on storage.objects
        for delete to authenticated
        using (
          bucket_id = 'branding'
          and public.has_permission('admin.manage')
          and (storage.foldername(name))[1] = public.current_tenant_id()::text
        )
    $pol$;
  end if;
end;
$$;

-- 5. Conferência ---------------------------------------------------------------
-- O que aparecer com "FALTA" precisa de atenção; o resto está pronto.
-- A parte do storage é consultada por EXECUTE porque o schema `storage` só
-- existe no Supabase — num Postgres comum a referência direta nem compilaria.
create temporary table _conferencia (ordem int, item text, situacao text);

do $$
declare
  buckets int := 0;
  politicas int := 0;
begin
  insert into _conferencia values
    (1, 'tabela tenant_branding',
        case when to_regclass('public.tenant_branding') is not null then 'OK' else 'FALTA' end),
    (2, 'colunas da tabela (esperado 24)',
        (select case when count(*) >= 24 then 'OK — ' || count(*)::text
                     else 'FALTA — so ' || count(*)::text end
           from information_schema.columns
          where table_schema = 'public' and table_name = 'tenant_branding')),
    (3, 'politicas de acesso (esperado 4)',
        (select case when count(*) = 4 then 'OK' else 'FALTA — ' || count(*)::text end
           from pg_policies where schemaname = 'public' and tablename = 'tenant_branding')),
    (4, 'funcao branding_for_login',
        case when to_regprocedure('public.branding_for_login(text)') is not null
             then 'OK' else 'FALTA' end);

  if to_regclass('storage.buckets') is null then
    insert into _conferencia values
      (5, 'bucket branding no storage', 'sem storage neste banco'),
      (6, 'politicas do bucket (esperado 4)', 'sem storage neste banco');
  else
    execute $q$ select count(*) from storage.buckets where id = 'branding' $q$ into buckets;
    select count(*) into politicas
      from pg_policies
     where schemaname = 'storage' and tablename = 'objects' and policyname like 'branding%';
    insert into _conferencia values
      (5, 'bucket branding no storage', case when buckets = 1 then 'OK' else 'FALTA' end),
      (6, 'politicas do bucket (esperado 4)',
          case when politicas = 4 then 'OK' else 'FALTA — ' || politicas::text end);
  end if;
end;
$$;

select item, situacao from _conferencia order by ordem;
drop table _conferencia;
