# ADR-007 — DNP e DP não são o mesmo campo

**Status:** Aceito · **Data:** 2026-09-04 · **Briefing:** item 3

## Contexto

A auditoria encontrou DNP por olho na receita e DP apenas na O.S., e alertou para
não tratar isso como duplicidade a ser unificada. Está correto: são medidas
diferentes, com origem, momento e finalidade diferentes.

## Definições adotadas

| Medida | Onde | Quem mede | Para quê |
|---|---|---|---|
| **DNP OD / DNP OE** (`optical_prescription_measures.dnp_mm`) | Receita | prescritor | distância naso-pupilar de cada olho, no exame |
| **DNP de montagem OD/OE** (`service_order_fitting_measures.dnp_mm`) | O.S. | vendedor/óptico | aferida contra a armação escolhida, na postura de uso |
| **DP total** (`service_order_fittings.dp_total_mm`) | O.S. | vendedor/óptico | soma binocular; medida de montagem e de sistemas legados |

`DNP_OD + DNP_OE = DP` **só vale em face simétrica**. Assimetria facial é comum, e é
exatamente por isso que a montagem monofocal moderna usa DNP por olho. Achatar tudo
em um campo "DP" perde a informação que evita erro de centragem.

`dp_source` registra a procedência do DP total: `measured`, `derived_from_dnp` ou
`from_prescription`.

## Demais medidas ópticas — todas na O.S.

- `fitting_height_mm` por olho (altura OD/OE) — obrigatória em multifocal e bifocal;
- `near_dnp_mm` (DNP de perto);
- `vertex_distance_mm`, `pantoscopic_tilt_deg`, `wrap_angle_deg` — parâmetros de
  lente freeform;
- `horizontal_decentration_mm` / `vertical_decentration_mm`;
- caixa da armação (`frame_lens_width_mm`, `frame_bridge_mm`,
  `frame_vertical_box_mm`, `frame_diagonal_mm`).

Nenhuma delas pertence à receita: todas dependem da **armação escolhida**, que é
decisão comercial posterior (ADR-001).

## Regra com força de banco

`tg_lens_spec_requires_fitting_height`: lente cujo `lens_types.requires_fitting_height`
é verdadeiro não pode ser especificada sem altura informada para aquele olho; lente
com `requires_addition` exige adição na receita utilizada da O.S.

## Consequências

**Positivas** — a divergência entre DNP prescrita e DNP de montagem vira informação
de qualidade (exposta lado a lado em `v_service_order_production`), não ruído a ser
"corrigido"; erro de centragem em multifocal cai.

**Negativas** — mais campos na tela de montagem. É o mínimo necessário para
multifocal freeform.

## Aplicação

`db/migrations/0004` (DNP clínico), `db/migrations/0007`
(`service_order_fittings` + `service_order_fitting_measures`).
