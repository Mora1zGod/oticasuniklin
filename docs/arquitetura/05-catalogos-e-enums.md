# Catálogos e enums — classificação completa

Item 11 do briefing. Nenhuma lista foi copiada do sistema auditado sem decisão.

## As três categorias

| Categoria | Critério | Implementação | Quem cria itens |
|---|---|---|---|
| **(a) Enum de código** | o valor **muda o comportamento** do software | `CHECK` na coluna | ninguém — só o desenvolvimento |
| **(b) Catálogo configurável** | lista **descritiva**, sem comportamento | `catalog_entries` | plataforma semeia, tenant estende |
| **(c) Tabela dedicada** | a lista carrega **regras/atributos próprios** | tabela própria | tenant, dentro dos limites do produto |

**Teste para classificar:** *"se um usuário criar um valor novo aqui, algum `if` do
sistema precisa mudar?"*
Sim → (a). Não, e o valor tem só rótulo → (b). Não, mas o valor tem atributos que o
sistema lê → (c).

---

## (a) Enums de código

Estes **não** são configuráveis. Cada um dirige uma regra.

| Coluna | Valores | O que dirige |
|---|---|---|
| `customers.party_type` | `individual`, `company` | qual perfil 1:1 é válido, quais campos fiscais existem |
| `customers.record_status` | `quick`, `complete` | nível de validação exigido |
| `customers.status` | `active`, `inactive`, `blocked`, `merged` | bloqueio de venda, consolidação de duplicados |
| `optical_prescriptions.status` | `draft`, `active`, `superseded`, `void` | imutabilidade, receita vigente, uso em produção |
| `optical_prescriptions.cylinder_notation` | `negative`, `positive` | leitura correta do grau (transposição) |
| `optical_prescription_measures.eye` | `OD`, `OS` | lateralidade — nunca texto livre |
| `sales.sale_type` | `identified`, `anonymous` | exige ou proíbe cliente (ADR-009) |
| `sales.status` | `open`, `confirmed`, `invoiced`, `cancelled`, `returned` | estoque, financeiro, comissão |
| `service_order_statuses.stage` | `draft` … `delivered`, `cancelled` | **estágio canônico** por trás do rótulo livre do tenant |
| `payment_methods.kind` | `cash`, `credit_card`, `pix`, `installment_plan`, … | conciliação, taxa, prazo |
| `receivables.status` | `open`, `partially_paid`, `paid`, `overdue`, … | saldo, inadimplência, baixa |
| `products.product_kind` | `frame`, `lens`, `contact_lens`, … | atributos aplicáveis, regra de estoque, comissão |
| `service_order_lens_specs.supply_mode` | `stock`, `surfaced` | gera ou não pedido a laboratório |
| `stock_movements.movement_kind` | `reserve`, `sale_out`, `lab_out`, … | efeito no saldo |
| `commission_rules.release_event` | `sale_confirmed`, `sale_paid`, `order_delivered` | quando a comissão vira direito |

> **Padrão adotado:** `CHECK (coluna in (...))`, não `CREATE TYPE ... AS ENUM`.
> Motivo: adicionar valor a um `ENUM` do PostgreSQL é DDL que não roda dentro de
> transação em versões antigas e não permite remover valor; `CHECK` é migração
> comum, reversível e legível no Supabase.

---

## (b) Catálogos configuráveis — `catalog_entries`

Estrutura: `catalog_key` + `code` + `label`, com `tenant_id NULL` = semente da
plataforma. `resolve_catalog(key, tenant)` devolve a lista efetiva, com o item do
tenant sobrepondo o da plataforma quando o `code` coincide.

| `catalog_key` | Escopo | Semente da plataforma |
|---|---|---|
| `customer_origin` | plataforma + tenant | balcão, indicação, redes sociais, WhatsApp, prescritor, campanha, convênio |
| `profession` | plataforma + tenant | — (tenant preenche; lista regional) |
| `relationship_type` | plataforma + tenant | filho(a), pai/mãe, cônjuge, irmão(ã), responsável legal, empregador, outro |
| `marital_status` | plataforma + tenant | solteiro, casado, divorciado, viúvo, união estável |
| `document_type` | plataforma + tenant | receita, RG/CNH, comprovante de endereço, contrato, foto |
| `customer_agreement` | só tenant | — (convênios são do negócio) |
| `cancel_reason` | plataforma + tenant | — |
| `warranty_reason` | plataforma + tenant | — |

**Por que profissão e origem não viraram tabela dedicada:** nenhuma regra do sistema
lê esses valores. Se amanhã "origem = convênio" passar a disparar uma regra de
preço, o item migra para (c) — a migração é conhecida e barata, o inverso não é.

---

## (c) Tabelas dedicadas

| Tabela | Atributos que justificam a promoção |
|---|---|
| `payment_methods` | `kind`, `generates_receivable`, `allows_installments`, `max_installments`, `settlement_days`, `fee_percent`, `requires_acquirer`, **`requires_customer`**, `chart_account_id` |
| `service_order_statuses` | `stage` canônico, `is_initial`, `is_final`, `blocks_delivery`, `notifies_customer`, `color_hex` |
| `service_order_status_transitions` | a máquina de estados é **dado**, validada por trigger — a otica desenha o próprio fluxo sem alterar código |
| `product_categories` | hierarquia (`parent_id`) + base de regra de comissão |
| `brands` | fabricante, usada em relatório de giro |
| `price_tables` (+ `_items`, `_branches`) | vigência, desconto máximo por item, escopo por filial |
| `lens_types` | **`requires_addition`**, **`requires_fitting_height`**, `vision_design` — dirigem validação óptica |
| `lens_materials` | `default_refractive_index`, `abbe_number` |
| `lens_treatments` | `treatment_group`, `is_billable` |
| `laboratories` | `default_lead_days`, `integration_kind`, `integration_config` |
| `prescribers` | conselho (CRM/CRO), UF, unicidade por conselho |
| `chart_accounts` | hierarquia contábil, `account_kind`, `accepts_entries` |
| `commission_rules` | escopo (filial, usuário, categoria), alíquota, base, evento de liberação |
| `roles` / `role_permissions` | permissões efetivas usadas pela RLS |

---

## Rótulo é do tenant; comportamento é do produto

O caso mais importante é `service_order_statuses`:

```sql
code   = 'no_lab'                 -- o tenant escolhe
label  = 'Enviada ao laboratório' -- o tenant escolhe
stage  = 'awaiting_lab'           -- fechado pelo produto (CHECK)
```

Uma rede pode ter 12 situações de O.S. e outra apenas 5. Relatórios, SLA de
produção e automações de WhatsApp leem `stage`, nunca `label`. É o que permite
personalização sem fragmentar o produto — o erro clássico de copiar os enums do
sistema legado.
