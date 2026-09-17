-- =============================================================================
-- 0011 — CORRIGE customer_missing_fields (concatenacao de array)
-- =============================================================================
-- Bug: `missing := missing || 'address'` é ambíguo no Postgres. Com um literal
-- de tipo desconhecido, o planejador escolhe o operador `anyarray || anyarray`
-- e tenta ler 'address' como literal de array:
--
--     ERROR: malformed array literal: "address"
--
-- A função só quebrava quando havia alguma pendência a reportar — por isso os
-- cenários passavam: todos percorriam cadastros completos. Apareceu ao abrir a
-- lista de clientes com um cadastro rápido de verdade.
--
-- Correção: array_append, que não tem essa ambiguidade.
-- =============================================================================

create or replace function public.customer_missing_fields(
  p_customer_id uuid,
  p_requirement text default 'complete'
)
returns text[]
language plpgsql
stable
as $$
declare
  c            public.customers%rowtype;
  ind          public.individual_profiles%rowtype;
  comp         public.company_profiles%rowtype;
  missing      text[] := '{}';
  has_contact  boolean;
  has_address  boolean;
begin
  select * into c from public.customers where id = p_customer_id;
  if not found then
    raise exception 'Cliente % nao encontrado', p_customer_id;
  end if;

  select exists (
    select 1 from public.customer_contacts
    where customer_id = p_customer_id and deleted_at is null
  ) into has_contact;

  select exists (
    select 1 from public.customer_addresses
    where customer_id = p_customer_id and deleted_at is null
  ) into has_address;

  -- Nivel 'quick': o minimo para nao criar lixo no banco
  if coalesce(trim(c.display_name), '') = '' then
    missing := array_append(missing, 'display_name');
  end if;
  if not has_contact then
    missing := array_append(missing, 'contact');
  end if;

  if p_requirement = 'quick' then
    return missing;
  end if;

  -- Nivel 'complete' / 'fiscal' / 'credit'
  if c.party_type = 'individual' then
    select * into ind from public.individual_profiles where customer_id = p_customer_id;
    if not found or coalesce(public.digits_only(ind.cpf), '') = '' then
      missing := array_append(missing, 'cpf');
    end if;
    if found and ind.birth_date is null then
      missing := array_append(missing, 'birth_date');
    end if;
  else
    select * into comp from public.company_profiles where customer_id = p_customer_id;
    if not found or coalesce(public.digits_only(comp.cnpj), '') = '' then
      missing := array_append(missing, 'cnpj');
    end if;
    if found and coalesce(trim(comp.legal_name), '') = '' then
      missing := array_append(missing, 'legal_name');
    end if;
    if found and not comp.state_registration_exempt
       and coalesce(trim(comp.state_registration), '') = '' then
      missing := array_append(missing, 'state_registration');
    end if;
  end if;

  if not has_address then
    missing := array_append(missing, 'address');
  end if;

  if p_requirement = 'credit' then
    if not exists (
      select 1 from public.customer_consents
      where customer_id = p_customer_id and purpose = 'data_processing'
        and granted and revoked_at is null
    ) then
      missing := array_append(missing, 'consent_data_processing');
    end if;
  end if;

  return missing;
end;
$$;

comment on function public.customer_missing_fields(uuid, text) is
  'Fonte unica de verdade das exigencias de cadastro. Cadastro rapido e cadastro '
  'completo chamam a MESMA funcao, mudando apenas o nivel exigido (ADR-006).';
