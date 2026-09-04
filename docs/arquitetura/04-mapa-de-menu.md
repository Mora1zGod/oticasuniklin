# Mapa de menu — derivado do domínio

Item 10 do briefing. O menu é **consequência** do modelo, não o contrário.
Nenhum item "Cadastros → Tabelas": todo agrupamento corresponde a um contexto real.

## Regra de derivação

1. Um item de menu existe porque uma **entidade de domínio** existe.
2. O agrupamento é o **contexto** ao qual a entidade pertence (`02-modelo-de-dados.md`).
3. Se um cadastro não tem relação com os vizinhos do grupo, o grupo está errado —
   não o modelo.

## Estrutura

```
🏠 Início
   Painel da filial · O.S. atrasadas · Contas do dia · Aniversariantes

👤 Clientes
   Clientes                      customers (+ perfis PF/PJ)
   Relacionamentos               customer_relationships
   Comunicações                  customer_communications
   Consentimentos (LGPD)         customer_consents

👓 Óptica
   Receitas                      optical_prescriptions
   Prescritores                  prescribers
   Tipos de lente                lens_types
   Materiais de lente            lens_materials
   Tratamentos                   lens_treatments
   Laboratórios                  laboratories

🛒 Comercial
   Orçamentos                    quotes
   Vendas                        sales
   Vendas avulsas                sales (sale_type = 'anonymous')
   Trocas e devoluções           customer_credits

🔧 Ordens de serviço
   Painel de produção            v_service_order_production
   Ordens de serviço             service_orders
   Pedidos ao laboratório        lab_orders
   Situações e transições        service_order_statuses (+ _transitions)

📦 Produtos
   Produtos                      products
   Armações                      products (product_kind = 'frame') + frame_attributes
   Lentes                        products (product_kind = 'lens') + lens_attributes
   Categorias                    product_categories
   Marcas                        brands
   Tabelas de preço              price_tables (+ _items, _branches)
   Fornecedores                  suppliers

📊 Estoque
   Saldos por filial             stock_balances
   Movimentações                 stock_movements
   Reservas de O.S.              stock_movements (kind = 'reserve')

💰 Financeiro
   Contas a receber              receivables (+ receivable_settlements)
   Contas a pagar                payables
   Formas de pagamento           payment_methods
   Plano de contas               chart_accounts
   Crédito de clientes           customer_credits
   Comissões                     commissions (+ commission_rules)

⚙️ Administração
   Empresa                       tenants
   Filiais                       branches
   Usuários                      app_users
   Acesso por filial             user_branch_access
   Papéis e permissões           roles (+ role_permissions)
   Listas configuráveis          catalog_entries
   Numeração de documentos       document_sequences
```

## O que deliberadamente NÃO virou item de menu

| Não existe | Por quê |
|---|---|
| "Cadastros → Tabelas" | agrupamento sem semântica; cada lista foi para o seu contexto |
| "Cliente Padrão" | não existe no modelo (ADR-009) |
| "Cadastro rápido" como tela separada | é o mesmo cadastro, em modal, com o mesmo conjunto de regras (ADR-006) |
| "Família" | o vínculo é cliente↔cliente (ADR-003) |
| "Lentes da receita" | lente não pertence à receita (ADR-001) |

## Onde o cadastro rápido aparece

Como **modal dentro do fluxo**, nunca como menu próprio:

- Orçamento/Venda → botão "+ Cliente" → `customers` com `record_status = 'quick'`
- Venda → "+ Produto" → `products` com `record_status = 'quick'`
- Receita → "+ Prescritor" → `prescribers` com `record_status = 'quick'`
- Compra → "+ Fornecedor" → `suppliers` com `record_status = 'quick'`

Todos gravam nas tabelas definitivas e passam pelas mesmas validações. O que muda é
só o nível de completude exigido naquele momento
(`customer_missing_fields(id, 'quick')`).

A tela de listagem de clientes traz um filtro "cadastros incompletos" alimentado por
`v_customer_overview.pending_fields` — a dívida de cadastro fica visível em vez de
escondida.
