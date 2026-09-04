# ADR-001 — Receita não é lente

**Status:** Aceito · **Data:** 2026-09-04 · **Briefing:** item 1

## Contexto

O sistema auditado mistura, no mesmo formulário de receita, dados clínicos
(esférico, cilíndrico, eixo, adição) e escolhas comerciais (tipo de lente,
fabricante, material, índice, tratamento). Isso cria três problemas:

1. **Semântico** — a receita é um documento clínico emitido por um prescritor
   habilitado. Fabricante e tratamento não são prescrição; são venda.
2. **Temporal** — a escolha comercial acontece *depois* da prescrição, no
   atendimento, e pode mudar (o cliente troca de antirreflexo, o laboratório
   substitui a linha) sem que a prescrição mude.
3. **Cardinalidade** — uma receita pode originar vários pares de óculos, cada um
   com lente diferente. Guardar a lente na receita força duplicar a prescrição.

## Decisão

Separar em duas cadeias que só se encontram na Ordem de Serviço:

```
CLIENTE → RECEITA CLÍNICA

O.S. → RECEITA UTILIZADA → ESPECIFICAÇÃO DA LENTE → PRODUTO/PREÇO → LABORATÓRIO
```

`optical_prescriptions` e `optical_prescription_measures` contêm **apenas** dado
clínico. É proibido adicionar a elas: tipo de lente, fabricante, material, índice,
tratamento, coloração, diâmetro, curva base, laboratório, produto ou preço.

Esses atributos vivem em `service_order_lens_specs` e
`service_order_lens_treatments` (o que foi fabricado), alimentados pelo catálogo
`products` + `lens_attributes` (o que a ótica vende).

## Alternativas consideradas

- **Manter tudo na receita (modelo auditado).** Rejeitada: impede duas O.S. com
  lentes diferentes a partir da mesma prescrição e polui o dado clínico com dado
  comercial.
- **Tabela intermediária "receita comercial".** Rejeitada: é exatamente a O.S., que
  já existe. Criar uma terceira entidade só adicionaria um salto sem dono.

## Consequências

**Positivas**
- Uma receita serve N O.S. sem duplicação.
- O dado clínico pode receber tratamento LGPD específico (dado de saúde) sem
  arrastar junto o catálogo comercial.
- Trocar de laboratório ou de linha de lente não toca o histórico clínico.

**Negativas**
- A tela de venda precisa juntar duas fontes (receita + catálogo). Resolvido com a
  view `v_service_order_production`.
- Uma consulta "qual lente o cliente usa hoje" exige passar pela O.S., não pela
  receita. É o custo correto: a lente é da O.S.

## Aplicação

`db/migrations/0004_optical_prescriptions.sql` (cabeçalho + `COMMENT ON TABLE`),
`db/migrations/0007_service_orders.sql`.
