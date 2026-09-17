import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAppContext, useBranchId } from '@/auth/SessionProvider'
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
import { CustomerPicker } from '@/components/CustomerPicker'
import { describeError } from '@/lib/errors'
import { digitsOnly, formatMoney, isValidCnpj, isValidCpf } from '@/lib/format'

type Item = {
  key: string
  product_id: string
  description: string
  eye: '' | 'OD' | 'OS' | 'both'
  quantity: string
  unit_price: string
  discount: string
}

type Payment = {
  key: string
  payment_method_id: string
  amount: string
  installments: string
}

const newKey = () => Math.random().toString(36).slice(2)
const num = (v: string): number => {
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/**
 * Venda. Suporta pagamento misto (PIX + cartão) e venda avulsa anônima.
 *
 * ADR-009: venda avulsa tem customer_id NULL — não existe "Cliente Padrão". O
 * CPF pedido na nota vai em `tax_document_on_invoice`, sem criar cadastro. O
 * banco recusa crediário nessa venda e recusa abrir O.S. a partir dela.
 */
export function SaleFormPage() {
  const ctx = useAppContext()
  const branchId = useBranchId()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [anonymous, setAnonymous] = useState(false)
  const [customerId, setCustomerId] = useState(params.get('cliente') ?? '')
  const [invoiceDocument, setInvoiceDocument] = useState('')
  const [salespersonId, setSalespersonId] = useState(ctx.is_salesperson ? ctx.app_user_id : '')
  const [items, setItems] = useState<Item[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [error, setError] = useState<string | null>(null)

  const products = useQuery({
    queryKey: ['sale-products', ctx.tenant_id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('products')
        .select('id, name, sku, list_price, cost_price, product_kind, tracks_stock')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name')
      if (err) throw err
      return data ?? []
    },
  })

  const paymentMethods = useQuery({
    queryKey: ['payment-methods', ctx.tenant_id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      if (err) throw err
      return data ?? []
    },
  })

  const salespeople = useQuery({
    queryKey: ['salespeople', ctx.tenant_id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('app_users')
        .select('id, full_name')
        .eq('is_salesperson', true)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('full_name')
      if (err) throw err
      return data ?? []
    },
  })

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + num(i.quantity) * num(i.unit_price), 0)
    const discount = items.reduce((sum, i) => sum + num(i.discount), 0)
    const total = subtotal - discount
    const paid = payments.reduce((sum, p) => sum + num(p.amount), 0)
    return { subtotal, discount, total, paid, remaining: total - paid }
  }, [items, payments])

  const addItem = (productId: string) => {
    const product = products.data?.find((p) => p.id === productId)
    setItems((prev) => [
      ...prev,
      {
        key: newKey(),
        product_id: productId,
        description: product?.name ?? '',
        eye: '',
        quantity: '1',
        unit_price: product?.list_price ? String(product.list_price) : '0',
        discount: '0',
      },
    ])
  }

  const save = useMutation({
    mutationFn: async () => {
      setError(null)
      if (items.length === 0) throw new Error('Adicione ao menos um item.')
      if (!anonymous && !customerId) {
        throw new Error('Escolha o cliente ou marque a venda como avulsa.')
      }

      const doc = digitsOnly(invoiceDocument)
      if (doc && !isValidCpf(doc) && !isValidCnpj(doc)) {
        throw new Error('CPF/CNPJ da nota é inválido.')
      }

      if (Math.abs(totals.remaining) > 0.009) {
        throw new Error(
          `Os pagamentos somam ${formatMoney(totals.paid)} e o total é ${formatMoney(totals.total)}.`,
        )
      }

      const { data: number, error: numberError } = await supabase.rpc(
        'next_document_number',
        { p_branch_id: branchId, p_document_type: 'sale' },
      )
      if (numberError) throw numberError

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          tenant_id: ctx.tenant_id,
          branch_id: branchId,
          number,
          sale_type: anonymous ? 'anonymous' : 'identified',
          customer_id: anonymous ? null : customerId,
          tax_document_on_invoice: doc || null,
          salesperson_id: salespersonId || null,
          status: 'confirmed',
          subtotal_amount: totals.subtotal,
          discount_amount: totals.discount,
          total_amount: totals.total,
          created_by: ctx.app_user_id,
        })
        .select('id')
        .single()
      if (saleError) throw saleError

      const itemRows = items.map((item, index) => {
        const product = products.data?.find((p) => p.id === item.product_id)
        const lineTotal = num(item.quantity) * num(item.unit_price) - num(item.discount)
        return {
          sale_id: sale.id,
          tenant_id: ctx.tenant_id,
          line_number: index + 1,
          product_id: item.product_id || null,
          description: item.description,
          eye: item.eye || null,
          quantity: num(item.quantity),
          unit_price: num(item.unit_price),
          discount_amount: num(item.discount),
          total_amount: lineTotal,
          unit_cost: product?.cost_price ?? null,
          stock_branch_id: product?.tracks_stock ? branchId : null,
        }
      })

      const { error: itemsError } = await supabase.from('sale_items').insert(itemRows)
      if (itemsError) throw itemsError

      const paymentRows = payments.map((p) => ({
        sale_id: sale.id,
        tenant_id: ctx.tenant_id,
        payment_method_id: p.payment_method_id,
        amount: num(p.amount),
        installments: Number(p.installments) || 1,
        paid_at: new Date().toISOString(),
      }))
      const { error: paymentsError } = await supabase.from('sale_payments').insert(paymentRows)
      if (paymentsError) throw paymentsError

      // Financeiro: só formas que geram título (crediário) viram contas a receber.
      const receivables = payments.flatMap((p) => {
        const method = paymentMethods.data?.find((m) => m.id === p.payment_method_id)
        if (!method?.generates_receivable || !customerId) return []
        const installments = Number(p.installments) || 1
        const perInstallment = Math.round((num(p.amount) / installments) * 100) / 100
        return Array.from({ length: installments }, (_, i) => {
          const due = new Date()
          due.setMonth(due.getMonth() + i + 1)
          return {
            tenant_id: ctx.tenant_id,
            branch_id: branchId,
            sale_id: sale.id,
            customer_id: customerId,
            payment_method_id: method.id,
            chart_account_id: method.chart_account_id,
            installment_number: i + 1,
            installments_total: installments,
            due_date: due.toISOString().slice(0, 10),
            amount: perInstallment,
          }
        })
      })
      if (receivables.length > 0) {
        const { error: err } = await supabase.from('receivables').insert(receivables)
        if (err) throw err
      }

      // Comissão por item, pela regra vigente do tenant.
      if (salespersonId) {
        const { data: rule } = await supabase
          .from('commission_rules')
          .select('*')
          .eq('is_active', true)
          .order('priority')
          .limit(1)
          .maybeSingle()

        if (rule) {
          const { data: savedItems } = await supabase
            .from('sale_items')
            .select('id, total_amount')
            .eq('sale_id', sale.id)

          const commissions = (savedItems ?? []).map((item) => ({
            tenant_id: ctx.tenant_id,
            branch_id: branchId,
            sale_id: sale.id,
            sale_item_id: item.id,
            app_user_id: salespersonId,
            commission_rule_id: rule.id,
            base_amount: Number(item.total_amount),
            rate_percent: Number(rule.rate_percent),
            amount:
              Math.round(Number(item.total_amount) * Number(rule.rate_percent)) / 100,
          }))
          if (commissions.length > 0) {
            await supabase.from('commissions').insert(commissions)
          }
        }
      }

      return sale.id
    },
    onSuccess: (id) => navigate(`/comercial/vendas/${id}`),
    onError: (err) => setError(describeError(err)),
  })

  const selectedMethodsRequireCustomer = payments.some((p) => {
    const method = paymentMethods.data?.find((m) => m.id === p.payment_method_id)
    return method?.requires_customer
  })

  return (
    <>
      <PageHeader
        title="Nova venda"
        subtitle={`Filial ${ctx.branches.find((b) => b.id === branchId)?.trade_name ?? ''}`}
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="space-y-4">
        <Card title="Cliente">
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={anonymous ? 'secondary' : 'primary'}
              onClick={() => setAnonymous(false)}
            >
              Cliente identificado
            </Button>
            <Button
              size="sm"
              variant={anonymous ? 'primary' : 'secondary'}
              onClick={() => {
                setAnonymous(true)
                setCustomerId('')
              }}
            >
              Venda avulsa
            </Button>
          </div>

          {anonymous ? (
            <div className="space-y-3">
              <Alert tone="info">
                Venda avulsa é realmente anônima: não cria cadastro. Não aceita
                crediário, não gera ordem de serviço e não entra no histórico de
                nenhum cliente.
              </Alert>
              <Field
                label="CPF/CNPJ na nota"
                hint="Só para a nota fiscal — não cria cliente."
                className="max-w-xs"
              >
                <Input
                  value={invoiceDocument}
                  onChange={(e) => setInvoiceDocument(e.target.value)}
                  inputMode="numeric"
                />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-3">
              <Field label="Cliente" required className="col-span-12 sm:col-span-6">
                <CustomerPicker value={customerId} onChange={setCustomerId} />
              </Field>
              <Field label="Vendedor" className="col-span-12 sm:col-span-6">
                <Select
                  value={salespersonId}
                  onChange={(e) => setSalespersonId(e.target.value)}
                >
                  <option value="">—</option>
                  {salespeople.data?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
        </Card>

        <Card
          title="Itens"
          actions={
            <Select
              className="w-64 py-1.5 text-xs"
              value=""
              onChange={(e) => e.target.value && addItem(e.target.value)}
            >
              <option value="">+ Adicionar produto…</option>
              {products.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.list_price ? ` — ${formatMoney(Number(p.list_price))}` : ''}
                </option>
              ))}
            </Select>
          }
          bodyClassName="p-0"
        >
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              Nenhum item. Use o seletor acima para adicionar.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2">Olho</th>
                    <th className="px-3 py-2">Qtd.</th>
                    <th className="px-3 py-2">Preço</th>
                    <th className="px-3 py-2">Desconto</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, index) => (
                    <tr key={item.key}>
                      <td className="px-3 py-2">
                        <Input
                          className="w-56"
                          value={item.description}
                          onChange={(e) => {
                            const next = [...items]
                            next[index] = { ...item, description: e.target.value }
                            setItems(next)
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          className="w-24"
                          value={item.eye}
                          onChange={(e) => {
                            const next = [...items]
                            next[index] = { ...item, eye: e.target.value as Item['eye'] }
                            setItems(next)
                          }}
                        >
                          <option value="">—</option>
                          <option value="OD">OD</option>
                          <option value="OS">OE</option>
                          <option value="both">Par</option>
                        </Select>
                      </td>
                      {(['quantity', 'unit_price', 'discount'] as const).map((field) => (
                        <td key={field} className="px-3 py-2">
                          <Input
                            className="w-24"
                            inputMode="decimal"
                            value={item[field]}
                            onChange={(e) => {
                              const next = [...items]
                              next[index] = { ...item, [field]: e.target.value }
                              setItems(next)
                            }}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMoney(
                          num(item.quantity) * num(item.unit_price) - num(item.discount),
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setItems(items.filter((i) => i.key !== item.key))}
                        >
                          remover
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title="Pagamento"
          actions={
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setPayments((prev) => [
                  ...prev,
                  {
                    key: newKey(),
                    payment_method_id: paymentMethods.data?.[0]?.id ?? '',
                    amount: String(Math.max(0, totals.remaining).toFixed(2)),
                    installments: '1',
                  },
                ])
              }
            >
              + Forma de pagamento
            </Button>
          }
        >
          {anonymous && selectedMethodsRequireCustomer && (
            <div className="mb-3">
              <Alert tone="warning">
                Uma das formas escolhidas exige cliente identificado. O banco vai
                recusar esta venda avulsa.
              </Alert>
            </div>
          )}

          <div className="space-y-2">
            {payments.map((payment, index) => {
              const method = paymentMethods.data?.find(
                (m) => m.id === payment.payment_method_id,
              )
              return (
                <div key={payment.key} className="flex flex-wrap items-end gap-2">
                  <Field label="Forma" className="w-52">
                    <Select
                      value={payment.payment_method_id}
                      onChange={(e) => {
                        const next = [...payments]
                        next[index] = { ...payment, payment_method_id: e.target.value }
                        setPayments(next)
                      }}
                    >
                      {paymentMethods.data?.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Valor" className="w-32">
                    <Input
                      inputMode="decimal"
                      value={payment.amount}
                      onChange={(e) => {
                        const next = [...payments]
                        next[index] = { ...payment, amount: e.target.value }
                        setPayments(next)
                      }}
                    />
                  </Field>
                  {method?.allows_installments && (
                    <Field label="Parcelas" className="w-24">
                      <Input
                        type="number"
                        min={1}
                        max={method.max_installments}
                        value={payment.installments}
                        onChange={(e) => {
                          const next = [...payments]
                          next[index] = { ...payment, installments: e.target.value }
                          setPayments(next)
                        }}
                      />
                    </Field>
                  )}
                  {method?.generates_receivable && (
                    <Badge tone="info" className="mb-2">
                      gera financeiro
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-1"
                    onClick={() =>
                      setPayments(payments.filter((p) => p.key !== payment.key))
                    }
                  >
                    remover
                  </Button>
                </div>
              )
            })}
          </div>

          <dl className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="tabular-nums">{formatMoney(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Desconto</dt>
              <dd className="tabular-nums">−{formatMoney(totals.discount)}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatMoney(totals.total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Pago</dt>
              <dd className="tabular-nums">{formatMoney(totals.paid)}</dd>
            </div>
            {Math.abs(totals.remaining) > 0.009 && (
              <div className="flex justify-between font-medium text-amber-700">
                <dt>Falta</dt>
                <dd className="tabular-nums">{formatMoney(totals.remaining)}</dd>
              </div>
            )}
          </dl>
        </Card>

        <div className="flex gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Fechar venda'}
          </Button>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
        </div>
      </div>
    </>
  )
}
