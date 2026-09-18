import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppContext, useBranchId } from '@/auth/SessionProvider'
import { CrudPage } from '@/components/CrudPage'
import { AsideRanking, AsideTip, CatalogScreen } from '@/components/CatalogScreen'
import { useRecordForm } from '@/components/RecordForm'
import { Badge, Card, cx } from '@/components/ui/primitives'
import { Donut, SERIES_COLOR } from '@/components/ui/Donut'
import {
  IconBox,
  IconCheckCircle,
  IconClock,
  IconCoin,
  IconDroplet,
  IconFile,
  IconFlask,
  IconGlasses,
  IconLayers,
  IconMoney,
  IconPhone,
  IconSparkle,
  IconUserCheck,
  IconUsers,
} from '@/components/ui/icons'
import { formatDate, formatPhone } from '@/lib/format'

/**
 * Cadastros da óptica. Tipos de lente, materiais e tratamentos são tabelas
 * dedicadas porque carregam REGRA (ADR-010, categoria "c"): `requires_addition`
 * e `requires_fitting_height` mudam a validação da O.S.
 *
 * Linhas com tenant_id nulo são sementes da plataforma: aparecem para todos e
 * não são editáveis pelo tenant.
 *
 * As quatro telas ricas usam o mesmo casco (`CatalogScreen`): números no topo,
 * filtros, lista paginada e, ao lado, o recorte que dá sentido aos números.
 */

const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 2 || /^[A-ZÀ-Ý]/.test(part))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

/** Bolinha com iniciais — mesma peça nas quatro listas. */
function Avatar({ name, tone = 1 }: { name: string; tone?: number }) {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold"
      style={{
        backgroundColor: `color-mix(in oklab, ${SERIES_COLOR[tone] ?? SERIES_COLOR[1]} 18%, transparent)`,
        color: SERIES_COLOR[tone] ?? SERIES_COLOR[1],
      }}
    >
      {initials(name) || '—'}
    </span>
  )
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? 'success' : 'neutral'} dot>
      {active ? 'Ativo' : 'Inativo'}
    </Badge>
  )
}

/** Distribuição para a rosca: agrupa, ordena e corta na quinta fatia. */
function distribution<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, number>()
  for (const row of rows) {
    const label = key(row)
    map.set(label, (map.get(label) ?? 0) + 1)
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value], index) => ({ key: label, label, value, series: index + 1 }))
}

// ---------------------------------------------------------------------------
// Prescritores
// ---------------------------------------------------------------------------

const PRESCRIBER_KIND: Record<string, string> = {
  ophthalmologist: 'Oftalmologista',
  optometrist: 'Optometrista',
  other: 'Outro',
}

export function PrescribersPage() {
  const ctx = useAppContext()

  const list = useQuery({
    queryKey: ['prescribers', ctx.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prescribers')
        .select(
          'id,full_name,kind,council_type,council_number,council_state,clinic_name,phone,email,is_active,record_status',
        )
        .is('deleted_at', null)
        .order('full_name')
      if (error) throw error
      return data ?? []
    },
  })

  /** Quantas receitas cada prescritor emitiu — é o que separa cadastro de parceria. */
  const usage = useQuery({
    queryKey: ['prescriber-usage', ctx.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('optical_prescriptions')
        .select('prescriber_id,issued_at')
        .not('prescriber_id', 'is', null)
        .limit(1000)
      if (error) throw error
      const month = new Date().toISOString().slice(0, 7)
      const total = new Map<string, number>()
      const last = new Map<string, string>()
      let thisMonth = 0
      for (const row of data ?? []) {
        const id = row.prescriber_id!
        total.set(id, (total.get(id) ?? 0) + 1)
        if (!last.has(id) || (row.issued_at ?? '') > last.get(id)!) {
          last.set(id, row.issued_at ?? '')
        }
        if ((row.issued_at ?? '').startsWith(month)) thisMonth += 1
      }
      return { total, last, thisMonth }
    },
  })

  const form = useRecordForm({
    table: 'prescribers',
    singular: 'prescritor',
    fields: [
      { name: 'full_name', label: 'Nome', required: true, span: 8 },
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
        span: 3,
        options: ['CRM', 'CRO', 'CROf', 'OUTRO'].map((value) => ({ value, label: value })),
      },
      { name: 'council_number', label: 'Registro', span: 6 },
      { name: 'council_state', label: 'UF', span: 3 },
      { name: 'clinic_name', label: 'Clínica', span: 6 },
      { name: 'phone', label: 'Telefone', span: 6 },
      { name: 'email', label: 'E-mail', type: 'email', span: 8 },
      { name: 'is_active', label: 'Ativo', type: 'checkbox', span: 4, defaultValue: true },
    ],
  })

  const rows = list.data ?? []
  const kinds = new Set(rows.map((row) => row.kind))
  const ranking = rows
    .map((row) => ({ row, count: usage.data?.total.get(row.id) ?? 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return (
    <>
      <CatalogScreen
        title="Prescritores"
        subtitle="Médicos e profissionais que emitem as receitas dos seus clientes."
        addLabel="prescritor"
        onAdd={form.openCreate}
        loading={list.isLoading}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={(row) => form.openEdit(row as unknown as Record<string, unknown>)}
        searchPlaceholder="Buscar por nome, especialidade, registro ou clínica…"
        searchText={(row) =>
          [
            row.full_name,
            PRESCRIBER_KIND[row.kind] ?? row.kind,
            row.council_number,
            row.clinic_name,
          ]
            .filter(Boolean)
            .join(' ')
        }
        stats={[
          {
            icon: IconUsers,
            tone: 'brand',
            label: 'Total de prescritores',
            value: String(rows.length),
            hint: 'cadastrados nesta ótica',
          },
          {
            icon: IconCheckCircle,
            tone: 'success',
            label: 'Prescritores ativos',
            value: String(rows.filter((row) => row.is_active).length),
            hint: 'podem receber novas receitas',
          },
          {
            icon: IconUserCheck,
            tone: 'violet',
            label: 'Especialidades',
            value: String(kinds.size),
            hint: 'tipos de profissional',
          },
          {
            icon: IconFile,
            tone: 'warning',
            label: 'Receitas no mês',
            value: String(usage.data?.thisMonth ?? 0),
            hint: 'emitidas neste mês',
          },
        ]}
        filters={[
          {
            id: 'kind',
            label: 'Todas as especialidades',
            options: Object.entries(PRESCRIBER_KIND).map(([value, label]) => ({
              value,
              label,
            })),
            match: (row, value) => row.kind === value,
          },
          {
            id: 'status',
            label: 'Todos os status',
            options: [
              { value: 'active', label: 'Ativos' },
              { value: 'inactive', label: 'Inativos' },
            ],
            match: (row, value) => (value === 'active' ? row.is_active : !row.is_active),
          },
        ]}
        columns={[
          {
            key: 'name',
            header: 'Nome',
            render: (row) => (
              <div className="flex items-center gap-2.5">
                <Avatar name={row.full_name} tone={row.kind === 'optometrist' ? 3 : 1} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{row.full_name}</p>
                  {row.clinic_name && (
                    <p className="truncate text-xs text-fg-subtle">{row.clinic_name}</p>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: 'kind',
            header: 'Especialidade',
            className: 'text-fg-muted',
            render: (row) => PRESCRIBER_KIND[row.kind] ?? row.kind,
          },
          {
            key: 'council',
            header: 'Registro',
            className: 'text-fg-muted whitespace-nowrap',
            render: (row) =>
              row.council_number
                ? `${row.council_type ?? ''} ${row.council_number}${row.council_state ? '-' + row.council_state : ''}`.trim()
                : '—',
          },
          {
            key: 'phone',
            header: 'Telefone',
            className: 'hidden text-fg-muted lg:table-cell',
            headerClassName: 'hidden lg:table-cell',
            render: (row) =>
              row.phone ? (
                <a
                  href={`tel:${row.phone}`}
                  onClick={(event) => event.stopPropagation()}
                  className="flex items-center gap-1.5 text-brand-700 hover:underline dark:text-brand-300"
                >
                  <IconPhone className="size-3.5" />
                  {formatPhone(row.phone)}
                </a>
              ) : (
                '—'
              ),
          },
          {
            key: 'last',
            header: 'Última receita',
            className: 'tnum hidden text-fg-muted xl:table-cell',
            headerClassName: 'hidden xl:table-cell',
            render: (row) => {
              const last = usage.data?.last.get(row.id)
              return last ? formatDate(last) : '—'
            },
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <ActiveBadge active={row.is_active} />,
          },
        ]}
        aside={
          <>
            <Card title={<span className="text-sm font-semibold text-fg">Prescritores mais ativos</span>} bodyClassName="p-2">
              <AsideRanking
                items={ranking.map((item) => ({
                  key: item.row.id,
                  title: item.row.full_name,
                  detail: PRESCRIBER_KIND[item.row.kind] ?? item.row.kind,
                  value: (
                    <span className="text-right leading-tight">
                      <span className="tnum block">{item.count}</span>
                      <span className="block text-[0.625rem] font-normal text-fg-subtle">
                        receitas
                      </span>
                    </span>
                  ),
                }))}
              />
            </Card>

            <Card title={<span className="text-sm font-semibold text-fg">Especialidades</span>}>
              <Donut
                layout="column"
                slices={distribution(rows, (row) => PRESCRIBER_KIND[row.kind] ?? row.kind)}
                centerValue={String(rows.length)}
                centerLabel="prescritores"
              />
            </Card>

            <AsideTip title="Parcerias que cuidam bem da visão">
              Relacione-se com os profissionais que confiam na sua ótica: o prescritor
              com mais receitas é quem mais traz cliente para a sua porta.
            </AsideTip>
          </>
        }
      />
      {form.modal}
    </>
  )
}

// ---------------------------------------------------------------------------
// Materiais de lente
// ---------------------------------------------------------------------------

export function LensMaterialsPage() {
  const ctx = useAppContext()

  const list = useQuery({
    queryKey: ['lens_materials', ctx.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lens_materials')
        .select('id,tenant_id,code,label,default_refractive_index,abbe_number,is_active')
        .order('label')
      if (error) throw error
      return data ?? []
    },
  })

  /** Material usado em produto é material que a ótica realmente vende. */
  const usage = useQuery({
    queryKey: ['lens-material-usage', ctx.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lens_attributes')
        .select('lens_material_id')
        .limit(1000)
      if (error) throw error
      const map = new Map<string, number>()
      for (const row of data ?? []) {
        map.set(row.lens_material_id, (map.get(row.lens_material_id) ?? 0) + 1)
      }
      return map
    },
  })

  const form = useRecordForm({
    table: 'lens_materials',
    singular: 'material',
    fields: [
      { name: 'code', label: 'Código', required: true, span: 4 },
      { name: 'label', label: 'Nome', required: true, span: 8 },
      {
        name: 'default_refractive_index',
        label: 'Índice de refração',
        type: 'number',
        step: '0.001',
        span: 6,
        hint: 'Quanto maior, mais fina a lente.',
      },
      {
        name: 'abbe_number',
        label: 'Número de Abbe',
        type: 'number',
        step: '0.1',
        span: 6,
        hint: 'Quanto maior, menos aberração cromática.',
      },
      { name: 'is_active', label: 'Ativo', type: 'checkbox', span: 12, defaultValue: true },
    ],
  })

  const rows = list.data ?? []
  const emUso = rows.filter((row) => (usage.data?.get(row.id) ?? 0) > 0).length

  return (
    <>
      <CatalogScreen
        title="Materiais"
        subtitle="Materiais usados na fabricação das lentes que a sua ótica vende."
        addLabel="material"
        onAdd={form.openCreate}
        loading={list.isLoading}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={(row) => form.openEdit(row as unknown as Record<string, unknown>)}
        searchPlaceholder="Buscar material por nome ou código…"
        searchText={(row) => `${row.label} ${row.code}`}
        stats={[
          {
            icon: IconBox,
            tone: 'brand',
            label: 'Total de materiais',
            value: String(rows.length),
            hint: 'no catálogo desta ótica',
          },
          {
            icon: IconCheckCircle,
            tone: 'success',
            label: 'Materiais ativos',
            value: String(rows.filter((row) => row.is_active).length),
            hint: 'disponíveis para venda',
          },
          {
            icon: IconLayers,
            tone: 'violet',
            label: 'Em uso em produtos',
            value: String(emUso),
            hint: 'ligados a alguma lente',
          },
          {
            icon: IconDroplet,
            tone: 'warning',
            label: 'Da plataforma',
            value: String(rows.filter((row) => row.tenant_id === null).length),
            hint: 'padrão, não editáveis',
          },
        ]}
        filters={[
          {
            id: 'origem',
            label: 'Todas as origens',
            options: [
              { value: 'tenant', label: 'Da minha ótica' },
              { value: 'platform', label: 'Da plataforma' },
            ],
            match: (row, value) =>
              value === 'platform' ? row.tenant_id === null : row.tenant_id !== null,
          },
          {
            id: 'status',
            label: 'Todos os status',
            options: [
              { value: 'active', label: 'Ativos' },
              { value: 'inactive', label: 'Inativos' },
            ],
            match: (row, value) => (value === 'active' ? row.is_active : !row.is_active),
          },
        ]}
        columns={[
          {
            key: 'label',
            header: 'Material',
            render: (row) => (
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-fg-muted">
                  <IconDroplet className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{row.label}</p>
                  <p className="truncate text-xs text-fg-subtle">{row.code}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'index',
            header: 'Índice',
            className: 'tnum text-fg-muted',
            render: (row) =>
              row.default_refractive_index ? Number(row.default_refractive_index).toFixed(3) : '—',
          },
          {
            key: 'abbe',
            header: 'Abbe',
            className: 'tnum hidden text-fg-muted sm:table-cell',
            headerClassName: 'hidden sm:table-cell',
            render: (row) => row.abbe_number ?? '—',
          },
          {
            key: 'usage',
            header: 'Produtos',
            className: 'tnum hidden text-fg-muted lg:table-cell',
            headerClassName: 'hidden lg:table-cell',
            render: (row) => usage.data?.get(row.id) ?? 0,
          },
          {
            key: 'origin',
            header: 'Origem',
            className: 'hidden xl:table-cell',
            headerClassName: 'hidden xl:table-cell',
            render: (row) =>
              row.tenant_id === null ? (
                <Badge tone="neutral">plataforma</Badge>
              ) : (
                <Badge tone="info">própria</Badge>
              ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <ActiveBadge active={row.is_active} />,
          },
        ]}
        aside={
          <>
            <Card title={<span className="text-sm font-semibold text-fg">Mais usados em produtos</span>} bodyClassName="p-2">
              <AsideRanking
                items={rows
                  .map((row) => ({ row, count: usage.data?.get(row.id) ?? 0 }))
                  .filter((item) => item.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 5)
                  .map((item) => ({
                    key: item.row.id,
                    title: item.row.label,
                    detail: item.row.default_refractive_index
                      ? `Índice ${Number(item.row.default_refractive_index).toFixed(2)}`
                      : undefined,
                    value: item.count,
                  }))}
              />
            </Card>

            <Card title={<span className="text-sm font-semibold text-fg">Por índice de refração</span>}>
              <Donut
                layout="column"
                slices={distribution(rows, (row) =>
                  row.default_refractive_index
                    ? `Índice ${Number(row.default_refractive_index).toFixed(2)}`
                    : 'Sem índice',
                )}
                centerValue={String(rows.length)}
                centerLabel="materiais"
              />
            </Card>

            <AsideTip title="Índice e Abbe andam juntos">
              Índice alto deixa a lente mais fina, mas costuma derrubar o Abbe — e Abbe
              baixo significa mais franja colorida na periferia. Diga isso ao cliente
              antes dele reclamar depois.
            </AsideTip>
          </>
        }
      />
      {form.modal}
    </>
  )
}

// ---------------------------------------------------------------------------
// Tratamentos
// ---------------------------------------------------------------------------

const TREATMENT_GROUP: Record<string, string> = {
  coating: 'Coating',
  tint: 'Coloração',
  photochromic: 'Fotocromático',
  polarized: 'Polarização',
  filter: 'Filtro',
  hardening: 'Endurecimento',
  other: 'Outro',
}

const GROUP_TONE: Record<string, string> = {
  coating: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  tint: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  photochromic: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  polarized: 'bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  filter: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  hardening: 'bg-surface-sunken text-fg-muted',
  other: 'bg-surface-sunken text-fg-muted',
}

export function LensTreatmentsPage() {
  const ctx = useAppContext()

  const list = useQuery({
    queryKey: ['lens_treatments', ctx.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lens_treatments')
        .select('id,tenant_id,code,label,treatment_group,is_billable,is_active')
        .order('label')
      if (error) throw error
      return data ?? []
    },
  })

  const form = useRecordForm({
    table: 'lens_treatments',
    singular: 'tratamento',
    fields: [
      { name: 'code', label: 'Código', required: true, span: 4 },
      { name: 'label', label: 'Nome', required: true, span: 8 },
      {
        name: 'treatment_group',
        label: 'Grupo',
        type: 'select',
        span: 6,
        defaultValue: 'coating',
        options: Object.entries(TREATMENT_GROUP).map(([value, label]) => ({
          value,
          label,
        })),
      },
      {
        name: 'is_billable',
        label: 'Cobrado à parte',
        type: 'checkbox',
        span: 3,
        defaultValue: true,
      },
      { name: 'is_active', label: 'Ativo', type: 'checkbox', span: 3, defaultValue: true },
    ],
  })

  const rows = list.data ?? []
  const porGrupo = useMemo(
    () => distribution(rows, (row) => TREATMENT_GROUP[row.treatment_group] ?? row.treatment_group),
    [rows],
  )

  return (
    <>
      <CatalogScreen
        title="Tratamentos"
        subtitle="Revestimentos, filtros e acabamentos aplicados às lentes."
        addLabel="tratamento"
        onAdd={form.openCreate}
        loading={list.isLoading}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={(row) => form.openEdit(row as unknown as Record<string, unknown>)}
        searchPlaceholder="Buscar tratamento por nome, grupo ou código…"
        searchText={(row) =>
          `${row.label} ${row.code} ${TREATMENT_GROUP[row.treatment_group] ?? ''}`
        }
        stats={[
          {
            icon: IconSparkle,
            tone: 'brand',
            label: 'Total de tratamentos',
            value: String(rows.length),
            hint: 'no catálogo desta ótica',
          },
          {
            icon: IconCoin,
            tone: 'success',
            label: 'Cobrados à parte',
            value: String(rows.filter((row) => row.is_billable).length),
            hint: 'entram como item na venda',
          },
          {
            icon: IconCheckCircle,
            tone: 'violet',
            label: 'Tratamentos ativos',
            value: String(rows.filter((row) => row.is_active).length),
            hint: 'disponíveis para venda',
          },
          {
            icon: IconLayers,
            tone: 'warning',
            label: 'Grupo mais usado',
            value: porGrupo[0]?.label ?? '—',
            hint: porGrupo[0] ? `${porGrupo[0].value} tratamento(s)` : 'sem tratamentos',
          },
        ]}
        filters={[
          {
            id: 'group',
            label: 'Todos os grupos',
            options: Object.entries(TREATMENT_GROUP).map(([value, label]) => ({
              value,
              label,
            })),
            match: (row, value) => row.treatment_group === value,
          },
          {
            id: 'billable',
            label: 'Toda cobrança',
            options: [
              { value: 'yes', label: 'Cobrado à parte' },
              { value: 'no', label: 'Incluso' },
            ],
            match: (row, value) => (value === 'yes' ? row.is_billable : !row.is_billable),
          },
          {
            id: 'status',
            label: 'Todos os status',
            options: [
              { value: 'active', label: 'Ativos' },
              { value: 'inactive', label: 'Inativos' },
            ],
            match: (row, value) => (value === 'active' ? row.is_active : !row.is_active),
          },
        ]}
        columns={[
          {
            key: 'label',
            header: 'Tratamento',
            render: (row) => (
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{row.label}</p>
                <p className="truncate text-xs text-fg-subtle">{row.code}</p>
              </div>
            ),
          },
          {
            key: 'group',
            header: 'Grupo',
            render: (row) => (
              <span
                className={cx(
                  'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                  GROUP_TONE[row.treatment_group] ?? GROUP_TONE['other'],
                )}
              >
                {TREATMENT_GROUP[row.treatment_group] ?? row.treatment_group}
              </span>
            ),
          },
          {
            key: 'billable',
            header: 'Cobrança',
            className: 'hidden sm:table-cell',
            headerClassName: 'hidden sm:table-cell',
            render: (row) => (
              <Badge tone={row.is_billable ? 'success' : 'neutral'}>
                {row.is_billable ? 'À parte' : 'Incluso'}
              </Badge>
            ),
          },
          {
            key: 'origin',
            header: 'Origem',
            className: 'hidden xl:table-cell',
            headerClassName: 'hidden xl:table-cell',
            render: (row) =>
              row.tenant_id === null ? (
                <Badge tone="neutral">plataforma</Badge>
              ) : (
                <Badge tone="info">próprio</Badge>
              ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <ActiveBadge active={row.is_active} />,
          },
        ]}
        aside={
          <>
            <Card title={<span className="text-sm font-semibold text-fg">Distribuição por grupo</span>}>
              <Donut
                layout="column"
                slices={porGrupo}
                centerValue={String(rows.length)}
                centerLabel="tratamentos"
              />
            </Card>

            <AsideTip title="Tratamento cobrado é receita a mais">
              Antirreflexo com filtro de luz azul é a combinação que o cliente mais
              entende — e a que mais agrega valor sem trocar a lente.
            </AsideTip>
          </>
        }
      />
      {form.modal}
    </>
  )
}

// ---------------------------------------------------------------------------
// Laboratórios
// ---------------------------------------------------------------------------

const INTEGRATION: Record<string, string> = {
  manual: 'Manual',
  email: 'E-mail',
  api: 'API',
  edi: 'EDI',
}

export function LaboratoriesPage() {
  const ctx = useAppContext()
  const branchId = useBranchId()

  const list = useQuery({
    queryKey: ['laboratories', ctx.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('laboratories')
        .select(
          'id,code,trade_name,legal_name,contact_name,phone,email,default_lead_days,integration_kind,is_active',
        )
        .order('trade_name')
      if (error) throw error
      return data ?? []
    },
  })

  /** Pedidos em andamento por laboratório — o número que diz quem está entregando. */
  const orders = useQuery({
    queryKey: ['lab-orders-open', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lab_orders')
        .select('id,laboratory_id,status,expected_at,number')
        .eq('branch_id', branchId)
        .limit(500)
      if (error) throw error
      const open = (data ?? []).filter(
        (row) => row.status !== 'received' && row.status !== 'cancelled',
      )
      const map = new Map<string, number>()
      for (const row of open) {
        if (!row.laboratory_id) continue
        map.set(row.laboratory_id, (map.get(row.laboratory_id) ?? 0) + 1)
      }
      return { open, map }
    },
  })

  const form = useRecordForm({
    table: 'laboratories',
    singular: 'laboratório',
    fields: [
      { name: 'code', label: 'Código', required: true, span: 4 },
      { name: 'trade_name', label: 'Nome fantasia', required: true, span: 8 },
      { name: 'legal_name', label: 'Razão social', span: 8 },
      { name: 'tax_document', label: 'CNPJ', span: 4 },
      { name: 'contact_name', label: 'Contato', span: 6 },
      { name: 'phone', label: 'Telefone', span: 6 },
      { name: 'email', label: 'E-mail', type: 'email', span: 8 },
      {
        name: 'default_lead_days',
        label: 'Prazo padrão (dias)',
        type: 'number',
        span: 4,
        defaultValue: 5,
      },
      {
        name: 'integration_kind',
        label: 'Envio do pedido',
        type: 'select',
        span: 8,
        defaultValue: 'manual',
        options: Object.entries(INTEGRATION).map(([value, label]) => ({ value, label })),
      },
      { name: 'is_active', label: 'Ativo', type: 'checkbox', span: 4, defaultValue: true },
    ],
  })

  const rows = list.data ?? []
  const ativos = rows.filter((row) => row.is_active)
  const emAndamento = orders.data?.open.length ?? 0
  const prazoMedio =
    ativos.length === 0
      ? 0
      : ativos.reduce((sum, row) => sum + Number(row.default_lead_days ?? 0), 0) /
        ativos.length

  const proximos = (orders.data?.open ?? [])
    .filter((row) => row.expected_at)
    .sort((a, b) => (a.expected_at ?? '').localeCompare(b.expected_at ?? ''))
    .slice(0, 5)

  const nomeDoLab = (id: string | null) =>
    rows.find((row) => row.id === id)?.trade_name ?? '—'

  return (
    <>
      <CatalogScreen
        title="Laboratórios"
        subtitle="Parceiros que surfaçam, montam e entregam as suas lentes."
        addLabel="laboratório"
        onAdd={form.openCreate}
        loading={list.isLoading}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={(row) => form.openEdit(row as unknown as Record<string, unknown>)}
        searchPlaceholder="Buscar por nome, contato, código ou e-mail…"
        searchText={(row) =>
          [row.trade_name, row.legal_name, row.contact_name, row.code, row.email]
            .filter(Boolean)
            .join(' ')
        }
        stats={[
          {
            icon: IconFlask,
            tone: 'brand',
            label: 'Laboratórios',
            value: String(rows.length),
            hint: 'parceiros cadastrados',
          },
          {
            icon: IconCheckCircle,
            tone: 'success',
            label: 'Ativos',
            value: String(ativos.length),
            hint: rows.length
              ? `${Math.round((ativos.length / rows.length) * 100)}% em operação`
              : 'nenhum cadastrado',
          },
          {
            icon: IconClock,
            tone: 'warning',
            label: 'Pedidos em andamento',
            value: String(emAndamento),
            hint: 'em produção nos laboratórios',
          },
          {
            icon: IconMoney,
            tone: 'violet',
            label: 'Prazo médio',
            value: prazoMedio ? `${prazoMedio.toFixed(1)} dias` : '—',
            hint: 'prazo padrão dos ativos',
          },
        ]}
        filters={[
          {
            id: 'status',
            label: 'Todos os status',
            options: [
              { value: 'active', label: 'Ativos' },
              { value: 'inactive', label: 'Inativos' },
            ],
            match: (row, value) => (value === 'active' ? row.is_active : !row.is_active),
          },
          {
            id: 'integration',
            label: 'Todo tipo de envio',
            options: Object.entries(INTEGRATION).map(([value, label]) => ({
              value,
              label,
            })),
            match: (row, value) => row.integration_kind === value,
          },
        ]}
        columns={[
          {
            key: 'name',
            header: 'Laboratório',
            render: (row) => (
              <div className="flex items-center gap-2.5">
                <Avatar name={row.trade_name} tone={3} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{row.trade_name}</p>
                  <p className="truncate text-xs text-fg-subtle">{row.code}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'contact',
            header: 'Contato',
            className: 'hidden lg:table-cell',
            headerClassName: 'hidden lg:table-cell',
            render: (row) => (
              <div className="min-w-0">
                <p className="truncate text-fg">{row.contact_name ?? '—'}</p>
                {row.phone && (
                  <p className="truncate text-xs text-fg-subtle">{formatPhone(row.phone)}</p>
                )}
              </div>
            ),
          },
          {
            key: 'lead',
            header: 'Prazo médio',
            className: 'tnum text-fg-muted whitespace-nowrap',
            render: (row) => `${row.default_lead_days} dias`,
          },
          {
            key: 'integration',
            header: 'Envio',
            className: 'hidden text-fg-muted xl:table-cell',
            headerClassName: 'hidden xl:table-cell',
            render: (row) => INTEGRATION[row.integration_kind] ?? row.integration_kind,
          },
          {
            key: 'orders',
            header: 'Pedidos ativos',
            className: 'tnum text-fg-muted',
            render: (row) => orders.data?.map.get(row.id) ?? 0,
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <ActiveBadge active={row.is_active} />,
          },
        ]}
        aside={
          <>
            <Card title={<span className="text-sm font-semibold text-fg">Pedidos com prazo próximo</span>} bodyClassName="p-2">
              <AsideRanking
                items={proximos.map((order, index) => ({
                  key: order.id,
                  rank: index + 1,
                  title: nomeDoLab(order.laboratory_id),
                  detail: `Pedido #${order.number}`,
                  value: (
                    <span className="tnum text-xs">{formatDate(order.expected_at)}</span>
                  ),
                }))}
              />
            </Card>

            <Card title={<span className="text-sm font-semibold text-fg">Distribuição de pedidos</span>}>
              {emAndamento === 0 ? (
                <p className="py-6 text-center text-xs text-fg-subtle">
                  Nenhum pedido em andamento.
                </p>
              ) : (
                <Donut
                  layout="column"
                  slices={distribution(orders.data?.open ?? [], (order) =>
                    nomeDoLab(order.laboratory_id),
                  )}
                  centerValue={String(emAndamento)}
                  centerLabel="em andamento"
                />
              )}
            </Card>

            <AsideTip title="Prazo curto não é tudo">
              Prazo prometido e prazo cumprido são coisas diferentes. Compare o prazo
              padrão com o que os pedidos acima mostram na prática antes de escolher
              o laboratório da próxima O.S.
            </AsideTip>
          </>
        }
      />
      {form.modal}
    </>
  )
}

// ---------------------------------------------------------------------------
// Cadastros simples (mantidos na lista enxuta)
// ---------------------------------------------------------------------------

export function LensTypesPage() {
  return (
    <CrudPage
      table="lens_types"
      title="Tipos de lente"
      singular="tipo de lente"
      subtitle="Monofocal, bifocal, multifocal — e as regras que cada um exige na O.S."
      orderBy={{ column: 'code', ascending: true }}
      columns={[
        { key: 'label', header: 'Tipo', render: (r) => r.label },
        {
          key: 'addition',
          header: 'Exige adição',
          render: (r) => (r.requires_addition ? <Badge tone="warning">sim</Badge> : '—'),
        },
        {
          key: 'height',
          header: 'Exige altura',
          render: (r) =>
            r.requires_fitting_height ? <Badge tone="warning">sim</Badge> : '—',
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
          name: 'requires_addition',
          label: 'Exige adição na receita',
          type: 'checkbox',
          span: 6,
        },
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

export function ServiceOrderStatusesPage() {
  return (
    <CrudPage
      table="service_order_statuses"
      title="Situações da O.S."
      singular="situação"
      subtitle="As etapas por onde uma ordem de serviço passa, na ordem do fluxo."
      orderBy={{ column: 'sort_order', ascending: true }}
      columns={[
        { key: 'label', header: 'Situação', render: (r) => r.label },
        { key: 'stage', header: 'Estágio', render: (r) => r.stage },
        { key: 'order', header: 'Ordem', numeric: true, render: (r) => r.sort_order },
        {
          key: 'final',
          header: '',
          render: (r) => (r.is_final ? <Badge tone="success">final</Badge> : null),
        },
      ]}
      fields={[
        { name: 'code', label: 'Código', required: true, span: 4 },
        { name: 'label', label: 'Nome', required: true, span: 8 },
        { name: 'stage', label: 'Estágio', required: true, span: 6 },
        { name: 'sort_order', label: 'Ordem', type: 'number', span: 3 },
        { name: 'is_final', label: 'Encerra a O.S.', type: 'checkbox', span: 3 },
      ]}
    />
  )
}

export { IconGlasses }
