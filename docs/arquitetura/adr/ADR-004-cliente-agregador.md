# ADR-004 — Cliente é agregador de navegação, não tabela gigante

**Status:** Aceito · **Data:** 2026-09-04 · **Briefing:** item 4

## Contexto

O cadastro do cliente é o ponto central de navegação da ótica: dali se chega a
receitas, orçamentos, vendas, O.S., financeiro, anexos e comunicações. A tentação
óbvia — e o erro do sistema auditado — é traduzir isso em uma tabela larga com
dezenas de colunas.

## Decisão

`customers` guarda **identidade e navegação** (17 colunas, nenhuma delas histórico).
Todo o resto é satélite normalizado:

`customer_contacts` · `customer_addresses` · `customer_relationships` ·
`individual_profiles` · `company_profiles` · `optical_prescriptions` · `quotes` ·
`sales` · `service_orders` · `receivables` · `customer_credits` ·
`customer_attachments` · `customer_communications` · `customer_consents` ·
`customer_audit_events` · `customer_branch_profiles`.

A tela em abas é resolvida na camada de leitura (`v_customer_overview` + consultas
por aba), nunca por desnormalização.

## Integridade cruzada

Todo satélite carrega `tenant_id` e usa FK composta:

```sql
foreign key (customer_id, tenant_id)
  references customers(id, tenant_id) on delete cascade
```

Isso torna *cross-tenant leak* impossível por construção — um contato do tenant B
não consegue apontar para um cliente do tenant A, mesmo que a aplicação erre.

## Consequências

**Positivas** — cada histórico cresce sem inchar o cadastro; permissões e LGPD podem
ser aplicadas por satélite (dado clínico e consentimento têm política própria);
`SELECT` na listagem de clientes lê uma tabela estreita.

**Negativas** — a tela do cliente faz várias consultas. Aceito: cada aba carrega sob
demanda, e as views cobrem o cabeçalho.

## Aplicação

`db/migrations/0003_customers.sql`.
