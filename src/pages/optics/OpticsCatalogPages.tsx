import { CrudPage } from '@/components/CrudPage'
import { Badge } from '@/components/ui/primitives'
import { formatDate } from '@/lib/format'

/**
 * Cadastros da óptica. Tipos de lente, materiais e tratamentos são tabelas
 * dedicadas porque carregam REGRA (ADR-010, categoria "c"): `requires_addition`
 * e `requires_fitting_height` mudam a validação da O.S.
 *
 * Linhas com tenant_id nulo são sementes da plataforma: aparecem para todos e
 * não são editáveis pelo tenant.
 */

export function PrescribersPage() {
  return (
    <CrudPage
      table="prescribers"
      title="Prescritores"
      singular="prescritor"
      subtitle="Médicos oftalmologistas e optometristas que emitem as receitas."
      searchColumn="full_name"
      orderBy={{ column: 'full_name', ascending: true }}
      columns={[
        { key: 'name', header: 'Nome', render: (r) => r.full_name },
        {
          key: 'kind',
          header: 'Tipo',
          render: (r) =>
            r.kind === 'ophthalmologist'
              ? 'Oftalmologista'
              : r.kind === 'optometrist'
                ? 'Optometrista'
                : 'Outro',
        },
        {
          key: 'council',
          header: 'Conselho',
          render: (r) =>
            r.council_number
              ? `${r.council_type ?? ''} ${r.council_number}/${r.council_state ?? ''}`.trim()
              : '—',
        },
        { key: 'clinic', header: 'Clínica', render: (r) => r.clinic_name ?? '—' },
        { key: 'phone', header: 'Telefone', render: (r) => r.phone ?? '—' },
        {
          key: 'status',
          header: '',
          render: (r) =>
            r.record_status === 'quick' ? <Badge tone="warning">Cadastro rápido</Badge> : null,
        },
      ]}
      fields={[
        { name: 'full_name', label: 'Nome completo', required: true, span: 8 },
        {
          name: 'kind',
          label: 'Tipo',
          type: 'select',
          span: 4,
          defaultValue: 'ophthalmologist',
          options: [
            { value: 'ophthalmologist', label: 'Oftalmologista' },
            { value: 'optometrist', label: 'Optometrista' },
            { value: 'other', label: 'Outro' },
          ],
        },
        {
          name: 'council_type',
          label: 'Conselho',
          type: 'select',
          span: 4,
          options: [
            { value: 'CRM', label: 'CRM' },
            { value: 'CRO', label: 'CRO' },
            { value: 'CROf', label: 'CROf' },
            { value: 'OUTRO', label: 'Outro' },
          ],
        },
        { name: 'council_number', label: 'Número', span: 4 },
        { name: 'council_state', label: 'UF', span: 4 },
        { name: 'clinic_name', label: 'Clínica', span: 6 },
        { name: 'phone', label: 'Telefone', span: 6 },
        { name: 'email', label: 'E-mail', type: 'email', span: 6 },
        {
          name: 'record_status',
          label: 'Situação do cadastro',
          type: 'select',
          span: 6,
          defaultValue: 'complete',
          options: [
            { value: 'quick', label: 'Cadastro rápido' },
            { value: 'complete', label: 'Completo' },
          ],
        },
        { name: 'notes', label: 'Observações', type: 'textarea', span: 12 },
      ]}
    />
  )
}

export function LensTypesPage() {
  return (
    <CrudPage
      table="lens_types"
      title="Tipos de lente"
      singular="tipo de lente"
      subtitle="O desenho da visão dirige a validação: multifocal exige adição e altura de montagem."
      orderBy={{ column: 'code', ascending: true }}
      columns={[
        { key: 'label', header: 'Nome', render: (r) => r.label },
        { key: 'design', header: 'Desenho', render: (r) => r.vision_design },
        {
          key: 'rules',
          header: 'Exige',
          render: (r) => (
            <div className="flex flex-wrap gap-1">
              {r.requires_addition && <Badge tone="info">adição</Badge>}
              {r.requires_fitting_height && <Badge tone="info">altura</Badge>}
            </div>
          ),
        },
        {
          key: 'scope',
          header: '',
          render: (r) => (r.tenant_id === null ? <Badge>plataforma</Badge> : null),
        },
      ]}
      fields={[
        { name: 'code', label: 'Código', required: true, span: 4 },
        { name: 'label', label: 'Nome', required: true, span: 8 },
        {
          name: 'vision_design',
          label: 'Desenho da visão',
          type: 'select',
          required: true,
          span: 6,
          options: [
            { value: 'single_vision', label: 'Visão simples' },
            { value: 'bifocal', label: 'Bifocal' },
            { value: 'trifocal', label: 'Trifocal' },
            { value: 'progressive', label: 'Multifocal/Progressiva' },
            { value: 'occupational', label: 'Ocupacional' },
            { value: 'contact', label: 'Lente de contato' },
          ],
        },
        { name: 'requires_addition', label: 'Exige adição na receita', type: 'checkbox', span: 6 },
        {
          name: 'requires_fitting_height',
          label: 'Exige altura de montagem',
          type: 'checkbox',
          span: 6,
        },
      ]}
    />
  )
}

export function LensMaterialsPage() {
  return (
    <CrudPage
      table="lens_materials"
      title="Materiais de lente"
      singular="material"
      orderBy={{ column: 'code', ascending: true }}
      columns={[
        { key: 'label', header: 'Material', render: (r) => r.label },
        {
          key: 'index',
          header: 'Índice padrão',
          numeric: true,
          render: (r) => r.default_refractive_index ?? '—',
        },
        { key: 'abbe', header: 'Abbe', numeric: true, render: (r) => r.abbe_number ?? '—' },
        {
          key: 'scope',
          header: '',
          render: (r) => (r.tenant_id === null ? <Badge>plataforma</Badge> : null),
        },
      ]}
      fields={[
        { name: 'code', label: 'Código', required: true, span: 4 },
        { name: 'label', label: 'Nome', required: true, span: 8 },
        {
          name: 'default_refractive_index',
          label: 'Índice de refração',
          type: 'number',
          step: '0.001',
          span: 6,
        },
        { name: 'abbe_number', label: 'Número de Abbe', type: 'number', step: '0.1', span: 6 },
      ]}
    />
  )
}

export function LensTreatmentsPage() {
  return (
    <CrudPage
      table="lens_treatments"
      title="Tratamentos"
      singular="tratamento"
      subtitle="Antirreflexo, fotossensível, filtro de luz azul, coloração…"
      orderBy={{ column: 'code', ascending: true }}
      columns={[
        { key: 'label', header: 'Tratamento', render: (r) => r.label },
        { key: 'group', header: 'Grupo', render: (r) => r.treatment_group },
        {
          key: 'billable',
          header: 'Cobrado',
          render: (r) => (r.is_billable ? 'Sim' : 'Não'),
        },
        {
          key: 'scope',
          header: '',
          render: (r) => (r.tenant_id === null ? <Badge>plataforma</Badge> : null),
        },
      ]}
      fields={[
        { name: 'code', label: 'Código', required: true, span: 4 },
        { name: 'label', label: 'Nome', required: true, span: 8 },
        {
          name: 'treatment_group',
          label: 'Grupo',
          type: 'select',
          span: 6,
          defaultValue: 'coating',
          options: [
            { value: 'coating', label: 'Camada/coating' },
            { value: 'tint', label: 'Coloração' },
            { value: 'photochromic', label: 'Fotossensível' },
            { value: 'polarized', label: 'Polarizada' },
            { value: 'filter', label: 'Filtro' },
            { value: 'hardening', label: 'Endurecimento' },
            { value: 'other', label: 'Outro' },
          ],
        },
        { name: 'is_billable', label: 'É cobrado do cliente', type: 'checkbox', span: 6, defaultValue: true },
      ]}
    />
  )
}

export function LaboratoriesPage() {
  return (
    <CrudPage
      table="laboratories"
      title="Laboratórios"
      singular="laboratório"
      subtitle="Quem surfaça e monta as lentes."
      searchColumn="trade_name"
      orderBy={{ column: 'trade_name', ascending: true }}
      columns={[
        { key: 'name', header: 'Laboratório', render: (r) => r.trade_name },
        { key: 'code', header: 'Código', render: (r) => r.code },
        { key: 'contact', header: 'Contato', render: (r) => r.contact_name ?? '—' },
        { key: 'phone', header: 'Telefone', render: (r) => r.phone ?? '—' },
        {
          key: 'lead',
          header: 'Prazo (dias)',
          numeric: true,
          render: (r) => r.default_lead_days,
        },
        {
          key: 'active',
          header: '',
          render: (r) => (r.is_active ? null : <Badge tone="warning">inativo</Badge>),
        },
      ]}
      fields={[
        { name: 'code', label: 'Código', required: true, span: 4 },
        { name: 'trade_name', label: 'Nome fantasia', required: true, span: 8 },
        { name: 'legal_name', label: 'Razão social', span: 8 },
        { name: 'tax_document', label: 'CNPJ', span: 4 },
        { name: 'contact_name', label: 'Contato', span: 4 },
        { name: 'phone', label: 'Telefone', span: 4 },
        { name: 'email', label: 'E-mail', type: 'email', span: 4 },
        {
          name: 'default_lead_days',
          label: 'Prazo padrão (dias)',
          type: 'number',
          span: 4,
          defaultValue: 5,
        },
        {
          name: 'integration_kind',
          label: 'Integração',
          type: 'select',
          span: 4,
          defaultValue: 'manual',
          options: [
            { value: 'manual', label: 'Manual' },
            { value: 'email', label: 'E-mail' },
            { value: 'api', label: 'API' },
            { value: 'edi', label: 'EDI' },
          ],
        },
        { name: 'is_active', label: 'Ativo', type: 'checkbox', span: 4, defaultValue: true },
      ]}
    />
  )
}

export function ServiceOrderStatusesPage() {
  return (
    <CrudPage
      table="service_order_statuses"
      title="Situações da O.S."
      singular="situação"
      subtitle="Você escolhe o rótulo; o estágio canônico é o que os relatórios e automações leem."
      orderBy={{ column: 'sort_order', ascending: true }}
      columns={[
        { key: 'label', header: 'Rótulo', render: (r) => r.label },
        { key: 'code', header: 'Código', render: (r) => r.code },
        { key: 'stage', header: 'Estágio canônico', render: (r) => <Badge>{r.stage}</Badge> },
        {
          key: 'flags',
          header: 'Comportamento',
          render: (r) => (
            <div className="flex flex-wrap gap-1">
              {r.is_initial && <Badge tone="info">inicial</Badge>}
              {r.is_final && <Badge tone="neutral">final</Badge>}
              {r.notifies_customer && <Badge tone="success">avisa cliente</Badge>}
              {r.blocks_delivery && <Badge tone="warning">bloqueia entrega</Badge>}
            </div>
          ),
        },
        { key: 'order', header: 'Ordem', numeric: true, render: (r) => r.sort_order },
        { key: 'created', header: 'Criada', render: (r) => formatDate(r.created_at) },
      ]}
      fields={[
        { name: 'code', label: 'Código', required: true, span: 4 },
        { name: 'label', label: 'Rótulo exibido', required: true, span: 8 },
        {
          name: 'stage',
          label: 'Estágio canônico',
          type: 'select',
          required: true,
          span: 6,
          hint: 'Fechado pelo produto: é o que dirige relatórios e automações.',
          options: [
            { value: 'draft', label: 'Rascunho' },
            { value: 'awaiting_prescription', label: 'Aguardando receita' },
            { value: 'awaiting_lab', label: 'Aguardando laboratório' },
            { value: 'in_production', label: 'Em produção' },
            { value: 'received_from_lab', label: 'Recebida do laboratório' },
            { value: 'assembling', label: 'Em montagem' },
            { value: 'quality_check', label: 'Conferência' },
            { value: 'ready_for_pickup', label: 'Pronta para retirada' },
            { value: 'delivered', label: 'Entregue' },
            { value: 'cancelled', label: 'Cancelada' },
          ],
        },
        { name: 'sort_order', label: 'Ordem', type: 'number', span: 6, defaultValue: 10 },
        { name: 'is_initial', label: 'É a situação inicial', type: 'checkbox', span: 6 },
        { name: 'is_final', label: 'É situação final', type: 'checkbox', span: 6 },
        { name: 'notifies_customer', label: 'Avisa o cliente', type: 'checkbox', span: 6 },
        { name: 'blocks_delivery', label: 'Bloqueia a entrega', type: 'checkbox', span: 6 },
      ]}
    />
  )
}
