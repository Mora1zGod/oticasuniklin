-- =============================================================================
-- 0006 — ORCAMENTO, VENDA E RECEBIMENTOS
-- =============================================================================
-- Item 8 / ADR-009: NAO existe "Cliente Padrao". A venda avulsa e realmente
-- anonima (customer_id NULL) e restrita por CHECK: sem crediario, sem O.S.,
-- sem garantia nominal, sem comissao por cliente, sem CRM.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Numeracao de documentos por filial
-- -----------------------------------------------------------------------------
create table public.document_sequences (
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  branch_id         uuid not null references public.branches(id) on delete cascade,
  document_type     text not null
                    check (document_type in ('quote','sale','service_order','lab_order','receipt')),
  next_value        bigint not null default 1 check (next_value >= 1),
  prefix            text,
  primary key (branch_id, document_type)
);

create or replace function public.next_document_number(
  p_branch_id uuid,
  p_document_type text
)
returns bigint
language plpgsql
as $$
declare
  v_tenant uuid;
  v_value  bigint;
begin
  select tenant_id into v_tenant from public.branches where id = p_branch_id;
  if v_tenant is null then
    raise exception 'Filial % inexistente', p_branch_id;
  end if;

  insert into public.document_sequences (tenant_id, branch_id, document_type, next_value)
  values (v_tenant, p_branch_id, p_document_type, 1)
  on conflict (branch_id, document_type) do nothing;

  update public.document_sequences
     set next_value = next_value + 1
   where branch_id = p_branch_id and document_type = p_document_type
  returning next_value - 1 into v_value;

  return v_value;
end;
$$;

-- -----------------------------------------------------------------------------
-- Orcamento
-- -----------------------------------------------------------------------------
create table public.quotes (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  branch_id           uuid not null references public.branches(id),
  number              bigint not null,
  customer_id         uuid,
  salesperson_id      uuid references public.app_users(id),
  -- referencia informativa a receita usada para dimensionar o orcamento.
  -- O snapshot definitivo so acontece na O.S. (ADR-002).
  prescription_id     uuid references public.optical_prescriptions(id),
  status              text not null default 'draft'
                      check (status in ('draft','sent','accepted','rejected','expired','converted')),
  valid_until         date,
  subtotal_amount     numeric(12,2) not null default 0 check (subtotal_amount >= 0),
  discount_amount     numeric(12,2) not null default 0 check (discount_amount >= 0),
  total_amount        numeric(12,2) not null default 0 check (total_amount >= 0),
  notes               text,
  created_by          uuid references public.app_users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint quotes_id_tenant_unique unique (id, tenant_id),
  constraint quotes_number_unique unique (branch_id, number),
  constraint quotes_customer_fk
    foreign key (customer_id, tenant_id) references public.customers(id, tenant_id)
);

create index quotes_customer_idx on public.quotes (customer_id, created_at desc);

create table public.quote_items (
  id                  uuid primary key default gen_random_uuid(),
  quote_id            uuid not null references public.quotes(id) on delete cascade,
  tenant_id           uuid not null,
  parent_item_id      uuid references public.quote_items(id) on delete cascade,
  line_number         integer not null,
  product_id          uuid,
  description         text not null,           -- snapshot do nome no momento
  eye                 text check (eye in ('OD','OS','both')),
  quantity            numeric(10,3) not null default 1 check (quantity > 0),
  unit_price          numeric(12,2) not null check (unit_price >= 0),
  discount_amount     numeric(12,2) not null default 0 check (discount_amount >= 0),
  total_amount        numeric(12,2) not null check (total_amount >= 0),
  created_at          timestamptz not null default now(),
  constraint quote_items_product_fk
    foreign key (product_id, tenant_id) references public.products(id, tenant_id),
  constraint quote_items_line_unique unique (quote_id, line_number)
);

-- -----------------------------------------------------------------------------
-- Venda
-- -----------------------------------------------------------------------------
create table public.sales (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  branch_id           uuid not null references public.branches(id),
  number              bigint not null,
  quote_id            uuid references public.quotes(id),

  -- ADR-009: venda avulsa = customer_id NULL, nunca um cliente fake
  sale_type           text not null default 'identified'
                      check (sale_type in ('identified','anonymous')),
  customer_id         uuid,
  -- CPF/CNPJ informado apenas para a nota fiscal, SEM criar cadastro
  tax_document_on_invoice text,

  salesperson_id      uuid references public.app_users(id),
  status              text not null default 'open'
                      check (status in ('open','confirmed','invoiced','cancelled','returned')),
  sold_at             timestamptz not null default now(),
  subtotal_amount     numeric(12,2) not null default 0 check (subtotal_amount >= 0),
  discount_amount     numeric(12,2) not null default 0 check (discount_amount >= 0),
  total_amount        numeric(12,2) not null default 0 check (total_amount >= 0),
  cancelled_at        timestamptz,
  cancel_reason       text,
  notes               text,
  created_by          uuid references public.app_users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint sales_id_tenant_unique unique (id, tenant_id),
  constraint sales_number_unique unique (branch_id, number),
  constraint sales_customer_fk
    foreign key (customer_id, tenant_id) references public.customers(id, tenant_id),
  -- a regra central do ADR-009
  constraint sales_customer_matches_type
    check ((sale_type = 'identified') = (customer_id is not null)),
  constraint sales_invoice_document_valid
    check (tax_document_on_invoice is null
           or public.is_valid_cpf(tax_document_on_invoice)
           or public.is_valid_cnpj(tax_document_on_invoice)),
  constraint sales_cancel_reason
    check ((status = 'cancelled') = (cancelled_at is not null))
);

create index sales_customer_idx on public.sales (customer_id, sold_at desc);
create index sales_branch_date_idx on public.sales (branch_id, sold_at desc);
create index sales_anonymous_idx on public.sales (tenant_id, sold_at desc) where sale_type = 'anonymous';

comment on column public.sales.customer_id is
  'NULL apenas em venda avulsa anonima (ADR-009). Nunca apontar para um '
  '"cliente padrao" generico: isso contamina CRM, BI, LGPD e garantia.';

create table public.sale_items (
  id                  uuid primary key default gen_random_uuid(),
  sale_id             uuid not null references public.sales(id) on delete cascade,
  tenant_id           uuid not null,
  parent_item_id      uuid references public.sale_items(id) on delete cascade,
  line_number         integer not null,
  product_id          uuid,
  description         text not null,
  eye                 text check (eye in ('OD','OS','both')),
  quantity            numeric(10,3) not null default 1 check (quantity > 0),
  unit_price          numeric(12,2) not null check (unit_price >= 0),
  discount_amount     numeric(12,2) not null default 0 check (discount_amount >= 0),
  total_amount        numeric(12,2) not null check (total_amount >= 0),
  unit_cost           numeric(12,2),
  -- baixa/reserva de estoque acontece por item (regra em 0007)
  stock_branch_id     uuid references public.branches(id),
  created_at          timestamptz not null default now(),
  constraint sale_items_id_tenant_unique unique (id, tenant_id),
  constraint sale_items_product_fk
    foreign key (product_id, tenant_id) references public.products(id, tenant_id),
  constraint sale_items_line_unique unique (sale_id, line_number)
);

create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id);

-- -----------------------------------------------------------------------------
-- Pagamentos da venda (varias formas na mesma venda — item 12: PIX + cartao)
-- -----------------------------------------------------------------------------
create table public.sale_payments (
  id                  uuid primary key default gen_random_uuid(),
  sale_id             uuid not null references public.sales(id) on delete cascade,
  tenant_id           uuid not null,
  payment_method_id   uuid not null references public.payment_methods(id),
  amount              numeric(12,2) not null check (amount > 0),
  installments        integer not null default 1 check (installments >= 1),
  first_due_date      date,
  acquirer_name       text,
  authorization_code  text,
  card_brand          text,
  paid_at             timestamptz,
  created_at          timestamptz not null default now()
);

create index sale_payments_sale_idx on public.sale_payments (sale_id);

-- Regra ADR-009: forma de pagamento que exige cliente (crediario, cheque,
-- credito de loja) nao pode ser usada em venda anonima.
create or replace function public.tg_sale_payment_requires_customer()
returns trigger
language plpgsql
as $$
declare
  v_requires boolean;
  v_sale     public.sales%rowtype;
begin
  select requires_customer into v_requires
    from public.payment_methods where id = new.payment_method_id;
  select * into v_sale from public.sales where id = new.sale_id;

  if v_requires and v_sale.customer_id is null then
    raise exception
      'Forma de pagamento exige cliente identificado; venda % e avulsa (ADR-009).',
      v_sale.id using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger sale_payments_requires_customer
  before insert or update on public.sale_payments
  for each row execute function public.tg_sale_payment_requires_customer();

create trigger quotes_set_updated_at before update on public.quotes
  for each row execute function public.tg_set_updated_at();
create trigger sales_set_updated_at before update on public.sales
  for each row execute function public.tg_set_updated_at();
