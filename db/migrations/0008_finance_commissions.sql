-- =============================================================================
-- 0008 — FINANCEIRO, CREDITO DO CLIENTE E COMISSAO
-- =============================================================================
-- Plano de contas e formas de pagamento sao do dominio FINANCEIRO (item 10):
-- o menu deriva daqui, nao o contrario.
-- =============================================================================

create table public.chart_accounts (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  parent_id         uuid references public.chart_accounts(id),
  code              text not null,
  label             text not null,
  account_kind      text not null
                    check (account_kind in ('revenue','expense','asset','liability','equity')),
  accepts_entries   boolean not null default true,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint chart_accounts_code_unique unique (tenant_id, code)
);

alter table public.payment_methods
  add constraint payment_methods_chart_account_fk
  foreign key (chart_account_id) references public.chart_accounts(id);

-- -----------------------------------------------------------------------------
-- Contas a receber — uma linha por parcela
-- -----------------------------------------------------------------------------
create table public.receivables (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  branch_id           uuid not null references public.branches(id),
  sale_id             uuid references public.sales(id) on delete restrict,
  sale_payment_id     uuid references public.sale_payments(id) on delete restrict,
  -- ADR-009: titulo financeiro SEMPRE tem cliente identificado
  customer_id         uuid not null,
  payment_method_id   uuid references public.payment_methods(id),
  chart_account_id    uuid references public.chart_accounts(id),

  installment_number  integer not null default 1 check (installment_number >= 1),
  installments_total  integer not null default 1 check (installments_total >= 1),
  issue_date          date not null default current_date,
  due_date            date not null,
  amount              numeric(12,2) not null check (amount > 0),
  paid_amount         numeric(12,2) not null default 0 check (paid_amount >= 0),
  interest_amount     numeric(12,2) not null default 0 check (interest_amount >= 0),
  discount_amount     numeric(12,2) not null default 0 check (discount_amount >= 0),
  status              text not null default 'open'
                      check (status in ('open','partially_paid','paid','overdue',
                                        'renegotiated','cancelled','written_off')),
  document_number     text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint receivables_customer_fk
    foreign key (customer_id, tenant_id) references public.customers(id, tenant_id),
  constraint receivables_installment_range check (installment_number <= installments_total),
  constraint receivables_paid_limit check (paid_amount <= amount + interest_amount)
);

create index receivables_customer_idx on public.receivables (customer_id, due_date);
create index receivables_open_idx on public.receivables (branch_id, due_date)
  where status in ('open','partially_paid','overdue');
create index receivables_sale_idx on public.receivables (sale_id);

create table public.receivable_settlements (
  id                  uuid primary key default gen_random_uuid(),
  receivable_id       uuid not null references public.receivables(id) on delete cascade,
  tenant_id           uuid not null,
  branch_id           uuid not null references public.branches(id),
  payment_method_id   uuid references public.payment_methods(id),
  amount              numeric(12,2) not null check (amount > 0),
  settled_at          timestamptz not null default now(),
  performed_by        uuid references public.app_users(id),
  notes               text
);

create index receivable_settlements_receivable_idx
  on public.receivable_settlements (receivable_id, settled_at);

create or replace function public.tg_receivable_recalculate()
returns trigger
language plpgsql
as $$
declare
  v_id     uuid := coalesce(new.receivable_id, old.receivable_id);
  v_paid   numeric(12,2);
  r        public.receivables%rowtype;
begin
  select coalesce(sum(amount), 0) into v_paid
  from public.receivable_settlements where receivable_id = v_id;

  select * into r from public.receivables where id = v_id;

  update public.receivables
     set paid_amount = v_paid,
         status = case
                    when v_paid >= (r.amount + r.interest_amount - r.discount_amount) then 'paid'
                    when v_paid > 0 then 'partially_paid'
                    when r.due_date < current_date then 'overdue'
                    else 'open'
                  end
   where id = v_id
     and status not in ('cancelled','renegotiated','written_off');

  return coalesce(new, old);
end;
$$;

create trigger receivable_settlements_recalculate
  after insert or update or delete on public.receivable_settlements
  for each row execute function public.tg_receivable_recalculate();

-- -----------------------------------------------------------------------------
-- Contas a pagar (compras e laboratorio)
-- -----------------------------------------------------------------------------
create table public.payables (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  branch_id           uuid not null references public.branches(id),
  supplier_id         uuid references public.suppliers(id),
  laboratory_id       uuid references public.laboratories(id),
  lab_order_id        uuid references public.lab_orders(id),
  chart_account_id    uuid references public.chart_accounts(id),
  description         text not null,
  issue_date          date not null default current_date,
  due_date            date not null,
  amount              numeric(12,2) not null check (amount > 0),
  paid_amount         numeric(12,2) not null default 0 check (paid_amount >= 0),
  status              text not null default 'open'
                      check (status in ('open','partially_paid','paid','overdue','cancelled')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint payables_counterparty
    check (supplier_id is not null or laboratory_id is not null)
);

create index payables_due_idx on public.payables (branch_id, due_date)
  where status in ('open','partially_paid','overdue');

-- -----------------------------------------------------------------------------
-- Credito do cliente (troca, devolucao, vale)
-- -----------------------------------------------------------------------------
create table public.customer_credits (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  customer_id         uuid not null,
  branch_id           uuid references public.branches(id),
  origin              text not null
                      check (origin in ('return','exchange','courtesy','warranty','adjustment')),
  origin_sale_id      uuid references public.sales(id),
  amount              numeric(12,2) not null check (amount > 0),
  balance_amount      numeric(12,2) not null check (balance_amount >= 0),
  expires_at          date,
  status              text not null default 'active'
                      check (status in ('active','consumed','expired','cancelled')),
  created_by          uuid references public.app_users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint customer_credits_customer_fk
    foreign key (customer_id, tenant_id) references public.customers(id, tenant_id),
  constraint customer_credits_balance_limit check (balance_amount <= amount)
);

create table public.customer_credit_movements (
  id                  uuid primary key default gen_random_uuid(),
  customer_credit_id  uuid not null references public.customer_credits(id) on delete cascade,
  sale_id             uuid references public.sales(id),
  amount              numeric(12,2) not null check (amount <> 0),
  occurred_at         timestamptz not null default now(),
  performed_by        uuid references public.app_users(id),
  notes               text
);

-- -----------------------------------------------------------------------------
-- Comissao
-- -----------------------------------------------------------------------------
create table public.commission_rules (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  label               text not null,
  branch_id           uuid references public.branches(id),           -- NULL = todas
  app_user_id         uuid references public.app_users(id),          -- NULL = todos
  product_kind        text check (product_kind in ('frame','sunglass','lens','contact_lens',
                                                   'accessory','service','lens_treatment')),
  category_id         uuid references public.product_categories(id),
  rate_percent        numeric(6,3) not null check (rate_percent >= 0 and rate_percent <= 100),
  base                text not null default 'net_item'
                      check (base in ('net_item','gross_item','margin')),
  -- quando a comissao vira direito adquirido
  release_event       text not null default 'sale_paid'
                      check (release_event in ('sale_confirmed','sale_paid','order_delivered')),
  priority            integer not null default 100,
  valid_from          date,
  valid_to            date,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index commission_rules_lookup_idx
  on public.commission_rules (tenant_id, is_active, priority);

create table public.commissions (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  branch_id           uuid not null references public.branches(id),
  sale_id             uuid not null references public.sales(id) on delete cascade,
  sale_item_id        uuid references public.sale_items(id) on delete cascade,
  app_user_id         uuid not null references public.app_users(id),
  commission_rule_id  uuid references public.commission_rules(id),
  base_amount         numeric(12,2) not null check (base_amount >= 0),
  rate_percent        numeric(6,3) not null check (rate_percent >= 0),
  amount              numeric(12,2) not null check (amount >= 0),
  status              text not null default 'pending'
                      check (status in ('pending','released','paid','cancelled')),
  released_at         timestamptz,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint commissions_item_unique unique (sale_item_id, app_user_id)
);

create index commissions_user_idx on public.commissions (app_user_id, status, created_at desc);

create trigger chart_accounts_set_updated_at before update on public.chart_accounts
  for each row execute function public.tg_set_updated_at();
create trigger receivables_set_updated_at before update on public.receivables
  for each row execute function public.tg_set_updated_at();
create trigger payables_set_updated_at before update on public.payables
  for each row execute function public.tg_set_updated_at();
create trigger customer_credits_set_updated_at before update on public.customer_credits
  for each row execute function public.tg_set_updated_at();
create trigger commission_rules_set_updated_at before update on public.commission_rules
  for each row execute function public.tg_set_updated_at();
create trigger commissions_set_updated_at before update on public.commissions
  for each row execute function public.tg_set_updated_at();
