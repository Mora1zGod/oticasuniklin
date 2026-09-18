import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppContext, useSession } from '@/auth/SessionProvider'
import { AsideTip, CatalogScreen } from '@/components/CatalogScreen'
import { Modal } from '@/components/ui/Modal'
import { Alert, Badge, Button, Field, Input, PageHeader } from '@/components/ui/primitives'
import {
  IconBuilding,
  IconCheckCircle,
  IconChevronRight,
  IconCoin,
  IconUsers,
} from '@/components/ui/icons'
import { describeError } from '@/lib/errors'
import { formatDate, formatMoney } from '@/lib/format'

/**
 * As lojas que a plataforma atende.
 *
 * Só existe para a ótica que opera a plataforma. Aqui ela cadastra a loja
 * cliente, combina a mensalidade e entra na loja para configurar a identidade
 * visual e dar suporte.
 *
 * "Entrar na loja" é abrir o endereço dela: cada ótica tem o seu, e é o
 * endereço que diz ao banco em qual ótica a sessão está. Não existe modo
 * fantasma nem visão por cima da RLS — lá dentro valem as mesmas regras de
 * sempre.
 */
type Store = {
  id: string
  slug: string
  trade_name: string
  legal_name: string
  tax_document: string | null
  is_active: boolean
  created_at: string
  subscription_amount: number | null
  subscription_due_day: number | null
}

export function PlatformStoresPage() {
  const ctx = useAppContext()
  const { isPlatformOwner } = useSession()
  const queryClient = useQueryClient()

  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ slug: '', trade_name: '', legal_name: '', tax_document: '' })
  const [error, setError] = useState<string | null>(null)

  const stores = useQuery({
    queryKey: ['platform-stores', ctx.tenant_id],
    enabled: isPlatformOwner,
    queryFn: async (): Promise<Store[]> => {
      const { data, error: err } = await supabase
        .from('tenants')
        .select(
          'id,slug,trade_name,legal_name,tax_document,is_active,created_at,subscription_amount,subscription_due_day',
        )
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
    queryKey: ['platform-invoices-summary', ctx.tenant_id],
    enabled: isPlatformOwner,
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('platform_invoices')
        .select('client_tenant_id,amount,paid_amount,status,due_date')
        .eq('provider_tenant_id', ctx.tenant_id)
      if (err) throw err
      return data ?? []
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      setError(null)
      const slug = draft.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-')
      if (!slug || !draft.trade_name.trim()) {
        throw new Error('Informe o endereço e o nome da loja.')
      }
      const { data, error: err } = await supabase.rpc('create_client_tenant', {
        p_slug: slug,
        p_trade_name: draft.trade_name.trim(),
        p_legal_name: draft.legal_name.trim() || null,
        p_tax_document: draft.tax_document.trim() || null,
      })
      if (err) throw err
      return data as string
    },
    onSuccess: () => {
      setCreating(false)
      setDraft({ slug: '', trade_name: '', legal_name: '', tax_document: '' })
      void queryClient.invalidateQueries({ queryKey: ['platform-stores'] })
    },
    onError: (err) => setError(describeError(err)),
  })

  const setSubscription = useMutation({
    mutationFn: async ({ id, amount, day }: { id: string; amount: string; day: string }) => {
      setError(null)
      const value = amount.trim() === '' ? null : Number(amount.replace(',', '.'))
      if (value !== null && (!Number.isFinite(value) || value < 0)) {
        throw new Error('Mensalidade inválida.')
      }
      const dueDay = day.trim() === '' ? null : Number(day)
      if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28)) {
        throw new Error('Dia de vencimento deve estar entre 1 e 28.')
      }
      const { error: err } = await supabase
        .from('tenants')
        .update({ subscription_amount: value, subscription_due_day: dueDay })
        .eq('id', id)
      if (err) throw err
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform-stores'] }),
    onError: (err) => setError(describeError(err)),
  })

  const [editing, setEditing] = useState<Store | null>(null)
  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState('')

  if (!isPlatformOwner) {
    return (
      <>
        <PageHeader title="Óticas atendidas" />
        <Alert>Esta tela pertence à ótica que opera a plataforma.</Alert>
      </>
    )
  }

  const rows = stores.data ?? []
  const emAberto = (invoices.data ?? []).filter(
    (invoice) => invoice.status === 'open' || invoice.status === 'overdue',
  )
  const receitaMensal = rows.reduce(
    (total, store) => total + Number(store.subscription_amount ?? 0),
    0,
  )

  return (
    <>
      <CatalogScreen
        title="Óticas atendidas"
        subtitle="As lojas que usam a plataforma. Cadastre, combine a mensalidade e entre para dar suporte."
        addLabel="ótica"
        onAdd={() => setCreating(true)}
        loading={stores.isLoading}
        rows={rows}
        rowKey={(store) => store.id}
        searchPlaceholder="Buscar por nome, endereço ou CNPJ…"
        searchText={(store) =>
          [store.trade_name, store.slug, store.legal_name, store.tax_document]
            .filter(Boolean)
            .join(' ')
        }
        stats={[
          {
            icon: IconBuilding,
            tone: 'brand',
            label: 'Óticas atendidas',
            value: String(rows.length),
            hint: 'lojas na plataforma',
          },
          {
            icon: IconCheckCircle,
            tone: 'success',
            label: 'Ativas',
            value: String(rows.filter((store) => store.is_active).length),
            hint: 'em operação',
          },
          {
            icon: IconCoin,
            tone: 'violet',
            label: 'Receita mensal',
            value: formatMoney(receitaMensal),
            hint: 'soma das mensalidades',
          },
          {
            icon: IconUsers,
            tone: 'warning',
            label: 'Cobranças em aberto',
            value: String(emAberto.length),
            hint: formatMoney(
              emAberto.reduce(
                (total, invoice) =>
                  total + (Number(invoice.amount) - Number(invoice.paid_amount)),
                0,
              ),
            ),
          },
        ]}
        filters={[
          {
            id: 'status',
            label: 'Todos os status',
            options: [
              { value: 'active', label: 'Ativas' },
              { value: 'inactive', label: 'Inativas' },
            ],
            match: (store, value) =>
              value === 'active' ? store.is_active : !store.is_active,
          },
          {
            id: 'plan',
            label: 'Toda mensalidade',
            options: [
              { value: 'set', label: 'Com mensalidade' },
              { value: 'none', label: 'Sem mensalidade' },
            ],
            match: (store, value) =>
              value === 'set'
                ? store.subscription_amount !== null
                : store.subscription_amount === null,
          },
        ]}
        columns={[
          {
            key: 'name',
            header: 'Ótica',
            render: (store) => (
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{store.trade_name}</p>
                <p className="truncate font-mono text-xs text-fg-subtle">/{store.slug}</p>
              </div>
            ),
          },
          {
            key: 'document',
            header: 'CNPJ',
            className: 'hidden text-fg-muted lg:table-cell',
            headerClassName: 'hidden lg:table-cell',
            render: (store) => store.tax_document ?? '—',
          },
          {
            key: 'since',
            header: 'Cliente desde',
            className: 'tnum hidden text-fg-muted xl:table-cell',
            headerClassName: 'hidden xl:table-cell',
            render: (store) => formatDate(store.created_at),
          },
          {
            key: 'plan',
            header: 'Mensalidade',
            className: 'tnum',
            render: (store) => (
              <button
                onClick={() => {
                  setEditing(store)
                  setAmount(store.subscription_amount?.toString() ?? '')
                  setDueDay(store.subscription_due_day?.toString() ?? '')
                }}
                className="text-brand-700 hover:underline dark:text-brand-300"
              >
                {store.subscription_amount === null
                  ? 'combinar'
                  : `${formatMoney(store.subscription_amount)}${store.subscription_due_day ? ` · dia ${store.subscription_due_day}` : ''}`}
              </button>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (store) => (
              <Badge tone={store.is_active ? 'success' : 'neutral'} dot>
                {store.is_active ? 'Ativa' : 'Inativa'}
              </Badge>
            ),
          },
          {
            key: 'enter',
            header: '',
            className: 'text-right',
            render: (store) => (
              <a
                href={`/${store.slug}/`}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-fg-muted hover:text-fg"
                title={`Abrir ${store.trade_name}`}
              >
                Entrar
                <IconChevronRight className="size-3.5" />
              </a>
            ),
          },
        ]}
        aside={
          <>
            <AsideTip title="Entrar na loja é abrir o endereço dela">
              Cada ótica tem o próprio endereço, e é ele que diz em qual ótica a sessão
              está. Você entra porque tem cadastro de administrador lá dentro — não
              porque a plataforma enxerga por cima das regras.
            </AsideTip>

            <AsideTip title="A identidade visual é de cada loja">
              Ao entrar, o menu Sistema → Identidade visual configura a marca daquela
              ótica. A sua continua sendo a sua.
            </AsideTip>
          </>
        }
      />

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {/* ------------------------------ Nova ótica ------------------------------ */}
      <Modal
        open={creating}
        title="Nova ótica na plataforma"
        onClose={() => setCreating(false)}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? 'Cadastrando…' : 'Cadastrar ótica'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-12 gap-3">
          <Field label="Nome da ótica" required className="col-span-12 sm:col-span-7">
            <Input
              value={draft.trade_name}
              onChange={(event) => {
                const trade_name = event.target.value
                setDraft((previous) => ({
                  ...previous,
                  trade_name,
                  // O endereço acompanha o nome até alguém mexer nele.
                  slug: previous.slug === slugify(previous.trade_name)
                    ? slugify(trade_name)
                    : previous.slug,
                }))
              }}
              placeholder="Ótica Tudo Bom"
            />
          </Field>
          <Field
            label="Endereço"
            required
            className="col-span-12 sm:col-span-5"
            hint="É por onde a loja acessa o sistema."
          >
            <Input
              value={draft.slug}
              onChange={(event) => setDraft({ ...draft, slug: slugify(event.target.value) })}
              className="font-mono"
              placeholder="tudobom"
            />
          </Field>
          <Field label="Razão social" className="col-span-12 sm:col-span-8">
            <Input
              value={draft.legal_name}
              onChange={(event) => setDraft({ ...draft, legal_name: event.target.value })}
            />
          </Field>
          <Field label="CNPJ" className="col-span-12 sm:col-span-4">
            <Input
              value={draft.tax_document}
              onChange={(event) => setDraft({ ...draft, tax_document: event.target.value })}
              inputMode="numeric"
            />
          </Field>
        </div>

        <div className="mt-4 space-y-2">
          <Alert tone="info">
            A loja nasce pronta: filial matriz, papéis, formas de pagamento, plano de
            contas e catálogos padrão. Você entra nela como administrador para
            configurar a marca e convidar a equipe.
          </Alert>
          {draft.slug && (
            <p className="text-xs text-fg-subtle">
              Endereço da loja:{' '}
              <span className="font-mono text-fg-muted">
                {window.location.host}/{draft.slug}
              </span>
            </p>
          )}
        </div>
      </Modal>

      {/* ----------------------------- Mensalidade ----------------------------- */}
      <Modal
        open={editing !== null}
        title={`Mensalidade — ${editing?.trade_name ?? ''}`}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                editing &&
                setSubscription.mutate(
                  { id: editing.id, amount, day: dueDay },
                  { onSuccess: () => setEditing(null) },
                )
              }
              disabled={setSubscription.isPending}
            >
              {setSubscription.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-12 gap-3">
          <Field
            label="Valor mensal"
            className="col-span-12 sm:col-span-6"
            hint="Vazio = sem cobrança automática."
          >
            <Input
              className="tnum"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="249,90"
            />
          </Field>
          <Field
            label="Dia do vencimento"
            className="col-span-12 sm:col-span-6"
            hint="De 1 a 28, para caber em todo mês."
          >
            <Input
              className="tnum"
              inputMode="numeric"
              value={dueDay}
              onChange={(event) => setDueDay(event.target.value)}
              placeholder="10"
            />
          </Field>
        </div>
      </Modal>
    </>
  )
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
