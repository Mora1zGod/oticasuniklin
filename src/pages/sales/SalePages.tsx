import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useBranchId } from '@/auth/SessionProvider'
import { DataTable } from '@/components/DataTable'
import { Alert, Badge, Button, Card, PageHeader } from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, formatDateTime, formatDocument, formatMoney } from '@/lib/format'

const SALE_STATUS: Record<string, { label: string; tone: 'success' | 'neutral' | 'danger' }> = {
  open: { label: 'Aberta', tone: 'neutral' },
  confirmed: { label: 'Confirmada', tone: 'success' },
  invoiced: { label: 'Faturada', tone: 'success' },
  cancelled: { label: 'Cancelada', tone: 'danger' },
  returned: { label: 'Devolvida', tone: 'danger' },
}

export function SaleListPage() {
  const branchId = useBranchId()
  const navigate = useNavigate()

  const list = useQuery({
    queryKey: ['sales', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('branch_id', branchId)
        .order('sold_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data ?? []
    },
  })

  const customers = useQuery({
    queryKey: ['sales-customers', list.data?.length],
    enabled: Boolean(list.data?.some((s) => s.customer_id)),
    queryFn: async () => {
      const ids = [...new Set((list.data ?? []).map((s) => s.customer_id).filter(Boolean))]
      const { data, error } = await supabase
        .from('customers')
        .select('id, display_name')
        .in('id', ids as string[])
      if (error) throw error
      return new Map((data ?? []).map((c) => [c.id, c.display_name]))
    },
  })

  return (
    <>
      <PageHeader
        title="Vendas"
        actions={
          <Link to="/comercial/vendas/nova">
            <Button>+ Venda</Button>
          </Link>
        }
      />
      <Card bodyClassName="p-0">
        <DataTable
          rows={list.data}
          loading={list.isLoading}
          rowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/comercial/vendas/${row.id}`)}
          emptyTitle="Nenhuma venda nesta filial"
          columns={[
            { key: 'number', header: 'Venda', render: (r) => `#${r.number}` },
            { key: 'date', header: 'Data', render: (r) => formatDate(r.sold_at) },
            {
              key: 'customer',
              header: 'Cliente',
              render: (r) =>
                r.sale_type === 'anonymous' ? (
                  <Badge>avulsa</Badge>
                ) : (
                  (customers.data?.get(r.customer_id ?? '') ?? '—')
                ),
            },
            {
              key: 'status',
              header: 'Situação',
              render: (r) => {
                const info = SALE_STATUS[r.status] ?? { label: r.status, tone: 'neutral' as const }
                return <Badge tone={info.tone}>{info.label}</Badge>
              },
            },
            {
              key: 'total',
              header: 'Total',
              numeric: true,
              render: (r) => formatMoney(Number(r.total_amount)),
            },
          ]}
        />
      </Card>
    </>
  )
}

export function SaleDetailPage() {
  const { id = '' } = useParams()

  const sale = useQuery({
    queryKey: ['sale', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_items(*), sale_payments(*, payment_methods(label))')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })

  const customer = useQuery({
    queryKey: ['sale-customer', sale.data?.customer_id],
    enabled: Boolean(sale.data?.customer_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, display_name')
        .eq('id', sale.data!.customer_id!)
        .single()
      if (error) throw error
      return data
    },
  })

  const orders = useQuery({
    queryKey: ['sale-orders', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_orders')
        .select('id, number, opened_at')
        .eq('sale_id', id)
      if (error) throw error
      return data ?? []
    },
  })

  if (sale.isLoading) return <Spinner />
  if (!sale.data) return <Alert>Venda não encontrada.</Alert>

  const s = sale.data
  const status = SALE_STATUS[s.status] ?? { label: s.status, tone: 'neutral' as const }

  return (
    <>
      <PageHeader
        title={`Venda #${s.number}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span>{formatDateTime(s.sold_at)}</span>
            {s.sale_type === 'anonymous' ? (
              <Badge>venda avulsa</Badge>
            ) : (
              customer.data && (
                <Link
                  to={`/clientes/${customer.data.id}`}
                  className="text-brand-700 hover:underline"
                >
                  {customer.data.display_name}
                </Link>
              )
            )}
          </span>
        }
        actions={
          s.sale_type === 'identified' && orders.data?.length === 0 ? (
            <Link to={`/ordens-de-servico/nova?venda=${s.id}`}>
              <Button>Abrir O.S.</Button>
            </Link>
          ) : null
        }
      />

      {s.sale_type === 'anonymous' && (
        <div className="mb-4">
          <Alert tone="info">
            Venda avulsa: sem cliente vinculado, sem crediário e sem ordem de serviço.
            {s.tax_document_on_invoice
              ? ` CPF/CNPJ na nota: ${formatDocument(s.tax_document_on_invoice)}.`
              : ''}
          </Alert>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Itens" className="lg:col-span-2" bodyClassName="p-0">
          <DataTable
            rows={s.sale_items.sort((a, b) => a.line_number - b.line_number)}
            rowKey={(row) => row.id}
            columns={[
              { key: 'line', header: '#', render: (r) => r.line_number },
              { key: 'desc', header: 'Descrição', render: (r) => r.description },
              {
                key: 'eye',
                header: 'Olho',
                render: (r) => (r.eye === 'both' ? 'Par' : (r.eye ?? '—')),
              },
              { key: 'qty', header: 'Qtd.', numeric: true, render: (r) => Number(r.quantity) },
              {
                key: 'price',
                header: 'Preço',
                numeric: true,
                render: (r) => formatMoney(Number(r.unit_price)),
              },
              {
                key: 'total',
                header: 'Total',
                numeric: true,
                render: (r) => formatMoney(Number(r.total_amount)),
              },
            ]}
          />
        </Card>

        <div className="space-y-4">
          <Card title="Pagamento">
            <ul className="space-y-2 text-sm">
              {s.sale_payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="text-slate-600">
                    {p.payment_methods?.label ?? '—'}
                    {p.installments > 1 ? ` (${p.installments}x)` : ''}
                  </span>
                  <span className="tabular-nums">{formatMoney(Number(p.amount))}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="tabular-nums">{formatMoney(Number(s.subtotal_amount))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Desconto</dt>
                <dd className="tabular-nums">−{formatMoney(Number(s.discount_amount))}</dd>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(Number(s.total_amount))}</dd>
              </div>
            </dl>
          </Card>

          {orders.data && orders.data.length > 0 && (
            <Card title="Ordens de serviço">
              <ul className="space-y-1 text-sm">
                {orders.data.map((o) => (
                  <li key={o.id}>
                    <Link
                      to={`/ordens-de-servico/${o.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      O.S. #{o.number}
                    </Link>
                    <span className="ml-2 text-xs text-slate-500">
                      {formatDate(o.opened_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

export function QuoteListPage() {
  const branchId = useBranchId()

  const list = useQuery({
    queryKey: ['quotes', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data ?? []
    },
  })

  return (
    <>
      <PageHeader
        title="Orçamentos"
        subtitle="Orçamento aceito vira venda; a venda é que abre a ordem de serviço."
      />
      <Card bodyClassName="p-0">
        <DataTable
          rows={list.data}
          loading={list.isLoading}
          rowKey={(row) => row.id}
          emptyTitle="Nenhum orçamento"
          emptyDescription="Orçamentos criados nesta filial aparecem aqui."
          columns={[
            { key: 'number', header: 'Orçamento', render: (r) => `#${r.number}` },
            { key: 'date', header: 'Criado', render: (r) => formatDate(r.created_at) },
            { key: 'valid', header: 'Válido até', render: (r) => formatDate(r.valid_until) },
            { key: 'status', header: 'Situação', render: (r) => <Badge>{r.status}</Badge> },
            {
              key: 'total',
              header: 'Total',
              numeric: true,
              render: (r) => formatMoney(Number(r.total_amount)),
            },
          ]}
        />
      </Card>
    </>
  )
}
