import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppContext, useBranchId, useSession } from '@/auth/SessionProvider'
import { Modal } from '@/components/ui/Modal'
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
  cx,
} from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/Spinner'
import { StatTile } from '@/components/ui/StatTile'
import { Donut } from '@/components/ui/Donut'
import {
  IconArrowRight,
  IconAlert,
  IconCalendar,
  IconCheckCircle,
  IconChart,
  IconFile,
  IconMoney,
} from '@/components/ui/icons'
import { describeError } from '@/lib/errors'
import { formatDate, formatMoney, today } from '@/lib/format'

/**
 * Contas a receber e a pagar.
 *
 * As duas telas são a MESMA leitura do mundo — um título com vencimento, valor,
 * saldo e contraparte — vista dos dois lados do caixa. Por isso são um
 * componente só: o que muda é de onde vem o dinheiro, não como se olha para ele.
 * Separá-las em dois arquivos parecidos faria as duas divergirem na primeira
 * correção feita só de um lado.
 */
type Kind = 'receivable' | 'payable'

type Title = {
  id: string
  dueDate: string
  amount: number
  paidAmount: number
  status: string
  counterparty: string
  counterpartyTo?: string
  description: string
  category: string
  method: string
  installment: string
}

const TABS = [
  { id: 'all', label: 'Todos' },
  { id: 'open', label: 'Em aberto' },
  { id: 'today', label: 'Vencendo hoje' },
  { id: 'overdue', label: 'Vencidos' },
  { id: 'settled', label: 'Quitados' },
] as const

type TabId = (typeof TABS)[number]['id']

export function LedgerPage({ kind }: { kind: Kind }) {
  const ctx = useAppContext()
  const branchId = useBranchId()
  const { can } = useSession()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<TabId>('open')
  const [term, setTerm] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [settling, setSettling] = useState<Title | null>(null)
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const receber = kind === 'receivable'
  const day = today()

  const rows = useQuery({
    queryKey: [kind, branchId],
    queryFn: async (): Promise<Title[]> => {
      if (receber) {
        const { data, error: err } = await supabase
          .from('receivables')
          // O select precisa ser um literal: o postgrest-js deriva o tipo da
          // linha a partir do texto, e uma concatenação vira `string`.
          .select(
            'id,due_date,amount,paid_amount,status,customer_id,document_number,installment_number,installments_total,customers(display_name),payment_methods(label),chart_accounts(label)',
          )
          .eq('branch_id', branchId)
          .order('due_date')
          .limit(400)
        if (err) throw err
        return (data ?? []).map((row) => ({
          id: row.id,
          dueDate: row.due_date,
          amount: Number(row.amount),
          paidAmount: Number(row.paid_amount),
          status: row.status,
          counterparty: row.customers?.display_name ?? '—',
          counterpartyTo: row.customer_id ? `/clientes/${row.customer_id}` : undefined,
          description:
            row.document_number ??
            `Parcela ${row.installment_number}/${row.installments_total}`,
          category: row.chart_accounts?.label ?? 'Sem categoria',
          method: row.payment_methods?.label ?? '—',
          installment: `${row.installment_number}/${row.installments_total}`,
        }))
      }

      const { data, error: err } = await supabase
        .from('payables')
        .select(
          'id,due_date,amount,paid_amount,status,description,suppliers(trade_name),laboratories(trade_name),chart_accounts(label)',
        )
        .eq('branch_id', branchId)
        .order('due_date')
        .limit(400)
      if (err) throw err
      return (data ?? []).map((row) => ({
        id: row.id,
        dueDate: row.due_date,
        amount: Number(row.amount),
        paidAmount: Number(row.paid_amount),
        status: row.status,
        counterparty: row.suppliers?.trade_name ?? row.laboratories?.trade_name ?? '—',
        description: row.description,
        category: row.chart_accounts?.label ?? 'Sem categoria',
        method: '—',
        installment: '',
      }))
    },
  })

  const methods = useQuery({
    queryKey: ['payment-methods-settle', ctx.tenant_id],
    enabled: receber,
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

  /** Receber lança uma baixa — o trigger do banco recalcula saldo e situação.
   *  Pagar não tem tabela de baixa: o saldo é o próprio campo do título. */
  const settle = useMutation({
    mutationFn: async () => {
      setError(null)
      if (!settling) return
      const value = Number(amount.replace(',', '.'))
      if (!Number.isFinite(value) || value <= 0) throw new Error('Valor inválido.')

      if (receber) {
        const { error: err } = await supabase.from('receivable_settlements').insert({
          receivable_id: settling.id,
          tenant_id: ctx.tenant_id,
          branch_id: branchId,
          payment_method_id: methodId || null,
          amount: value,
          performed_by: ctx.app_user_id,
        })
        if (err) throw err
        return
      }

      const paid = settling.paidAmount + value
      if (paid > settling.amount) throw new Error('Valor maior que o saldo do título.')
      const { error: err } = await supabase
        .from('payables')
        .update({
          paid_amount: paid,
          status: paid >= settling.amount ? 'paid' : 'partially_paid',
        })
        .eq('id', settling.id)
      if (err) throw err
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [kind] })
      setSettling(null)
      setAmount('')
    },
    onError: (err) => setError(describeError(err)),
  })

  // ---------------------------------------------------------------- derivados
  const all = rows.data ?? []
  const saldo = (title: Title) => title.amount - title.paidAmount
  const quitado = (title: Title) => title.status === 'paid' || saldo(title) <= 0
  const emAberto = (title: Title) =>
    !quitado(title) && title.status !== 'cancelled' && title.status !== 'written_off'

  const counts = {
    all: all.length,
    open: all.filter(emAberto).length,
    today: all.filter((t) => emAberto(t) && t.dueDate === day).length,
    overdue: all.filter((t) => emAberto(t) && t.dueDate < day).length,
    settled: all.filter(quitado).length,
  }

  const kpis = useMemo(() => {
    const mes = day.slice(0, 7)
    const trintaDias = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
    const soma = (list: Title[], fn: (t: Title) => number) =>
      list.reduce((sum, t) => sum + fn(t), 0)

    return {
      aberto: soma(all.filter(emAberto), saldo),
      abertoQtd: counts.open,
      hoje: soma(
        all.filter((t) => emAberto(t) && t.dueDate === day),
        saldo,
      ),
      hojeQtd: counts.today,
      vencido: soma(
        all.filter((t) => emAberto(t) && t.dueDate < day),
        saldo,
      ),
      vencidoQtd: counts.overdue,
      liquidadoMes: soma(
        all.filter((t) => quitado(t) && t.dueDate.slice(0, 7) === mes),
        (t) => t.paidAmount,
      ),
      liquidadoQtd: all.filter((t) => quitado(t) && t.dueDate.slice(0, 7) === mes).length,
      previsto: soma(
        all.filter((t) => emAberto(t) && t.dueDate >= day && t.dueDate <= trintaDias),
        saldo,
      ),
    }
    // `all` já carrega tudo de que os números dependem.
  }, [all, day, counts.open, counts.today, counts.overdue])

  const visible = all
    .filter((title) => {
      if (tab === 'open') return emAberto(title)
      if (tab === 'today') return emAberto(title) && title.dueDate === day
      if (tab === 'overdue') return emAberto(title) && title.dueDate < day
      if (tab === 'settled') return quitado(title)
      return true
    })
    .filter((title) => {
      if (from && title.dueDate < from) return false
      if (to && title.dueDate > to) return false
      if (!term.trim()) return true
      const needle = term.trim().toLowerCase()
      return (
        title.counterparty.toLowerCase().includes(needle) ||
        title.description.toLowerCase().includes(needle) ||
        title.category.toLowerCase().includes(needle)
      )
    })

  const proximos = all
    .filter((title) => emAberto(title) && title.dueDate >= day)
    .slice(0, 5)

  const porCategoria = useMemo(() => {
    const map = new Map<string, number>()
    for (const title of all.filter(emAberto)) {
      map.set(title.category, (map.get(title.category) ?? 0) + saldo(title))
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value], index) => ({
        key: label,
        label,
        value,
        series: index + 1,
      }))
  }, [all])

  const podeBaixar = can(receber ? 'finance.settle' : 'finance.write') || ctx.is_tenant_admin

  return (
    <>
      <PageHeader
        title={receber ? 'Contas a receber' : 'Contas a pagar'}
        subtitle={
          receber
            ? 'Recebimentos, vencimentos e inadimplência da ótica.'
            : 'Despesas, vencimentos e pagamentos da ótica.'
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {/* ---------------------------- Indicadores ---------------------------- */}
      {rows.isLoading ? (
        <Spinner />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile
            icon={IconFile}
            tone="brand"
            label="Em aberto"
            value={formatMoney(kpis.aberto)}
            hint={`${kpis.abertoQtd} ${receber ? 'título(s)' : 'conta(s)'}`}
          />
          <StatTile
            icon={IconCalendar}
            tone="warning"
            label="Vencendo hoje"
            value={formatMoney(kpis.hoje)}
            hint={`${kpis.hojeQtd} ${receber ? 'título(s)' : 'conta(s)'}`}
          />
          <StatTile
            icon={IconAlert}
            tone="danger"
            label={receber ? 'Vencidos' : 'Vencidas'}
            value={formatMoney(kpis.vencido)}
            hint={`${kpis.vencidoQtd} ${receber ? 'título(s)' : 'conta(s)'}`}
          />
          <StatTile
            icon={IconCheckCircle}
            tone="success"
            label={receber ? 'Recebidos no mês' : 'Pagas no mês'}
            value={formatMoney(kpis.liquidadoMes)}
            hint={`${kpis.liquidadoQtd} ${receber ? 'título(s)' : 'conta(s)'}`}
          />
          <StatTile
            icon={IconChart}
            tone="violet"
            label={receber ? 'Previsão de entrada' : 'Previsão de saída'}
            value={formatMoney(kpis.previsto)}
            hint="próximos 30 dias"
          />
        </div>
      )}

      {/* ------------------------------ Filtros ------------------------------ */}
      <Card className="mt-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <SearchInput
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="self-end"
            placeholder={
              receber
                ? 'Buscar por cliente, descrição ou categoria…'
                : 'Buscar por fornecedor, descrição ou categoria…'
            }
          />
          <Field label="De" className="w-full lg:w-40">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Até" className="w-full lg:w-40">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button
              variant="ghost"
              onClick={() => {
                setTerm('')
                setFrom('')
                setTo('')
                setTab('open')
              }}
              disabled={!term && !from && !to && tab === 'open'}
            >
              Limpar filtros
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cx(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                tab === item.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-sunken text-fg-muted hover:text-fg',
              )}
            >
              {item.label} ({counts[item.id]})
            </button>
          ))}
        </div>
      </Card>

      {/* ------------------------- Tabela e painéis ------------------------- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card
          title={
            <span className="flex items-center gap-2 text-sm font-semibold text-fg">
              <IconFile className="size-4 text-brand-600" />
              {receber ? 'Contas a receber' : 'Contas a pagar'} ({visible.length})
            </span>
          }
          bodyClassName="p-0"
        >
          {rows.isLoading ? (
            <Spinner />
          ) : visible.length === 0 ? (
            <p className="py-12 text-center text-sm text-fg-subtle">
              Nenhum resultado com os filtros atuais.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-sunken text-[0.6875rem] tracking-wide text-fg-subtle uppercase">
                    <th className="px-4 py-2.5 text-left font-medium">
                      {receber ? 'Cliente' : 'Fornecedor'}
                    </th>
                    <th className="hidden px-4 py-2.5 text-left font-medium 2xl:table-cell">
                      Categoria
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium">Descrição</th>
                    <th className="px-4 py-2.5 text-left font-medium">Vencimento</th>
                    <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                    <th className="px-4 py-2.5 text-right font-medium">Saldo</th>
                    {receber && (
                      <th className="hidden px-4 py-2.5 text-left font-medium xl:table-cell">
                        Forma
                      </th>
                    )}
                    <th className="px-4 py-2.5 text-left font-medium">Situação</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((title) => {
                    const state = stateOf(title, day)
                    return (
                      <tr key={title.id} className="hover:bg-surface-sunken">
                        <td className="max-w-48 truncate px-4 py-3 font-medium text-fg">
                          {title.counterpartyTo ? (
                            <Link
                              to={title.counterpartyTo}
                              className="text-brand-700 hover:underline dark:text-brand-300"
                            >
                              {title.counterparty}
                            </Link>
                          ) : (
                            title.counterparty
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-fg-muted 2xl:table-cell">
                          {title.category}
                        </td>
                        <td className="max-w-48 truncate px-4 py-3 text-fg-muted">
                          {title.description}
                        </td>
                        <td className="tnum px-4 py-3 text-fg-muted">
                          {formatDate(title.dueDate)}
                        </td>
                        <td className="tnum px-4 py-3 text-right text-fg">
                          {formatMoney(title.amount)}
                        </td>
                        <td className="tnum px-4 py-3 text-right font-medium text-fg">
                          {formatMoney(saldo(title))}
                        </td>
                        {receber && (
                          <td className="hidden px-4 py-3 text-fg-muted xl:table-cell">
                            {title.method}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <Badge tone={state.tone} dot>
                            {state.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {podeBaixar && !quitado(title) && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSettling(title)
                                setAmount(String(saldo(title).toFixed(2)))
                                setMethodId('')
                              }}
                            >
                              {receber ? 'Receber' : 'Pagar'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card
            title={
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                <IconCalendar className="size-4 text-brand-600" />
                Próximos vencimentos
              </span>
            }
            bodyClassName="p-2"
          >
            {proximos.length === 0 ? (
              <p className="py-8 text-center text-xs text-fg-subtle">
                Nada a vencer daqui para a frente.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {proximos.map((title) => {
                  const state = stateOf(title, day)
                  return (
                    <li
                      key={title.id}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-2"
                    >
                      <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-sunken leading-none">
                        <span className="tnum text-sm font-semibold text-fg">
                          {title.dueDate.slice(8, 10)}
                        </span>
                        <span className="mt-0.5 text-[0.5625rem] tracking-wide text-fg-subtle uppercase">
                          {monthAbbr(title.dueDate)}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-sm font-medium text-fg">
                          {title.counterparty}
                        </span>
                        <span className="block truncate text-xs text-fg-subtle">
                          {title.description}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="tnum block text-sm font-medium text-fg">
                          {formatMoney(saldo(title))}
                        </span>
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                <IconMoney className="size-4 text-brand-600" />
                Distribuição por categoria
              </span>
            }
          >
            {porCategoria.length === 0 ? (
              <p className="py-8 text-center text-xs text-fg-subtle">
                Nada em aberto para distribuir.
              </p>
            ) : (
              <Donut
                layout="column"
                slices={porCategoria}
                centerValue={formatMoney(kpis.aberto)}
                centerLabel="em aberto"
                formatValue={formatMoney}
              />
            )}
          </Card>
        </div>
      </div>

      {/* ------------------------------- Baixa ------------------------------- */}
      <Modal
        open={settling !== null}
        onClose={() => setSettling(null)}
        title={receber ? 'Receber título' : 'Pagar conta'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSettling(null)}>
              Cancelar
            </Button>
            <Button onClick={() => settle.mutate()} disabled={settle.isPending}>
              {settle.isPending ? 'Lançando…' : 'Confirmar'}
            </Button>
          </>
        }
      >
        {settling && (
          <div className="space-y-3">
            <p className="text-sm text-fg-muted">
              {settling.counterparty} · {settling.description} · vence em{' '}
              {formatDate(settling.dueDate)}
            </p>
            <Field label="Valor" required>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            {receber && (
              <Field label="Forma de pagamento">
                <Select value={methodId} onChange={(e) => setMethodId(e.target.value)}>
                  <option value="">Selecione…</option>
                  {methods.data?.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <p className="text-xs text-fg-subtle">
              Saldo do título: {formatMoney(saldo(settling))}
            </p>
          </div>
        )}
      </Modal>

      <p className="mt-4 flex items-center justify-end gap-1 text-xs text-fg-subtle">
        <Link
          to={receber ? '/financeiro/pagar' : '/financeiro/receber'}
          className="flex items-center gap-1 text-brand-700 hover:underline dark:text-brand-300"
        >
          Ver {receber ? 'contas a pagar' : 'contas a receber'}
          <IconArrowRight className="size-3.5" />
        </Link>
      </p>
    </>
  )
}

// ---------------------------------------------------------------------------

function stateOf(
  title: Title,
  day: string,
): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (title.status === 'cancelled') return { label: 'Cancelado', tone: 'neutral' }
  if (title.status === 'written_off') return { label: 'Baixado', tone: 'neutral' }
  if (title.status === 'paid' || title.amount - title.paidAmount <= 0)
    return { label: 'Quitado', tone: 'success' }
  if (title.dueDate < day) return { label: 'Vencido', tone: 'danger' }
  if (title.dueDate === day) return { label: 'Vence hoje', tone: 'warning' }
  if (title.paidAmount > 0) return { label: 'Parcial', tone: 'warning' }
  return { label: 'Em aberto', tone: 'neutral' }
}

const monthAbbr = (date: string): string =>
  new Date(`${date}T12:00:00`)
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '')
