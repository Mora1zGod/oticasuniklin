-- =============================================================================
-- 0004 — RECEITA OFTALMOLOGICA (PRESCRICAO CLINICA)
-- =============================================================================
-- Item 1 do briefing / ADR-001: RECEITA NAO E LENTE.
--
-- Esta tabela representa EXCLUSIVAMENTE a prescricao clinica emitida por um
-- prescritor. E PROIBIDO adicionar aqui qualquer um dos campos abaixo:
--
--     tipo de lente, fabricante, material, indice de refracao, tratamento,
--     coloracao, diametro, curva base, laboratorio, produto, preco.
--
-- Todos esses atributos sao ESCOLHA COMERCIAL/TECNICA e vivem em
-- service_order_lens_specs (migration 0007). A receita responde "qual e o grau
-- do paciente"; a lente responde "o que foi vendido e fabricado".
--
-- Item 2 / ADR-002: a receita e IMUTAVEL apos emitida. Correcao gera nova versao
-- encadeada (supersedes_prescription_id), preservando o historico do cliente.
--
-- Item 3 / ADR-007: aqui existe DNP POR OLHO (medida clinica). DP total e
-- medidas de montagem NAO ficam aqui — ficam na O.S.
-- =============================================================================

create table public.optical_prescriptions (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,
  customer_id               uuid not null,

  -- Proveniencia
  branch_id                 uuid references public.branches(id),   -- onde foi registrada
  prescriber_id             uuid references public.prescribers(id),
  -- snapshot do prescritor no momento do registro (o cadastro dele pode mudar)
  prescriber_name_snapshot  text,
  prescriber_council_snapshot text,

  source                    text not null default 'external_document'
                            check (source in ('external_document','in_store_exam','customer_report')),

  issued_at                 date not null,                          -- data da receita
  valid_until               date,
  purpose                   text not null default 'eyeglasses'
                            check (purpose in ('eyeglasses','contact_lenses','both')),
  vision_use                text not null default 'far'
                            check (vision_use in ('far','near','multifocal','bifocal',
                                                  'occupational','intermediate')),
  -- convencao de cilindro em que a receita foi ESCRITA (nao transpor no banco)
  cylinder_notation         text not null default 'negative'
                            check (cylinder_notation in ('negative','positive')),

  -- Versionamento (ADR-002)
  status                    text not null default 'draft'
                            check (status in ('draft','active','superseded','void')),
  revision                  integer not null default 1 check (revision >= 1),
  root_prescription_id      uuid references public.optical_prescriptions(id),
  supersedes_prescription_id uuid references public.optical_prescriptions(id),
  void_reason               text,

  clinical_notes            text,
  attachment_id             uuid references public.customer_attachments(id),

  created_by                uuid references public.app_users(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint optical_prescriptions_id_tenant_unique unique (id, tenant_id),
  constraint optical_prescriptions_customer_fk
    foreign key (customer_id, tenant_id) references public.customers(id, tenant_id) on delete cascade,
  constraint optical_prescriptions_validity
    check (valid_until is null or valid_until >= issued_at),
  constraint optical_prescriptions_issue_sane
    check (issued_at > date '1950-01-01'),
  constraint optical_prescriptions_void_reason
    check ((status = 'void') = (void_reason is not null)),
  constraint optical_prescriptions_no_self_supersede
    check (supersedes_prescription_id is null or supersedes_prescription_id <> id)
);

create index optical_prescriptions_customer_idx
  on public.optical_prescriptions (customer_id, issued_at desc);
create index optical_prescriptions_root_idx
  on public.optical_prescriptions (root_prescription_id);
create unique index optical_prescriptions_single_active_revision
  on public.optical_prescriptions (root_prescription_id)
  where status = 'active';

comment on table public.optical_prescriptions is
  'Prescricao clinica do cliente. NAO contem lente, material, indice, tratamento, '
  'fabricante nem preco (ADR-001). Imutavel apos ativacao (ADR-002).';

-- -----------------------------------------------------------------------------
-- Medidas por olho — inclui DNP clinico (item 3)
-- -----------------------------------------------------------------------------
create table public.optical_prescription_measures (
  id                    uuid primary key default gen_random_uuid(),
  prescription_id       uuid not null references public.optical_prescriptions(id) on delete cascade,
  -- OD = olho direito, OS = olho esquerdo (nomenclatura clinica internacional)
  eye                   text not null check (eye in ('OD','OS')),
  vision_zone           text not null default 'far'
                        check (vision_zone in ('far','near','intermediate')),

  sphere_dpt            numeric(5,2),               -- esferico
  cylinder_dpt          numeric(5,2),               -- cilindrico
  axis_deg              smallint check (axis_deg between 0 and 180),
  addition_dpt          numeric(4,2) check (addition_dpt is null or addition_dpt >= 0),

  prism_horizontal_pd   numeric(4,2),
  prism_horizontal_base text check (prism_horizontal_base in ('in','out')),
  prism_vertical_pd     numeric(4,2),
  prism_vertical_base   text check (prism_vertical_base in ('up','down')),

  -- DNP: Distancia Naso-Pupilar DESTE olho, medida clinica prescrita.
  -- NAO confundir com DP total nem com as medidas de montagem da O.S. (ADR-007).
  dnp_mm                numeric(4,1) check (dnp_mm is null or dnp_mm between 15 and 45),

  visual_acuity         text,                        -- ex.: '20/20', '0,8'
  notes                 text,
  created_at            timestamptz not null default now(),

  constraint prescription_measures_unique unique (prescription_id, eye, vision_zone),
  constraint prescription_measures_axis_requires_cylinder
    check (cylinder_dpt is null or cylinder_dpt = 0 or axis_deg is not null),
  constraint prescription_measures_prism_base_h
    check ((prism_horizontal_pd is null) = (prism_horizontal_base is null)),
  constraint prescription_measures_prism_base_v
    check ((prism_vertical_pd is null) = (prism_vertical_base is null))
);

comment on column public.optical_prescription_measures.dnp_mm is
  'Distancia naso-pupilar do olho (clinica). DP total e medidas de montagem '
  'pertencem a O.S., nao a receita (ADR-007).';

-- -----------------------------------------------------------------------------
-- Imutabilidade e encadeamento de versoes (ADR-002)
-- -----------------------------------------------------------------------------
create or replace function public.tg_prescription_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'draft' then
    return new;   -- rascunho ainda pode ser corrigido livremente
  end if;

  if new.issued_at            is distinct from old.issued_at
     or new.customer_id       is distinct from old.customer_id
     or new.prescriber_id     is distinct from old.prescriber_id
     or new.vision_use        is distinct from old.vision_use
     or new.purpose           is distinct from old.purpose
     or new.cylinder_notation is distinct from old.cylinder_notation
     or new.revision          is distinct from old.revision
     or (old.root_prescription_id is not null
         and new.root_prescription_id is distinct from old.root_prescription_id) then
    raise exception
      'Receita % ja emitida: dados clinicos sao imutaveis. Crie uma nova versao '
      '(supersedes_prescription_id) em vez de editar.', old.id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger optical_prescriptions_immutable
  before update on public.optical_prescriptions
  for each row execute function public.tg_prescription_immutable();

create or replace function public.tg_prescription_measures_immutable()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_id uuid := coalesce(new.prescription_id, old.prescription_id);
begin
  select status into v_status from public.optical_prescriptions where id = v_id;
  if v_status is distinct from 'draft' then
    raise exception
      'Medidas da receita % nao podem ser alteradas apos a emissao (status=%).',
      v_id, v_status
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger optical_prescription_measures_immutable
  before insert or update or delete on public.optical_prescription_measures
  for each row execute function public.tg_prescription_measures_immutable();

-- Encadeamento de versoes: executa ANTES da gravacao para que o indice unico
-- de "uma unica versao ativa por raiz" nunca seja violado no meio da troca.
create or replace function public.tg_prescription_version_chain()
returns trigger
language plpgsql
as $$
declare
  v_prev public.optical_prescriptions%rowtype;
begin
  if new.supersedes_prescription_id is not null then
    select * into v_prev
    from public.optical_prescriptions
    where id = new.supersedes_prescription_id
    for update;

    if not found then
      raise exception 'Receita substituida % nao encontrada', new.supersedes_prescription_id;
    end if;
    if v_prev.customer_id <> new.customer_id then
      raise exception 'Nova versao pertence a outro cliente que a receita substituida';
    end if;

    new.root_prescription_id := coalesce(new.root_prescription_id,
                                         v_prev.root_prescription_id, v_prev.id);
    if tg_op = 'INSERT' then
      new.revision := coalesce(v_prev.revision, 1) + 1;
    end if;
  end if;

  -- Primeira versao: a raiz da cadeia e ela mesma.
  if new.root_prescription_id is null then
    new.root_prescription_id := new.id;
  end if;

  -- Ao ativar, a versao anterior da MESMA cadeia sai de circulacao.
  if new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    update public.optical_prescriptions
       set status = 'superseded'
     where root_prescription_id = new.root_prescription_id
       and id <> new.id
       and status = 'active';
  end if;

  return new;
end;
$$;

create trigger optical_prescriptions_version_chain
  before insert or update of status on public.optical_prescriptions
  for each row execute function public.tg_prescription_version_chain();

-- -----------------------------------------------------------------------------
-- Consulta: receita vigente do cliente (para NOVOS pedidos)
-- -----------------------------------------------------------------------------
create or replace function public.latest_active_prescription(p_customer_id uuid)
returns uuid
language sql
stable
as $$
  select p.id
  from public.optical_prescriptions p
  where p.customer_id = p_customer_id
    and p.status = 'active'
  order by p.issued_at desc, p.created_at desc
  limit 1;
$$;

create or replace view public.v_customer_prescriptions as
select
  p.id,
  p.tenant_id,
  p.customer_id,
  p.issued_at,
  p.valid_until,
  p.status,
  p.revision,
  p.root_prescription_id,
  p.vision_use,
  coalesce(p.prescriber_name_snapshot, pr.full_name) as prescriber_name,
  max(m.sphere_dpt)   filter (where m.eye = 'OD' and m.vision_zone = 'far') as od_sphere,
  max(m.cylinder_dpt) filter (where m.eye = 'OD' and m.vision_zone = 'far') as od_cylinder,
  max(m.axis_deg)     filter (where m.eye = 'OD' and m.vision_zone = 'far') as od_axis,
  max(m.dnp_mm)       filter (where m.eye = 'OD' and m.vision_zone = 'far') as od_dnp,
  max(m.sphere_dpt)   filter (where m.eye = 'OS' and m.vision_zone = 'far') as os_sphere,
  max(m.cylinder_dpt) filter (where m.eye = 'OS' and m.vision_zone = 'far') as os_cylinder,
  max(m.axis_deg)     filter (where m.eye = 'OS' and m.vision_zone = 'far') as os_axis,
  max(m.dnp_mm)       filter (where m.eye = 'OS' and m.vision_zone = 'far') as os_dnp,
  max(m.addition_dpt) filter (where m.eye = 'OD')                            as od_addition,
  max(m.addition_dpt) filter (where m.eye = 'OS')                            as os_addition
from public.optical_prescriptions p
left join public.prescribers pr on pr.id = p.prescriber_id
left join public.optical_prescription_measures m on m.prescription_id = p.id
group by p.id, pr.full_name;

create trigger optical_prescriptions_set_updated_at before update on public.optical_prescriptions
  for each row execute function public.tg_set_updated_at();
