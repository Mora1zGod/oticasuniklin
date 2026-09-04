# Cenário de validação — Regra final (item 12)

> *"Se a arquitetura não representar esse cenário sem duplicação incoerente de
> dados, revise-a antes de concluir."*

O cenário não virou texto: virou **teste executável** contra um PostgreSQL real.

```bash
# requer um Postgres 14+ acessível via psql
./db/tools/validate.sh
```

O script recria o banco do zero, aplica as 9 migrations, os seeds de plataforma e
roda `db/tools/scenario_item12.sql`. Qualquer assertiva que falhe interrompe a
execução com erro.

## O que o cenário percorre

| Passo | O que acontece | Onde grava |
|---|---|---|
| 1 | Cliente cadastrado na **Filial A** (rápido → completo) | `customers`, `customer_contacts`, `individual_profiles`, `customer_addresses`, `customer_consents`, `customer_branch_profiles` |
| 2 | Receita **R1** (multifocal, com DNP por olho) | `optical_prescriptions` + `optical_prescription_measures` |
| 3 | Orçamento: armação + lente multifocal OD/OS + antirreflexo | `quotes` + `quote_items` |
| 4 | Venda com **PIX (R$ 1.000) + cartão 4x (R$ 1.589)** | `sales`, `sale_items`, `sale_payments` |
| 5 | **O.S. #100** com snapshot de R1 | `service_orders`, `service_order_prescriptions` (+ medidas) |
| 6 | Medidas de montagem: DNP aferida + altura por olho + DP total | `service_order_fittings` + `_measures` |
| 7 | Especificação da lente por olho + tratamento | `service_order_lens_specs` + `_treatments` |
| 8 | Armação **reservada** na venda | `stock_balances.reserved_quantity`, `stock_movements` (`reserve`) |
| 9 | Pedido ao laboratório + conta a pagar | `lab_orders`, `lab_order_items`, `payables` |
| 10 | Financeiro (4 parcelas) e comissão (3% por item) | `receivables`, `commissions` |
| 11 | Produção: aberta → lab → produção → recebida → montagem → pronta → entregue | `service_order_status_history` (7 linhas, automáticas) |
| 12 | Cliente avisado no WhatsApp | `customer_communications` |
| 13 | Entrega: reserva liberada e **baixa efetiva** do estoque | `stock_balances`, `stock_movements` (`sale_out`) |
| 14 | **Seis meses depois:** cliente cadastra **R2** | nova linha em `optical_prescriptions` com `supersedes_prescription_id = R1` |

## Assertivas

| | Assertiva | Como é verificada |
|---|---|---|
| **A** | R1 continua no histórico | `optical_prescriptions.status = 'superseded'` (nunca `DELETE`) |
| **B** | a O.S. antiga mostra exatamente a prescrição utilizada | `v_service_order_production.od_sphere_used = -2.00` (valor de R1) mesmo após R2 |
| **C** | R2 é a receita vigente para novos pedidos | `latest_active_prescription(cliente) = R2` |
| **D** | R1 não pode ser editada após emitida | `UPDATE` nas medidas levanta exceção |
| **E** | snapshot da O.S. em produção não pode ser alterado | `UPDATE` no snapshot levanta exceção |
| **F** | venda avulsa sem crediário, sem O.S., sem cliente fake | três `INSERT` que **devem** falhar |
| **G** | RLS isola tenants | usuário do tenant A vê 1 cliente e 1 tenant, com papel `authenticated` |

## Última execução

```
==> migrations
    - 0001_core_tenant_branch.sql ... 0009_rls_policies.sql
==> seeds
    - 0001_platform_catalogs.sql
==> cenario de validacao (item 12 do briefing)
NOTICE:  [A][B][C][D][E] OK — snapshot, versionamento, imutabilidade e estoque validados
NOTICE:  [F] OK — venda avulsa anonima sem crediario, sem O.S. e sem cliente fake
NOTICE:  [G] OK — RLS isolando por tenant

--- Historico de receitas do cliente (R1 preservada, R2 vigente) ---
 revision | emitida_em |   status   | od_sphere | od_cylinder | od_axis | od_addition | od_dnp | os_dnp
----------+------------+------------+-----------+-------------+---------+-------------+--------+--------
        1 | 2026-08-25 | superseded |     -2.00 |       -0.75 |      90 |        2.00 |   32.0 |   31.0
        2 | 2027-02-21 | active     |     -2.50 |       -0.75 |      90 |        2.50 |   32.0 |   31.0

--- O.S. #100: prescricao UTILIZADA (snapshot) x medidas de MONTAGEM ---
 status_stage | od_sphere_used | od_addition_used | od_dnp_prescribed | od_dnp_fitting | od_height | os_dnp_prescribed | os_dnp_fitting | os_height | dp_total_mm
--------------+----------------+------------------+-------------------+----------------+-----------+-------------------+----------------+-----------+-------------
 delivered    |          -2.00 |             2.00 |              32.0 |           32.5 |      22.0 |              31.0 |           31.0 |      21.5 |        63.5

--- Especificacao da lente (dominio comercial, fora da receita) ---
 eye |    lens_type_label     | lens_material_label | refractive_index |  design  | supply_mode |        laboratorio         | tratamentos
-----+------------------------+---------------------+------------------+----------+-------------+----------------------------+--------------
 OD  | Multifocal/Progressiva | Alto indice 1.60    |            1.600 | freeform | surfaced    | Laboratorio Optico Central | Antirreflexo
 OS  | Multifocal/Progressiva | Alto indice 1.60    |            1.600 | freeform | surfaced    | Laboratorio Optico Central | Antirreflexo

==> OK
```

## Leitura das três saídas

1. **Histórico de receitas** — R1 e R2 coexistem. R1 virou `superseded`
   automaticamente quando R2 foi ativada; nada foi apagado nem sobrescrito.

2. **O.S. #100** — entregue, mostrando `od_sphere_used = -2.00` e
   `od_addition_used = 2.00`, que são os valores de **R1**. R2 tem `-2.50` / `2.50`
   e não contaminou a produção passada. Ao lado, a distinção do item 3 fica
   explícita: `od_dnp_prescribed = 32,0` (receita) contra `od_dnp_fitting = 32,5`
   (montagem), com `dp_total = 63,5` — três medidas, três significados.

3. **Especificação da lente** — tipo, material, índice, design, laboratório e
   tratamento estão na O.S., **não** na receita. É a separação do item 1 visível no
   dado.

## Duplicação: o que é cópia legítima

Existe duplicação **intencional e controlada** em três lugares, todos snapshot:

| Cópia | Por quê | Rastreabilidade |
|---|---|---|
| `service_order_prescriptions` (grau) | congela o que foi produzido | `source_prescription_id` + `source_revision` |
| `sale_items.description` | preserva o nome do produto na data da venda | `product_id` |
| `service_order_lens_specs.lens_type_label` / `lens_material_label` | preserva o catálogo na data do pedido | `lens_type_id` / `lens_material_id` |

Em todos os casos o **id de origem continua ali**: é cópia com procedência, não
denormalização cega. Nenhuma delas é lida como fonte de verdade para dados atuais.
