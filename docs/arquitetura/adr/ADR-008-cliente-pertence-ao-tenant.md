# ADR-008 — Cliente pertence ao tenant; filial é proveniência

**Status:** Aceito · **Data:** 2026-09-04 · **Briefing:** item 9

## Contexto

O sistema auditado registra em qual filial o cliente foi cadastrado e trata isso
como escopo. Em uma rede, o efeito é duplicar o mesmo CPF em cada unidade que o
atende, fragmentando histórico, crédito e receita.

## Decisão

O cliente pertence ao **TENANT**. A filial aparece em três papéis, nenhum deles de
propriedade:

| Campo | Papel |
|---|---|
| `customers.created_at_branch_id` | onde o cadastro nasceu (auditoria, BI, comissão de captação) |
| `customers.preferred_branch_id` | unidade de preferência do cliente |
| `customer_branch_profiles` | vendedor preferencial, tabela de preço e convênio **por filial** |

## Análise dos impactos levantados

| Ponto | Resolução |
|---|---|
| **CPF duplicado entre filiais** | eliminado: índice único `(tenant_id, digits(cpf))` em `individual_profiles` |
| **Histórico consolidado** | natural: vendas, O.S. e receitas apontam ao cliente do tenant, cada documento com sua `branch_id` |
| **Permissões** | RLS em duas camadas: permissiva por tenant + restritiva por filial **apenas sobre documentos operacionais** (`quotes`, `sales`, `service_orders`, `lab_orders`, `receivables`, `payables`, `commissions`, estoque). `customers` fica fora, deliberadamente |
| **LGPD** | o controlador é o tenant, não a loja. `customer_consents` é por cliente; atender a um pedido de exclusão não depende de descobrir em quantas filiais o CPF foi duplicado |
| **Vendedor preferencial por filial** | `customer_branch_profiles.preferred_salesperson_id` |
| **Preços/convênios por filial** | `customer_branch_profiles.price_table_id` + `price_table_branches` |

## Alternativas consideradas

- **Cliente da filial (modelo auditado).** Rejeitada: duplicação de CPF por
  construção; crédito e garantia deixam de ser consolidados.
- **Cliente do tenant com visibilidade obrigatória por filial.** Rejeitada como
  padrão: quebra o atendimento em rede. Fica disponível como política adicional
  opcional sobre `customers`, para tenants que exijam segregação.

## Consequências

**Positivas** — atendimento em qualquer unidade sem duplicar; BI e crédito
consolidados; LGPD tratável.

**Negativas** — uma rede que queira segregar cadastros por unidade precisa de
política extra. É a exceção, não o padrão.

## Aplicação

`db/migrations/0003_customers.sql`, `db/migrations/0009_rls_policies.sql`.
