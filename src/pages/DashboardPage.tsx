import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAppContext, useBranchId } from '@/auth/SessionProvider'
import { supabase } from '@/lib/supabase'
import { Badge, Card, PageHeader } from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, formatMoney, today } from '@/lib/format'

function Stat({
  label,
  value,
  tone,
  to,
}: {
  label: string
  value: string
  tone?: 'neutral' | 'warning' | 'danger' | 'success'
  to?: string
}) {
  const body = (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs transition hover:border-brand-300">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={
          'mt-1 text-2xl font-semibold tabular-nums ' +
          (tone === 'danger'
            ? 'text-red-600'
            : tone === 'warning'
              ? 'text-amber-600'
              : tone === 'success'
                ? 'text-emerald-600'
                : 'text-slate-900')
        }
      >
        {value}
      </p>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
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
            to="/producao"
          />
          <Stat
            label="O.S. atrasadas"
            value={String(stats.data?.osAtrasadas ?? 0)}
            tone={stats.data?.osAtrasadas ? 'danger' : 'neutral'}
            to="/producao"
          />
          <Stat
            label="Prontas para retirada"
            value={String(stats.data?.osProntas ?? 0)}
            tone={stats.data?.osProntas ? 'success' : 'neutral'}
            to="/producao"
          />
          <Stat
            label="Vendas de hoje"
            value={formatMoney(stats.data?.vendasHoje ?? 0)}
            to="/comercial/vendas"
          />
          <Stat
            label="A receber vencido"
            value={formatMoney(stats.data?.vencido ?? 0)}
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
            <ul className="divide-y divide-slate-100 text-sm">
              {aniversariantes.data.map((row) => (
                <li key={row.customer_id} className="flex justify-between py-2">
                  <Link
                    to={`/clientes/${row.customer_id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {row.customers?.display_name ?? '—'}
                  </Link>
                  <span className="text-slate-500">
                    {row.birth_date?.slice(8, 10)}/{row.birth_date?.slice(5, 7)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-slate-500">Nenhum aniversariante este mês.</p>
          )}
        </Card>

        <Card title="Atalhos">
          <div className="grid gap-2 text-sm">
            <Link to="/comercial/vendas/nova" className="text-brand-700 hover:underline">
              → Nova venda
            </Link>
            <Link to="/clientes" className="text-brand-700 hover:underline">
              → Buscar cliente
            </Link>
            <Link to="/optica/receitas" className="text-brand-700 hover:underline">
              → Registrar receita
            </Link>
            <Link to="/producao" className="text-brand-700 hover:underline">
              → Painel de produção
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {ctx.is_tenant_admin && <Badge tone="info">Administrador</Badge>}
            {ctx.is_salesperson && <Badge tone="neutral">Vendedor</Badge>}
          </div>
        </Card>
      </div>
    </>
  )
}
