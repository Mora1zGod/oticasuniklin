# ADR-003 — Responsável/dependente em tabela N:N

**Status:** Aceito · **Data:** 2026-09-04 · **Briefing:** item 5

## Contexto

O sistema auditado usa `responsible_customer_id` no próprio cliente, com um campo de
grau de parentesco. O briefing pede para preservar o conceito cliente→cliente, não
criar obrigatoriamente uma entidade "Família", e avaliar se um N:N é superior.

## Decisão

**Tabela `customer_relationships` (N:N). Sem entidade "Família".**

```sql
customer_relationships (
  customer_id,              -- dependente / parte A
  related_customer_id,      -- responsável / parte B
  relationship_entry_id,    -- catálogo 'relationship_type'
  is_financial_responsible,
  is_legal_guardian,
  is_pickup_authorized,
  valid_from, valid_to
)
```

## Comparação

| Cenário real | `responsible_customer_id` | `customer_relationships` |
|---|---|---|
| Criança com pai **e** mãe responsáveis | ✗ | ✓ |
| Um responsável com vários dependentes | ✓ | ✓ |
| Cônjuges (relação simétrica) | ✗ (força hierarquia) | ✓ |
| Responsável financeiro ≠ responsável legal | ✗ | ✓ (flags separados) |
| Terceiro autorizado apenas a retirar | ✗ | ✓ (`is_pickup_authorized`) |
| Relação que termina (divórcio, maioridade) | ✗ (perde história) | ✓ (`valid_to`) |
| Empresa como responsável (convênio PJ) | ✗ | ✓ |

## Por que não uma entidade "Família"

Uma entidade `families` exigiria que toda relação passasse por um grupo, o que:

- não representa vínculos assimétricos (empregador, responsável legal de terceiro);
- obriga a criar um agregado artificial para relacionar duas pessoas;
- complica a LGPD: quem é o titular dos dados do "grupo"?

O vínculo direto cliente↔cliente cobre todos os casos observados, incluindo o
"grupo familiar" — que é simplesmente o conjunto de relações de um cliente,
resolvível por consulta.

## Consequências

**Positivas** — flexibilidade sem custo estrutural; a temporalidade preserva a
história; os flags evitam explosão de tipos de vínculo.

**Negativas** — "quem é o responsável deste cliente" vira uma consulta em vez de uma
coluna. Mitigado por índice em `related_customer_id` e por view de navegação.

## Aplicação

`db/migrations/0003_customers.sql`; tipos de vínculo em
`db/seeds/0001_platform_catalogs.sql` (`relationship_type`).
