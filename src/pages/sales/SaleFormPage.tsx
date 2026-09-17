import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
  SearchInput,
  Select,
  Textarea,
  cx,
} from '@/components/ui/primitives'
import {
  IconBolt,
  IconBox,
  IconCalendar,
  IconChart,
  IconCheckCircle,
  IconChevronRight,
  IconFile,
  IconMoney,
  IconPercent,
  IconPlus,
  IconTrash,
  IconUsers,
  IconWallet,
} from '@/components/ui/icons'
import { CustomerPicker } from '@/components/CustomerPicker'
import { describeError } from '@/lib/errors'
import {
  digitsOnly,
  formatDocument,
  formatMoney,
  formatPhone,
  isValidCnpj,
  isValidCpf,
} from '@/lib/format'

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
  const [notes, setNotes] = useState('')
  const [productTerm, setProductTerm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const products = useQuery({
    queryKey: ['sale-products', ctx.tenant_id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('products')
        .select(
          'id,name,sku,list_price,cost_price,product_kind,tracks_stock,product_categories(label)',
        )
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
          notes: notes.trim() || null,
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

  const branch = ctx.branches.find((b) => b.id === branchId)

  const matches =
    productTerm.trim().length < 2
      ? []
      : (products.data ?? [])
          .filter((product) => {
            const needle = productTerm.trim().toLowerCase()
            return (
              product.name.toLowerCase().includes(needle) ||
              (product.sku ?? '').toLowerCase().includes(needle)
            )
          })
          .slice(0, 6)

  /** Atalhos das quatro formas mais usadas no balcão. */
  const quickMethod = (kind: string) => {
    const method = paymentMethods.data?.find((m) => m.kind === kind)
    if (!method) return
    setPayments((prev) => [
      ...prev,
      {
        key: newKey(),
        payment_method_id: method.id,
        amount: String(Math.max(0, totals.remaining).toFixed(2)),
        installments: '1',
      },
    ])
  }

  const hasMethod = (kind: string) =>
    Boolean(paymentMethods.data?.some((m) => m.kind === kind))

  return (
    <>
      <PageHeader
        title="Nova venda"
        subtitle={`Filial ${branch?.trade_name ?? ''}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <IconCheckCircle className="size-4" />
              {save.isPending ? 'Finalizando…' : 'Finalizar venda'}
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
        {/* ------------------------------ Esquerda ------------------------------ */}
        <div className="space-y-4">
          <Card
            title={
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                <IconUsers className="size-4 text-brand-600" />
                Cliente
              </span>
            }
            actions={
              customerId && (
                <Button size="sm" variant="ghost" onClick={() => setCustomerId('')}>
                  Limpar cliente
                </Button>
              )
            }
          >
            <div className="mb-3 inline-flex rounded-lg bg-surface-sunken p-0.5">
              <button
                onClick={() => setAnonymous(false)}
                className={cx(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  anonymous ? 'text-fg-muted hover:text-fg' : 'bg-brand-600 text-white',
                )}
              >
                Cliente identificado
              </button>
              <button
                onClick={() => {
                  setAnonymous(true)
                  setCustomerId('')
                }}
                className={cx(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  anonymous ? 'bg-brand-600 text-white' : 'text-fg-muted hover:text-fg',
                )}
              >
                Venda avulsa
              </button>
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
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Cliente" required>
                    <CustomerPicker value={customerId} onChange={setCustomerId} />
                  </Field>
                  <Field label="Vendedor">
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

                {customerId && <CustomerSummary customerId={customerId} />}
              </>
            )}
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                <IconBox className="size-4 text-brand-600" />
                Itens da venda
              </span>
            }
            actions={
              <div className="relative">
                <SearchInput
                  value={productTerm}
                  onChange={(e) => setProductTerm(e.target.value)}
                  placeholder="Buscar produto por nome ou código…"
                  className="w-64"
                />
                {matches.length > 0 && (
                  <div className="absolute right-0 z-20 mt-1 w-80 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
                    {matches.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => {
                          addItem(product.id)
                          setProductTerm('')
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-sunken"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-fg-subtle">
                          <IconBox className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-fg">
                            {product.name}
                          </span>
                          <span className="block truncate text-xs text-fg-subtle">
                            {product.sku ?? '—'}
                          </span>
                        </span>
                        <span className="tnum shrink-0 text-xs font-medium text-fg">
                          {formatMoney(Number(product.list_price ?? 0))}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            }
            bodyClassName="p-0"
          >
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-fg-subtle">
                Nenhum item ainda. Busque um produto acima para começar.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="w-full min-w-[46rem] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface-sunken text-[0.6875rem] tracking-wide text-fg-subtle uppercase">
                      <th className="px-4 py-2.5 text-left font-medium">Produto</th>
                      <th className="px-4 py-2.5 text-left font-medium">Olho</th>
                      <th className="px-4 py-2.5 text-center font-medium">Qtd.</th>
                      <th className="px-4 py-2.5 text-right font-medium">Valor unit.</th>
                      <th className="px-4 py-2.5 text-right font-medium">Desconto</th>
                      <th className="px-4 py-2.5 text-right font-medium">Total</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {items.map((item, index) => {
                      const product = products.data?.find((p) => p.id === item.product_id)
                      const update = (patch: Partial<Item>) => {
                        const next = [...items]
                        next[index] = { ...item, ...patch }
                        setItems(next)
                      }
                      return (
                        <tr key={item.key}>
                          <td className="px-4 py-3">
                            <div className="flex w-56 items-center gap-2.5">
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-fg-subtle">
                                <IconBox className="size-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <Input
                                  className="w-full min-w-0 border-0 bg-transparent px-0 py-0 text-sm font-medium shadow-none focus:ring-0"
                                  value={item.description}
                                  onChange={(e) => update({ description: e.target.value })}
                                />
                                <p className="text-xs text-fg-subtle">
                                  {product?.sku ?? '—'}
                                  {product?.product_categories?.label
                                    ? ` · ${product.product_categories.label}`
                                    : ''}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Select
                              className="w-24 py-1.5 text-xs"
                              value={item.eye}
                              onChange={(e) => update({ eye: e.target.value as Item['eye'] })}
                            >
                              <option value="">—</option>
                              <option value="OD">OD</option>
                              <option value="OS">OE</option>
                              <option value="both">Par</option>
                            </Select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="mx-auto flex w-24 items-center rounded-lg border border-line-strong">
                              <button
                                onClick={() =>
                                  update({
                                    quantity: String(Math.max(1, num(item.quantity) - 1)),
                                  })
                                }
                                className="px-2 py-1.5 text-fg-subtle hover:text-fg"
                                aria-label="Diminuir"
                              >
                                −
                              </button>
                              <input
                                value={item.quantity}
                                onChange={(e) => update({ quantity: e.target.value })}
                                inputMode="decimal"
                                className="tnum w-full min-w-0 bg-transparent text-center text-sm text-fg outline-none"
                              />
                              <button
                                onClick={() =>
                                  update({ quantity: String(num(item.quantity) + 1) })
                                }
                                className="px-2 py-1.5 text-fg-subtle hover:text-fg"
                                aria-label="Aumentar"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              className="tnum w-20 text-right"
                              inputMode="decimal"
                              value={item.unit_price}
                              onChange={(e) => update({ unit_price: e.target.value })}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              className="tnum w-24 text-right"
                              inputMode="decimal"
                              value={item.discount}
                              onChange={(e) => update({ discount: e.target.value })}
                            />
                          </td>
                          <td className="tnum px-4 py-3 text-right font-semibold text-fg">
                            {formatMoney(
                              num(item.quantity) * num(item.unit_price) - num(item.discount),
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() =>
                                setItems(items.filter((i) => i.key !== item.key))
                              }
                              className="rounded-md p-1.5 text-fg-subtle hover:bg-surface-sunken hover:text-red-600"
                              aria-label={`Remover ${item.description}`}
                              title="Remover item"
                            >
                              <IconTrash className="size-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                <IconFile className="size-4 text-brand-600" />
                Observações da venda
              </span>
            }
            actions={
              <span className="tnum text-xs text-fg-subtle">{notes.length}/500</span>
            }
          >
            <Textarea
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações (opcional)…"
            />
          </Card>
        </div>

        {/* ------------------------------- Resumo ------------------------------- */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <Card
            title={
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                <IconChart className="size-4 text-brand-600" />
                Resumo da venda
              </span>
            }
          >
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-fg-muted">Subtotal</dt>
                <dd className="tnum text-fg">{formatMoney(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">Desconto</dt>
                <dd className="tnum text-red-600">−{formatMoney(totals.discount)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="text-base font-semibold text-fg">Total</dt>
                <dd className="tnum text-xl font-semibold text-brand-700 dark:text-brand-300">
                  {formatMoney(totals.total)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">Pago</dt>
                <dd className="tnum text-fg">{formatMoney(totals.paid)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">Saldo</dt>
                <dd
                  className={cx(
                    'tnum font-medium',
                    Math.abs(totals.remaining) > 0.009 ? 'text-red-600' : 'text-emerald-600',
                  )}
                >
                  {formatMoney(totals.remaining)}
                </dd>
              </div>
            </dl>

            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-2.5 text-sm font-semibold text-fg">Forma de pagamento</p>

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
                  const update = (patch: Partial<Payment>) => {
                    const next = [...payments]
                    next[index] = { ...payment, ...patch }
                    setPayments(next)
                  }
                  return (
                    <div
                      key={payment.key}
                      className="rounded-xl border border-line bg-canvas p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                          <IconWallet className="size-4" />
                        </span>
                        <Select
                          className="h-9 min-w-0 flex-1 py-0 text-xs"
                          value={payment.payment_method_id}
                          onChange={(e) => update({ payment_method_id: e.target.value })}
                        >
                          {paymentMethods.data?.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </Select>
                        <button
                          onClick={() =>
                            setPayments(payments.filter((p) => p.key !== payment.key))
                          }
                          className="shrink-0 rounded-md p-1.5 text-fg-subtle hover:bg-surface-sunken hover:text-red-600"
                          aria-label="Remover forma de pagamento"
                        >
                          <IconTrash className="size-4" />
                        </button>
                      </div>

                      <div className="mt-2 flex items-end gap-2">
                        <Field label="Valor" className="flex-1">
                          <Input
                            className="tnum h-9 py-0 text-right"
                            inputMode="decimal"
                            value={payment.amount}
                            onChange={(e) => update({ amount: e.target.value })}
                          />
                        </Field>
                        {method?.allows_installments && (
                          <Field label="Parcelas" className="w-24">
                            <Input
                              className="tnum h-9 py-0 text-center"
                              type="number"
                              min={1}
                              max={method.max_installments}
                              value={payment.installments}
                              onChange={(e) => update({ installments: e.target.value })}
                            />
                          </Field>
                        )}
                      </div>

                      {method?.generates_receivable && (
                        <p className="mt-2 text-[0.6875rem] text-fg-subtle">
                          Gera título no contas a receber.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              <Button
                variant="secondary"
                className="mt-2.5 w-full"
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
                <IconPlus className="size-4" />
                Adicionar forma de pagamento
              </Button>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {[
                  { kind: 'credit_card', label: 'Cartão', icon: IconWallet },
                  { kind: 'pix', label: 'Pix', icon: IconBolt },
                  { kind: 'cash', label: 'Dinheiro', icon: IconMoney },
                  { kind: 'installment_plan', label: 'Crediário', icon: IconCalendar },
                ].map((quick) => (
                  <button
                    key={quick.kind}
                    onClick={() => quickMethod(quick.kind)}
                    disabled={!hasMethod(quick.kind)}
                    title={
                      hasMethod(quick.kind)
                        ? `Adicionar ${quick.label}`
                        : `${quick.label} não está cadastrado em formas de pagamento`
                    }
                    className={cx(
                      'flex flex-col items-center gap-1.5 rounded-xl border border-line px-2 py-2.5',
                      'text-[0.6875rem] text-fg-muted transition-colors',
                      hasMethod(quick.kind)
                        ? 'hover:border-brand-200 hover:text-brand-700 dark:hover:border-brand-500/40'
                        : 'cursor-not-allowed opacity-40',
                    )}
                  >
                    <quick.icon className="size-4.5" />
                    {quick.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-brand-50 px-3 py-2.5 dark:bg-brand-500/10">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface text-brand-600 dark:text-brand-300">
                  <IconPercent className="size-4" />
                </span>
                <p className="text-[0.6875rem] leading-snug text-brand-800 dark:text-brand-200">
                  <span className="block font-semibold">Dica</span>
                  O desconto pode ir no item ou no total — o que valer para o cliente é a
                  soma, e ela precisa fechar com os pagamentos.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

/** Cartão do cliente escolhido: confere quem é antes de fechar a venda. */
function CustomerSummary({ customerId }: { customerId: string }) {
  const customer = useQuery({
    queryKey: ['sale-customer', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_customer_overview')
        .select('id,display_name,tax_document,primary_phone,record_status')
        .eq('id', customerId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  if (!customer.data) return null
  const person = customer.data

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-canvas px-3 py-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
        {(person.display_name ?? '?')
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? '')
          .join('')}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">{person.display_name}</p>
        <p className="truncate text-xs text-fg-subtle">
          {[formatDocument(person.tax_document), formatPhone(person.primary_phone)]
            .filter(Boolean)
            .join('  |  ') || 'Sem documento e telefone no cadastro'}
        </p>
      </div>
      {person.record_status === 'quick' && (
        <Badge tone="warning">Cadastro rápido</Badge>
      )}
      <Link
        to={`/clientes/${person.id}`}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-fg-muted hover:text-fg"
      >
        Ver cadastro
        <IconChevronRight className="size-3.5" />
      </Link>
    </div>
  )
}
