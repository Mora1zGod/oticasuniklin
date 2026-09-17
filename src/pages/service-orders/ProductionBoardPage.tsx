import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useBranchId } from '@/auth/SessionProvider'
import { DataTable } from '@/components/DataTable'
import { Badge, Button, Card, PageHeader, cx } from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, formatDiopter } from '@/lib/format'

/** Estágios canônicos na ordem do fluxo (ADR-010). */
const STAGES = [
  { stage: 'draft', label: 'Aberta' },
  { stage: 'awaiting_lab', label: 'No laboratório' },
  { stage: 'in_production', label: 'Em produção' },
  { stage: 'received_from_lab', label: 'Recebida' },
  { stage: 'assembling', label: 'Montagem' },
  { stage: 'quality_check', label: 'Conferência' },
  { stage: 'ready_for_pickup', label: 'Pronta' },
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
            className="rounded-lg border border-slate-200 bg-white"
          >
            <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <h2 className="text-sm font-semibold text-slate-700">{column.label}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {column.orders.length}
              </span>
            </header>
            <div className="max-h-96 space-y-2 overflow-y-auto p-2">
              {column.orders.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-slate-400">vazio</p>
              ) : (
                column.orders.map((order) => (
                  <button
                    key={order.service_order_id}
                    onClick={() => navigate(`/ordens-de-servico/${order.service_order_id}`)}
                    className={cx(
                      'block w-full rounded-md border p-2 text-left transition hover:border-brand-300 hover:bg-brand-50/50',
                      isLate(order.promised_at)
                        ? 'border-red-200 bg-red-50/50'
                        : 'border-slate-200',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800">
                        #{order.number}
                      </span>
                      {order.promised_at && (
                        <span
                          className={cx(
                            'text-xs',
                            isLate(order.promised_at)
                              ? 'font-medium text-red-600'
                              : 'text-slate-500',
                          )}
                        >
                          {formatDate(order.promised_at)}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-600">{order.customer_name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400 tabular-nums">
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
                <Badge tone={r.status_stage === 'delivered' ? 'success' : 'info'}>
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
