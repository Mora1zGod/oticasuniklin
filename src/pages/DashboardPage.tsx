import type { ComponentType, ReactNode, SVGProps } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAppContext, useBranchId } from '@/auth/SessionProvider'
import { useBranding } from '@/branding/BrandingProvider'
import { supabase } from '@/lib/supabase'
import { Badge, Card, cx } from '@/components/ui/primitives'
import { StatTile } from '@/components/ui/StatTile'
import { Donut } from '@/components/ui/Donut'
import { Spinner } from '@/components/ui/Spinner'
import {
  IconArrowRight,
  IconBolt,
  IconCake,
  IconCart,
  IconChart,
  IconCheckCircle,
  IconClipboard,
  IconClock,
  IconCoin,
  IconFile,
  IconGlasses,
  IconPhone,
  IconUsers,
  IconWrench,
} from '@/components/ui/icons'
import { formatDate, formatMoney, formatPhone, today } from '@/lib/format'

/** Rótulo e cor de cada estágio da produção. Ordem = ordem do fluxo. */
const STAGES = [
  { stage: 'draft', label: 'Aberta', series: 1 },
  { stage: 'awaiting_lab', label: 'No laboratório', series: 2 },
  { stage: 'in_production', label: 'Em produção', series: 3 },
  { stage: 'received_from_lab', label: 'Recebida', series: 4 },
  { stage: 'assembling', label: 'Montagem', series: 5 },
  { stage: 'quality_check', label: 'Conferência', series: 1 },
  { stage: 'ready_for_pickup', label: 'Pronta para retirada', series: 3 },
] as const

export function DashboardPage() {
  const ctx = useAppContext()
  const branchId = useBranchId()
  const { branding } = useBranding()

  const stats = useQuery({
    queryKey: ['dashboard', branchId],
    queryFn: async () => {
      const day = today()
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

      const [osAbertas, osAtrasadas, osProntas, vendasHoje, vendasOntem, vencido] =
        await Promise.all([
          supabase
            .from('service_orders')
            .select('id', { count: 'exact', head: true })
            .eq('branch_id', branchId)
            .is('delivered_at', null)
            .is('cancelled_at', null),
          supabase
            .from('service_orders')
            .select('id', { count: 'exact', head: true })
            .eq('branch_id', branchId)
            .is('delivered_at', null)
            .is('cancelled_at', null)
            .lt('promised_at', new Date().toISOString()),
          supabase
            .from('v_service_order_production')
            .select('service_order_id', { count: 'exact', head: true })
            .eq('branch_id', branchId)
            .eq('status_stage', 'ready_for_pickup'),
          supabase
            .from('sales')
            .select('total_amount')
            .eq('branch_id', branchId)
            .gte('sold_at', `${day}T00:00:00`)
            .neq('status', 'cancelled'),
          supabase
            .from('sales')
            .select('total_amount')
            .eq('branch_id', branchId)
            .gte('sold_at', `${yesterday}T00:00:00`)
            .lt('sold_at', `${day}T00:00:00`)
            .neq('status', 'cancelled'),
          supabase
            .from('receivables')
            .select('amount, paid_amount')
            .eq('branch_id', branchId)
            .lt('due_date', day)
            .in('status', ['open', 'partially_paid', 'overdue']),
        ])

      const soma = (rows: { total_amount: number | null }[] | null) =>
        (rows ?? []).reduce((total, row) => total + Number(row.total_amount ?? 0), 0)

      return {
        osAbertas: osAbertas.count ?? 0,
        osAtrasadas: osAtrasadas.count ?? 0,
        osProntas: osProntas.count ?? 0,
        vendasHoje: soma(vendasHoje.data),
        vendasOntem: soma(vendasOntem.data),
        vencido: (vencido.data ?? []).reduce(
          (total, row) => total + (Number(row.amount ?? 0) - Number(row.paid_amount ?? 0)),
          0,
        ),
        vencidoQtd: (vencido.data ?? []).length,
      }
    },
  })

  const producao = useQuery({
    queryKey: ['dashboard-producao', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_service_order_production')
        .select('status_stage')
        .eq('branch_id', branchId)
        .not('status_stage', 'in', '("delivered","cancelled")')
      if (error) throw error
      return STAGES.map((stage) => ({
        ...stage,
        count: (data ?? []).filter((row) => row.status_stage === stage.stage).length,
      })).filter((stage) => stage.count > 0)
    },
  })

  const aniversariantes = useQuery({
    queryKey: ['aniversariantes', ctx.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_customer_overview')
        .select('id, display_name, birth_date, primary_phone')
        .not('birth_date', 'is', null)
        .limit(300)
      if (error) throw error
      const mes = String(new Date().getMonth() + 1).padStart(2, '0')
      return (data ?? [])
        .filter((row) => row.birth_date?.slice(5, 7) === mes)
        .sort((a, b) => (a.birth_date ?? '').slice(8) .localeCompare((b.birth_date ?? '').slice(8)))
        .slice(0, 5)
    },
  })

  const vendas = useQuery({
    queryKey: ['dashboard-vendas', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('id, number, sold_at, total_amount, status, customers(display_name)')
        .eq('branch_id', branchId)
        .order('sold_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data ?? []
    },
  })

  const ordens = useQuery({
    queryKey: ['dashboard-ordens', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_service_order_production')
        .select('service_order_id, number, customer_name, promised_at, status_stage')
        .eq('branch_id', branchId)
        .not('status_stage', 'in', '("delivered","cancelled")')
        .order('promised_at')
        .limit(6)
      if (error) throw error
      return data ?? []
    },
  })

  const data = stats.data
  const branch = ctx.branches.find((b) => b.id === branchId)
  const diffVendas = delta(data?.vendasHoje ?? 0, data?.vendasOntem ?? 0)

  return (
    <>
      {/* ------------------------------ Saudação ------------------------------ */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fg">
            Olá, {ctx.full_name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Hoje é {longDate()} · {branch?.trade_name}
          </p>
        </div>
        <p className="hidden items-center gap-2.5 text-sm text-fg-subtle italic lg:flex">
          “{branding.loginHeadline}”
          <IconGlasses className="size-7 shrink-0 text-line-strong not-italic" />
        </p>
      </div>

      {/* ---------------------------- Indicadores ---------------------------- */}
      {stats.isLoading ? (
        <Spinner />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile
            icon={IconFile}
            tone="brand"
            label="O.S. em aberto"
            value={String(data?.osAbertas ?? 0)}
            hint="em produção nesta filial"
            to="/producao"
          />
          <StatTile
            icon={IconClock}
            tone="danger"
            label="O.S. atrasadas"
            value={String(data?.osAtrasadas ?? 0)}
            hint="passaram da data prometida"
            to="/producao"
          />
          <StatTile
            icon={IconCheckCircle}
            tone="success"
            label="Prontas para retirada"
            value={String(data?.osProntas ?? 0)}
            hint="avisar o cliente"
            to="/producao"
          />
          <StatTile
            icon={IconChart}
            tone="brand"
            label="Vendas de hoje"
            value={formatMoney(data?.vendasHoje ?? 0)}
            delta={diffVendas}
            hint="vs. ontem"
            to="/comercial/vendas"
          />
          <StatTile
            icon={IconCoin}
            tone="warning"
            label="A receber vencido"
            value={formatMoney(data?.vencido ?? 0)}
            hint={`${data?.vencidoQtd ?? 0} título(s) em atraso`}
            to="/financeiro/receber"
          />
        </div>
      )}

      {/* ------------------- Produção · Atalhos · Aniversários ------------------- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        <Card
          title={
            <span className="flex items-center gap-2 text-sm font-semibold text-fg">
              <IconWrench className="size-4 text-brand-600" />
              Status da produção
            </span>
          }
          actions={
            <Link
              to="/producao"
              className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              Ver painel <IconArrowRight className="size-3.5" />
            </Link>
          }
        >
          {producao.isLoading ? (
            <Spinner />
          ) : (producao.data?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-fg-subtle">
              Nenhuma O.S. em andamento nesta filial.
            </p>
          ) : (
            <Donut
              slices={(producao.data ?? []).map((stage) => ({
                key: stage.stage,
                label: stage.label,
                value: stage.count,
                series: stage.series,
              }))}
              centerValue={String(
                (producao.data ?? []).reduce((sum, stage) => sum + stage.count, 0),
              )}
              centerLabel="O.S. totais"
            />
          )}
        </Card>

        <Card
          title={
            <span className="flex items-center gap-2 text-sm font-semibold text-fg">
              <IconBolt className="size-4 text-brand-600" />
              Atalhos
            </span>
          }
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Shortcut
              to="/comercial/vendas/nova"
              icon={IconCart}
              tone="brand"
              title="Nova venda"
              detail="Iniciar atendimento"
            />
            <Shortcut
              to="/clientes"
              icon={IconUsers}
              tone="success"
              title="Buscar cliente"
              detail="Localizar no sistema"
            />
            <Shortcut
              to="/optica/receitas/nova"
              icon={IconGlasses}
              tone="violet"
              title="Registrar receita"
              detail="Incluir nova receita"
            />
            <Shortcut
              to="/producao"
              icon={IconWrench}
              tone="warning"
              title="Painel de produção"
              detail="Acompanhar O.S."
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">
            {ctx.is_tenant_admin && (
              <Badge tone="info" dot>
                Administrador
              </Badge>
            )}
            {ctx.is_salesperson && (
              <Badge tone="neutral" dot>
                Vendedor
              </Badge>
            )}
          </div>
        </Card>

        <Card
          title={
            <span className="flex items-center gap-2 text-sm font-semibold text-fg">
              <IconCake className="size-4 text-brand-600" />
              Aniversariantes do mês
            </span>
          }
          actions={
            <Link
              to="/clientes"
              className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              Ver todos <IconArrowRight className="size-3.5" />
            </Link>
          }
          bodyClassName="p-2"
        >
          {aniversariantes.isLoading ? (
            <Spinner />
          ) : (aniversariantes.data?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-fg-subtle">
              Nenhum aniversariante este mês.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {aniversariantes.data?.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-sunken"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[0.6875rem] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                    {(row.display_name ?? '?')
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() ?? '')
                      .join('')}
                  </span>
                  <Link
                    to={`/clientes/${row.id}`}
                    className="min-w-0 flex-1 leading-tight"
                  >
                    <span className="block truncate text-sm font-medium text-fg">
                      {row.display_name}
                    </span>
                    <span className="block text-xs text-fg-subtle">
                      {birthdayLabel(row.birth_date)}
                    </span>
                  </Link>
                  {row.primary_phone && (
                    <a
                      href={`tel:${row.primary_phone}`}
                      title={formatPhone(row.primary_phone)}
                      className="shrink-0 rounded-lg p-2 text-fg-subtle hover:bg-surface-sunken hover:text-brand-600"
                      aria-label={`Ligar para ${row.display_name}`}
                    >
                      <IconPhone className="size-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ---------------------- Últimas vendas · O.S. ---------------------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card
          title={
            <span className="flex items-center gap-2 text-sm font-semibold text-fg">
              <IconChart className="size-4 text-brand-600" />
              Últimas vendas
            </span>
          }
          actions={
            <Link
              to="/comercial/vendas"
              className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              Ver todas <IconArrowRight className="size-3.5" />
            </Link>
          }
          bodyClassName="p-0"
        >
          {vendas.isLoading ? (
            <Spinner />
          ) : (vendas.data?.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-sm text-fg-subtle">
              Nenhuma venda registrada ainda.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="border-b border-line text-[0.6875rem] tracking-wide text-fg-subtle uppercase">
                    <th className="px-4 py-2 text-left font-medium">#</th>
                    <th className="px-4 py-2 text-left font-medium">Data</th>
                    <th className="px-4 py-2 text-left font-medium">Cliente</th>
                    <th className="px-4 py-2 text-right font-medium">Valor</th>
                    <th className="px-4 py-2 text-left font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {vendas.data?.map((sale) => (
                    <tr key={sale.id} className="hover:bg-surface-sunken">
                      <td className="px-4 py-2.5">
                        <Link
                          to={`/comercial/vendas/${sale.id}`}
                          className="tnum font-medium text-brand-700 hover:underline dark:text-brand-300"
                        >
                          #{sale.number}
                        </Link>
                      </td>
                      <td className="tnum px-4 py-2.5 text-fg-muted">
                        {formatDate(sale.sold_at)}
                      </td>
                      <td className="max-w-40 truncate px-4 py-2.5 text-fg">
                        {sale.customers?.display_name ?? 'Venda avulsa'}
                      </td>
                      <td className="tnum px-4 py-2.5 text-right font-medium text-fg">
                        {formatMoney(Number(sale.total_amount ?? 0))}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={saleTone(sale.status)} dot>
                          {saleLabel(sale.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title={
            <span className="flex items-center gap-2 text-sm font-semibold text-fg">
              <IconClipboard className="size-4 text-brand-600" />
              O.S. em destaque
            </span>
          }
          actions={
            <Link
              to="/ordens-de-servico"
              className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              Ver todas <IconArrowRight className="size-3.5" />
            </Link>
          }
          bodyClassName="p-0"
        >
          {ordens.isLoading ? (
            <Spinner />
          ) : (ordens.data?.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-sm text-fg-subtle">
              Nenhuma O.S. em andamento.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="border-b border-line text-[0.6875rem] tracking-wide text-fg-subtle uppercase">
                    <th className="px-4 py-2 text-left font-medium"># O.S.</th>
                    <th className="px-4 py-2 text-left font-medium">Cliente</th>
                    <th className="px-4 py-2 text-left font-medium">Prazo</th>
                    <th className="px-4 py-2 text-left font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {ordens.data?.map((order) => {
                    const atrasada =
                      order.promised_at &&
                      new Date(order.promised_at).getTime() < Date.now()
                    return (
                      <tr key={order.service_order_id} className="hover:bg-surface-sunken">
                        <td className="px-4 py-2.5">
                          <Link
                            to={`/ordens-de-servico/${order.service_order_id}`}
                            className="tnum font-medium text-brand-700 hover:underline dark:text-brand-300"
                          >
                            #{order.number}
                          </Link>
                        </td>
                        <td className="max-w-40 truncate px-4 py-2.5 text-fg">
                          {order.customer_name ?? '—'}
                        </td>
                        <td
                          className={cx(
                            'tnum px-4 py-2.5',
                            atrasada ? 'font-medium text-red-600' : 'text-fg-muted',
                          )}
                        >
                          {formatDate(order.promised_at)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge tone={atrasada ? 'danger' : 'info'} dot>
                            {atrasada
                              ? 'Atrasada'
                              : (STAGES.find((s) => s.stage === order.status_stage)?.label ??
                                '—')}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------

const SHORTCUT_TONE = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/12 dark:text-brand-200',
  success:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-200',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/12 dark:text-violet-200',
  warning: 'bg-amber-50 text-amber-800 dark:bg-amber-500/12 dark:text-amber-200',
} as const

function Shortcut({
  to,
  icon: Icon,
  tone,
  title,
  detail,
}: {
  to: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone: keyof typeof SHORTCUT_TONE
  title: string
  detail: string
}) {
  return (
    <Link
      to={to}
      className={cx(
        'flex items-center gap-2.5 rounded-xl px-3 py-3 transition-opacity hover:opacity-85',
        SHORTCUT_TONE[tone],
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface/70">
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-[0.6875rem] opacity-75">{detail}</span>
      </span>
    </Link>
  )
}

// ---------------------------------------------------------------------------

/** Variação percentual; null quando não há base de comparação. */
function delta(current: number, previous: number): number | null {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 100)
}

function longDate(): string {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function birthdayLabel(date: string | null | undefined): string {
  if (!date) return ''
  const day = Number(date.slice(8, 10))
  const hoje = new Date().getDate()
  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long' })
  if (day === hoje) return `Hoje, ${day} de ${mes}`
  return `${day} de ${mes}`
}

const saleTone = (status: string | null): 'success' | 'warning' | 'danger' | 'neutral' =>
  status === 'confirmed' ? 'success' : status === 'cancelled' ? 'danger' : 'warning'

const saleLabel = (status: string | null): ReactNode =>
  status === 'confirmed'
    ? 'Concluída'
    : status === 'cancelled'
      ? 'Cancelada'
      : 'Rascunho'
