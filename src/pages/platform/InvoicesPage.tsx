import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppContext, useSession } from '@/auth/SessionProvider'
import { AsideRanking, AsideTip, CatalogScreen } from '@/components/CatalogScreen'
import { Card } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Alert, Badge, Button, Field, Input, PageHeader, Select } from '@/components/ui/primitives'
import {
  IconAlert,
  IconCheckCircle,
  IconClock,
  IconCoin,
} from '@/components/ui/icons'
import { describeError } from '@/lib/errors'
import { formatDate, formatMoney, today } from '@/lib/format'

/**
 * A mensalidade que a plataforma cobra das lojas.
 *
 * É dinheiro de OUTRA natureza que o "contas a receber" de uma ótica: lá é o
 * que a loja cobra do cliente dela; aqui é o que a plataforma cobra da loja.
 * Por isso mora numa tabela própria (`platform_invoices`) e numa tela própria —
 * misturar as duas faria o financeiro da loja enxergar a própria assinatura
 * como se fosse venda.
 *
 * A loja cliente não vê nada disto: a RLS entrega estas linhas só para quem
 * opera a plataforma.
 */
type InvoiceStatus = 'open' | 'paid' | 'overdue' | 'cancelled'

type Invoice = {
  id: string
  client_tenant_id: string
  reference_month: string
  due_date: string
  amount: number
  paid_amount: number
  status: InvoiceStatus
  notes: string | null
}

type Store = {
  id: string
  trade_name: string
  slug: string
  subscription_amount: number | null
  subscription_due_day: number | null
}

const STATUS: Record<InvoiceStatus, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }> = {
  open: { label: 'Em aberto', tone: 'warning' },
  paid: { label: 'Paga', tone: 'success' },
  overdue: { label: 'Vencida', tone: 'danger' },
  cancelled: { label: 'Cancelada', tone: 'neutral' },
}

export function PlatformInvoicesPage() {
  const ctx = useAppContext()
  const { isPlatformOwner } = useSession()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const stores = useQuery({
    queryKey: ['platform-stores', ctx.tenant_id],
    enabled: isPlatformOwner,
    queryFn: async (): Promise<Store[]> => {
      const { data, error: err } = await supabase
        .from('tenants')
        .select('id,trade_name,slug,subscription_amount,subscription_due_day')
        .eq('provider_tenant_id', ctx.tenant_id)
        .is('deleted_at', null)
        .order('trade_name')
      if (err) throw err
      return (data ?? []).map((row) => ({
        ...row,
        subscription_amount:
          row.subscription_amount === null ? null : Number(row.subscription_amount),
      }))
    },
  })

  const invoices = useQuery({
    queryKey: ['platform-invoices', ctx.tenant_id],
    enabled: isPlatformOwner,
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error: err } = await supabase
        .from('platform_invoices')
        .select(
          'id,client_tenant_id,reference_month,due_date,amount,paid_amount,status,notes',
        )
        .eq('provider_tenant_id', ctx.tenant_id)
        .order('reference_month', { ascending: false })
      if (err) throw err
      return (data ?? []).map((row) => ({
        ...row,
        status: row.status as InvoiceStatus,
        amount: Number(row.amount),
        paid_amount: Number(row.paid_amount),
      }))
    },
  })

  const storeById = useMemo(() => {
    const map = new Map<string, Store>()
    for (const store of stores.data ?? []) map.set(store.id, store)
    return map
  }, [stores.data])

  /** Mês de referência aberto na tela de geração: sempre o dia 1. */
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const [generating, setGenerating] = useState(false)

  const generate = useMutation({
    mutationFn: async () => {
      setError(null)
      const reference = `${month}-01`
      const alreadyBilled = new Set(
        (invoices.data ?? [])
          .filter((invoice) => invoice.reference_month === reference)
          .map((invoice) => invoice.client_tenant_id),
      )

      // Só entra loja com mensalidade combinada e ainda não cobrada no mês: a
      // geração pode rodar de novo sem duplicar nada.
      const rows = (stores.data ?? [])
        .filter((store) => store.subscription_amount !== null && store.subscription_amount > 0)
        .filter((store) => !alreadyBilled.has(store.id))
        .map((store) => ({
          provider_tenant_id: ctx.tenant_id,
          client_tenant_id: store.id,
          reference_month: reference,
          due_date: dueDateFor(reference, store.subscription_due_day),
          amount: store.subscription_amount as number,
        }))

      if (rows.length === 0) {
        throw new Error('Nenhuma loja a cobrar neste mês: já geradas ou sem mensalidade.')
      }
      const { error: err } = await supabase.from('platform_invoices').insert(rows)
      if (err) throw err
      return rows.length
    },
    onSuccess: () => {
      setGenerating(false)
      void queryClient.invalidateQueries({ queryKey: ['platform-invoices'] })
    },
    onError: (err) => setError(describeError(err)),
  })

  const [settling, setSettling] = useState<Invoice | null>(null)
  const [paid, setPaid] = useState('')

  const settle = useMutation({
    mutationFn: async ({ invoice, value }: { invoice: Invoice; value: string }) => {
      setError(null)
      const amount = value.trim() === '' ? invoice.amount : Number(value.replace(',', '.'))
      if (!Number.isFinite(amount) || amount < 0 || amount > invoice.amount) {
        throw new Error('Valor recebido inválido.')
      }
      const { error: err } = await supabase
        .from('platform_invoices')
        .update({
          paid_amount: amount,
          status: amount >= invoice.amount ? 'paid' : invoice.status,
        })
        .eq('id', invoice.id)
      if (err) throw err
    },
    onSuccess: () => {
      setSettling(null)
      void queryClient.invalidateQueries({ queryKey: ['platform-invoices'] })
    },
    onError: (err) => setError(describeError(err)),
  })

  const cancel = useMutation({
    mutationFn: async (invoice: Invoice) => {
      setError(null)
      const { error: err } = await supabase
        .from('platform_invoices')
        .update({ status: 'cancelled' })
        .eq('id', invoice.id)
      if (err) throw err
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform-invoices'] }),
    onError: (err) => setError(describeError(err)),
  })

  if (!isPlatformOwner) {
    return (
      <>
        <PageHeader title="Cobranças da plataforma" />
        <Alert>Esta tela pertence à ótica que opera a plataforma.</Alert>
      </>
    )
  }

  const rows = invoices.data ?? []
  const day = today()

  // "Vencida" é uma leitura da data, não um estado guardado: uma cobrança em
  // aberto cujo vencimento passou já está vencida, sem ninguém ter gravado nada.
  const readStatus = (invoice: Invoice): InvoiceStatus =>
    invoice.status === 'open' && invoice.due_date < day ? 'overdue' : invoice.status

  const abertas = rows.filter((invoice) => readStatus(invoice) === 'open')
  const vencidas = rows.filter((invoice) => readStatus(invoice) === 'overdue')
  const mesCorrente = rows.filter(
    (invoice) => invoice.reference_month.slice(0, 7) === day.slice(0, 7),
  )
  const recebidoNoMes = mesCorrente.reduce((total, invoice) => total + invoice.paid_amount, 0)

  const porLoja = [...storeById.values()]
    .map((store) => ({
      store,
      devendo: rows
        .filter(
          (invoice) =>
            invoice.client_tenant_id === store.id &&
            (readStatus(invoice) === 'open' || readStatus(invoice) === 'overdue'),
        )
        .reduce((total, invoice) => total + (invoice.amount - invoice.paid_amount), 0),
    }))
    .filter((entry) => entry.devendo > 0)
    .sort((a, b) => b.devendo - a.devendo)
    .slice(0, 6)

  return (
    <>
      <CatalogScreen
        title="Cobranças da plataforma"
        subtitle="A mensalidade que cada ótica atendida paga pelo uso do sistema."
        addLabel="Gerar mês"
        onAdd={() => setGenerating(true)}
        loading={invoices.isLoading}
        rows={rows}
        rowKey={(invoice) => invoice.id}
        emptyTitle="Nenhuma cobrança gerada ainda."
        searchPlaceholder="Buscar por ótica ou mês…"
        searchText={(invoice) =>
          [
            storeById.get(invoice.client_tenant_id)?.trade_name ?? '',
            monthLabel(invoice.reference_month),
            invoice.reference_month,
          ].join(' ')
        }
        stats={[
          {
            icon: IconCoin,
            tone: 'brand',
            label: 'Faturado no mês',
            value: formatMoney(
              mesCorrente.reduce((total, invoice) => total + invoice.amount, 0),
            ),
            hint: `${mesCorrente.length} cobrança${mesCorrente.length === 1 ? '' : 's'} em ${monthLabel(day.slice(0, 7) + '-01')}`,
          },
          {
            icon: IconCheckCircle,
            tone: 'success',
            label: 'Recebido no mês',
            value: formatMoney(recebidoNoMes),
            hint: 'baixas lançadas',
          },
          {
            icon: IconClock,
            tone: 'warning',
            label: 'Em aberto',
            value: formatMoney(
              abertas.reduce((total, invoice) => total + (invoice.amount - invoice.paid_amount), 0),
            ),
            hint: `${abertas.length} a vencer`,
          },
          {
            icon: IconAlert,
            tone: 'danger',
            label: 'Vencidas',
            value: formatMoney(
              vencidas.reduce((total, invoice) => total + (invoice.amount - invoice.paid_amount), 0),
            ),
            hint: `${vencidas.length} em atraso`,
          },
        ]}
        filters={[
          {
            id: 'status',
            label: 'Toda situação',
            options: [
              { value: 'open', label: 'Em aberto' },
              { value: 'overdue', label: 'Vencidas' },
              { value: 'paid', label: 'Pagas' },
              { value: 'cancelled', label: 'Canceladas' },
            ],
            match: (invoice, value) => readStatus(invoice) === value,
          },
          {
            id: 'month',
            label: 'Todo mês',
            options: [...new Set(rows.map((invoice) => invoice.reference_month))]
              .slice(0, 12)
              .map((value) => ({ value, label: monthLabel(value) })),
            match: (invoice, value) => invoice.reference_month === value,
          },
        ]}
        columns={[
          {
            key: 'store',
            header: 'Ótica',
            render: (invoice) => (
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">
                  {storeById.get(invoice.client_tenant_id)?.trade_name ?? 'Ótica removida'}
                </p>
                <p className="truncate font-mono text-xs text-fg-subtle">
                  /{storeById.get(invoice.client_tenant_id)?.slug ?? '—'}
                </p>
              </div>
            ),
          },
          {
            key: 'month',
            header: 'Referência',
            className: 'text-fg-muted',
            render: (invoice) => monthLabel(invoice.reference_month),
          },
          {
            key: 'due',
            header: 'Vencimento',
            className: 'tnum hidden text-fg-muted sm:table-cell',
            headerClassName: 'hidden sm:table-cell',
            render: (invoice) => formatDate(invoice.due_date),
          },
          {
            key: 'amount',
            header: 'Valor',
            className: 'tnum font-medium text-fg',
            headerClassName: 'tnum',
            render: (invoice) => formatMoney(invoice.amount),
          },
          {
            key: 'paid',
            header: 'Recebido',
            className: 'tnum hidden text-fg-muted lg:table-cell',
            headerClassName: 'hidden lg:table-cell',
            render: (invoice) =>
              invoice.paid_amount > 0 ? formatMoney(invoice.paid_amount) : '—',
          },
          {
            key: 'status',
            header: 'Situação',
            render: (invoice) => {
              const state = STATUS[readStatus(invoice)]
              return (
                <Badge tone={state.tone} dot>
                  {state.label}
                </Badge>
              )
            },
          },
          {
            key: 'actions',
            header: '',
            className: 'text-right whitespace-nowrap',
            render: (invoice) =>
              invoice.status === 'paid' || invoice.status === 'cancelled' ? (
                <span className="text-xs text-fg-subtle">—</span>
              ) : (
                <span className="flex justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSettling(invoice)
                      setPaid(String(invoice.amount - invoice.paid_amount))
                    }}
                  >
                    Baixar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => cancel.mutate(invoice)}
                    disabled={cancel.isPending}
                  >
                    Cancelar
                  </Button>
                </span>
              ),
          },
        ]}
        aside={
          <>
            <Card title="Quem está devendo">
              <AsideRanking
                items={porLoja.map((entry) => ({
                  key: entry.store.id,
                  title: entry.store.trade_name,
                  detail: `/${entry.store.slug}`,
                  value: formatMoney(entry.devendo),
                }))}
              />
            </Card>

            <AsideTip title="Gerar o mês não duplica">
              A geração pula quem já foi cobrado no mês de referência e quem não tem
              mensalidade combinada. Pode rodar de novo depois de cadastrar uma loja
              nova.
            </AsideTip>
          </>
        }
      />

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {/* --------------------------- Gerar o mês --------------------------- */}
      <Modal
        open={generating}
        title="Gerar cobranças do mês"
        onClose={() => setGenerating(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setGenerating(false)}>
              Cancelar
            </Button>
            <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
              {generate.isPending ? 'Gerando…' : 'Gerar'}
            </Button>
          </>
        }
      >
        <Field label="Mês de referência">
          <Select value={month} onChange={(event) => setMonth(event.target.value)}>
            {lastMonths(6).map((value) => (
              <option key={value} value={value}>
                {monthLabel(value + '-01')}
              </option>
            ))}
          </Select>
        </Field>

        <div className="mt-4 space-y-2">
          <Alert tone="info">
            Entram as óticas com mensalidade combinada que ainda não foram cobradas
            neste mês. O vencimento sai do dia combinado com cada loja.
          </Alert>
          <ul className="divide-y divide-line rounded-card border border-line">
            {(stores.data ?? [])
              .filter((store) => store.subscription_amount)
              .map((store) => {
                const billed = rows.some(
                  (invoice) =>
                    invoice.client_tenant_id === store.id &&
                    invoice.reference_month === `${month}-01`,
                )
                return (
                  <li
                    key={store.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-fg">{store.trade_name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tnum text-fg-muted">
                        {formatMoney(store.subscription_amount)}
                      </span>
                      {billed && (
                        <Badge tone="success">já gerada</Badge>
                      )}
                    </span>
                  </li>
                )
              })}
          </ul>
        </div>
      </Modal>

      {/* ----------------------------- Baixa ----------------------------- */}
      <Modal
        open={settling !== null}
        title="Registrar recebimento"
        onClose={() => setSettling(null)}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSettling(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => settling && settle.mutate({ invoice: settling, value: paid })}
              disabled={settle.isPending}
            >
              {settle.isPending ? 'Salvando…' : 'Confirmar'}
            </Button>
          </>
        }
      >
        {settling && (
          <>
            <p className="mb-3 text-sm text-fg-muted">
              {storeById.get(settling.client_tenant_id)?.trade_name} ·{' '}
              {monthLabel(settling.reference_month)} · {formatMoney(settling.amount)}
            </p>
            <Field
              label="Valor recebido"
              hint="Menor que o total deixa a cobrança em aberto pelo restante."
            >
              <Input
                className="tnum"
                inputMode="decimal"
                value={paid}
                onChange={(event) => setPaid(event.target.value)}
              />
            </Field>
          </>
        )}
      </Modal>
    </>
  )
}

// ---------------------------------------------------------------------------

/** Vencimento do mês: o dia combinado com a loja, ou o dia 10. */
function dueDateFor(referenceMonth: string, day: number | null): string {
  const chosen = day && day >= 1 && day <= 28 ? day : 10
  return `${referenceMonth.slice(0, 7)}-${String(chosen).padStart(2, '0')}`
}

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function monthLabel(reference: string): string {
  const [year, month] = reference.split('-')
  const name = MONTHS[Number(month) - 1] ?? month
  return `${name}/${year}`
}

/** Os últimos N meses, do mais recente para trás, como `AAAA-MM`. */
function lastMonths(count: number): string[] {
  const now = new Date()
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  })
}
