import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAppContext, useBranchId } from '@/auth/SessionProvider'
import { supabase } from '@/lib/supabase'
import { Badge, Card, PageHeader } from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, formatMoney, today } from '@/lib/format'

type StatTone = 'neutral' | 'warning' | 'danger' | 'success'

const STAT_ACCENT: Record<StatTone, string> = {
  neutral: 'bg-line-strong',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
}

const STAT_VALUE: Record<StatTone, string> = {
  neutral: 'text-fg',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
}

function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  to,
}: {
  label: string
  value: string
  hint?: string
  tone?: StatTone
  to?: string
}) {
  const body = (
    <div
      className={
        'relative h-full overflow-hidden rounded-card border border-line bg-surface p-4 ' +
        'shadow-sm shadow-ink-900/4 transition-colors ' +
        (to ? 'hover:border-brand-200 hover:bg-brand-50/30 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/8' : '')
      }
    >
      <span className={'absolute inset-x-0 top-0 h-0.5 ' + STAT_ACCENT[tone]} />
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      <p className={'tnum mt-1.5 text-[1.75rem] leading-none font-semibold ' + STAT_VALUE[tone]}>
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[0.6875rem] text-fg-subtle">{hint}</p>}
    </div>
  )
  return to ? (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  )
}

export function DashboardPage() {
  const ctx = useAppContext()
  const branchId = useBranchId()

  const stats = useQuery({
    queryKey: ['dashboard', branchId],
    queryFn: async () => {
      const day = today()

      const [osAbertas, osAtrasadas, osProntas, vendasHoje, receberVencido] =
        await Promise.all([
          supabase.from('service_orders')
            .select('id', { count: 'exact', head: true })
            .eq('branch_id', branchId)
            .is('delivered_at', null)
            .is('cancelled_at', null),
          supabase.from('service_orders')
            .select('id', { count: 'exact', head: true })
            .eq('branch_id', branchId)
            .is('delivered_at', null)
            .is('cancelled_at', null)
            .lt('promised_at', new Date().toISOString()),
          supabase.from('v_service_order_production')
            .select('service_order_id', { count: 'exact', head: true })
            .eq('branch_id', branchId)
            .eq('status_stage', 'ready_for_pickup'),
          supabase.from('sales')
            .select('total_amount')
            .eq('branch_id', branchId)
            .gte('sold_at', `${day}T00:00:00`)
            .neq('status', 'cancelled'),
          supabase.from('receivables')
            .select('amount, paid_amount')
            .eq('branch_id', branchId)
            .lt('due_date', day)
            .in('status', ['open', 'partially_paid', 'overdue']),
        ])

      const totalVendas = (vendasHoje.data ?? []).reduce(
        (sum, s) => sum + Number(s.total_amount ?? 0),
        0,
      )
      const totalVencido = (receberVencido.data ?? []).reduce(
        (sum, r) => sum + (Number(r.amount ?? 0) - Number(r.paid_amount ?? 0)),
        0,
      )

      return {
        osAbertas: osAbertas.count ?? 0,
        osAtrasadas: osAtrasadas.count ?? 0,
        osProntas: osProntas.count ?? 0,
        vendasHoje: totalVendas,
        vencido: totalVencido,
      }
    },
  })

  const aniversariantes = useQuery({
    queryKey: ['aniversariantes', ctx.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('individual_profiles')
        // Duas FKs ligam este perfil a customers (a simples e a composta com
        // tenant_id): o embed precisa dizer qual usar.
        .select('customer_id, birth_date, customers!individual_profiles_customer_id_fkey(display_name)')
        .not('birth_date', 'is', null)
        .limit(200)
      if (error) throw error
      const mesAtual = new Date().getMonth() + 1
      return (data ?? [])
        .filter((r) => Number(r.birth_date?.slice(5, 7)) === mesAtual)
        .slice(0, 8)
    },
  })

  return (
    <>
      <PageHeader
        title={`Olá, ${ctx.full_name.split(' ')[0]}`}
        subtitle={`${ctx.branches.find((b) => b.id === branchId)?.trade_name ?? ''} · ${formatDate(today())}`}
      />

      {stats.isLoading ? (
        <Spinner />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat
            label="O.S. em aberto"
            value={String(stats.data?.osAbertas ?? 0)}
            hint="em produção nesta filial"
            to="/producao"
          />
          <Stat
            label="O.S. atrasadas"
            value={String(stats.data?.osAtrasadas ?? 0)}
            hint="passaram da data prometida"
            tone={stats.data?.osAtrasadas ? 'danger' : 'neutral'}
            to="/producao"
          />
          <Stat
            label="Prontas para retirada"
            value={String(stats.data?.osProntas ?? 0)}
            hint="avisar o cliente"
            tone={stats.data?.osProntas ? 'success' : 'neutral'}
            to="/producao"
          />
          <Stat
            label="Vendas de hoje"
            value={formatMoney(stats.data?.vendasHoje ?? 0)}
            hint="faturamento do dia"
            to="/comercial/vendas"
          />
          <Stat
            label="A receber vencido"
            value={formatMoney(stats.data?.vencido ?? 0)}
            hint="títulos em atraso"
            tone={stats.data?.vencido ? 'warning' : 'neutral'}
            to="/financeiro/receber"
          />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Aniversariantes do mês">
          {aniversariantes.isLoading ? (
            <Spinner />
          ) : aniversariantes.data && aniversariantes.data.length > 0 ? (
            <ul className="divide-y divide-line text-sm">
              {aniversariantes.data.map((row) => (
                <li key={row.customer_id} className="flex justify-between py-2">
                  <Link
                    to={`/clientes/${row.customer_id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {row.customers?.display_name ?? '—'}
                  </Link>
                  <span className="tnum text-fg-subtle">
                    {row.birth_date?.slice(8, 10)}/{row.birth_date?.slice(5, 7)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-fg-subtle">Nenhum aniversariante este mês.</p>
          )}
        </Card>

        <Card title="Atalhos">
          <div className="grid gap-1.5">
            {[
              ['/comercial/vendas/nova', 'Nova venda'],
              ['/clientes', 'Buscar cliente'],
              ['/optica/receitas/nova', 'Registrar receita'],
              ['/producao', 'Painel de produção'],
            ].map(([to, label]) => (
              <Link
                key={to}
                to={to!}
                className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 text-sm text-fg transition-colors hover:border-brand-200 hover:bg-brand-50/40 hover:text-brand-800 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-200"
              >
                {label}
                <span className="text-fg-subtle">›</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">
            {ctx.is_tenant_admin && <Badge tone="info" dot>Administrador</Badge>}
            {ctx.is_salesperson && <Badge tone="neutral" dot>Vendedor</Badge>}
          </div>
        </Card>
      </div>
    </>
  )
}
