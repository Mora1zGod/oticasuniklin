import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/primitives'
import { formatDate, formatDiopter, formatMoney } from '@/lib/format'

const PRESCRIPTION_STATUS: Record<string, { label: string; tone: 'success' | 'neutral' | 'warning' }> = {
  active: { label: 'Vigente', tone: 'success' },
  superseded: { label: 'Substituída', tone: 'neutral' },
  draft: { label: 'Rascunho', tone: 'warning' },
  void: { label: 'Anulada', tone: 'warning' },
}

/**
 * Históricos do cliente. Cada um é uma tabela satélite (ADR-004): a tela agrega,
 * o banco continua normalizado.
 */
export function CustomerHistoryTabs({
  customerId,
  tab,
}: {
  customerId: string
  tab: 'receitas' | 'vendas' | 'os' | 'financeiro'
}) {
  const prescriptions = useQuery({
    queryKey: ['customer-prescriptions', customerId],
    enabled: tab === 'receitas',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_customer_prescriptions')
        .select('*')
        .eq('customer_id', customerId)
        .order('issued_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const sales = useQuery({
    queryKey: ['customer-sales', customerId],
    enabled: tab === 'vendas',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('customer_id', customerId)
        .order('sold_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const orders = useQuery({
    queryKey: ['customer-orders', customerId],
    enabled: tab === 'os',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_service_order_production')
        .select('*')
        .eq('customer_id', customerId)
        .order('opened_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const receivables = useQuery({
    queryKey: ['customer-receivables', customerId],
    enabled: tab === 'financeiro',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receivables')
        .select('*')
        .eq('customer_id', customerId)
        .order('due_date')
      if (error) throw error
      return data ?? []
    },
  })

  if (tab === 'receitas') {
    return (
      <DataTable
        rows={prescriptions.data}
        loading={prescriptions.isLoading}
        rowKey={(row) => String(row.id)}
        emptyTitle="Nenhuma receita registrada"
        emptyDescription="A receita é a prescrição clínica — a lente escolhida fica na O.S."
        columns={[
          {
            key: 'issued',
            header: 'Emitida em',
            render: (row) => (
              <Link
                to={`/optica/receitas/${row.id}`}
                className="text-brand-700 hover:underline"
              >
                {formatDate(row.issued_at)}
              </Link>
            ),
          },
          { key: 'rev', header: 'Versão', render: (row) => `v${row.revision ?? 1}` },
          {
            key: 'status',
            header: 'Situação',
            render: (row) => {
              const info = PRESCRIPTION_STATUS[row.status ?? ''] ?? {
                label: row.status ?? '—',
                tone: 'neutral' as const,
              }
              return <Badge tone={info.tone}>{info.label}</Badge>
            },
          },
          {
            key: 'od',
            header: 'OD (esf / cil / eixo)',
            render: (row) =>
              `${formatDiopter(row.od_sphere)} / ${formatDiopter(row.od_cylinder)} / ${row.od_axis ?? '—'}°`,
          },
          {
            key: 'os',
            header: 'OE (esf / cil / eixo)',
            render: (row) =>
              `${formatDiopter(row.os_sphere)} / ${formatDiopter(row.os_cylinder)} / ${row.os_axis ?? '—'}°`,
          },
          {
            key: 'add',
            header: 'Adição',
            render: (row) => formatDiopter(row.od_addition),
          },
          { key: 'prescriber', header: 'Prescritor', render: (row) => row.prescriber_name ?? '—' },
        ]}
      />
    )
  }

  if (tab === 'vendas') {
    return (
      <DataTable
        rows={sales.data}
        loading={sales.isLoading}
        rowKey={(row) => row.id}
        emptyTitle="Nenhuma venda"
        columns={[
          {
            key: 'number',
            header: 'Venda',
            render: (row) => (
              <Link to={`/comercial/vendas/${row.id}`} className="text-brand-700 hover:underline">
                #{row.number}
              </Link>
            ),
          },
          { key: 'date', header: 'Data', render: (row) => formatDate(row.sold_at) },
          {
            key: 'status',
            header: 'Situação',
            render: (row) => (
              <Badge tone={row.status === 'cancelled' ? 'danger' : 'neutral'}>{row.status}</Badge>
            ),
          },
          {
            key: 'total',
            header: 'Total',
            numeric: true,
            render: (row) => formatMoney(Number(row.total_amount)),
          },
        ]}
      />
    )
  }

  if (tab === 'os') {
    return (
      <DataTable
        rows={orders.data}
        loading={orders.isLoading}
        rowKey={(row) => String(row.service_order_id)}
        emptyTitle="Nenhuma ordem de serviço"
        columns={[
          {
            key: 'number',
            header: 'O.S.',
            render: (row) => (
              <Link
                to={`/ordens-de-servico/${row.service_order_id}`}
                className="text-brand-700 hover:underline"
              >
                #{row.number}
              </Link>
            ),
          },
          { key: 'opened', header: 'Aberta em', render: (row) => formatDate(row.opened_at) },
          { key: 'stage', header: 'Situação', render: (row) => row.status_code ?? '—' },
          {
            key: 'grade',
            header: 'Grau utilizado (OD)',
            render: (row) =>
              `${formatDiopter(row.od_sphere_used)} / ${formatDiopter(row.od_cylinder_used)}`,
          },
          {
            key: 'prescription',
            header: 'Receita de',
            render: (row) => formatDate(row.prescription_issued_at),
          },
          {
            key: 'delivered',
            header: 'Entregue',
            render: (row) => formatDate(row.delivered_at),
          },
        ]}
      />
    )
  }

  return (
    <DataTable
      rows={receivables.data}
      loading={receivables.isLoading}
      rowKey={(row) => row.id}
      emptyTitle="Nenhum título financeiro"
      columns={[
        {
          key: 'due',
          header: 'Vencimento',
          render: (row) => formatDate(row.due_date),
        },
        {
          key: 'installment',
          header: 'Parcela',
          render: (row) => `${row.installment_number}/${row.installments_total}`,
        },
        {
          key: 'amount',
          header: 'Valor',
          numeric: true,
          render: (row) => formatMoney(Number(row.amount)),
        },
        {
          key: 'paid',
          header: 'Pago',
          numeric: true,
          render: (row) => formatMoney(Number(row.paid_amount)),
        },
        {
          key: 'status',
          header: 'Situação',
          render: (row) => (
            <Badge
              tone={
                row.status === 'paid'
                  ? 'success'
                  : row.status === 'overdue'
                    ? 'danger'
                    : 'neutral'
              }
            >
              {row.status}
            </Badge>
          ),
        },
      ]}
    />
  )
}
