-- =============================================================================
-- 0012 — IDENTIDADE VISUAL POR EMPRESA (white label)
-- =============================================================================
-- Cada ótica personaliza nome, logo, cores e os textos da tela de login.
--
-- Por que tabela separada e não colunas em `tenants`: `tenants` é o agregador
-- enxuto do produto (ADR-004) e branding tem ciclo de vida próprio — muda com
-- frequência, é editado por outra tela e, principalmente, precisa de uma regra
-- de acesso DIFERENTE (leitura anônima).
--
-- A tela de login acontece ANTES da sessão existir: `current_tenant_id()` é
-- nulo ali. Por isso esta tabela — e só ela — permite SELECT anônimo. O que ela
-- guarda é público por natureza: logo, cores e texto de marketing aparecem para
-- qualquer visitante. Nenhum dado pessoal, fiscal ou operacional entra aqui.
-- =============================================================================

create table public.tenant_branding (
  tenant_id             uuid primary key references public.tenants(id) on delete cascade,

  -- Identidade ------------------------------------------------------------
  company_name          text,
  short_name            text,
  subtitle              text,
  logo_url              text,
  logo_icon_url         text,
  favicon_url           text,

  -- Cores (qualquer cor CSS válida; a UI oferece seletor hexadecimal) ------
  primary_color         text,
  secondary_color       text,
  accent_color          text,
  background_color      text,
  card_color            text,
  text_color            text,

  -- Tela de login ---------------------------------------------------------
  login_image_url       text,
  login_background_url  text,
  login_headline        text,
  login_highlight       text,
  login_description     text,
  benefit_1             text,
  benefit_2             text,
  benefit_3             text,
  login_footnote        text,

  updated_by            uuid references public.app_users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Cor vazia é ausência de personalização, não string vazia.
  constraint tenant_branding_colors_format check (
    (primary_color     is null or primary_color     ~ '^#[0-9a-fA-F]{6}$') and
    (secondary_color   is null or secondary_color   ~ '^#[0-9a-fA-F]{6}$') and
    (accent_color      is null or accent_color      ~ '^#[0-9a-fA-F]{6}$') and
    (background_color  is null or background_color  ~ '^#[0-9a-fA-F]{6}$') and
    (card_color        is null or card_color        ~ '^#[0-9a-fA-F]{6}$') and
    (text_color        is null or text_color        ~ '^#[0-9a-fA-F]{6}$')
  )
);

comment on table public.tenant_branding is
  'Identidade visual da otica (white label). Leitura anonima por ser exibida na '
  'tela de login, antes da sessao existir — guarda apenas dado publico.';

create trigger tenant_branding_set_updated_at before update on public.tenant_branding
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS: leitura pública, escrita só de quem administra a própria ótica
-- -----------------------------------------------------------------------------
alter table public.tenant_branding enable row level security;
alter table public.tenant_branding force row level security;

-- Quem ainda não entrou precisa ver a marca na tela de login.
create policy tenant_branding_public_read on public.tenant_branding
  for select
  using (true);

create policy tenant_branding_admin_insert on public.tenant_branding
  for insert
  with check (
    tenant_id = public.current_tenant_id()
    and public.has_permission('admin.manage')
  );

create policy tenant_branding_admin_update on public.tenant_branding
  for update
  using (
    tenant_id = public.current_tenant_id()
    and public.has_permission('admin.manage')
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.has_permission('admin.manage')
  );

create policy tenant_branding_admin_delete on public.tenant_branding
  for delete
  using (
    tenant_id = public.current_tenant_id()
    and public.has_permission('admin.manage')
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

-- -----------------------------------------------------------------------------
-- Resolução do tenant na tela de login
-- -----------------------------------------------------------------------------
-- O app ainda não tem sessão ali, então precisa descobrir de quem é a marca.
-- Ordem: slug informado (subdomínio ou ?otica=) e, se não vier nenhum e a
-- instalação tiver uma única ótica ativa, essa mesma.
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

-- -----------------------------------------------------------------------------
-- Storage: bucket público para as imagens de marca
-- -----------------------------------------------------------------------------
-- Guardado por IF EXISTS porque o schema `storage` só existe no Supabase — a
-- validação local (db/tools/validate.sh) roda em Postgres puro.
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
exception
  when duplicate_object then
    null;  -- politicas ja existiam
end;
$$;
