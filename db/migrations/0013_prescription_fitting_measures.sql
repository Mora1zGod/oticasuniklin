-- =============================================================================
-- 0013 — MEDIDAS DE ADAPTAÇÃO NA RECEITA
-- =============================================================================
-- Altura de montagem, distância vértice, ângulo pantoscópico e curva da armação
-- passam a ser registráveis NA RECEITA.
--
-- Por que isso não contraria o ADR-001 (receita é clínica, lente é comercial):
-- o que entra aqui é o que o PRESCRITOR indicou — a altura sugerida, a distância
-- vértice em que ele mediu, a inclinação que considerou. Continua não havendo
-- tipo de lente, material, índice, tratamento, fabricante nem preço.
--
-- E não substitui a medida da O.S. (ADR-007): lá continua a medida tirada NA
-- ARMAÇÃO ESCOLHIDA, que é outra coisa. A O.S. mantém a sua própria
-- `fitting_height_mm`; as duas convivem lado a lado, como já acontece com a DNP
-- prescrita e a DNP de montagem.
-- =============================================================================

-- Altura por olho: mora na medida, porque cada olho tem a sua.
alter table public.optical_prescription_measures
  add column if not exists fitting_height_mm numeric(4,1);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'prescription_measures_fitting_height_range'
      and conrelid = 'public.optical_prescription_measures'::regclass
  ) then
    alter table public.optical_prescription_measures
      add constraint prescription_measures_fitting_height_range
      check (fitting_height_mm is null or fitting_height_mm between 5 and 45);
  end if;
end;
$$;

comment on column public.optical_prescription_measures.fitting_height_mm is
  'Altura de montagem INDICADA pelo prescritor. A altura efetivamente medida na '
  'armacao escolhida vive na O.S. (ADR-007) e pode ser diferente desta.';

-- Medidas de adaptação do conjunto: uma por receita, não por olho.
alter table public.optical_prescriptions
  add column if not exists vertex_distance_mm    numeric(4,1),
  add column if not exists pantoscopic_angle_deg numeric(4,1),
  add column if not exists frame_wrap_angle_deg  numeric(4,1);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'prescriptions_fitting_ranges'
      and conrelid = 'public.optical_prescriptions'::regclass
  ) then
    -- Faixas largas o bastante para qualquer caso real e estreitas o bastante
    -- para pegar erro de digitação (12 virando 120).
    alter table public.optical_prescriptions
      add constraint prescriptions_fitting_ranges check (
        (vertex_distance_mm    is null or vertex_distance_mm    between 5 and 30) and
        (pantoscopic_angle_deg is null or pantoscopic_angle_deg between -20 and 30) and
        (frame_wrap_angle_deg  is null or frame_wrap_angle_deg  between -15 and 35)
      );
  end if;
end;
$$;

comment on column public.optical_prescriptions.vertex_distance_mm is
  'Distancia vertice em que a refracao foi medida (mm).';
comment on column public.optical_prescriptions.pantoscopic_angle_deg is
  'Angulo pantoscopico indicado (graus).';
comment on column public.optical_prescriptions.frame_wrap_angle_deg is
  'Curva/wrap da armacao indicada (graus).';

-- -----------------------------------------------------------------------------
-- Imutabilidade (ADR-002): o que é da receita não muda depois de emitida
-- -----------------------------------------------------------------------------
-- As medidas por olho já estavam cobertas — o trigger delas barra qualquer
-- alteração fora do rascunho. As três novas colunas do cabeçalho precisam
-- entrar na lista explícita, senão passariam a ser editáveis depois da emissão.
create or replace function public.tg_prescription_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'draft' then
    return new;   -- rascunho ainda pode ser corrigido livremente
  end if;

  if new.issued_at              is distinct from old.issued_at
     or new.customer_id         is distinct from old.customer_id
     or new.prescriber_id       is distinct from old.prescriber_id
     or new.vision_use          is distinct from old.vision_use
     or new.purpose             is distinct from old.purpose
     or new.cylinder_notation   is distinct from old.cylinder_notation
     or new.revision            is distinct from old.revision
     or new.vertex_distance_mm    is distinct from old.vertex_distance_mm
     or new.pantoscopic_angle_deg is distinct from old.pantoscopic_angle_deg
     or new.frame_wrap_angle_deg  is distinct from old.frame_wrap_angle_deg
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
