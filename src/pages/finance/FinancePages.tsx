import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { LedgerPage } from './LedgerPage'
import { useBranchId } from '@/auth/SessionProvider'
import { CrudPage } from '@/components/CrudPage'
import { DataTable } from '@/components/DataTable'
import { Badge, Card, PageHeader } from '@/components/ui/primitives'
import { formatDate, formatMoney } from '@/lib/format'

export function ReceivablesPage() {
  return <LedgerPage kind="receivable" />
}

export function PayablesPage() {
  return <LedgerPage kind="payable" />
}

export function CommissionsPage() {
  const branchId = useBranchId()

  const list = useQuery({
    queryKey: ['commissions', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commissions')
        .select('*, app_users(full_name), sales(number, sold_at)')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(300)
      if (error) throw error
      return data ?? []
    },
  })

  const total = (list.data ?? []).reduce((sum, c) => sum + Number(c.amount), 0)

  return (
    <>
      <PageHeader title="Comissões" subtitle={`${formatMoney(total)} no período listado`} />
      <Card bodyClassName="p-0">
        <DataTable
          rows={list.data}
          loading={list.isLoading}
          rowKey={(row) => row.id}
          emptyTitle="Nenhuma comissão"
          columns={[
            { key: 'user', header: 'Vendedor', render: (r) => r.app_users?.full_name ?? '—' },
            {
              key: 'sale',
              header: 'Venda',
              render: (r) => (
                <Link to={`/comercial/vendas/${r.sale_id}`} className="text-brand-700 hover:underline">
                  #{r.sales?.number}
                </Link>
              ),
            },
            { key: 'date', header: 'Data', render: (r) => formatDate(r.sales?.sold_at) },
            {
              key: 'base',
              header: 'Base',
              numeric: true,
              render: (r) => formatMoney(Number(r.base_amount)),
            },
            { key: 'rate', header: '%', numeric: true, render: (r) => `${Number(r.rate_percent)}%` },
            {
              key: 'amount',
              header: 'Comissão',
              numeric: true,
              render: (r) => formatMoney(Number(r.amount)),
            },
            { key: 'status', header: 'Situação', render: (r) => <Badge>{r.status}</Badge> },
          ]}
        />
      </Card>
    </>
  )
}

export function CustomerCreditsPage() {
  const list = useQuery({
    queryKey: ['customer-credits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_credits')
        .select('*, customers(display_name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  return (
    <>
      <PageHeader
        title="Crédito de clientes"
        subtitle="Vales de troca e devolução. Só existe para cliente identificado."
      />
      <Card bodyClassName="p-0">
        <DataTable
          rows={list.data}
          loading={list.isLoading}
          rowKey={(row) => row.id}
          emptyTitle="Nenhum crédito ativo"
          columns={[
            {
              key: 'customer',
              header: 'Cliente',
              render: (r) => (
                <Link to={`/clientes/${r.customer_id}`} className="text-brand-700 hover:underline">
                  {r.customers?.display_name ?? '—'}
                </Link>
              ),
            },
            { key: 'origin', header: 'Origem', render: (r) => r.origin },
            {
              key: 'amount',
              header: 'Valor',
              numeric: true,
              render: (r) => formatMoney(Number(r.amount)),
            },
            {
              key: 'balance',
              header: 'Saldo',
              numeric: true,
              render: (r) => formatMoney(Number(r.balance_amount)),
            },
            { key: 'expires', header: 'Expira', render: (r) => formatDate(r.expires_at) },
          ]}
        />
      </Card>
    </>
  )
}

export function PaymentMethodsPage() {
  const accounts = useQuery({
    queryKey: ['chart-accounts-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_accounts')
        .select('id, code, label')
        .eq('is_active', true)
        .order('code')
      if (error) throw error
      return data ?? []
    },
  })

  return (
    <CrudPage
      table="payment_methods"
      title="Formas de pagamento"
      singular="forma de pagamento"
      subtitle="Carregam regra: prazo, taxa, parcelamento e se exigem cliente identificado."
      orderBy={{ column: 'sort_order', ascending: true }}
      columns={[
        { key: 'label', header: 'Forma', render: (r) => r.label },
        { key: 'kind', header: 'Tipo', render: (r) => r.kind },
        {
          key: 'rules',
          header: 'Regras',
          render: (r) => (
            <div className="flex flex-wrap gap-1">
              {r.generates_receivable && <Badge tone="info">gera financeiro</Badge>}
              {r.allows_installments && <Badge>até {r.max_installments}x</Badge>}
              {r.requires_customer && <Badge tone="warning">exige cliente</Badge>}
            </div>
          ),
        },
        { key: 'fee', header: 'Taxa', numeric: true, render: (r) => `${Number(r.fee_percent)}%` },
        {
          key: 'settlement',
          header: 'Prazo',
          numeric: true,
          render: (r) => `${r.settlement_days}d`,
        },
      ]}
      fields={[
        { name: 'code', label: 'Código', required: true, span: 4 },
        { name: 'label', label: 'Nome', required: true, span: 8 },
        {
          name: 'kind',
          label: 'Tipo',
          type: 'select',
          required: true,
          span: 6,
          defaultValue: 'cash',
          options: [
            { value: 'cash', label: 'Dinheiro' },
            { value: 'pix', label: 'PIX' },
            { value: 'debit_card', label: 'Cartão de débito' },
            { value: 'credit_card', label: 'Cartão de crédito' },
            { value: 'installment_plan', label: 'Crediário' },
            { value: 'store_credit', label: 'Crédito de loja' },
            { value: 'bank_slip', label: 'Boleto' },
            { value: 'check', label: 'Cheque' },
            { value: 'transfer', label: 'Transferência' },
            { value: 'voucher', label: 'Voucher' },
          ],
        },
        {
          name: 'chart_account_id',
          label: 'Conta contábil',
          type: 'select',
          span: 6,
          options: (accounts.data ?? []).map((a) => ({
            value: a.id,
            label: `${a.code} — ${a.label}`,
          })),
        },
        { name: 'generates_receivable', label: 'Gera conta a receber', type: 'checkbox', span: 6 },
        { name: 'allows_installments', label: 'Permite parcelar', type: 'checkbox', span: 6 },
        { name: 'max_installments', label: 'Máximo de parcelas', type: 'number', span: 4, defaultValue: 1 },
        { name: 'settlement_days', label: 'Prazo de repasse (dias)', type: 'number', span: 4, defaultValue: 0 },
        { name: 'fee_percent', label: 'Taxa (%)', type: 'number', step: '0.001', span: 4, defaultValue: 0 },
        {
          name: 'requires_customer',
          label: 'Exige cliente identificado',
          type: 'checkbox',
          span: 6,
          hint: 'Crediário e crédito de loja não podem ser usados em venda avulsa.',
        },
        { name: 'requires_acquirer', label: 'Exige adquirente', type: 'checkbox', span: 6 },
        { name: 'sort_order', label: 'Ordem', type: 'number', span: 4, defaultValue: 10 },
        { name: 'is_active', label: 'Ativa', type: 'checkbox', span: 4, defaultValue: true },
      ]}
    />
  )
}

export function ChartAccountsPage() {
  return (
    <CrudPage
      table="chart_accounts"
      title="Plano de contas"
      singular="conta"
      orderBy={{ column: 'code', ascending: true }}
      columns={[
        { key: 'code', header: 'Código', render: (r) => r.code },
        { key: 'label', header: 'Conta', render: (r) => r.label },
        {
          key: 'kind',
          header: 'Natureza',
          render: (r) => {
            const labels: Record<string, string> = {
              revenue: 'Receita',
              expense: 'Despesa',
              asset: 'Ativo',
              liability: 'Passivo',
              equity: 'Patrimônio',
            }
            return labels[r.account_kind] ?? r.account_kind
          },
        },
      ]}
      fields={[
        { name: 'code', label: 'Código', required: true, span: 4 },
        { name: 'label', label: 'Nome', required: true, span: 8 },
        {
          name: 'account_kind',
          label: 'Natureza',
          type: 'select',
          required: true,
          span: 6,
          defaultValue: 'revenue',
          options: [
            { value: 'revenue', label: 'Receita' },
            { value: 'expense', label: 'Despesa' },
            { value: 'asset', label: 'Ativo' },
            { value: 'liability', label: 'Passivo' },
            { value: 'equity', label: 'Patrimônio' },
          ],
        },
        { name: 'accepts_entries', label: 'Aceita lançamentos', type: 'checkbox', span: 6, defaultValue: true },
        { name: 'is_active', label: 'Ativa', type: 'checkbox', span: 6, defaultValue: true },
      ]}
    />
  )
}
