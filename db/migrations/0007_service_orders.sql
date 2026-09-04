-- =============================================================================
-- 0007 — ORDEM DE SERVICO: SNAPSHOT DA RECEITA, MEDIDAS DE MONTAGEM E LENTE
-- =============================================================================
-- Itens 1, 2, 3 e 12 do briefing.
--
-- Cadeia obrigatoria:
--   O.S. -> RECEITA UTILIZADA (snapshot imutavel)
--        -> MEDIDAS DE MONTAGEM (DNP de montagem, altura, DP total)
--        -> ESPECIFICACAO DA LENTE (tipo, material, indice, tratamento)
--        -> PRODUTO/PRECO (itens da venda)
--        -> LABORATORIO (pedido de surfacagem)
--
-- A O.S. NUNCA le a receita "ao vivo": ela le o proprio snapshot. Cadastrar R2
-- seis meses depois nao altera a O.S. #100 (ADR-002).
-- =============================================================================

create table public.service_orders (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  branch_id             uuid not null references public.branches(id),
  number                bigint not null,

  -- O.S. SEMPRE tem cliente identificado (ADR-009): producao, garantia,
  -- entrega e aviso ao cliente dependem disso.
  customer_id           uuid not null,
  sale_id               uuid references public.sales(id),

  status_id             uuid not null references public.service_order_statuses(id),
  priority              text not null default 'normal'
                        check (priority in ('low','normal','high','urgent')),

  -- Origem da armacao (define se ha baixa de estoque)
  frame_source          text not null default 'store_stock'
                        check (frame_source in ('store_stock','customer_own','supplier_direct')),
  frame_product_id      uuid,
  frame_sale_item_id    uuid,
  frame_description     text,           -- usado quando a armacao e do cliente

  opened_at             timestamptz not null default now(),
  promised_at           timestamptz,
  delivered_at          timestamptz,
  delivered_to_name     text,
  delivered_to_document text,
  cancelled_at          timestamptz,
  cancel_reason         text,
  notes                 text,

  created_by            uuid references public.app_users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint service_orders_id_tenant_unique unique (id, tenant_id),
  constraint service_orders_number_unique unique (branch_id, number),
  constraint service_orders_customer_fk
    foreign key (customer_id, tenant_id) references public.customers(id, tenant_id),
  constraint service_orders_sale_fk
    foreign key (sale_id, tenant_id) references public.sales(id, tenant_id),
  constraint service_orders_frame_product_fk
    foreign key (frame_product_id, tenant_id) references public.products(id, tenant_id),
  constraint service_orders_frame_item_fk
    foreign key (frame_sale_item_id, tenant_id) references public.sale_items(id, tenant_id),
  constraint service_orders_frame_source_consistency
    check ((frame_source = 'store_stock') = (frame_product_id is not null)),
  constraint service_orders_cancel_reason
    check ((cancelled_at is not null) = (cancel_reason is not null))
);

create index service_orders_customer_idx on public.service_orders (customer_id, opened_at desc);
create index service_orders_status_idx on public.service_orders (branch_id, status_id);
create index service_orders_sale_idx on public.service_orders (sale_id);

-- A O.S. exige venda com cliente identificado (coerencia com ADR-009)
create or replace function public.tg_service_order_requires_identified_sale()
returns trigger
language plpgsql
as $$
declare
  v_sale public.sales%rowtype;
begin
  if new.sale_id is not null then
    select * into v_sale from public.sales where id = new.sale_id;
    if v_sale.customer_id is null then
      raise exception 'Venda avulsa (anonima) nao pode gerar O.S. (ADR-009).'
        using errcode = 'check_violation';
    end if;
    if v_sale.customer_id <> new.customer_id then
      raise exception 'Cliente da O.S. difere do cliente da venda %', new.sale_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger service_orders_identified_sale
  before insert or update on public.service_orders
  for each row execute function public.tg_service_order_requires_identified_sale();

-- -----------------------------------------------------------------------------
-- 1) RECEITA UTILIZADA — SNAPSHOT IMUTAVEL (ADR-002)
-- -----------------------------------------------------------------------------
create table public.service_order_prescriptions (
  id                        uuid primary key default gen_random_uuid(),
  service_order_id          uuid not null references public.service_orders(id) on delete cascade,
  tenant_id                 uuid not null,

  -- rastreabilidade da origem; RESTRICT impede apagar a receita historica
  source_prescription_id    uuid references public.optical_prescriptions(id) on delete restrict,
  source_revision           integer,
  snapshot_taken_at         timestamptz not null default now(),

  -- valores COPIADOS no momento do uso (nao sao lidos da receita depois)
  issued_at                 date not null,
  prescriber_name           text,
  prescriber_council        text,
  vision_use                text not null,
  cylinder_notation         text not null default 'negative'
                            check (cylinder_notation in ('negative','positive')),

  -- quando o valor produzido diferiu do prescrito (adaptacao, transposicao)
  is_adjusted               boolean not null default false,
  adjustment_reason         text,

  created_by                uuid references public.app_users(id),
  created_at                timestamptz not null default now(),

  constraint service_order_prescriptions_unique unique (service_order_id),
  constraint service_order_prescriptions_adjustment
    check (is_adjusted = false or adjustment_reason is not null)
);

comment on table public.service_order_prescriptions is
  'Receita EFETIVAMENTE UTILIZADA na producao desta O.S. Copia congelada: '
  'editar ou substituir a receita de origem nao altera esta linha (ADR-002).';

create table public.service_order_prescription_measures (
  id                        uuid primary key default gen_random_uuid(),
  service_order_prescription_id uuid not null
                            references public.service_order_prescriptions(id) on delete cascade,
  eye                       text not null check (eye in ('OD','OS')),
  vision_zone               text not null default 'far'
                            check (vision_zone in ('far','near','intermediate')),
  sphere_dpt                numeric(5,2),
  cylinder_dpt              numeric(5,2),
  axis_deg                  smallint check (axis_deg between 0 and 180),
  addition_dpt              numeric(4,2),
  prism_horizontal_pd       numeric(4,2),
  prism_horizontal_base     text check (prism_horizontal_base in ('in','out')),
  prism_vertical_pd         numeric(4,2),
  prism_vertical_base       text check (prism_vertical_base in ('up','down')),
  -- DNP CLINICO copiado da receita (nao e a medida de montagem — ADR-007)
  dnp_mm                    numeric(4,1),
  created_at                timestamptz not null default now(),
  constraint so_prescription_measures_unique
    unique (service_order_prescription_id, eye, vision_zone)
);

-- -----------------------------------------------------------------------------
-- 2) MEDIDAS DE MONTAGEM — DNP de montagem, altura, DP total (ADR-007)
-- -----------------------------------------------------------------------------
create table public.service_order_fittings (
  id                        uuid primary key default gen_random_uuid(),
  service_order_id          uuid not null references public.service_orders(id) on delete cascade,
  tenant_id                 uuid not null,

  -- DP TOTAL: soma binocular usada em montagens simples/legado. NAO substitui a
  -- DNP por olho: em face assimetrica, DNP_OD + DNP_OS <> DP util por olho.
  dp_total_mm               numeric(4,1) check (dp_total_mm is null or dp_total_mm between 30 and 90),
  dp_source                 text not null default 'measured'
                            check (dp_source in ('measured','derived_from_dnp','from_prescription')),

  -- caixa da armacao efetivamente usada (fonte da descentracao)
  frame_lens_width_mm       numeric(4,1),
  frame_bridge_mm           numeric(4,1),
  frame_vertical_box_mm     numeric(4,1),
  frame_diagonal_mm         numeric(4,1),

  vertex_distance_mm        numeric(4,1),
  pantoscopic_tilt_deg      numeric(4,1),
  wrap_angle_deg            numeric(4,1),

  measurement_method        text not null default 'manual'
                            check (measurement_method in ('manual','pupilometer','digital_photo','app')),
  measured_by               uuid references public.app_users(id),
  measured_at               timestamptz not null default now(),
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint service_order_fittings_unique unique (service_order_id)
);

comment on table public.service_order_fittings is
  'Medidas de montagem da O.S. DP total e medida de MONTAGEM/legado; DNP por '
  'olho e medida CLINICA/OPTICA. Semanticamente distintas (ADR-007).';

create table public.service_order_fitting_measures (
  id                        uuid primary key default gen_random_uuid(),
  service_order_fitting_id  uuid not null
                            references public.service_order_fittings(id) on delete cascade,
  eye                       text not null check (eye in ('OD','OS')),

  -- DNP de MONTAGEM: distancia naso-pupilar aferida contra a armacao escolhida.
  -- Pode divergir da DNP da receita (postura, armacao, tecnica de medicao).
  dnp_mm                    numeric(4,1) not null check (dnp_mm between 15 and 45),
  -- ALTURA por olho: obrigatoria em multifocal/progressiva
  fitting_height_mm         numeric(4,1) check (fitting_height_mm between 5 and 45),
  near_dnp_mm               numeric(4,1),
  horizontal_decentration_mm numeric(5,2),
  vertical_decentration_mm  numeric(5,2),
  notes                     text,
  created_at                timestamptz not null default now(),
  constraint so_fitting_measures_unique unique (service_order_fitting_id, eye)
);

comment on column public.service_order_fitting_measures.dnp_mm is
  'DNP usada na montagem. NAO e o mesmo campo da receita: a receita prescreve, '
  'a montagem afere contra a armacao real (ADR-007).';

-- -----------------------------------------------------------------------------
-- 3) ESPECIFICACAO DA LENTE — escolha comercial/tecnica, por olho
-- -----------------------------------------------------------------------------
create table public.service_order_lens_specs (
  id                        uuid primary key default gen_random_uuid(),
  service_order_id          uuid not null references public.service_orders(id) on delete cascade,
  tenant_id                 uuid not null,
  eye                       text not null check (eye in ('OD','OS')),

  -- produto vendido (liga preco/estoque/comissao)
  product_id                uuid,
  sale_item_id              uuid,

  -- atributos congelados no momento do pedido (o catalogo pode mudar depois)
  lens_type_id              uuid references public.lens_types(id),
  lens_material_id          uuid references public.lens_materials(id),
  lens_type_label           text,
  lens_material_label       text,
  manufacturer_name         text,
  product_line              text,
  refractive_index          numeric(4,3) check (refractive_index is null
                                                or refractive_index between 1.400 and 2.200),
  design                    text check (design in ('spherical','aspheric','bi_aspheric',
                                                   'freeform','digital')),
  supply_mode               text not null default 'surfaced'
                            check (supply_mode in ('stock','surfaced')),
  diameter_mm               numeric(4,1),
  base_curve                numeric(4,2),
  tint_description          text,
  laboratory_id             uuid references public.laboratories(id),

  unit_cost                 numeric(12,2),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint service_order_lens_specs_unique unique (service_order_id, eye),
  constraint so_lens_specs_id_tenant_unique unique (id, tenant_id),
  constraint so_lens_specs_product_fk
    foreign key (product_id, tenant_id) references public.products(id, tenant_id),
  constraint so_lens_specs_sale_item_fk
    foreign key (sale_item_id, tenant_id) references public.sale_items(id, tenant_id)
);

comment on table public.service_order_lens_specs is
  'O QUE FOI VENDIDO E FABRICADO. Tipo, material, indice, tratamento e '
  'fabricante vivem AQUI — nunca na receita clinica (ADR-001).';

create table public.service_order_lens_treatments (
  id                        uuid primary key default gen_random_uuid(),
  lens_spec_id              uuid not null
                            references public.service_order_lens_specs(id) on delete cascade,
  treatment_id              uuid references public.lens_treatments(id),
  treatment_label           text not null,       -- snapshot do rotulo
  sale_item_id              uuid,
  tenant_id                 uuid not null,
  created_at                timestamptz not null default now(),
  constraint so_lens_treatments_unique unique (lens_spec_id, treatment_label),
  constraint so_lens_treatments_sale_item_fk
    foreign key (sale_item_id, tenant_id) references public.sale_items(id, tenant_id)
);

-- Regra optica: lente progressiva/bifocal exige altura de montagem e adicao
create or replace function public.tg_lens_spec_requires_fitting_height()
returns trigger
language plpgsql
as $$
declare
  v_requires_height boolean;
  v_requires_add    boolean;
  v_height          numeric;
  v_addition        numeric;
begin
  if new.lens_type_id is null then
    return new;
  end if;

  select requires_fitting_height, requires_addition
    into v_requires_height, v_requires_add
    from public.lens_types where id = new.lens_type_id;

  if coalesce(v_requires_height, false) then
    select m.fitting_height_mm into v_height
    from public.service_order_fitting_measures m
    join public.service_order_fittings f on f.id = m.service_order_fitting_id
    where f.service_order_id = new.service_order_id and m.eye = new.eye;

    if v_height is null then
      raise exception
        'Lente do olho % exige altura de montagem informada na O.S. %',
        new.eye, new.service_order_id using errcode = 'check_violation';
    end if;
  end if;

  if coalesce(v_requires_add, false) then
    select max(m.addition_dpt) into v_addition
    from public.service_order_prescription_measures m
    join public.service_order_prescriptions p
      on p.id = m.service_order_prescription_id
    where p.service_order_id = new.service_order_id and m.eye = new.eye;

    if coalesce(v_addition, 0) <= 0 then
      raise exception
        'Lente multifocal/bifocal do olho % exige adicao na receita utilizada da O.S. %',
        new.eye, new.service_order_id using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create constraint trigger service_order_lens_specs_optical_rules
  after insert or update on public.service_order_lens_specs
  deferrable initially deferred
  for each row execute function public.tg_lens_spec_requires_fitting_height();

-- -----------------------------------------------------------------------------
-- 4) LABORATORIO
-- -----------------------------------------------------------------------------
create table public.lab_orders (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,
  branch_id                 uuid not null references public.branches(id),
  service_order_id          uuid not null references public.service_orders(id) on delete restrict,
  laboratory_id             uuid not null references public.laboratories(id),
  number                    bigint not null,
  external_number           text,
  status                    text not null default 'draft'
                            check (status in ('draft','sent','acknowledged','in_production',
                                              'shipped','received','rejected','cancelled')),
  sent_at                   timestamptz,
  expected_at               timestamptz,
  received_at               timestamptz,
  total_cost                numeric(12,2) check (total_cost is null or total_cost >= 0),
  rejection_reason          text,
  notes                     text,
  created_by                uuid references public.app_users(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint lab_orders_number_unique unique (branch_id, number)
);

create index lab_orders_service_order_idx on public.lab_orders (service_order_id);
create index lab_orders_status_idx on public.lab_orders (laboratory_id, status);

create table public.lab_order_items (
  id                        uuid primary key default gen_random_uuid(),
  lab_order_id              uuid not null references public.lab_orders(id) on delete cascade,
  lens_spec_id              uuid not null references public.service_order_lens_specs(id) on delete restrict,
  eye                       text not null check (eye in ('OD','OS')),
  cost                      numeric(12,2),
  created_at                timestamptz not null default now(),
  constraint lab_order_items_unique unique (lab_order_id, eye)
);

-- -----------------------------------------------------------------------------
-- 5) HISTORICO DE STATUS (a producao percorrida)
-- -----------------------------------------------------------------------------
create table public.service_order_status_history (
  id                        uuid primary key default gen_random_uuid(),
  service_order_id          uuid not null references public.service_orders(id) on delete cascade,
  from_status_id            uuid references public.service_order_statuses(id),
  to_status_id              uuid not null references public.service_order_statuses(id),
  changed_by                uuid references public.app_users(id),
  changed_at                timestamptz not null default now(),
  notes                     text
);

create index so_status_history_idx
  on public.service_order_status_history (service_order_id, changed_at desc);

create or replace function public.tg_service_order_status_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.service_order_status_history (service_order_id, to_status_id, changed_by)
    values (new.id, new.status_id, new.created_by);
  elsif new.status_id is distinct from old.status_id then
    if not exists (
      select 1 from public.service_order_status_transitions t
      where t.from_status_id = old.status_id and t.to_status_id = new.status_id
    ) then
      raise exception 'Transicao de status nao permitida para a O.S. %', new.id
        using errcode = 'check_violation';
    end if;
    insert into public.service_order_status_history
      (service_order_id, from_status_id, to_status_id, changed_by)
    values (new.id, old.status_id, new.status_id, public.current_app_user_id());
  end if;
  return new;
end;
$$;

create trigger service_orders_status_history
  after insert or update of status_id on public.service_orders
  for each row execute function public.tg_service_order_status_history();

-- -----------------------------------------------------------------------------
-- IMUTABILIDADE DO SNAPSHOT
-- -----------------------------------------------------------------------------
create or replace function public.tg_so_snapshot_immutable()
returns trigger
language plpgsql
as $$
declare
  v_so_id  uuid;
  v_stage  text;
begin
  if tg_table_name = 'service_order_prescriptions' then
    v_so_id := coalesce(new.service_order_id, old.service_order_id);
  else
    select service_order_id into v_so_id
    from public.service_order_prescriptions
    where id = coalesce(new.service_order_prescription_id, old.service_order_prescription_id);
  end if;

  select s.stage into v_stage
  from public.service_orders so
  join public.service_order_statuses s on s.id = so.status_id
  where so.id = v_so_id;

  if v_stage is distinct from 'draft' then
    raise exception
      'Receita utilizada da O.S. % e imutavel apos o inicio da producao '
      '(estagio atual: %). Abra uma nova O.S. ou registre um retrabalho.',
      v_so_id, v_stage using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger service_order_prescriptions_immutable
  before update or delete on public.service_order_prescriptions
  for each row execute function public.tg_so_snapshot_immutable();

create trigger service_order_prescription_measures_immutable
  before update or delete on public.service_order_prescription_measures
  for each row execute function public.tg_so_snapshot_immutable();

-- -----------------------------------------------------------------------------
-- FUNCAO DE SNAPSHOT — o unico caminho suportado para "usar" uma receita
-- -----------------------------------------------------------------------------
create or replace function public.take_prescription_snapshot(
  p_service_order_id uuid,
  p_prescription_id  uuid,
  p_created_by       uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_so    public.service_orders%rowtype;
  v_pres  public.optical_prescriptions%rowtype;
  v_snap  uuid;
begin
  select * into v_so from public.service_orders where id = p_service_order_id;
  if not found then
    raise exception 'O.S. % nao encontrada', p_service_order_id;
  end if;

  select * into v_pres from public.optical_prescriptions where id = p_prescription_id;
  if not found then
    raise exception 'Receita % nao encontrada', p_prescription_id;
  end if;

  if v_pres.customer_id <> v_so.customer_id then
    raise exception 'A receita % pertence a outro cliente', p_prescription_id;
  end if;
  if v_pres.status not in ('active','superseded') then
    raise exception 'Receita % com status % nao pode ser usada em producao',
      p_prescription_id, v_pres.status;
  end if;

  insert into public.service_order_prescriptions (
    service_order_id, tenant_id, source_prescription_id, source_revision,
    issued_at, prescriber_name, prescriber_council, vision_use, cylinder_notation,
    created_by
  )
  values (
    p_service_order_id, v_so.tenant_id, v_pres.id, v_pres.revision,
    v_pres.issued_at,
    coalesce(v_pres.prescriber_name_snapshot,
             (select full_name from public.prescribers where id = v_pres.prescriber_id)),
    coalesce(v_pres.prescriber_council_snapshot,
             (select council_type || ' ' || council_number || '/' || council_state
                from public.prescribers where id = v_pres.prescriber_id)),
    v_pres.vision_use, v_pres.cylinder_notation,
    coalesce(p_created_by, public.current_app_user_id())
  )
  returning id into v_snap;

  insert into public.service_order_prescription_measures (
    service_order_prescription_id, eye, vision_zone, sphere_dpt, cylinder_dpt, axis_deg,
    addition_dpt, prism_horizontal_pd, prism_horizontal_base,
    prism_vertical_pd, prism_vertical_base, dnp_mm
  )
  select
    v_snap, m.eye, m.vision_zone, m.sphere_dpt, m.cylinder_dpt, m.axis_deg,
    m.addition_dpt, m.prism_horizontal_pd, m.prism_horizontal_base,
    m.prism_vertical_pd, m.prism_vertical_base, m.dnp_mm
  from public.optical_prescription_measures m
  where m.prescription_id = p_prescription_id;

  return v_snap;
end;
$$;

comment on function public.take_prescription_snapshot(uuid, uuid, uuid) is
  'Congela a receita na O.S. Depois disso a O.S. e autossuficiente: novas '
  'versoes da receita (R2, R3...) nao alteram producoes passadas (ADR-002).';

-- -----------------------------------------------------------------------------
-- VISAO OPERACIONAL DA O.S. (o que a tela de producao mostra)
-- -----------------------------------------------------------------------------
create or replace view public.v_service_order_production as
select
  so.id                                as service_order_id,
  so.tenant_id,
  so.branch_id,
  so.number,
  so.customer_id,
  c.display_name                       as customer_name,
  st.code                              as status_code,
  st.stage                             as status_stage,
  so.opened_at,
  so.promised_at,
  so.delivered_at,
  sop.source_prescription_id,
  sop.source_revision,
  sop.issued_at                        as prescription_issued_at,
  sop.prescriber_name,
  -- grau EFETIVAMENTE usado (snapshot), nunca a receita vigente
  max(spm.sphere_dpt)   filter (where spm.eye = 'OD' and spm.vision_zone = 'far') as od_sphere_used,
  max(spm.cylinder_dpt) filter (where spm.eye = 'OD' and spm.vision_zone = 'far') as od_cylinder_used,
  max(spm.axis_deg)     filter (where spm.eye = 'OD' and spm.vision_zone = 'far') as od_axis_used,
  max(spm.addition_dpt) filter (where spm.eye = 'OD')                             as od_addition_used,
  max(spm.sphere_dpt)   filter (where spm.eye = 'OS' and spm.vision_zone = 'far') as os_sphere_used,
  max(spm.cylinder_dpt) filter (where spm.eye = 'OS' and spm.vision_zone = 'far') as os_cylinder_used,
  max(spm.axis_deg)     filter (where spm.eye = 'OS' and spm.vision_zone = 'far') as os_axis_used,
  max(spm.addition_dpt) filter (where spm.eye = 'OS')                             as os_addition_used,
  -- DNP clinica (receita) x DNP de montagem (O.S.) lado a lado (ADR-007)
  max(spm.dnp_mm)       filter (where spm.eye = 'OD' and spm.vision_zone = 'far') as od_dnp_prescribed,
  max(spm.dnp_mm)       filter (where spm.eye = 'OS' and spm.vision_zone = 'far') as os_dnp_prescribed,
  max(fm.dnp_mm)        filter (where fm.eye = 'OD')                              as od_dnp_fitting,
  max(fm.dnp_mm)        filter (where fm.eye = 'OS')                              as os_dnp_fitting,
  max(fm.fitting_height_mm) filter (where fm.eye = 'OD')                          as od_height,
  max(fm.fitting_height_mm) filter (where fm.eye = 'OS')                          as os_height,
  f.dp_total_mm,
  f.dp_source
from public.service_orders so
join public.customers c on c.id = so.customer_id
join public.service_order_statuses st on st.id = so.status_id
left join public.service_order_prescriptions sop on sop.service_order_id = so.id
left join public.service_order_prescription_measures spm
       on spm.service_order_prescription_id = sop.id
left join public.service_order_fittings f on f.service_order_id = so.id
left join public.service_order_fitting_measures fm on fm.service_order_fitting_id = f.id
group by so.id, c.display_name, st.code, st.stage, sop.source_prescription_id,
         sop.source_revision, sop.issued_at, sop.prescriber_name,
         f.dp_total_mm, f.dp_source;

create trigger service_orders_set_updated_at before update on public.service_orders
  for each row execute function public.tg_set_updated_at();
create trigger service_order_fittings_set_updated_at before update on public.service_order_fittings
  for each row execute function public.tg_set_updated_at();
create trigger service_order_lens_specs_set_updated_at before update on public.service_order_lens_specs
  for each row execute function public.tg_set_updated_at();
create trigger lab_orders_set_updated_at before update on public.lab_orders
  for each row execute function public.tg_set_updated_at();
