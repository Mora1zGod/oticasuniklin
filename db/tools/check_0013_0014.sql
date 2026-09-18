-- =============================================================================
-- CONFERÊNCIA DAS MIGRATIONS 0013 e 0014
-- =============================================================================
-- Somente leitura: não cria, não altera e não apaga nada. Cole no SQL Editor do
-- Supabase e rode. Cada linha diz se um objeto que as migrations deviam ter
-- criado está mesmo lá.
--
-- A última linha é a que mais falha na prática: a ótica dona da plataforma
-- precisa ser marcada à mão depois da 0014.
-- =============================================================================

with checagem(ordem, origem, item, achado, esperado) as (
  values
    -- ---------------------------------------------------------------- 0013 ---
    (1, '0013', 'coluna optical_prescription_measures.fitting_height_mm',
      (select count(*)::int from information_schema.columns
        where table_schema = 'public'
          and table_name = 'optical_prescription_measures'
          and column_name = 'fitting_height_mm'), 1),

    (2, '0013', 'faixa da altura de montagem (5 a 45 mm)',
      (select count(*)::int from pg_constraint
        where conname = 'prescription_measures_fitting_height_range'), 1),

    (3, '0013', 'colunas de adaptação na receita (vértice, pantoscópico, curva)',
      (select count(*)::int from information_schema.columns
        where table_schema = 'public' and table_name = 'optical_prescriptions'
          and column_name in ('vertex_distance_mm', 'pantoscopic_angle_deg',
                              'frame_wrap_angle_deg')), 3),

    (4, '0013', 'faixas das medidas de adaptação',
      (select count(*)::int from pg_constraint
        where conname = 'prescriptions_fitting_ranges'), 1),

    (5, '0013', 'imutabilidade cobre as medidas novas (ADR-002)',
      (select count(*)::int from pg_proc p
        where p.proname = 'tg_prescription_immutable'
          and p.prosrc like '%vertex_distance_mm%'
          and p.prosrc like '%pantoscopic_angle_deg%'
          and p.prosrc like '%frame_wrap_angle_deg%'), 1),

    -- ---------------------------------------------------------------- 0014 ---
    (6, '0014', 'colunas de plataforma em tenants',
      (select count(*)::int from information_schema.columns
        where table_schema = 'public' and table_name = 'tenants'
          and column_name in ('is_platform_owner', 'provider_tenant_id',
                              'subscription_amount', 'subscription_due_day')), 4),

    (7, '0014', 'só pode existir UMA dona da plataforma (índice)',
      (select count(*)::int from pg_class
        where relname = 'tenants_single_platform_owner' and relkind = 'i'), 1),

    (8, '0014', 'um login pode existir em mais de uma ótica (índice novo)',
      (select count(*)::int from pg_class
        where relname = 'app_users_auth_tenant_unique' and relkind = 'i'), 1),

    (9, '0014', 'restrição antiga de um login por ótica foi removida',
      (select count(*)::int from pg_constraint
        where conname = 'app_users_auth_user_id_key'), 0),

    (10, '0014', 'funções da plataforma',
      (select count(*)::int from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('requested_tenant_slug', 'current_app_user_id',
                            'current_tenant_id', 'is_platform_owner',
                            'my_tenants', 'create_client_tenant')), 6),

    (11, '0014', 'o endereço escolhe a ótica (x-tenant-slug em current_tenant_id)',
      (select count(*)::int from pg_proc
        where proname = 'current_tenant_id'
          and prosrc like '%requested_tenant_slug%'), 1),

    (12, '0014', 'tabela platform_invoices',
      (select count(*)::int from pg_class
        where relname = 'platform_invoices' and relkind = 'r'), 1),

    (13, '0014', 'RLS ligada e forçada em platform_invoices',
      (select count(*)::int from pg_class
        where relname = 'platform_invoices'
          and relrowsecurity and relforcerowsecurity), 1),

    (14, '0014', 'política que entrega a cobrança só para a dona',
      (select count(*)::int from pg_policies
        where tablename = 'platform_invoices'
          and policyname = 'platform_invoices_owner_all'), 1),

    (15, '0014', 'políticas da dona sobre as lojas atendidas',
      (select count(*)::int from pg_policies
        where tablename = 'tenants'
          and policyname in ('tenants_platform_owner_read',
                             'tenants_platform_owner_update')), 2),

    (16, '0014', 'app pode chamar as funções da plataforma (grant)',
      (select count(*)::int from information_schema.routine_privileges
        where grantee = 'authenticated' and specific_schema = 'public'
          and routine_name in ('create_client_tenant', 'my_tenants',
                               'is_platform_owner')), 3),

    -- --------------------------------------------------------------- passo ---
    -- Lido por `to_jsonb` de propósito: se a 0014 não passou, a coluna não
    -- existe, e uma referência direta a ela derrubaria a conferência inteira
    -- justamente no banco que mais precisa dela.
    (17, 'passo', 'UMA ótica marcada como dona da plataforma',
      (select count(*)::int from public.tenants t
        where coalesce((to_jsonb(t) ->> 'is_platform_owner')::boolean, false)), 1)
)
select
  origem                                          as "migration",
  item,
  case when achado = esperado then '✅ ok'
       else '❌ FALTA'                            end as "situação",
  case when achado = esperado then ''
       when ordem = 9  then 'rode a 0014 de novo — o trecho que derruba a restrição não passou'
       when ordem = 17 and achado = 0
         then 'rode: update public.tenants set is_platform_owner = true where slug = ''SEU-SLUG'';'
       when ordem = 17 then 'há mais de uma dona marcada — deixe só a sua'
       else 'encontrei ' || achado || ' de ' || esperado || ' — reaplique a migration ' || origem
  end                                             as "o que fazer"
from checagem
order by ordem;
