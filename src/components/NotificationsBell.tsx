import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useBranchId, useSession } from '@/auth/SessionProvider'
import { formatMoney, today } from '@/lib/format'
import { cx } from './ui/primitives'
import { IconBell, IconCheckCircle, IconClock, IconMoney } from './ui/icons'

/**
 * O sino mostra só o que exige ação hoje, e cada linha é um número que o
 * sistema já sabe — nada de "novidades". Três coisas param uma ótica: O.S.
 * atrasada, óculos pronto que ninguém avisou e título vencido.
 */
export function NotificationsBell() {
  const branchId = useBranchId()
  const { can } = useSession()
  const [open, setOpen] = useState(false)

  const alerts = useQuery({
    queryKey: ['alertas', branchId],
    enabled: Boolean(branchId),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const day = today()
      const [atrasadas, prontas, vencidos] = await Promise.all([
        can('service_order.read')
          ? supabase
              .from('service_orders')
              .select('id', { count: 'exact', head: true })
              .eq('branch_id', branchId)
              .is('delivered_at', null)
              .is('cancelled_at', null)
              .lt('promised_at', new Date().toISOString())
          : Promise.resolve({ count: 0 }),
        can('service_order.read')
          ? supabase
              .from('v_service_order_production')
              .select('service_order_id', { count: 'exact', head: true })
              .eq('branch_id', branchId)
              .eq('status_stage', 'ready_for_pickup')
          : Promise.resolve({ count: 0 }),
        can('finance.read')
          ? supabase
              .from('receivables')
              .select('amount, paid_amount')
              .eq('branch_id', branchId)
              .lt('due_date', day)
              .in('status', ['open', 'partially_paid', 'overdue'])
          : Promise.resolve({ data: [] }),
      ])

      const vencidoTotal = ('data' in vencidos ? (vencidos.data ?? []) : []).reduce(
        (sum, row) => sum + (Number(row.amount ?? 0) - Number(row.paid_amount ?? 0)),
        0,
      )

      return {
        atrasadas: ('count' in atrasadas ? atrasadas.count : 0) ?? 0,
        prontas: ('count' in prontas ? prontas.count : 0) ?? 0,
        vencidoTotal,
        vencidoQtd: ('data' in vencidos ? (vencidos.data ?? []) : []).length,
      }
    },
  })

  const data = alerts.data
  const items = [
    data?.atrasadas
      ? {
          key: 'atrasadas',
          icon: IconClock,
          tone: 'danger' as const,
          title: `${data.atrasadas} O.S. atrasada${data.atrasadas > 1 ? 's' : ''}`,
          detail: 'Passaram da data prometida ao cliente.',
          to: '/producao',
        }
      : null,
    data?.prontas
      ? {
          key: 'prontas',
          icon: IconCheckCircle,
          tone: 'success' as const,
          title: `${data.prontas} pronta${data.prontas > 1 ? 's' : ''} para retirada`,
          detail: 'Avise o cliente para buscar.',
          to: '/producao',
        }
      : null,
    data?.vencidoQtd
      ? {
          key: 'vencidos',
          icon: IconMoney,
          tone: 'warning' as const,
          title: `${formatMoney(data.vencidoTotal)} vencidos`,
          detail: `${data.vencidoQtd} título${data.vencidoQtd > 1 ? 's' : ''} em atraso.`,
          to: '/financeiro/receber',
        }
      : null,
  ].filter((item) => item !== null)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg"
        aria-label={items.length ? `${items.length} avisos` : 'Avisos'}
        aria-expanded={open}
      >
        <IconBell className="size-5" />
        {items.length > 0 && (
          <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[0.5625rem] font-bold text-white">
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1.5 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-surface p-1.5 shadow-lg">
            <p className="px-2.5 py-2 text-xs font-semibold text-fg">Precisa de atenção</p>

            {items.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-xs text-fg-subtle">
                Nada pendente por aqui. Bom trabalho.
              </p>
            ) : (
              items.map((item) => (
                <Link
                  key={item.key}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2.5 rounded-lg px-2.5 py-2.5 hover:bg-surface-sunken"
                >
                  <span
                    className={cx(
                      'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                      item.tone === 'danger' &&
                        'bg-red-50 text-red-600 dark:bg-red-500/12 dark:text-red-300',
                      item.tone === 'success' &&
                        'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300',
                      item.tone === 'warning' &&
                        'bg-amber-50 text-amber-600 dark:bg-amber-500/12 dark:text-amber-300',
                    )}
                  >
                    <item.icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">{item.title}</span>
                    <span className="block text-xs text-fg-subtle">{item.detail}</span>
                  </span>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
