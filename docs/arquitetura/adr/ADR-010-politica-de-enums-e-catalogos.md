# ADR-010 — Política de enums e catálogos

**Status:** Aceito · **Data:** 2026-09-04 · **Briefing:** item 11

## Contexto

O sistema auditado tem dezenas de listas fixas. Copiá-las sem análise congelaria no
produto decisões de outro negócio; transformar todas em tabelas configuráveis
permitiria ao usuário criar valores que o software não sabe interpretar.

## Decisão

Três categorias, com um teste único de classificação:

> *"Se um usuário criar um valor novo aqui, algum `if` do sistema precisa mudar?"*

| Resposta | Categoria | Implementação |
|---|---|---|
| Sim | **(a) enum de código** | `CHECK (coluna in (...))` |
| Não, e o valor só tem rótulo | **(b) catálogo configurável** | `catalog_entries` |
| Não, mas o valor tem atributos que o sistema lê | **(c) tabela dedicada** | tabela própria |

Escopo em (b) e (c): `tenant_id NULL` = semente da plataforma (leitura global);
`tenant_id` preenchido = item do tenant. `resolve_catalog(key, tenant)` funde as
duas listas, com o item do tenant sobrepondo o da plataforma no mesmo `code`.

## Decisões para os itens de atenção do briefing

| Lista | Categoria | Justificativa |
|---|---|---|
| Profissão | (b) | descritiva, longa, regional; nenhuma regra lê |
| Origem do cliente | (b) | descritiva; muda por estratégia de marketing |
| Grau de parentesco | (b) | descritiva; o comportamento está nos flags de `customer_relationships` |
| Grupos de produto | (c) `product_categories` | hierarquia + base de regra de comissão |
| Formas de pagamento | (c) `payment_methods` | prazo, taxa, parcelamento, geração de financeiro, exigência de cliente |
| Situação da O.S. | (c) `service_order_statuses` + `_transitions` | máquina de estados com efeitos colaterais |
| Tipos de documento | (b) | descritiva |
| Status financeiros | (a) | dirigem cálculo de saldo, inadimplência e baixa |

## Rótulo é do tenant, comportamento é do produto

O padrão decisivo aparece em `service_order_statuses`:

```
code  = 'no_lab'                  -- tenant escolhe
label = 'Enviada ao laboratório'  -- tenant escolhe
stage = 'awaiting_lab'            -- fechado pelo produto (CHECK)
```

Relatórios, SLA e automações leem `stage`; a tela mostra `label`. Uma rede pode ter
12 situações e outra 5 sem fragmentar o produto.

## Por que `CHECK` e não `CREATE TYPE ... AS ENUM`

- `ALTER TYPE ... ADD VALUE` tem restrições transacionais e **não permite remover**
  valor;
- `CHECK` é migração comum, reversível, legível e inspecionável pelo Supabase;
- o custo (sem tipo forte no cliente) é resolvido por tipos gerados em TypeScript.

## Consequências

**Positivas** — personalização real sem fragmentar comportamento; migração de
categoria (b→c) é conhecida e barata quando uma lista passa a carregar regra.

**Negativas** — mais um `JOIN` para resolver rótulos de catálogo. Absorvido por
`resolve_catalog` e por cache no frontend.

## Aplicação

`db/migrations/0002_catalogs.sql`, `db/seeds/0001_platform_catalogs.sql`,
`docs/arquitetura/05-catalogos-e-enums.md`.
