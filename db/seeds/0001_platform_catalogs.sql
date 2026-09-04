-- =============================================================================
-- SEED — CATALOGOS DE PLATAFORMA (tenant_id NULL)
-- =============================================================================
-- Item 11 / ADR-010: estes sao os catalogos DESCRITIVOS. Nenhum deles altera o
-- comportamento do software — por isso vivem em catalog_entries e podem ser
-- estendidos por cada tenant.
-- =============================================================================

insert into public.catalog_definitions (key, label, description, scope, allows_custom) values
  ('customer_origin',   'Origem do cliente',
   'Como o cliente chegou a otica. Puramente descritivo — nao muda regra.', 'both', true),
  ('profession',        'Profissao',
   'Profissao do cliente PF. Lista longa e regional; tenant estende.', 'both', true),
  ('relationship_type', 'Grau de parentesco',
   'Tipo de vinculo entre clientes (ADR-003).', 'both', true),
  ('marital_status',    'Estado civil', null, 'both', true),
  ('document_type',     'Tipo de documento', 'Tipos de anexo/documento do cliente.', 'both', true),
  ('customer_agreement','Convenio',
   'Convenio/parceria aplicavel ao cliente por filial.', 'tenant', true),
  ('cancel_reason',     'Motivo de cancelamento', null, 'both', true),
  ('warranty_reason',   'Motivo de garantia/retrabalho', null, 'both', true)
on conflict (key) do nothing;

insert into public.catalog_entries (catalog_key, tenant_id, code, label, sort_order) values
  ('customer_origin', null, 'walk_in',      'Passou em frente / balcao', 10),
  ('customer_origin', null, 'referral',     'Indicacao de cliente',      20),
  ('customer_origin', null, 'social_media', 'Redes sociais',             30),
  ('customer_origin', null, 'whatsapp',     'WhatsApp',                  40),
  ('customer_origin', null, 'prescriber',   'Indicacao de prescritor',   50),
  ('customer_origin', null, 'campaign',     'Campanha/anuncio',          60),
  ('customer_origin', null, 'agreement',    'Convenio/empresa',          70),

  ('relationship_type', null, 'child',      'Filho(a)',        10),
  ('relationship_type', null, 'parent',     'Pai/Mae',         20),
  ('relationship_type', null, 'spouse',     'Conjuge',         30),
  ('relationship_type', null, 'sibling',    'Irmao(a)',        40),
  ('relationship_type', null, 'guardian',   'Responsavel legal', 50),
  ('relationship_type', null, 'employer',   'Empregador',      60),
  ('relationship_type', null, 'other',      'Outro',           99),

  ('marital_status', null, 'single',    'Solteiro(a)',  10),
  ('marital_status', null, 'married',   'Casado(a)',    20),
  ('marital_status', null, 'divorced',  'Divorciado(a)',30),
  ('marital_status', null, 'widowed',   'Viuvo(a)',     40),
  ('marital_status', null, 'stable_union','Uniao estavel', 50),

  ('document_type', null, 'prescription', 'Receita',            10),
  ('document_type', null, 'id_card',      'RG/CNH',             20),
  ('document_type', null, 'proof_address','Comprovante de endereco', 30),
  ('document_type', null, 'contract',     'Contrato/termo',     40),
  ('document_type', null, 'photo',        'Foto',               50)
on conflict do nothing;

-- =============================================================================
-- SEED — CATALOGO OPTICO DE PLATAFORMA
-- =============================================================================
-- Estes NAO estao em catalog_entries porque carregam REGRA (exigem adicao,
-- exigem altura de montagem). Sao tabelas dedicadas (ADR-010, categoria "c").
-- =============================================================================

insert into public.lens_types (tenant_id, code, label, vision_design, requires_addition, requires_fitting_height) values
  (null, 'single_vision', 'Visao simples',        'single_vision', false, false),
  (null, 'bifocal',       'Bifocal',              'bifocal',       true,  true),
  (null, 'progressive',   'Multifocal/Progressiva','progressive',  true,  true),
  (null, 'occupational',  'Ocupacional',          'occupational',  true,  true),
  (null, 'contact',       'Lente de contato',     'contact',       false, false)
on conflict do nothing;

insert into public.lens_materials (tenant_id, code, label, default_refractive_index, abbe_number) values
  (null, 'cr39',          'Resina CR-39',   1.499, 58.0),
  (null, 'polycarbonate', 'Policarbonato',  1.586, 30.0),
  (null, 'trivex',        'Trivex',         1.532, 45.0),
  (null, 'high_160',      'Alto indice 1.60', 1.600, 42.0),
  (null, 'high_167',      'Alto indice 1.67', 1.670, 32.0),
  (null, 'high_174',      'Alto indice 1.74', 1.740, 33.0),
  (null, 'mineral',       'Cristal (mineral)', 1.523, 58.0)
on conflict do nothing;

insert into public.lens_treatments (tenant_id, code, label, treatment_group) values
  (null, 'ar',            'Antirreflexo',        'coating'),
  (null, 'hard_coat',     'Endurecimento',       'hardening'),
  (null, 'uv',            'Protecao UV',         'filter'),
  (null, 'blue_filter',   'Filtro de luz azul',  'filter'),
  (null, 'photochromic',  'Fotossensivel',       'photochromic'),
  (null, 'polarized',     'Polarizada',          'polarized'),
  (null, 'tint_solid',    'Coloracao solida',    'tint'),
  (null, 'tint_gradient', 'Coloracao degrade',   'tint'),
  (null, 'oleophobic',    'Antiembacante/oleofobico', 'coating')
on conflict do nothing;
