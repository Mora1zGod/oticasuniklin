# ADR-002 — Snapshot da receita na O.S. + versionamento clínico

**Status:** Aceito · **Data:** 2026-09-04 · **Briefing:** item 2

## Contexto

Cenário obrigatório: cliente tem R1; a O.S. #100 usa R1; meses depois o cliente
cadastra R2. A O.S. #100 **não pode** passar a mostrar R2, nem sofrer alteração
retroativa se alguém editar R1.

Uma FK simples `service_orders.prescription_id` falha nos dois casos: a O.S. leria
sempre o estado atual da receita.

## Decisão

Adotar **os dois mecanismos**, com papéis distintos:

### 1. Versionamento na receita (história clínica)

- `optical_prescriptions` é imutável após sair de `draft`
  (`tg_prescription_immutable`, `tg_prescription_measures_immutable`).
- Correção ou nova consulta = **nova linha** com `supersedes_prescription_id`.
- Todas as versões compartilham `root_prescription_id`.
- Índice parcial `optical_prescriptions_single_active_revision` garante uma única
  versão `active` por cadeia.
- `latest_active_prescription(customer_id)` responde "qual vale para novos pedidos".

### 2. Snapshot na O.S. (o que foi produzido)

- `take_prescription_snapshot(os_id, prescription_id)` copia cabeçalho e medidas
  para `service_order_prescriptions` / `service_order_prescription_measures`.
- A O.S. lê o próprio snapshot; nunca faz join com a receita viva.
- `source_prescription_id` (`ON DELETE RESTRICT`) + `source_revision` preservam a
  procedência.
- `is_adjusted` + `adjustment_reason` registram divergência legítima entre prescrito
  e produzido (adaptação de grau, transposição).
- O snapshot congela junto com a produção: alterar depois do estágio `draft` é
  bloqueado (`tg_so_snapshot_immutable`).

## Alternativas consideradas

- **Só FK para a receita.** Rejeitada: viola o requisito diretamente.
- **Só snapshot, sem versionar a receita.** Rejeitada: permitiria editar R1
  silenciosamente e perder a história clínica do cliente.
- **Snapshot em `jsonb` solto.** Rejeitada: sem tipagem, sem `CHECK`, sem índice; o
  grau usado na produção é dado crítico de retrabalho e garantia, precisa ser
  consultável e validado.
- **Tabela de auditoria genérica (before/after).** Rejeitada como mecanismo
  primário: auditoria registra o que mudou, não serve como fonte para reimprimir a
  O.S.

## Consequências

**Positivas**
- A O.S. é autossuficiente: reimprimir uma O.S. de 3 anos atrás devolve exatamente
  o que foi produzido.
- Retrabalho e garantia comparam o produzido com o prescrito, não com o atual.
- A cadeia de versões dá o histórico clínico completo do cliente.

**Negativas**
- Duplicação controlada dos valores de grau. Aceita: é snapshot com procedência
  (`source_prescription_id` sempre presente).
- Corrigir um erro de digitação em receita emitida exige nova versão. Aceito e
  desejado: é documento clínico.

## Aplicação

`db/migrations/0004`, `db/migrations/0007`; validado por
`db/tools/scenario_item12.sql` (assertivas A, B, C, D, E).
