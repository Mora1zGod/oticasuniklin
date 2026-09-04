-- =============================================================================
-- SHIM DE VALIDACAO LOCAL — NAO APLICAR NO SUPABASE
-- =============================================================================
-- O Supabase ja fornece o schema `auth` (auth.users, auth.uid(), auth.role()).
-- Este arquivo recria o minimo necessario para que as migrations do diretorio
-- db/migrations sejam validadas em um Postgres local (psql -f).
-- =============================================================================

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

-- Papeis que o Supabase ja fornece
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$$;
