-- =============================================================================
-- CENARIO DE VALIDACAO — REGRA FINAL (item 12 do briefing)
-- =============================================================================
-- Cliente cadastrado na Filial A -> receita R1 -> orcamento (armacao + lente
-- multifocal + antirreflexo) -> venda (PIX + cartao) -> O.S. com SNAPSHOT de R1
-- -> especificacao da lente -> laboratorio -> estoque -> financeiro -> comissao
-- -> producao -> aviso -> entrega. Seis meses depois entra R2.
--
-- Assercoes finais:
--   [A] R1 continua no historico (status 'superseded', nunca apagada)
--   [B] a O.S. antiga continua mostrando EXATAMENTE a prescricao utilizada
--   [C] R2 e a receita vigente para novos pedidos
--   [D] editar R1 apos emissao e bloqueado pelo banco
--   [E] alterar o snapshot da O.S. em producao e bloqueado pelo banco
--   [F] venda avulsa nao aceita crediario nem gera O.S.
--   [G] RLS isola tenants
-- =============================================================================
\set ON_ERROR_STOP on
\timing off

begin;

-- -----------------------------------------------------------------------------
-- Estrutura minima
-- -----------------------------------------------------------------------------
insert into public.tenants (id, slug, legal_name, trade_name, tax_document) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'uniklin', 'Oticas Uniklin LTDA', 'Oticas Uniklin', '11222333000181'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'concorrente', 'Outra Rede LTDA', 'Outra Rede', null);

insert into public.branches (id, tenant_id, code, legal_name, trade_name) values
  ('bbbbbbbb-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'A', 'Filial A LTDA', 'Filial A - Centro'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001', 'B', 'Filial B LTDA', 'Filial B - Shopping'),
  ('bbbbbbbb-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000002', 'X', 'Outra Rede LTDA', 'Outra Rede');

insert into auth.users (id, email) values
  ('99999999-0000-0000-0000-000000000001', 'vendedor@uniklin.com'),
  ('99999999-0000-0000-0000-000000000002', 'gerente@outrarede.com');

insert into public.app_users (id, auth_user_id, tenant_id, full_name, email, is_salesperson) values
  ('cccccccc-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001', 'Maria Vendedora', 'vendedor@uniklin.com', true),
  ('cccccccc-0000-0000-0000-000000000009', '99999999-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000002', 'Gerente Concorrente', 'gerente@outrarede.com', false);

insert into public.roles (id, tenant_id, code, label) values
  ('cccccccc-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'sales', 'Vendedor'),
  ('cccccccc-0000-0000-0000-0000000000a9', 'aaaaaaaa-0000-0000-0000-000000000002', 'sales', 'Vendedor');

insert into public.role_permissions (role_id, permission_code) values
  ('cccccccc-0000-0000-0000-0000000000a1', 'clinical.prescription.read'),
  ('cccccccc-0000-0000-0000-0000000000a1', 'clinical.prescription.write'),
  ('cccccccc-0000-0000-0000-0000000000a1', 'customer.consent.read'),
  ('cccccccc-0000-0000-0000-0000000000a1', 'customer.consent.write'),
  ('cccccccc-0000-0000-0000-0000000000a9', 'clinical.prescription.read');

insert into public.user_branch_access (app_user_id, branch_id, role_id, is_default_branch) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000a',
   'cccccccc-0000-0000-0000-0000000000a1', true),
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b',
   'cccccccc-0000-0000-0000-0000000000a1', false),
  ('cccccccc-0000-0000-0000-000000000009', 'bbbbbbbb-0000-0000-0000-00000000000c',
   'cccccccc-0000-0000-0000-0000000000a9', true);

-- Situacoes de O.S. do tenant (rotulo do tenant, estagio canonico do produto)
insert into public.service_order_statuses (id, tenant_id, code, label, stage, is_initial, is_final, notifies_customer) values
  ('50000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aberta',      'Aberta',                'draft',            true,  false, false),
  ('50000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'no_lab',      'Enviada ao laboratorio','awaiting_lab',     false, false, false),
  ('50000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'producao',    'Em producao',           'in_production',    false, false, false),
  ('50000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'recebida',    'Recebida do lab',       'received_from_lab',false, false, false),
  ('50000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'montagem',    'Em montagem',           'assembling',       false, false, false),
  ('50000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'pronta',      'Pronta para retirada',  'ready_for_pickup', false, false, true),
  ('50000000-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000001', 'entregue',    'Entregue',              'delivered',        false, true,  false);

insert into public.service_order_status_transitions (tenant_id, from_status_id, to_status_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000004'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000005'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000006'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000007');

insert into public.payment_methods (id, tenant_id, code, label, kind, generates_receivable, allows_installments, max_installments, requires_customer) values
  ('60000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'pix',      'PIX',              'pix',              false, false, 1,  false),
  ('60000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'credito',  'Cartao de credito','credit_card',      false, true,  12, false),
  ('60000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'crediario','Crediario proprio','installment_plan', true,  true,  10, true);

insert into public.laboratories (id, tenant_id, code, trade_name, default_lead_days) values
  ('70000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'LAB01', 'Laboratorio Optico Central', 7);

insert into public.prescribers (id, tenant_id, full_name, kind, council_type, council_number, council_state) values
  ('80000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Dr. Carlos Oftalmo', 'ophthalmologist', 'CRM', '12345', 'AC');

-- Produtos
insert into public.products (id, tenant_id, sku, name, product_kind, tracks_stock, is_made_to_order, cost_price, list_price) values
  ('f0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'ARM-001',
   'Armacao Acetato Preta', 'frame', true, false, 90.00, 349.00),
  ('f0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'LEN-MULTI-160',
   'Lente Multifocal 1.60', 'lens', false, true, 260.00, 890.00),
  ('f0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'TRAT-AR',
   'Tratamento Antirreflexo', 'lens_treatment', false, false, 30.00, 120.00);

insert into public.frame_attributes (product_id, material, color, lens_width_mm, bridge_mm, temple_mm, vertical_box_mm, diagonal_mm, rim_type)
values ('f0000000-0000-0000-0000-000000000001', 'Acetato', 'Preto', 52.0, 18.0, 140.0, 38.0, 56.0, 'full_rim');

insert into public.lens_attributes (product_id, lens_type_id, lens_material_id, refractive_index, design, supply_mode, default_laboratory_id)
select 'f0000000-0000-0000-0000-000000000002',
       (select id from public.lens_types where code = 'progressive' and tenant_id is null),
       (select id from public.lens_materials where code = 'high_160' and tenant_id is null),
       1.600, 'freeform', 'surfaced', '70000000-0000-0000-0000-000000000001';

insert into public.stock_balances (tenant_id, branch_id, product_id, quantity)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000a',
        'f0000000-0000-0000-0000-000000000001', 3);

-- -----------------------------------------------------------------------------
-- PASSO 1 — Cliente cadastrado na FILIAL A (cadastro rapido -> completo)
-- -----------------------------------------------------------------------------
insert into public.customers (id, tenant_id, party_type, display_name, record_status,
                              created_at_branch_id, preferred_branch_id, origin_entry_id, created_by)
values ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'individual', 'Joao da Silva', 'quick',
        'bbbbbbbb-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-00000000000a',
        (select id from public.catalog_entries where catalog_key = 'customer_origin' and code = 'referral' and tenant_id is null),
        'cccccccc-0000-0000-0000-000000000001');

insert into public.customer_contacts (customer_id, tenant_id, kind, value, is_primary)
values ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'whatsapp', '+5568999990000', true);

-- promocao para cadastro completo: MESMAS regras do cadastro rapido (ADR-006)
insert into public.individual_profiles (customer_id, tenant_id, cpf, birth_date)
values ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        '52998224725', date '1975-04-12');

insert into public.customer_addresses (customer_id, tenant_id, kind, zip_code, street, street_number, city, state_code, is_primary)
values ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'residential', '69900000', 'Rua das Oticas', '100', 'Rio Branco', 'AC', true);

insert into public.customer_consents (customer_id, tenant_id, purpose, granted)
values ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'data_processing', true),
       ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'health_data', true);

update public.customers set record_status = 'complete'
where id = 'dddddddd-0000-0000-0000-000000000001';

-- perfil do cliente na filial (vendedor preferencial) — nao e propriedade (ADR-008)
insert into public.customer_branch_profiles (customer_id, tenant_id, branch_id, preferred_salesperson_id, first_interaction_at)
values ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-000000000001', now());

-- -----------------------------------------------------------------------------
-- PASSO 2 — Receita R1 (clinica pura: sem lente, sem material, sem preco)
-- -----------------------------------------------------------------------------
insert into public.optical_prescriptions
  (id, tenant_id, customer_id, branch_id, prescriber_id, prescriber_name_snapshot,
   prescriber_council_snapshot, issued_at, valid_until, vision_use, status, created_by)
values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000a',
   '80000000-0000-0000-0000-000000000001', 'Dr. Carlos Oftalmo', 'CRM 12345/AC',
   current_date - interval '10 days', current_date + interval '355 days',
   'multifocal', 'draft', 'cccccccc-0000-0000-0000-000000000001');

insert into public.optical_prescription_measures
  (prescription_id, eye, vision_zone, sphere_dpt, cylinder_dpt, axis_deg, addition_dpt, dnp_mm)
values
  ('e0000000-0000-0000-0000-000000000001', 'OD', 'far', -2.00, -0.75,  90, 2.00, 32.0),
  ('e0000000-0000-0000-0000-000000000001', 'OS', 'far', -1.75, -0.50, 100, 2.00, 31.0);

update public.optical_prescriptions set status = 'active'
where id = 'e0000000-0000-0000-0000-000000000001';

-- -----------------------------------------------------------------------------
-- PASSO 3 — Orcamento: armacao + lente multifocal (OD/OS) + antirreflexo
-- -----------------------------------------------------------------------------
insert into public.quotes (id, tenant_id, branch_id, number, customer_id, salesperson_id,
                           prescription_id, status, valid_until, subtotal_amount, total_amount, created_by)
values ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-00000000000a',
        public.next_document_number('bbbbbbbb-0000-0000-0000-00000000000a', 'quote'),
        'dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
        'e0000000-0000-0000-0000-000000000001', 'accepted', current_date + 15,
        2589.00, 2589.00, 'cccccccc-0000-0000-0000-000000000001');

insert into public.quote_items (id, quote_id, tenant_id, line_number, product_id, description, eye, quantity, unit_price, total_amount) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 1,
   'f0000000-0000-0000-0000-000000000001', 'Armacao Acetato Preta', null, 1, 349.00, 349.00),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 2,
   'f0000000-0000-0000-0000-000000000002', 'Lente Multifocal 1.60', 'OD', 1, 890.00, 890.00),
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 3,
   'f0000000-0000-0000-0000-000000000002', 'Lente Multifocal 1.60', 'OS', 1, 890.00, 890.00),
  ('a1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 4,
   'f0000000-0000-0000-0000-000000000003', 'Tratamento Antirreflexo (par)', 'both', 2, 120.00, 240.00);

-- -----------------------------------------------------------------------------
-- PASSO 4 — Venda com pagamento misto (PIX + cartao)
-- -----------------------------------------------------------------------------
insert into public.sales (id, tenant_id, branch_id, number, quote_id, sale_type, customer_id,
                          salesperson_id, status, subtotal_amount, total_amount, created_by)
values ('a2000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-00000000000a',
        public.next_document_number('bbbbbbbb-0000-0000-0000-00000000000a', 'sale'),
        'a0000000-0000-0000-0000-000000000001', 'identified',
        'dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
        'confirmed', 2589.00, 2589.00, 'cccccccc-0000-0000-0000-000000000001');

update public.quotes set status = 'converted' where id = 'a0000000-0000-0000-0000-000000000001';

insert into public.sale_items (id, sale_id, tenant_id, line_number, product_id, description, eye,
                              quantity, unit_price, total_amount, unit_cost, stock_branch_id) values
  ('a3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 1,
   'f0000000-0000-0000-0000-000000000001', 'Armacao Acetato Preta', null, 1, 349.00, 349.00, 90.00,
   'bbbbbbbb-0000-0000-0000-00000000000a'),
  ('a3000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 2,
   'f0000000-0000-0000-0000-000000000002', 'Lente Multifocal 1.60', 'OD', 1, 890.00, 890.00, 260.00, null),
  ('a3000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 3,
   'f0000000-0000-0000-0000-000000000002', 'Lente Multifocal 1.60', 'OS', 1, 890.00, 890.00, 260.00, null),
  ('a3000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 4,
   'f0000000-0000-0000-0000-000000000003', 'Tratamento Antirreflexo (par)', 'both', 2, 120.00, 240.00, 30.00, null);

insert into public.sale_payments (sale_id, tenant_id, payment_method_id, amount, installments, paid_at) values
  ('a2000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   '60000000-0000-0000-0000-000000000001', 1000.00, 1, now()),
  ('a2000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   '60000000-0000-0000-0000-000000000002', 1589.00, 4, now());

-- -----------------------------------------------------------------------------
-- PASSO 5 — Abertura da O.S. e SNAPSHOT de R1
-- -----------------------------------------------------------------------------
insert into public.service_orders (id, tenant_id, branch_id, number, customer_id, sale_id,
                                   status_id, frame_source, frame_product_id, frame_sale_item_id,
                                   promised_at, created_by)
values ('a4000000-0000-0000-0000-000000000100', 'aaaaaaaa-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-00000000000a',
        public.next_document_number('bbbbbbbb-0000-0000-0000-00000000000a', 'service_order'),
        'dddddddd-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000001', 'store_stock',
        'f0000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001',
        now() + interval '10 days', 'cccccccc-0000-0000-0000-000000000001');

select public.take_prescription_snapshot(
  'a4000000-0000-0000-0000-000000000100',
  'e0000000-0000-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000001') as snapshot_id \gset

-- Medidas de MONTAGEM (DNP aferida contra a armacao + altura por olho) — ADR-007
insert into public.service_order_fittings (id, service_order_id, tenant_id, dp_total_mm, dp_source,
                                           frame_lens_width_mm, frame_bridge_mm, frame_vertical_box_mm,
                                           vertex_distance_mm, pantoscopic_tilt_deg,
                                           measurement_method, measured_by)
values ('a5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000100',
        'aaaaaaaa-0000-0000-0000-000000000001', 63.5, 'measured',
        52.0, 18.0, 38.0, 13.0, 8.0, 'pupilometer', 'cccccccc-0000-0000-0000-000000000001');

insert into public.service_order_fitting_measures (service_order_fitting_id, eye, dnp_mm, fitting_height_mm) values
  ('a5000000-0000-0000-0000-000000000001', 'OD', 32.5, 22.0),
  ('a5000000-0000-0000-0000-000000000001', 'OS', 31.0, 21.5);

-- ESPECIFICACAO DA LENTE (dominio comercial/tecnico — nunca na receita)
insert into public.service_order_lens_specs
  (id, service_order_id, tenant_id, eye, product_id, sale_item_id, lens_type_id, lens_material_id,
   lens_type_label, lens_material_label, manufacturer_name, refractive_index, design,
   supply_mode, diameter_mm, base_curve, laboratory_id, unit_cost)
values
  ('a6000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000100',
   'aaaaaaaa-0000-0000-0000-000000000001', 'OD',
   'f0000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000002',
   (select id from public.lens_types where code = 'progressive' and tenant_id is null),
   (select id from public.lens_materials where code = 'high_160' and tenant_id is null),
   'Multifocal/Progressiva', 'Alto indice 1.60', 'Fabricante X', 1.600, 'freeform',
   'surfaced', 65.0, 4.00, '70000000-0000-0000-0000-000000000001', 260.00),
  ('a6000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000100',
   'aaaaaaaa-0000-0000-0000-000000000001', 'OS',
   'f0000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000003',
   (select id from public.lens_types where code = 'progressive' and tenant_id is null),
   (select id from public.lens_materials where code = 'high_160' and tenant_id is null),
   'Multifocal/Progressiva', 'Alto indice 1.60', 'Fabricante X', 1.600, 'freeform',
   'surfaced', 65.0, 4.00, '70000000-0000-0000-0000-000000000001', 260.00);

insert into public.service_order_lens_treatments (lens_spec_id, treatment_id, treatment_label, sale_item_id, tenant_id) values
  ('a6000000-0000-0000-0000-000000000001',
   (select id from public.lens_treatments where code = 'ar' and tenant_id is null),
   'Antirreflexo', 'a3000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a6000000-0000-0000-0000-000000000002',
   (select id from public.lens_treatments where code = 'ar' and tenant_id is null),
   'Antirreflexo', 'a3000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001');

-- -----------------------------------------------------------------------------
-- PASSO 6 — Estoque da armacao: reserva na venda, baixa na entrega
-- -----------------------------------------------------------------------------
update public.stock_balances
   set reserved_quantity = reserved_quantity + 1
 where branch_id = 'bbbbbbbb-0000-0000-0000-00000000000a'
   and product_id = 'f0000000-0000-0000-0000-000000000001';

insert into public.stock_movements (tenant_id, branch_id, product_id, movement_kind, quantity,
                                    direction, related_entity, related_entity_id, performed_by)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000a',
        'f0000000-0000-0000-0000-000000000001', 'reserve', 1, 0,
        'service_orders', 'a4000000-0000-0000-0000-000000000100',
        'cccccccc-0000-0000-0000-000000000001');

-- -----------------------------------------------------------------------------
-- PASSO 7 — Pedido ao laboratorio
-- -----------------------------------------------------------------------------
insert into public.lab_orders (id, tenant_id, branch_id, service_order_id, laboratory_id, number,
                               status, sent_at, expected_at, total_cost, created_by)
values ('a7000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-00000000000a', 'a4000000-0000-0000-0000-000000000100',
        '70000000-0000-0000-0000-000000000001',
        public.next_document_number('bbbbbbbb-0000-0000-0000-00000000000a', 'lab_order'),
        'sent', now(), now() + interval '7 days', 520.00,
        'cccccccc-0000-0000-0000-000000000001');

insert into public.lab_order_items (lab_order_id, lens_spec_id, eye, cost) values
  ('a7000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'OD', 260.00),
  ('a7000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000002', 'OS', 260.00);

insert into public.payables (tenant_id, branch_id, laboratory_id, lab_order_id, description, due_date, amount)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000a',
        '70000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001',
        'Surfacagem par multifocal O.S. #100', current_date + 30, 520.00);

-- -----------------------------------------------------------------------------
-- PASSO 8 — Financeiro e comissao
-- -----------------------------------------------------------------------------
insert into public.chart_accounts (id, tenant_id, code, label, account_kind) values
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   '3.1.01', 'Receita de vendas', 'revenue');

insert into public.receivables (tenant_id, branch_id, sale_id, customer_id, payment_method_id,
                                chart_account_id, installment_number, installments_total,
                                due_date, amount)
select 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000a',
       'a2000000-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001',
       '60000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001',
       i, 4, current_date + (30 * i), 397.25
from generate_series(1, 4) as i;

insert into public.commission_rules (id, tenant_id, label, rate_percent, release_event)
values ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'Padrao 3% sobre item liquido', 3.000, 'sale_paid');

insert into public.commissions (tenant_id, branch_id, sale_id, sale_item_id, app_user_id,
                                commission_rule_id, base_amount, rate_percent, amount)
select 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000a',
       si.sale_id, si.id, 'cccccccc-0000-0000-0000-000000000001',
       'c1000000-0000-0000-0000-000000000001',
       si.total_amount, 3.000, round(si.total_amount * 0.03, 2)
from public.sale_items si
where si.sale_id = 'a2000000-0000-0000-0000-000000000001';

-- -----------------------------------------------------------------------------
-- PASSO 9 — Producao, aviso e entrega
-- -----------------------------------------------------------------------------
update public.service_orders set status_id = '50000000-0000-0000-0000-000000000002' where id = 'a4000000-0000-0000-0000-000000000100';
update public.service_orders set status_id = '50000000-0000-0000-0000-000000000003' where id = 'a4000000-0000-0000-0000-000000000100';
update public.service_orders set status_id = '50000000-0000-0000-0000-000000000004' where id = 'a4000000-0000-0000-0000-000000000100';
update public.lab_orders set status = 'received', received_at = now() where id = 'a7000000-0000-0000-0000-000000000001';
update public.service_orders set status_id = '50000000-0000-0000-0000-000000000005' where id = 'a4000000-0000-0000-0000-000000000100';
update public.service_orders set status_id = '50000000-0000-0000-0000-000000000006' where id = 'a4000000-0000-0000-0000-000000000100';

insert into public.customer_communications (customer_id, tenant_id, branch_id, channel, direction,
                                            subject, body, related_entity, related_entity_id, created_by)
values ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-00000000000a', 'whatsapp', 'outbound',
        'Oculos pronto', 'Seu oculos esta pronto para retirada na Filial A.',
        'service_orders', 'a4000000-0000-0000-0000-000000000100',
        'cccccccc-0000-0000-0000-000000000001');

update public.service_orders
   set status_id = '50000000-0000-0000-0000-000000000007',
       delivered_at = now(),
       delivered_to_name = 'Joao da Silva'
 where id = 'a4000000-0000-0000-0000-000000000100';

-- baixa definitiva do estoque da armacao na entrega
update public.stock_balances
   set reserved_quantity = reserved_quantity - 1,
       quantity = quantity - 1
 where branch_id = 'bbbbbbbb-0000-0000-0000-00000000000a'
   and product_id = 'f0000000-0000-0000-0000-000000000001';

insert into public.stock_movements (tenant_id, branch_id, product_id, movement_kind, quantity,
                                    direction, related_entity, related_entity_id, performed_by)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000a',
        'f0000000-0000-0000-0000-000000000001', 'sale_out', 1, -1,
        'service_orders', 'a4000000-0000-0000-0000-000000000100',
        'cccccccc-0000-0000-0000-000000000001');

commit;

-- =============================================================================
-- SEIS MESES DEPOIS: cliente cadastra R2
-- =============================================================================
begin;

insert into public.optical_prescriptions
  (id, tenant_id, customer_id, branch_id, prescriber_id, prescriber_name_snapshot,
   issued_at, vision_use, status, supersedes_prescription_id, created_by)
values
  ('e0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b',
   '80000000-0000-0000-0000-000000000001', 'Dr. Carlos Oftalmo',
   current_date + interval '170 days', 'multifocal', 'draft',
   'e0000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001');

insert into public.optical_prescription_measures
  (prescription_id, eye, vision_zone, sphere_dpt, cylinder_dpt, axis_deg, addition_dpt, dnp_mm)
values
  ('e0000000-0000-0000-0000-000000000002', 'OD', 'far', -2.50, -0.75,  90, 2.50, 32.0),
  ('e0000000-0000-0000-0000-000000000002', 'OS', 'far', -2.25, -0.50, 100, 2.50, 31.0);

update public.optical_prescriptions set status = 'active'
where id = 'e0000000-0000-0000-0000-000000000002';

commit;

-- =============================================================================
-- ASSERCOES
-- =============================================================================
do $$
declare
  v_r1_status  text;
  v_od_sphere  numeric;
  v_latest     uuid;
  v_failed     boolean;
  v_reserved   numeric;
  v_qty        numeric;
  v_history    integer;
begin
  -- [A] R1 continua no historico
  select status into v_r1_status from public.optical_prescriptions
   where id = 'e0000000-0000-0000-0000-000000000001';
  if v_r1_status <> 'superseded' then
    raise exception '[A] FALHOU: R1 deveria estar superseded, esta %', v_r1_status;
  end if;

  -- [B] a O.S. #100 continua mostrando a prescricao EFETIVAMENTE utilizada
  select od_sphere_used into v_od_sphere
    from public.v_service_order_production
   where service_order_id = 'a4000000-0000-0000-0000-000000000100';
  if v_od_sphere <> -2.00 then
    raise exception '[B] FALHOU: O.S. deveria mostrar esferico OD -2.00 (R1), mostrou %', v_od_sphere;
  end if;

  -- [C] R2 e a receita vigente para novos pedidos
  v_latest := public.latest_active_prescription('dddddddd-0000-0000-0000-000000000001');
  if v_latest <> 'e0000000-0000-0000-0000-000000000002' then
    raise exception '[C] FALHOU: receita vigente deveria ser R2, e %', v_latest;
  end if;

  -- [D] editar R1 apos emissao e bloqueado
  v_failed := false;
  begin
    update public.optical_prescription_measures set sphere_dpt = -9.00
     where prescription_id = 'e0000000-0000-0000-0000-000000000001' and eye = 'OD';
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception '[D] FALHOU: o banco permitiu editar medidas de R1 apos emissao';
  end if;

  -- [E] alterar o snapshot da O.S. em producao e bloqueado
  v_failed := false;
  begin
    update public.service_order_prescription_measures m
       set sphere_dpt = -9.00
      from public.service_order_prescriptions p
     where p.id = m.service_order_prescription_id
       and p.service_order_id = 'a4000000-0000-0000-0000-000000000100';
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception '[E] FALHOU: o banco permitiu alterar o snapshot de uma O.S. entregue';
  end if;

  -- estoque: reserva liberada e baixa efetivada
  select reserved_quantity, quantity into v_reserved, v_qty
    from public.stock_balances
   where branch_id = 'bbbbbbbb-0000-0000-0000-00000000000a'
     and product_id = 'f0000000-0000-0000-0000-000000000001';
  if v_reserved <> 0 or v_qty <> 2 then
    raise exception 'FALHOU estoque: reservado=% saldo=% (esperado 0 e 2)', v_reserved, v_qty;
  end if;

  -- historico de status registrado automaticamente
  select count(*) into v_history from public.service_order_status_history
   where service_order_id = 'a4000000-0000-0000-0000-000000000100';
  if v_history <> 7 then
    raise exception 'FALHOU historico de status: % linhas (esperado 7)', v_history;
  end if;

  -- [E2] medidas de adaptacao tambem sao imutaveis depois da emissao
  begin
    update public.optical_prescriptions set vertex_distance_mm = 13
     where id = 'e0000000-0000-0000-0000-000000000001';
    raise exception '[E2] FALHOU: receita emitida aceitou mudar a distancia vertice';
  exception when check_violation then
    null;
  end;

  begin
    update public.optical_prescription_measures set fitting_height_mm = 22
     where prescription_id = 'e0000000-0000-0000-0000-000000000001';
    raise exception '[E2] FALHOU: receita emitida aceitou mudar a altura de montagem';
  exception when check_violation then
    null;
  end;

  raise notice '[A][B][C][D][E] OK — snapshot, versionamento, imutabilidade (inclusive das medidas de adaptacao) e estoque validados';
end;
$$;

-- [F] venda avulsa: sem cliente, sem crediario, sem O.S.
do $$
declare
  v_sale uuid := 'a2000000-0000-0000-0000-0000000000f1';
  v_failed boolean;
begin
  insert into public.sales (id, tenant_id, branch_id, number, sale_type, customer_id,
                            tax_document_on_invoice, status, total_amount)
  values (v_sale, 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000a',
          public.next_document_number('bbbbbbbb-0000-0000-0000-00000000000a', 'sale'),
          'anonymous', null, '52998224725', 'confirmed', 89.90);

  -- PIX em venda avulsa: permitido
  insert into public.sale_payments (sale_id, tenant_id, payment_method_id, amount, paid_at)
  values (v_sale, 'aaaaaaaa-0000-0000-0000-000000000001',
          '60000000-0000-0000-0000-000000000001', 89.90, now());

  -- crediario em venda avulsa: proibido
  v_failed := false;
  begin
    insert into public.sale_payments (sale_id, tenant_id, payment_method_id, amount, installments)
    values (v_sale, 'aaaaaaaa-0000-0000-0000-000000000001',
            '60000000-0000-0000-0000-000000000003', 89.90, 3);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception '[F] FALHOU: crediario aceito em venda avulsa';
  end if;

  -- O.S. a partir de venda avulsa: proibido
  v_failed := false;
  begin
    insert into public.service_orders (tenant_id, branch_id, number, customer_id, sale_id,
                                       status_id, frame_source, frame_product_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000a',
            public.next_document_number('bbbbbbbb-0000-0000-0000-00000000000a', 'service_order'),
            'dddddddd-0000-0000-0000-000000000001', v_sale,
            '50000000-0000-0000-0000-000000000001', 'store_stock',
            'f0000000-0000-0000-0000-000000000001');
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception '[F] FALHOU: O.S. aberta a partir de venda anonima';
  end if;

  -- cliente fake tambem e barrado: sale_type identified exige customer_id
  v_failed := false;
  begin
    insert into public.sales (tenant_id, branch_id, number, sale_type, customer_id, total_amount)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000a',
            public.next_document_number('bbbbbbbb-0000-0000-0000-00000000000a', 'sale'),
            'identified', null, 10.00);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception '[F] FALHOU: venda identificada aceita sem cliente';
  end if;

  raise notice '[F] OK — venda avulsa anonima sem crediario, sem O.S. e sem cliente fake';
end;
$$;

-- [G] RLS: isolamento entre tenants com usuario nao-superusuario
-- (superusuario ignora RLS; por isso o teste roda com o papel `authenticated`)
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '99999999-0000-0000-0000-000000000001', true);

do $$
declare
  v_mine  integer;
  v_other integer;
begin
  select count(*) into v_mine from public.customers;
  select count(*) into v_other from public.tenants;
  if v_mine <> 1 then
    raise exception '[G] FALHOU: usuario do tenant A enxergou % clientes (esperado 1)', v_mine;
  end if;
  if v_other <> 1 then
    raise exception '[G] FALHOU: usuario enxergou % tenants (esperado 1)', v_other;
  end if;
  raise notice '[G] OK — RLS isolando por tenant';
end;
$$;

commit;

-- =============================================================================
-- SAIDA LEGIVEL
-- =============================================================================
\echo ''
\echo '--- Historico de receitas do cliente (R1 preservada, R2 vigente) ---'
select revision, to_char(issued_at, 'YYYY-MM-DD') as emitida_em, status,
       od_sphere, od_cylinder, od_axis, od_addition, od_dnp, os_dnp
from public.v_customer_prescriptions
where customer_id = 'dddddddd-0000-0000-0000-000000000001'
order by revision;

\echo ''
\echo '--- O.S. #100: prescricao UTILIZADA (snapshot) x medidas de MONTAGEM ---'
select number,
       status_stage,
       od_sphere_used, od_cylinder_used, od_axis_used, od_addition_used,
       od_dnp_prescribed, od_dnp_fitting, od_height,
       os_dnp_prescribed, os_dnp_fitting, os_height,
       dp_total_mm
from public.v_service_order_production
where service_order_id = 'a4000000-0000-0000-0000-000000000100';

\echo ''
\echo '--- Especificacao da lente (dominio comercial, fora da receita) ---'
select s.eye, s.lens_type_label, s.lens_material_label, s.refractive_index,
       s.design, s.supply_mode, l.trade_name as laboratorio,
       string_agg(t.treatment_label, ', ') as tratamentos
from public.service_order_lens_specs s
left join public.laboratories l on l.id = s.laboratory_id
left join public.service_order_lens_treatments t on t.lens_spec_id = s.id
where s.service_order_id = 'a4000000-0000-0000-0000-000000000100'
group by s.eye, s.lens_type_label, s.lens_material_label, s.refractive_index,
         s.design, s.supply_mode, l.trade_name
order by s.eye;
