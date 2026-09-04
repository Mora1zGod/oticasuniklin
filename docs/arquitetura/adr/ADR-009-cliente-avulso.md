# ADR-009 — Venda avulsa anônima em vez de "Cliente Padrão"

**Status:** Aceito · **Data:** 2026-09-04 · **Briefing:** item 8

## Contexto

O sistema auditado usa um registro "Cliente Padrão" para vendas de balcão. O
briefing pede decisão arquitetural explícita entre:

- **(A)** registro especial do sistema;
- **(B)** venda realmente anônima com `customer_id` nulo sob regras específicas.

## Decisão

**Opção B.** `sales.customer_id` é anulável, controlado por `sale_type`:

```sql
sale_type in ('identified', 'anonymous')
constraint sales_customer_matches_type
  check ((sale_type = 'identified') = (customer_id is not null))
```

CPF/CNPJ pedido "na nota" é guardado em `sales.tax_document_on_invoice` (validado),
**sem criar cadastro**.

## Análise de impacto

| Dimensão | (A) Cliente Padrão | (B) `customer_id` NULL — adotado |
|---|---|---|
| **Fiscal** | CPF na nota vira campo de um cadastro falso; risco de emitir NF-e vinculada a titular inexistente | documento fiscal fica na venda, validado, sem titular fantasma |
| **LGPD** | acumula dados pessoais reais num registro compartilhado; impossível atender pedido de acesso ou exclusão | não há dado pessoal além do documento fiscal da nota |
| **BI** | um "cliente" com milhares de compras destrói ticket médio, recorrência e RFM | vendas anônimas são segmentáveis (`sale_type`, índice dedicado) |
| **Garantia** | garantia nominal impossível de rastrear | garantia pelo número da venda/cupom |
| **Troca** | crédito de troca creditado ao cliente genérico — risco de uso indevido | `customer_credits` exige cliente; troca anônima é resolvida na venda |
| **O.S.** | O.S. órfã pendurada no cliente genérico | proibida por trigger |
| **Crediário** | risco real de crédito concedido ao "cliente padrão" | `payment_methods.requires_customer` bloqueia |
| **Comissão** | funciona | funciona (é por item/vendedor, não por cliente) |
| **Histórico** | compras de pessoas diferentes misturadas | não há histórico a misturar |

## Regras que o banco impõe

1. `sales_customer_matches_type` — venda identificada exige cliente; anônima proíbe.
2. `tg_sale_payment_requires_customer` — crediário, cheque e crédito de loja não
   entram em venda anônima.
3. `tg_service_order_requires_identified_sale` — O.S. nunca nasce de venda anônima.
4. `receivables.customer_id` **NOT NULL** — título financeiro sem titular não existe.
5. `service_orders.customer_id` **NOT NULL** — produção sempre tem titular.

Validado em `scenario_item12.sql`, assertiva **F**.

## Promoção posterior

Se o cliente se identificar depois, o caminho é criar o cadastro e vincular a venda
(`sale_type` passa a `identified`) — não converter um registro fantasma em pessoa.

## Consequências

**Positivas** — BI limpo, LGPD tratável, risco de crédito eliminado, sem "cliente"
com 40 mil compras.

**Negativas** — todo relatório que agrupa por cliente precisa lidar com `NULL`.
Aceito: é a representação honesta de "não sabemos quem é".

## Aplicação

`db/migrations/0006_quotes_sales.sql`, `db/migrations/0007_service_orders.sql`,
`db/migrations/0008_finance_commissions.sql`.
