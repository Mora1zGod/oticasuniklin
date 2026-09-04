# ADR-006 — Cadastro rápido é o mesmo cadastro

**Status:** Aceito · **Data:** 2026-09-04 · **Briefing:** item 7

## Contexto

O fluxo comercial precisa criar cliente, fornecedor, prescritor e produto sem
abandonar a operação em andamento. O erro clássico — e presente em vários ERPs — é
criar um "cadastro simplificado" como entidade ou fluxo paralelo, que escapa das
validações e gera duas fontes de verdade.

## Decisão

**Cadastro rápido não é entidade nem fluxo separado.** É o mesmo registro, nas
mesmas tabelas, marcado com `record_status = 'quick'` — presente em `customers`,
`suppliers`, `prescribers` e `products`.

A regra de completude vive em **uma única função**:

```sql
customer_missing_fields(customer_id, requirement)
-- requirement: 'quick' | 'complete' | 'fiscal' | 'credit'
```

Tela rápida, tela completa, emissão fiscal e liberação de crediário chamam a mesma
função com nível diferente. Não existe caminho que pule validação:

| Camada | Garantia |
|---|---|
| `CHECK` de coluna | CPF/CNPJ com dígito verificador válido, datas sãs, enums |
| Índice único | CPF/CNPJ não duplicado no tenant |
| `customers_promotion_guard` | promover para `complete` com pendência levanta exceção |
| `v_customer_overview.pending_fields` | a dívida de cadastro fica visível na listagem |

## Alternativas consideradas

- **Tabela `quick_customers` com migração posterior.** Rejeitada: duas fontes de
  verdade, risco de duplicata na promoção, FKs órfãs.
- **Validação apenas no frontend do cadastro completo.** Rejeitada: é exatamente a
  falha apontada em auditorias anteriores (validação só no cliente).
- **Sem distinção nenhuma (tudo obrigatório sempre).** Rejeitada: inviabiliza o
  atendimento de balcão.

## Consequências

**Positivas** — zero divergência entre fluxos; a exigência muda por contexto de
negócio, não por tela; a pendência é mensurável (relatório de cadastros incompletos).

**Negativas** — a UI precisa saber qual nível exigir em cada ponto. É configuração
de tela, não de modelo.

## Aplicação

`db/migrations/0003_customers.sql` (`customer_missing_fields`,
`tg_customer_promotion_guard`), `db/migrations/0002` e `0005` (`record_status` em
prescritores, fornecedores e produtos).
