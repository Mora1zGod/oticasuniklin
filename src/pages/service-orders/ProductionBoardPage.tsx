import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useBranchId } from '@/auth/SessionProvider'
import { DataTable } from '@/components/DataTable'
import { Badge, Button, Card, PageHeader, cx } from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, formatDiopter } from '@/lib/format'

/**
 * Estágios canônicos na ordem do fluxo (ADR-010). A cor marca a posição na
 * esteira: cinza no início, azul enquanto está fora da loja, âmbar no
 * acabamento, verde quando está pronta para o cliente.
 */
const STAGES = [
  { stage: 'draft', label: 'Aberta', accent: 'bg-line-strong' },
  { stage: 'awaiting_lab', label: 'No laboratório', accent: 'bg-brand-400' },
  { stage: 'in_production', label: 'Em produção', accent: 'bg-brand-500' },
  { stage: 'received_from_lab', label: 'Recebida', accent: 'bg-brand-600' },
  { stage: 'assembling', label: 'Montagem', accent: 'bg-amber-400' },
  { stage: 'quality_check', label: 'Conferência', accent: 'bg-amber-500' },
  { stage: 'ready_for_pickup', label: 'Pronta', accent: 'bg-emerald-500' },
] as const

export function ProductionBoardPage() {
  const branchId = useBranchId()
  const navigate = useNavigate()

  const orders = useQuery({
    queryKey: ['production-board', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_service_order_production')
        .select('*')
        .eq('branch_id', branchId)
        .not('status_stage', 'in', '("delivered","cancelled")')
        .order('promised_at')
      if (error) throw error
      return data ?? []
    },
  })

  if (orders.isLoading) return <Spinner />

  const now = Date.now()
  const isLate = (promised: string | null) =>
    Boolean(promised && new Date(promised).getTime() < now)

  const byStage = STAGES.map((s) => ({
    ...s,
    orders: (orders.data ?? []).filter((o) => o.status_stage === s.stage),
  }))

  const late = (orders.data ?? []).filter((o) => isLate(o.promised_at))

  return (
    <>
      <PageHeader
        title="Painel de produção"
        subtitle={`${orders.data?.length ?? 0} ordens em andamento nesta filial`}
        actions={
          <Link to="/ordens-de-servico/nova">
            <Button>+ O.S.</Button>
          </Link>
        }
      />

      {late.length > 0 && (
        <Card
          title={`${late.length} ordem(ns) atrasada(s)`}
          className="mb-4 border-red-200"
          bodyClassName="p-0"
        >
          <DataTable
            rows={late}
            rowKey={(row) => String(row.service_order_id)}
            onRowClick={(row) => navigate(`/ordens-de-servico/${row.service_order_id}`)}
            columns={[
              { key: 'number', header: 'O.S.', render: (r) => `#${r.number}` },
              { key: 'customer', header: 'Cliente', render: (r) => r.customer_name },
              { key: 'stage', header: 'Situação', render: (r) => <Badge>{r.status_code}</Badge> },
              {
                key: 'promised',
                header: 'Prometida',
                render: (r) => (
                  <span className="font-medium text-red-600">{formatDate(r.promised_at)}</span>
                ),
              },
            ]}
          />
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {byStage.map((column) => (
          <section
            key={column.stage}
            className="overflow-hidden rounded-card border border-line bg-surface shadow-sm shadow-ink-900/4"
          >
            <span className={cx('block h-1', column.accent)} />
            <header className="flex items-center justify-between border-b border-line px-3 py-2.5">
              <h2 className="text-sm font-semibold tracking-tight text-fg">
                {column.label}
              </h2>
              <span className="tnum rounded-md bg-surface-sunken px-2 py-0.5 text-xs font-medium text-fg-muted">
                {column.orders.length}
              </span>
            </header>
            <div className="max-h-96 space-y-2 overflow-y-auto p-2">
              {column.orders.length === 0 ? (
                <p className="px-2 py-5 text-center text-xs text-fg-subtle">vazio</p>
              ) : (
                column.orders.map((order) => (
                  <button
                    key={order.service_order_id}
                    onClick={() => navigate(`/ordens-de-servico/${order.service_order_id}`)}
                    className={cx(
                      'block w-full rounded-lg border p-2.5 text-left transition-colors',
                      isLate(order.promised_at)
                        ? 'border-red-200 bg-red-50/60 hover:bg-red-50 '
                          + 'dark:border-red-500/30 dark:bg-red-500/10 dark:hover:bg-red-500/15'
                        : 'border-line hover:border-brand-200 hover:bg-brand-50/40 '
                          + 'dark:hover:border-brand-500/40 dark:hover:bg-brand-500/8',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="tnum text-sm font-semibold text-fg">
                        #{order.number}
                      </span>
                      {order.promised_at && (
                        <span
                          className={cx(
                            'tnum text-xs',
                            isLate(order.promised_at)
                              ? 'font-medium text-red-600'
                              : 'text-fg-subtle',
                          )}
                        >
                          {formatDate(order.promised_at)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-fg-muted">{order.customer_name}</p>
                    <p className="tnum mt-1 truncate text-[0.6875rem] text-fg-subtle">
                      OD {formatDiopter(order.od_sphere_used)} · OE{' '}
                      {formatDiopter(order.os_sphere_used)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

export function ServiceOrderListPage() {
  const branchId = useBranchId()
  const navigate = useNavigate()

  const list = useQuery({
    queryKey: ['service-orders', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_service_order_production')
        .select('*')
        .eq('branch_id', branchId)
        .order('opened_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data ?? []
    },
  })

  return (
    <>
      <PageHeader
        title="Ordens de serviço"
        actions={
          <Link to="/ordens-de-servico/nova">
            <Button>+ O.S.</Button>
          </Link>
        }
      />
      <Card bodyClassName="p-0">
        <DataTable
          rows={list.data}
          loading={list.isLoading}
          rowKey={(row) => String(row.service_order_id)}
          onRowClick={(row) => navigate(`/ordens-de-servico/${row.service_order_id}`)}
          emptyTitle="Nenhuma ordem de serviço"
          columns={[
            { key: 'number', header: 'O.S.', render: (r) => `#${r.number}` },
            { key: 'customer', header: 'Cliente', render: (r) => r.customer_name },
            { key: 'opened', header: 'Aberta', render: (r) => formatDate(r.opened_at) },
            { key: 'promised', header: 'Prometida', render: (r) => formatDate(r.promised_at) },
            {
              key: 'stage',
              header: 'Situação',
              render: (r) => (
                <Badge tone={r.status_stage === 'delivered' ? 'success' : 'info'} dot>
                  {r.status_code}
                </Badge>
              ),
            },
            {
              key: 'od',
              header: 'OD utilizado',
              render: (r) =>
                `${formatDiopter(r.od_sphere_used)} ${formatDiopter(r.od_cylinder_used)}`,
            },
            { key: 'delivered', header: 'Entregue', render: (r) => formatDate(r.delivered_at) },
          ]}
        />
      </Card>
    </>
  )
}

export function LabOrderListPage() {
  const branchId = useBranchId()
  const navigate = useNavigate()

  const list = useQuery({
    queryKey: ['lab-orders', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lab_orders')
        .select('*, laboratories(trade_name), service_orders(number)')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data ?? []
    },
  })

  return (
    <>
      <PageHeader title="Pedidos ao laboratório" />
      <Card bodyClassName="p-0">
        <DataTable
          rows={list.data}
          loading={list.isLoading}
          rowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/ordens-de-servico/${row.service_order_id}`)}
          emptyTitle="Nenhum pedido"
          columns={[
            { key: 'number', header: 'Pedido', render: (r) => `#${r.number}` },
            { key: 'os', header: 'O.S.', render: (r) => `#${r.service_orders?.number ?? '—'}` },
            { key: 'lab', header: 'Laboratório', render: (r) => r.laboratories?.trade_name ?? '—' },
            { key: 'status', header: 'Situação', render: (r) => <Badge>{r.status}</Badge> },
            { key: 'sent', header: 'Enviado', render: (r) => formatDate(r.sent_at) },
            { key: 'expected', header: 'Previsto', render: (r) => formatDate(r.expected_at) },
            { key: 'received', header: 'Recebido', render: (r) => formatDate(r.received_at) },
          ]}
        />
      </Card>
    </>
  )
}
