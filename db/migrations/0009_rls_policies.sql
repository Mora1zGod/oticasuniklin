-- =============================================================================
-- 0009 — ROW LEVEL SECURITY
-- =============================================================================
-- Padrao do produto: o TENANT e a fronteira de isolamento (ADR-008). A FILIAL
-- restringe o ESCOPO OPERACIONAL de documentos (venda, O.S., caixa), mas nunca
-- o cadastro do cliente — a rede precisa enxergar o mesmo cliente em todas as
-- unidades sem duplica-lo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tabelas com tenant_id: isolamento direto
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
  v_nullable boolean;
begin
  for r in
    select c.table_name, c.is_nullable
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'tenant_id'
      and t.table_type = 'BASE TABLE'
    order by c.table_name
  loop
    v_nullable := (r.is_nullable = 'YES');

    execute format('alter table public.%I enable row level security', r.table_name);
    execute format('alter table public.%I force row level security', r.table_name);

    if v_nullable then
      -- catalogos com semente de plataforma: leitura global, escrita so do tenant
      execute format($f$
        create policy %I on public.%I for select
        using (tenant_id = public.current_tenant_id() or tenant_id is null)
      $f$, r.table_name || '_select', r.table_name);

      execute format($f$
        create policy %I on public.%I for insert
        with check (tenant_id = public.current_tenant_id())
      $f$, r.table_name || '_insert', r.table_name);

      execute format($f$
        create policy %I on public.%I for update
        using (tenant_id = public.current_tenant_id())
        with check (tenant_id = public.current_tenant_id())
      $f$, r.table_name || '_update', r.table_name);

      execute format($f$
        create policy %I on public.%I for delete
        using (tenant_id = public.current_tenant_id())
      $f$, r.table_name || '_delete', r.table_name);
    else
      execute format($f$
        create policy %I on public.%I for all
        using (tenant_id = public.current_tenant_id())
        with check (tenant_id = public.current_tenant_id())
      $f$, r.table_name || '_tenant_isolation', r.table_name);
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2) Tabelas-filhas sem tenant_id: herdam o isolamento do pai
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select *
    from (values
      ('individual_profiles',                'customer_id',    'customers'),
      ('company_profiles',                   'customer_id',    'customers'),
      ('frame_attributes',                   'product_id',     'products'),
      ('lens_attributes',                    'product_id',     'products'),
      ('optical_prescription_measures',      'prescription_id','optical_prescriptions'),
      ('service_order_prescription_measures','service_order_prescription_id',
                                             'service_order_prescriptions'),
      ('service_order_fitting_measures',     'service_order_fitting_id',
                                             'service_order_fittings'),
      ('service_order_status_history',       'service_order_id','service_orders'),
      ('lab_order_items',                    'lab_order_id',   'lab_orders'),
      ('customer_credit_movements',          'customer_credit_id','customer_credits'),
      ('price_table_items',                  'price_table_id', 'price_tables'),
      ('price_table_branches',               'price_table_id', 'price_tables'),
      ('role_permissions',                   'role_id',        'roles')
    ) as v(child_table, fk_column, parent_table)
  loop
    execute format('alter table public.%I enable row level security', r.child_table);
    execute format('alter table public.%I force row level security', r.child_table);
    execute format($f$
      create policy %I on public.%I for all
      using (exists (select 1 from public.%I p
                     where p.id = public.%I.%I
                       and (p.tenant_id = public.current_tenant_id()
                            or p.tenant_id is null)))
      with check (exists (select 1 from public.%I p
                          where p.id = public.%I.%I
                            and p.tenant_id = public.current_tenant_id()))
    $f$,
      r.child_table || '_via_parent', r.child_table,
      r.parent_table, r.child_table, r.fk_column,
      r.parent_table, r.child_table, r.fk_column);
  end loop;
end;
$$;

-- lens_product_treatments tem PK composta (product_id, treatment_id)
alter table public.lens_product_treatments enable row level security;
alter table public.lens_product_treatments force row level security;
create policy lens_product_treatments_via_parent on public.lens_product_treatments
  for all
  using (exists (select 1 from public.products p
                 where p.id = lens_product_treatments.product_id
                   and p.tenant_id = public.current_tenant_id()))
  with check (exists (select 1 from public.products p
                      where p.id = lens_product_treatments.product_id
                        and p.tenant_id = public.current_tenant_id()));

-- service_order_lens_treatments tem tenant_id proprio (coberto no bloco 1),
-- mas o vinculo com a O.S. tambem precisa ser valido:
create policy service_order_lens_treatments_parent_check
  on public.service_order_lens_treatments
  as restrictive
  for all
  using (exists (select 1
                 from public.service_order_lens_specs s
                 where s.id = service_order_lens_treatments.lens_spec_id
                   and s.tenant_id = public.current_tenant_id()));

-- -----------------------------------------------------------------------------
-- 3) Tabelas de identidade e plataforma
-- -----------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.tenants force row level security;
create policy tenants_self on public.tenants
  for select using (id = public.current_tenant_id());

alter table public.catalog_definitions enable row level security;
create policy catalog_definitions_read on public.catalog_definitions
  for select using (true);

alter table public.user_branch_access enable row level security;
alter table public.user_branch_access force row level security;
create policy user_branch_access_tenant on public.user_branch_access
  for all
  using (exists (select 1 from public.app_users u
                 where u.id = user_branch_access.app_user_id
                   and u.tenant_id = public.current_tenant_id()))
  with check (exists (select 1 from public.app_users u
                      where u.id = user_branch_access.app_user_id
                        and u.tenant_id = public.current_tenant_id()));

-- -----------------------------------------------------------------------------
-- 4) Escopo operacional por FILIAL (restritivo, empilha com o isolamento acima)
-- -----------------------------------------------------------------------------
-- Documentos operacionais so aparecem para quem opera na filial. O CLIENTE
-- deliberadamente NAO entra nesta lista (ADR-008).
do $$
declare
  t text;
begin
  foreach t in array array[
    'quotes','sales','service_orders','lab_orders','receivables',
    'receivable_settlements','payables','commissions','stock_balances',
    'stock_movements','document_sequences'
  ]
  loop
    execute format($f$
      create policy %I on public.%I
      as restrictive for all
      using (public.user_can_access_branch(branch_id))
      with check (public.user_can_access_branch(branch_id))
    $f$, t || '_branch_scope', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5) Dado clinico e sensivel: exige permissao explicita (LGPD)
-- -----------------------------------------------------------------------------
create policy optical_prescriptions_clinical_permission
  on public.optical_prescriptions
  as restrictive for all
  using (public.has_permission('clinical.prescription.read'))
  with check (public.has_permission('clinical.prescription.write'));

create policy customer_consents_permission
  on public.customer_consents
  as restrictive for all
  using (public.has_permission('customer.consent.read'))
  with check (public.has_permission('customer.consent.write'));

-- -----------------------------------------------------------------------------
-- 6) Grants para os papeis do Supabase (quando existirem)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema public to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant execute on all functions in schema public to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant usage on schema public to anon;
  end if;
end;
$$;
