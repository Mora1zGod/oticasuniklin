import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAppContext, useBranchId } from '@/auth/SessionProvider'
import { CrudPage } from '@/components/CrudPage'
import { DataTable } from '@/components/DataTable'
import { Modal } from '@/components/ui/Modal'
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
} from '@/components/ui/primitives'
import { describeError } from '@/lib/errors'
import { formatDate, formatMoney, today } from '@/lib/format'
import type { Row } from '@/lib/db'

const RECEIVABLE_STATUS: Record<string, { label: string; tone: 'success' | 'neutral' | 'danger' | 'warning' }> = {
  open: { label: 'Em aberto', tone: 'neutral' },
  partially_paid: { label: 'Parcial', tone: 'warning' },
  paid: { label: 'Pago', tone: 'success' },
  overdue: { label: 'Vencido', tone: 'danger' },
  renegotiated: { label: 'Renegociado', tone: 'neutral' },
  cancelled: { label: 'Cancelado', tone: 'neutral' },
  written_off: { label: 'Baixado', tone: 'neutral' },
}

export function ReceivablesPage() {
  const ctx = useAppContext()
  const branchId = useBranchId()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'open' | 'overdue' | 'paid' | 'all'>('open')
  const [settling, setSettling] = useState<Row<'receivables'> | null>(null)
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const list = useQuery({
    queryKey: ['receivables', branchId, filter],
    queryFn: async () => {
      let q = supabase.from('receivables').select('*').eq('branch_id', branchId)
      if (filter === 'open') q = q.in('status', ['open', 'partially_paid', 'overdue'])
      else if (filter === 'overdue') q = q.lt('due_date', today()).neq('status', 'paid')
      else if (filter === 'paid') q = q.eq('status', 'paid')
      const { data, error: err } = await q.order('due_date').limit(300)
      if (err) throw err
      return data ?? []
    },
  })

  const customers = useQuery({
    queryKey: ['receivable-customers', list.data?.length],
    enabled: Boolean(list.data && list.data.length > 0),
    queryFn: async () => {
      const ids = [...new Set((list.data ?? []).map((r) => r.customer_id))]
      const { data, error: err } = await supabase
        .from('customers')
        .select('id, display_name')
        .in('id', ids)
      if (err) throw err
      return new Map((data ?? []).map((c) => [c.id, c.display_name]))
    },
  })

  const methods = useQuery({
    queryKey: ['payment-methods-settle', ctx.tenant_id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('payment_methods')
        .select('id, label')
        .eq('is_active', true)
        .order('sort_order')
      if (err) throw err
      return data ?? []
    },
  })

  /** A baixa é lançada; o trigger do banco recalcula saldo e situação. */
  const settle = useMutation({
    mutationFn: async () => {
      setError(null)
      if (!settling) return
      const value = Number(amount.replace(',', '.'))
      if (!Number.isFinite(value) || value <= 0) throw new Error('Valor inválido.')

      const { error: err } = await supabase.from('receivable_settlements').insert({
        receivable_id: settling.id,
        tenant_id: ctx.tenant_id,
        branch_id: branchId,
        payment_method_id: methodId || null,
        amount: value,
        performed_by: ctx.app_user_id,
      })
      if (err) throw err
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['receivables'] })
      setSettling(null)
      setAmount('')
    },
    onError: (err) => setError(describeError(err)),
  })

  const total = (list.data ?? []).reduce(
    (sum, r) => sum + (Number(r.amount) - Number(r.paid_amount)),
    0,
  )

  return (
    <>
      <PageHeader
        title="Contas a receber"
        subtitle={`${list.data?.length ?? 0} título(s) · ${formatMoney(total)} em aberto`}
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <Card
        bodyClassName="p-0"
        title={
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['open', 'Em aberto'],
                ['overdue', 'Vencidos'],
                ['paid', 'Pagos'],
                ['all', 'Todos'],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? 'primary' : 'secondary'}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        }
      >
        <DataTable
          rows={list.data}
          loading={list.isLoading}
          rowKey={(row) => row.id}
          emptyTitle="Nenhum título"
          columns={[
            {
              key: 'customer',
              header: 'Cliente',
              render: (r) => (
                <Link to={`/clientes/${r.customer_id}`} className="text-brand-700 hover:underline">
                  {customers.data?.get(r.customer_id) ?? '—'}
                </Link>
              ),
            },
            { key: 'due', header: 'Vencimento', render: (r) => formatDate(r.due_date) },
            {
              key: 'installment',
              header: 'Parcela',
              render: (r) => `${r.installment_number}/${r.installments_total}`,
            },
            {
              key: 'amount',
              header: 'Valor',
              numeric: true,
              render: (r) => formatMoney(Number(r.amount)),
            },
            {
              key: 'paid',
              header: 'Pago',
              numeric: true,
              render: (r) => formatMoney(Number(r.paid_amount)),
            },
            {
              key: 'status',
              header: 'Situação',
              render: (r) => {
                const info = RECEIVABLE_STATUS[r.status] ?? {
                  label: r.status,
                  tone: 'neutral' as const,
                }
                return (
                  <Badge tone={info.tone} dot>
                    {info.label}
                  </Badge>
                )
              },
            },
            {
              key: 'actions',
              header: '',
              numeric: true,
              render: (r) =>
                r.status !== 'paid' && r.status !== 'cancelled' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSettling(r)
                      setAmount(String((Number(r.amount) - Number(r.paid_amount)).toFixed(2)))
                      setMethodId(methods.data?.[0]?.id ?? '')
                    }}
                  >
                    Baixar
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>

      <Modal
        open={settling !== null}
        title="Baixar título"
        size="sm"
        onClose={() => setSettling(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSettling(null)}>
              Cancelar
            </Button>
            <Button onClick={() => settle.mutate()} disabled={settle.isPending}>
              Confirmar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Valor recebido" required>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Forma de pagamento">
            <Select value={methodId} onChange={(e) => setMethodId(e.target.value)}>
              <option value="">—</option>
              {methods.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  )
}

export function PayablesPage() {
  const branchId = useBranchId()

  const list = useQuery({
    queryKey: ['payables', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payables')
        .select('*, suppliers(trade_name), laboratories(trade_name)')
        .eq('branch_id', branchId)
        .order('due_date')
        .limit(300)
      if (error) throw error
      return data ?? []
    },
  })

  const total = (list.data ?? [])
    .filter((p) => p.status !== 'paid' && p.status !== 'cancelled')
    .reduce((sum, p) => sum + (Number(p.amount) - Number(p.paid_amount)), 0)

  return (
    <>
      <PageHeader title="Contas a pagar" subtitle={`${formatMoney(total)} em aberto`} />
      <Card bodyClassName="p-0">
        <DataTable
          rows={list.data}
          loading={list.isLoading}
          rowKey={(row) => row.id}
          emptyTitle="Nenhuma conta a pagar"
          columns={[
            { key: 'desc', header: 'Descrição', render: (r) => r.description },
            {
              key: 'counterparty',
              header: 'Fornecedor / laboratório',
              render: (r) =>
                r.suppliers?.trade_name ?? r.laboratories?.trade_name ?? '—',
            },
            { key: 'due', header: 'Vencimento', render: (r) => formatDate(r.due_date) },
            {
              key: 'amount',
              header: 'Valor',
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
