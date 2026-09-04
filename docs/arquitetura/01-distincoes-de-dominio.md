# Distinções de domínio confirmadas na auditoria

Resposta ponto a ponto ao complemento do Prompt 02. Cada item traz **a decisão**,
**onde ela vive no schema** e **como o banco a impede de ser violada**.

Referências de arquivo: `db/migrations/*.sql`. Cada decisão tem um ADR em
`docs/arquitetura/adr/`.

---

## 1. Receita não é lente

**Decisão:** a receita é prescrição clínica pura. Nenhum atributo comercial entra nela.

`public.optical_prescriptions` **não possui e não pode receber**: tipo de lente,
fabricante, material, índice, tratamento, laboratório, produto ou preço. O comentário
da tabela e o cabeçalho da migration `0004` registram a proibição explicitamente.

A cadeia foi separada exatamente como pedido:

```
CLIENTE ──> RECEITA CLÍNICA                (optical_prescriptions + _measures)

O.S. ──> RECEITA UTILIZADA                 (service_order_prescriptions + _measures)
     ──> MEDIDAS DE MONTAGEM               (service_order_fittings + _measures)
     ──> ESPECIFICAÇÃO DA LENTE            (service_order_lens_specs + _treatments)
     ──> PRODUTO/PREÇO                     (sale_items ← products/price_tables)
     ──> LABORATÓRIO                       (lab_orders + lab_order_items)
```

O que amarra as duas metades é `service_order_lens_specs.sale_item_id`: a lente
fabricada aponta para o item vendido, e o item vendido aponta para o produto do
catálogo. A receita nunca participa dessa ponte.

→ [ADR-001](adr/ADR-001-receita-nao-e-lente.md)

---

## 2. Snapshot da receita na O.S.

**Decisão: snapshot tipado + versionamento encadeado.** Os dois, não um ou outro.

1. **Versionamento na receita.** `optical_prescriptions` é imutável após a emissão.
   Correção não é `UPDATE`: é uma nova linha com `supersedes_prescription_id`
   apontando para a anterior. As versões compartilham `root_prescription_id`, e o
   índice parcial `optical_prescriptions_single_active_revision` garante **uma única
   versão ativa por cadeia**.
2. **Snapshot na O.S.** `take_prescription_snapshot(os_id, prescription_id)` copia
   cabeçalho e medidas para `service_order_prescriptions` /
   `service_order_prescription_measures`. A O.S. lê o próprio snapshot — nunca a
   receita viva.

Por que os dois: o snapshot preserva o que foi produzido; a cadeia de versões
preserva a história clínica e permite auditar de qual receita o snapshot saiu
(`source_prescription_id` + `source_revision`, com `ON DELETE RESTRICT`).

O snapshot também aceita divergência legítima: `is_adjusted` + `adjustment_reason`
registram quando o valor produzido diferiu do prescrito (adaptação, transposição).

Guardas no banco:

| Tentativa | Resultado |
|---|---|
| `UPDATE` em medidas de R1 depois de emitida | erro `tg_prescription_measures_immutable` |
| `UPDATE` nos dados clínicos de R1 | erro `tg_prescription_immutable` |
| `UPDATE` no snapshot de uma O.S. fora do estágio `draft` | erro `tg_so_snapshot_immutable` |
| `DELETE` de uma receita usada por O.S. | erro de FK (`ON DELETE RESTRICT`) |

Validado no cenário: a O.S. #100 continua exibindo esférico OD `-2.00` depois de R2
entrar com `-2.50`.

→ [ADR-002](adr/ADR-002-snapshot-e-versionamento-da-receita.md)

---

## 3. DNP e DP não são o mesmo campo

**Decisão:** três medidas semanticamente distintas, em três lugares distintos.

| Medida | Onde | Significado |
|---|---|---|
| `optical_prescription_measures.dnp_mm` (OD/OS) | Receita | **DNP clínica**: o que o prescritor mediu/prescreveu |
| `service_order_fitting_measures.dnp_mm` (OD/OS) | O.S. | **DNP de montagem**: aferida contra a armação escolhida |
| `service_order_fittings.dp_total_mm` | O.S. | **DP total** binocular, medida de montagem/legado |

`dp_source` diz de onde o DP total veio (`measured`, `derived_from_dnp`,
`from_prescription`), porque `DNP_OD + DNP_OS = DP` só vale em face simétrica.

Demais medidas ópticas de montagem, todas na O.S. e nunca na receita:

- `fitting_height_mm` por olho (altura OD/OE — obrigatória em multifocal);
- `near_dnp_mm` (DNP de perto);
- `vertex_distance_mm`, `pantoscopic_tilt_deg`, `wrap_angle_deg`;
- `horizontal_decentration_mm` / `vertical_decentration_mm`;
- caixa da armação (`frame_lens_width_mm`, `frame_bridge_mm`, `frame_vertical_box_mm`).

A view `v_service_order_production` mostra `od_dnp_prescribed` ao lado de
`od_dnp_fitting` de propósito: a divergência entre as duas é informação de
qualidade, não erro de digitação a ser "corrigido" achatando os campos.

Regra óptica com força de banco: lente com `requires_fitting_height` sem altura
informada, ou `requires_addition` sem adição na receita utilizada, é rejeitada
(`tg_lens_spec_requires_fitting_height`).

→ [ADR-007](adr/ADR-007-dnp-nao-e-dp.md)

---

## 4. Cliente é agregador, não tabela gigante

**Decisão:** `customers` guarda identidade e navegação. Todo histórico é satélite.

`customers` tem 17 colunas — nenhuma delas é histórico. Os satélites são exatamente
os pedidos:

`customer_contacts` · `customer_addresses` · `customer_relationships` ·
`individual_profiles` / `company_profiles` · `optical_prescriptions` · `quotes` ·
`sales` · `service_orders` · `receivables` · `customer_credits` ·
`customer_attachments` · `customer_communications` · `customer_consents` ·
`customer_audit_events` · `customer_branch_profiles`.

A tela em abas é resolvida por **view**, não por desnormalização:
`v_customer_overview` monta nome, documento, telefone e e-mail principais e ainda
devolve `pending_fields` (o que falta no cadastro). O banco continua normalizado.

Integridade cruzada: todo satélite carrega `tenant_id` e usa FK composta
`(customer_id, tenant_id) → customers(id, tenant_id)`. É impossível pendurar um
contato de um tenant em um cliente de outro.

→ [ADR-004](adr/ADR-004-cliente-agregador.md)

---

## 5. Responsável / dependente

**Decisão: `customer_relationships` N:N. Não existe entidade "Família".**

O campo único `responsible_customer_id` foi avaliado e **rejeitado**:

| Cenário real | Campo único | Tabela N:N |
|---|---|---|
| Criança com pai e mãe como responsáveis | não representa | representa |
| Um responsável com 3 dependentes | representa | representa |
| Cônjuge (relação simétrica, sem hierarquia) | força hierarquia falsa | representa |
| Responsável financeiro ≠ responsável legal | não representa | `is_financial_responsible` / `is_legal_guardian` |
| Autorizado só a retirar o produto | não representa | `is_pickup_authorized` |
| Relação que termina (divórcio, maioridade) | perde a história | `valid_from` / `valid_to` |

O tipo de vínculo é `catalog_entries` com `catalog_key = 'relationship_type'`
(filho, pai/mãe, cônjuge, irmão, responsável legal, empregador…), extensível por
tenant.

→ [ADR-003](adr/ADR-003-relacionamento-cliente-cliente.md)

---

## 6. Pessoa física e pessoa jurídica

**Decisão:** `customers` + perfil especializado 1:1 (`individual_profiles` /
`company_profiles`). Nada de tabela única com dezenas de colunas nulas.

- PF: CPF, RG, nascimento, gênero, estado civil, profissão, filiação.
- PJ: CNPJ, razão social, IE (com `state_registration_exempt`), IM, regime
  tributário, contribuinte ICMS, SUFRAMA, fundação.

Nenhuma dessas colunas fica nula "por não se aplicar" — elas simplesmente não
existem na outra tabela.

Consistência garantida por trigger (`tg_customer_profile_matches_type`): não se
cria `company_profiles` para um cliente `party_type = 'individual'`. CPF e CNPJ têm
validação de dígito verificador em `CHECK` (`is_valid_cpf` / `is_valid_cnpj`), e
unicidade **por tenant** via índice parcial sobre os dígitos.

→ [ADR-005](adr/ADR-005-pf-e-pj.md)

---

## 7. Cadastro rápido

**Decisão:** cadastro rápido **não é outra entidade nem outro fluxo**. É o mesmo
registro, no mesmo nível de exigência mínima, marcado com
`record_status = 'quick'`.

Presente em `customers`, `suppliers`, `prescribers` e `products` — os quatro
cadastros que o fluxo comercial precisa criar sem abandonar a operação.

A regra de completude mora em **uma única função**,
`customer_missing_fields(customer_id, requirement)`, com níveis `quick`,
`complete`, `fiscal` e `credit`. Tela de cadastro rápido, tela de cadastro
completo, emissão fiscal e liberação de crediário chamam a mesma função — é
impossível o cadastro rápido "escapar" de uma validação.

Promover para `complete` com pendências levanta exceção
(`customers_promotion_guard`, constraint trigger deferida). As validações de
documento (`is_valid_cpf`, `is_valid_cnpj`) valem em qualquer caminho, porque são
`CHECK` de coluna.

→ [ADR-006](adr/ADR-006-cadastro-rapido.md)

---

## 8. Cliente avulso

**Decisão: opção B — venda realmente anônima (`customer_id` NULL) sob regras
explícitas. O "Cliente Padrão" foi rejeitado.**

Análise de impacto que sustenta a decisão:

| Dimensão | Cliente Padrão (registro especial) | `customer_id` NULL (adotado) |
|---|---|---|
| **Fiscal** | CPF na nota vira campo do cadastro fake; risco de emitir NF-e para um CPF inexistente | `sales.tax_document_on_invoice` guarda o CPF/CNPJ **da nota**, validado, sem criar cadastro |
| **LGPD** | acumula dados pessoais reais em um registro compartilhado — titular impossível de identificar e de atender | não há titular: não há dado pessoal armazenado além do documento fiscal |
| **BI** | um "cliente" com milhares de compras destrói ticket médio, recorrência, RFM | vendas anônimas são segmentáveis (`sale_type = 'anonymous'`, índice próprio) |
| **Garantia / troca** | garantia nominal impossível de rastrear | garantia se dá pelo número da venda; troca gera `customer_credits` só se houver cliente |
| **O.S.** | O.S. órfã pendurada no cliente genérico | proibida por trigger — O.S. exige cliente identificado |
| **Crediário** | risco real de crédito concedido ao "cliente padrão" | `payment_methods.requires_customer` bloqueia no banco |
| **Comissão** | comissão existe normalmente | comissão existe normalmente (é por item/vendedor, não por cliente) |
| **Histórico** | histórico de compras de pessoas diferentes misturado | não há histórico a misturar |

Como o banco garante:

```sql
constraint sales_customer_matches_type
  check ((sale_type = 'identified') = (customer_id is not null))
```

mais `tg_sale_payment_requires_customer` (crediário/cheque/crédito de loja) e
`tg_service_order_requires_identified_sale` (O.S.). `receivables.customer_id` é
`NOT NULL` — título financeiro sem titular não existe.

Se o cliente decidir se identificar depois, o caminho é criar o cadastro e vincular
a venda (`sale_type` passa a `identified`), não converter um registro fantasma.

→ [ADR-009](adr/ADR-009-cliente-avulso.md)

---

## 9. Filial de cadastro ≠ escopo total do cliente

**Decisão:** o cliente pertence ao **TENANT**. A filial é proveniência e
preferência, nunca propriedade.

- `customers.created_at_branch_id` — onde o cadastro nasceu (auditoria/BI).
- `customers.preferred_branch_id` — unidade de preferência.
- `customer_branch_profiles` — **vendedor preferencial, tabela de preço e convênio
  por filial**, sem duplicar o cliente.

Análise dos pontos levantados:

| Ponto | Como fica |
|---|---|
| **CPF duplicado entre filiais** | eliminado: índice único `(tenant_id, digits(cpf))`. Duas filiais não conseguem criar o mesmo CPF duas vezes |
| **Histórico consolidado** | natural: vendas, O.S. e receitas apontam para o cliente do tenant, cada uma com sua `branch_id` |
| **Permissões** | RLS em duas camadas: isolamento por tenant (permissiva) + escopo por filial (restritiva) sobre **documentos operacionais**; o cadastro do cliente fica deliberadamente fora do escopo por filial |
| **LGPD** | consentimento é do titular perante o **controlador (tenant)**, não por loja — `customer_consents` é por cliente |
| **Vendedor preferencial por filial** | `customer_branch_profiles.preferred_salesperson_id` |
| **Preços/convênios por filial** | `customer_branch_profiles.price_table_id` + `price_table_branches` |

Se uma rede quiser restringir a visão de cadastro por unidade, isso é uma política
adicional sobre `customers`, não uma mudança de modelo.

→ [ADR-008](adr/ADR-008-cliente-pertence-ao-tenant.md)

---

## 10. Navegação não dita modelo de domínio

O modelo foi fechado primeiro (migrations `0001`–`0009`); o menu foi **derivado**
depois, em [`04-mapa-de-menu.md`](04-mapa-de-menu.md).

Não existe "Cadastros → Tabelas". Os agrupamentos saem dos contextos:

```
Produtos      → Categorias · Marcas · Tabelas de preço · Fornecedores
Financeiro    → Formas de pagamento · Plano de contas · A receber · A pagar · Comissões
Óptica        → Prescritores · Tipos/Materiais/Tratamentos de lente · Laboratórios
Administração → Empresa · Filiais · Usuários · Papéis e permissões · Catálogos
```

→ [ADR-011](adr/ADR-011-navegacao-derivada-do-dominio.md)

---

## 11. Não copiar enums sem analisar

Nenhum enum do sistema auditado foi replicado. Cada lista foi classificada em três
categorias, com a tabela completa em
[`05-catalogos-e-enums.md`](05-catalogos-e-enums.md):

| Categoria | Quando | Onde vive |
|---|---|---|
| **(a) Enum de código** | o valor **muda comportamento** do software | `CHECK` na coluna |
| **(b) Catálogo configurável** | lista puramente descritiva | `catalog_entries` (`tenant_id` NULL = semente da plataforma) |
| **(c) Tabela dedicada** | a lista carrega **regras e atributos próprios** | tabela própria |

Decisões dos itens de atenção citados no briefing:

| Lista | Categoria | Justificativa |
|---|---|---|
| Profissão | (b) tenant estende | descritiva, longa, regional |
| Origem do cliente | (b) tenant estende | descritiva; muda por estratégia de marketing |
| Grau de parentesco | (b) tenant estende | descritiva; o comportamento está nos *flags* do relacionamento |
| Grupos de produto | (c) `product_categories` | hierarquia + regra de comissão por categoria |
| Formas de pagamento | (c) `payment_methods` | prazo, taxa, parcelamento, geração de financeiro, exigência de cliente |
| Situação da O.S. | (c) `service_order_statuses` + `_transitions` | máquina de estados com efeitos (notifica, bloqueia entrega) |
| Tipos de documento | (b) plataforma + tenant | descritiva |
| Status financeiros | (a) enum de código | dirigem cálculo de saldo, inadimplência e baixa |

Regra de ouro aplicada: **o tenant pode renomear qualquer rótulo, nunca inventar um
comportamento.** Por isso `service_order_statuses` tem `code`/`label` livres e
`stage` canônico fechado — a otica chama de "No laboratório" ou "Enviado pro lab",
mas o produto sabe que aquilo é `awaiting_lab`.

→ [ADR-010](adr/ADR-010-politica-de-enums-e-catalogos.md)

---

## 12. Regra final — o cenário completo

O cenário do briefing está implementado como **teste executável**:
`db/tools/scenario_item12.sql`, rodado por `db/tools/validate.sh` contra um
PostgreSQL real.

Ele percorre cliente na Filial A → R1 → orçamento (armação + multifocal + AR) →
venda (PIX + cartão) → O.S. com snapshot → especificação da lente → laboratório →
reserva/baixa de estoque → financeiro → comissão → produção → aviso → entrega →
R2 seis meses depois.

Assertivas que o script exige (falha = erro, não aviso):

| | Assertiva |
|---|---|
| A | R1 continua no histórico (`superseded`, nunca apagada) |
| B | a O.S. #100 continua mostrando exatamente a prescrição utilizada |
| C | R2 passa a ser a receita vigente para novos pedidos |
| D | editar R1 após a emissão é bloqueado pelo banco |
| E | alterar o snapshot de uma O.S. em produção é bloqueado pelo banco |
| F | venda avulsa não aceita crediário, não gera O.S. e não aceita cliente fake |
| G | RLS isola tenants |

Resultado da última execução em [`03-cenario-de-validacao.md`](03-cenario-de-validacao.md).
