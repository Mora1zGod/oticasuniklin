import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppContext, useBranchId } from '@/auth/SessionProvider'
import { AsideRanking, AsideTip, CatalogScreen } from '@/components/CatalogScreen'
import { Donut } from '@/components/ui/Donut'
import { Modal } from '@/components/ui/Modal'
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
} from '@/components/ui/primitives'
import {
  IconAlert,
  IconArrowDown,
  IconArrowUp,
  IconBox,
  IconClock,
  IconCoin,
  IconLayers,
} from '@/components/ui/icons'
import { describeError } from '@/lib/errors'
import { formatDateTime, formatMoney } from '@/lib/format'
import type { Row } from '@/lib/db'

type MovementKind = Row<'stock_movements'>['movement_kind']
type ProductKind = Row<'products'>['product_kind']

const MOVEMENT_LABEL: Record<MovementKind, string> = {
  purchase_in: 'Entrada por compra',
  sale_out: 'Saída por venda',
  reserve: 'Reserva',
  release_reserve: 'Liberação de reserva',
  transfer_in: 'Transferência (entrada)',
  transfer_out: 'Transferência (saída)',
  adjustment: 'Ajuste',
  return_in: 'Devolução',
  loss: 'Perda',
  lab_out: 'Envio ao laboratório',
  lab_in: 'Retorno do laboratório',
}

/** Movimentos que somam, subtraem ou apenas reservam. */
const DIRECTION: Record<MovementKind, -1 | 0 | 1> = {
  purchase_in: 1,
  return_in: 1,
  transfer_in: 1,
  lab_in: 1,
  sale_out: -1,
  loss: -1,
  transfer_out: -1,
  lab_out: -1,
  adjustment: 1,
  reserve: 0,
  release_reserve: 0,
}

const KIND_LABEL: Record<ProductKind, string> = {
  frame: 'Armação',
  sunglass: 'Solar',
  lens: 'Lente',
  contact_lens: 'Lente de contato',
  accessory: 'Acessório',
  service: 'Serviço',
  lens_treatment: 'Tratamento',
}

/**
 * O saldo de uma linha da tela.
 *
 * Três números que não se confundem: o que existe na gaveta (`quantity`), o que
 * já tem dono (`reserved_quantity`, preso a uma venda ou O.S. em andamento) e o
 * que sobra para vender hoje (a diferença). Quem confunde os dois primeiros
 * vende duas vezes a mesma armação.
 */
type Balance = {
  id: string
  product_id: string
  quantity: number
  reserved: number
  available: number
  name: string
  sku: string | null
  kind: ProductKind
  cost: number | null
  updated_at: string
}

export function StockBalancesPage() {
  const ctx = useAppContext()
  const branchId = useBranchId()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<{
    product_id: string
    movement_kind: MovementKind
    quantity: string
    unit_cost: string
    notes: string
  }>({
    product_id: '',
    movement_kind: 'purchase_in',
    quantity: '1',
    unit_cost: '',
    notes: '',
  })

  const balances = useQuery({
    queryKey: ['stock-balances', branchId],
    queryFn: async (): Promise<Balance[]> => {
      const { data, error: err } = await supabase
        .from('stock_balances')
        .select(
          'id,product_id,quantity,reserved_quantity,updated_at,products(name,sku,product_kind,cost_price)',
        )
        .eq('branch_id', branchId)
      if (err) throw err
      return (data ?? []).map((row) => {
        const quantity = Number(row.quantity)
        const reserved = Number(row.reserved_quantity)
        return {
          id: row.id,
          product_id: row.product_id,
          quantity,
          reserved,
          available: quantity - reserved,
          name: row.products?.name ?? 'Produto removido',
          sku: row.products?.sku ?? null,
          kind: (row.products?.product_kind ?? 'accessory') as ProductKind,
          cost: row.products?.cost_price === null ? null : Number(row.products?.cost_price),
          updated_at: row.updated_at,
        }
      })
    },
  })

  /** Últimos movimentos da filial: alimentam o painel lateral da tela. */
  const recent = useQuery({
    queryKey: ['stock-movements-recent', branchId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('stock_movements')
        .select('id,movement_kind,quantity,direction,occurred_at,products(name)')
        .eq('branch_id', branchId)
        .order('occurred_at', { ascending: false })
        .limit(6)
      if (err) throw err
      return data ?? []
    },
  })

  const products = useQuery({
    queryKey: ['stock-products', ctx.tenant_id],
    enabled: open,
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('tracks_stock', true)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name')
      if (err) throw err
      return data ?? []
    },
  })

  /**
   * Movimentação manual. O saldo é atualizado junto com o lançamento — as
   * constraints do banco impedem saldo ou reserva negativos.
   */
  const move = useMutation({
    mutationFn: async () => {
      setError(null)
      const qty = Number(form.quantity.replace(',', '.'))
      if (!form.product_id) throw new Error('Escolha o produto.')
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantidade inválida.')

      const direction = DIRECTION[form.movement_kind]

      const { data: current, error: balanceError } = await supabase
        .from('stock_balances')
        .select('id, quantity, reserved_quantity')
        .eq('branch_id', branchId)
        .eq('product_id', form.product_id)
        .maybeSingle()
      if (balanceError) throw balanceError

      const currentQty = Number(current?.quantity ?? 0)
      const currentReserved = Number(current?.reserved_quantity ?? 0)

      let nextQty = currentQty
      let nextReserved = currentReserved
      if (form.movement_kind === 'reserve') nextReserved = currentReserved + qty
      else if (form.movement_kind === 'release_reserve')
        nextReserved = Math.max(0, currentReserved - qty)
      else nextQty = currentQty + direction * qty

      if (nextQty < 0) throw new Error('Estoque insuficiente para esta saída.')
      if (nextReserved > nextQty) throw new Error('Reserva maior que o saldo disponível.')

      if (current) {
        const { error: err } = await supabase
          .from('stock_balances')
          .update({ quantity: nextQty, reserved_quantity: nextReserved })
          .eq('id', current.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('stock_balances').insert({
          tenant_id: ctx.tenant_id,
          branch_id: branchId,
          product_id: form.product_id,
          quantity: nextQty,
          reserved_quantity: nextReserved,
        })
        if (err) throw err
      }

      const { error: movementError } = await supabase.from('stock_movements').insert({
        tenant_id: ctx.tenant_id,
        branch_id: branchId,
        product_id: form.product_id,
        movement_kind: form.movement_kind,
        quantity: qty,
        direction,
        unit_cost: form.unit_cost ? Number(form.unit_cost.replace(',', '.')) : null,
        notes: form.notes || null,
        performed_by: ctx.app_user_id,
      })
      if (movementError) throw movementError
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stock-balances'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-movements-recent'] })
      setOpen(false)
      setForm({
        product_id: '',
        movement_kind: 'purchase_in',
        quantity: '1',
        unit_cost: '',
        notes: '',
      })
    },
    onError: (err) => setError(describeError(err)),
  })

  const rows = useMemo(() => balances.data ?? [], [balances.data])

  const unidades = rows.reduce((total, row) => total + row.quantity, 0)
  const reservadas = rows.reduce((total, row) => total + row.reserved, 0)
  const zerados = rows.filter((row) => row.available <= 0)
  // Só entra no valor o que tem custo cadastrado: somar com zero mentiria
  // sobre o quanto está parado na gaveta.
  const comCusto = rows.filter((row) => row.cost !== null)
  const valor = comCusto.reduce((total, row) => total + row.quantity * (row.cost ?? 0), 0)

  /** Distribuição do saldo por tipo de produto: onde o dinheiro está parado. */
  const porTipo = useMemo(() => {
    const totals = new Map<ProductKind, number>()
    for (const row of rows) {
      totals.set(row.kind, (totals.get(row.kind) ?? 0) + row.quantity)
    }
    return [...totals.entries()]
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([kind, value], index) => ({
        key: kind,
        label: KIND_LABEL[kind],
        value,
        series: index + 1,
      }))
  }, [rows])

  return (
    <>
      <CatalogScreen
        title="Estoque"
        subtitle="Saldo da filial. Reserva e baixa da armação acompanham a venda e a entrega da O.S."
        addLabel="Movimentar"
        onAdd={() => setOpen(true)}
        loading={balances.isLoading}
        rows={rows}
        rowKey={(row) => row.id}
        emptyTitle="Nenhum produto com saldo nesta filial."
        searchPlaceholder="Buscar produto ou SKU…"
        searchText={(row) => [row.name, row.sku, KIND_LABEL[row.kind]].filter(Boolean).join(' ')}
        stats={[
          {
            icon: IconBox,
            tone: 'brand',
            label: 'Itens com saldo',
            value: String(rows.filter((row) => row.quantity > 0).length),
            hint: `${formatNumber(unidades)} unidades na filial`,
          },
          {
            icon: IconClock,
            tone: 'warning',
            label: 'Reservado',
            value: formatNumber(reservadas),
            hint: 'com dono: venda ou O.S. em andamento',
          },
          {
            icon: IconAlert,
            tone: 'danger',
            label: 'Sem disponível',
            value: String(zerados.length),
            hint: 'nada a vender hoje',
          },
          {
            icon: IconCoin,
            tone: 'violet',
            label: 'Valor em estoque',
            value: formatMoney(valor),
            hint:
              comCusto.length === rows.length
                ? 'a preço de custo'
                : `a custo · ${rows.length - comCusto.length} sem custo cadastrado`,
          },
        ]}
        filters={[
          {
            id: 'situacao',
            label: 'Toda situação',
            options: [
              { value: 'disponivel', label: 'Com disponível' },
              { value: 'reservado', label: 'Com reserva' },
              { value: 'zerado', label: 'Sem disponível' },
            ],
            match: (row, value) =>
              value === 'disponivel'
                ? row.available > 0
                : value === 'reservado'
                  ? row.reserved > 0
                  : row.available <= 0,
          },
          {
            id: 'tipo',
            label: 'Todo tipo',
            options: [...new Set(rows.map((row) => row.kind))].map((kind) => ({
              value: kind,
              label: KIND_LABEL[kind],
            })),
            match: (row, value) => row.kind === value,
          },
        ]}
        columns={[
          {
            key: 'product',
            header: 'Produto',
            render: (row) => (
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{row.name}</p>
                <p className="truncate text-xs text-fg-subtle">
                  {row.sku ? `${row.sku} · ` : ''}
                  {KIND_LABEL[row.kind]}
                </p>
              </div>
            ),
          },
          {
            key: 'qty',
            header: 'Saldo',
            className: 'tnum text-right text-fg-muted',
            headerClassName: 'text-right',
            render: (row) => formatNumber(row.quantity),
          },
          {
            key: 'reserved',
            header: 'Reservado',
            className: 'tnum hidden text-right text-fg-muted sm:table-cell',
            headerClassName: 'hidden text-right sm:table-cell',
            render: (row) => (row.reserved > 0 ? formatNumber(row.reserved) : '—'),
          },
          {
            key: 'available',
            header: 'Disponível',
            className: 'tnum text-right',
            headerClassName: 'text-right',
            render: (row) => (
              <span
                className={
                  row.available <= 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'font-medium text-fg'
                }
              >
                {formatNumber(row.available)}
              </span>
            ),
          },
          {
            key: 'value',
            header: 'Custo total',
            className: 'tnum hidden text-right text-fg-muted lg:table-cell',
            headerClassName: 'hidden text-right lg:table-cell',
            render: (row) =>
              row.cost === null ? '—' : formatMoney(row.quantity * row.cost),
          },
          {
            key: 'status',
            header: 'Situação',
            render: (row) =>
              row.available <= 0 ? (
                <Badge tone="danger" dot>
                  Zerado
                </Badge>
              ) : row.reserved > 0 ? (
                <Badge tone="warning" dot>
                  Com reserva
                </Badge>
              ) : (
                <Badge tone="success" dot>
                  Disponível
                </Badge>
              ),
          },
        ]}
        aside={
          <>
            {porTipo.length > 0 && (
              <Card title="Saldo por tipo">
                <Donut
                  slices={porTipo}
                  centerValue={formatNumber(unidades)}
                  centerLabel="unidades"
                  formatValue={formatNumber}
                  layout="column"
                />
              </Card>
            )}

            <Card title="Últimos movimentos">
              <AsideRanking
                items={(recent.data ?? []).map((movement) => ({
                  key: movement.id,
                  rank: movement.direction === -1 ? '−' : movement.direction === 1 ? '+' : '=',
                  title: movement.products?.name ?? 'Produto removido',
                  detail: `${MOVEMENT_LABEL[movement.movement_kind]} · ${formatDateTime(movement.occurred_at)}`,
                  value: formatNumber(Number(movement.quantity)),
                }))}
              />
            </Card>

            {zerados.length > 0 && (
              <Card title="Sem disponível">
                <AsideRanking
                  items={zerados.slice(0, 6).map((row) => ({
                    key: row.id,
                    rank: '!',
                    title: row.name,
                    detail:
                      row.reserved > 0
                        ? `${formatNumber(row.reserved)} reservado(s) de ${formatNumber(row.quantity)}`
                        : 'sem saldo na filial',
                    value: formatNumber(row.available),
                  }))}
                />
              </Card>
            )}

            <AsideTip title="Reservado não é vendido">
              A reserva prende a peça a uma venda ou O.S. em andamento: ela ainda está
              na gaveta, mas já tem dono. Quem vende olhando o saldo, e não o
              disponível, vende duas vezes a mesma armação.
            </AsideTip>
          </>
        }
      />

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <Modal
        open={open}
        title="Movimentar estoque"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => move.mutate()} disabled={move.isPending}>
              {move.isPending ? 'Lançando…' : 'Lançar'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-12 gap-3">
          <Field label="Produto" required className="col-span-12">
            <Select
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            >
              <option value="">—</option>
              {products.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` (${p.sku})` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tipo de movimento" required className="col-span-12 sm:col-span-6">
            <Select
              value={form.movement_kind}
              onChange={(e) =>
                setForm({ ...form, movement_kind: e.target.value as MovementKind })
              }
            >
              {(Object.entries(MOVEMENT_LABEL) as [MovementKind, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </Select>
          </Field>

          <Field label="Quantidade" required className="col-span-12 sm:col-span-3">
            <Input
              className="tnum"
              inputMode="decimal"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </Field>

          <Field label="Custo unitário" className="col-span-12 sm:col-span-3">
            <Input
              className="tnum"
              inputMode="decimal"
              value={form.unit_cost}
              onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
            />
          </Field>

          <Field label="Observação" className="col-span-12">
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </div>

        <div className="mt-4">
          <Alert tone="info">
            Reserva e liberação mexem só no que está prometido; as demais entram e
            saem do saldo. O banco recusa saldo negativo e reserva maior que o saldo.
          </Alert>
        </div>
      </Modal>
    </>
  )
}

// ---------------------------------------------------------------------------

type Movement = {
  id: string
  movement_kind: MovementKind
  quantity: number
  direction: number
  occurred_at: string
  related_entity: string | null
  notes: string | null
  name: string
  sku: string | null
}

export function StockMovementsPage() {
  const branchId = useBranchId()

  const movements = useQuery({
    queryKey: ['stock-movements', branchId],
    queryFn: async (): Promise<Movement[]> => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(
          'id,movement_kind,quantity,direction,occurred_at,related_entity,notes,products(name,sku)',
        )
        .eq('branch_id', branchId)
        .order('occurred_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []).map((row) => ({
        id: row.id,
        movement_kind: row.movement_kind,
        quantity: Number(row.quantity),
        direction: Number(row.direction),
        occurred_at: row.occurred_at,
        related_entity: row.related_entity,
        notes: row.notes,
        name: row.products?.name ?? 'Produto removido',
        sku: row.products?.sku ?? null,
      }))
    },
  })

  const rows = movements.data ?? []
  const entradas = rows.filter((row) => row.direction === 1)
  const saidas = rows.filter((row) => row.direction === -1)
  const reservas = rows.filter((row) => row.direction === 0)

  return (
    <CatalogScreen
      title="Movimentações de estoque"
      subtitle="Cada entrada, saída e reserva com a origem que a gerou. Últimas 200 da filial."
      loading={movements.isLoading}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="Nenhuma movimentação nesta filial."
      searchPlaceholder="Buscar produto, movimento ou observação…"
      searchText={(row) =>
        [row.name, row.sku, MOVEMENT_LABEL[row.movement_kind], row.notes]
          .filter(Boolean)
          .join(' ')
      }
      stats={[
        {
          icon: IconLayers,
          tone: 'brand',
          label: 'Movimentos',
          value: String(rows.length),
          hint: 'no histórico recente',
        },
        {
          icon: IconArrowUp,
          tone: 'success',
          label: 'Entradas',
          value: formatNumber(entradas.reduce((total, row) => total + row.quantity, 0)),
          hint: `${entradas.length} lançamento${entradas.length === 1 ? '' : 's'}`,
        },
        {
          icon: IconArrowDown,
          tone: 'danger',
          label: 'Saídas',
          value: formatNumber(saidas.reduce((total, row) => total + row.quantity, 0)),
          hint: `${saidas.length} lançamento${saidas.length === 1 ? '' : 's'}`,
        },
        {
          icon: IconClock,
          tone: 'warning',
          label: 'Reservas',
          value: String(reservas.length),
          hint: 'reservas e liberações',
        },
      ]}
      filters={[
        {
          id: 'direcao',
          label: 'Todo sentido',
          options: [
            { value: 'in', label: 'Entradas' },
            { value: 'out', label: 'Saídas' },
            { value: 'hold', label: 'Reservas' },
          ],
          match: (row, value) =>
            value === 'in' ? row.direction === 1 : value === 'out' ? row.direction === -1 : row.direction === 0,
        },
        {
          id: 'origem',
          label: 'Toda origem',
          options: [
            { value: 'manual', label: 'Manual' },
            { value: 'service_orders', label: 'Ordem de serviço' },
            { value: 'sales', label: 'Venda' },
          ],
          match: (row, value) =>
            value === 'manual' ? !row.related_entity : row.related_entity === value,
        },
      ]}
      columns={[
        {
          key: 'when',
          header: 'Quando',
          className: 'whitespace-nowrap text-fg-muted',
          render: (row) => formatDateTime(row.occurred_at),
        },
        {
          key: 'product',
          header: 'Produto',
          render: (row) => (
            <div className="min-w-0">
              <p className="truncate font-medium text-fg">{row.name}</p>
              {row.sku && <p className="truncate text-xs text-fg-subtle">{row.sku}</p>}
            </div>
          ),
        },
        {
          key: 'kind',
          header: 'Movimento',
          render: (row) => (
            <Badge
              tone={row.direction === 1 ? 'success' : row.direction === -1 ? 'danger' : 'neutral'}
            >
              {MOVEMENT_LABEL[row.movement_kind]}
            </Badge>
          ),
        },
        {
          key: 'qty',
          header: 'Qtd.',
          className: 'tnum text-right font-medium text-fg',
          headerClassName: 'text-right',
          render: (row) =>
            `${row.direction === -1 ? '−' : row.direction === 1 ? '+' : ''}${formatNumber(row.quantity)}`,
        },
        {
          key: 'origin',
          header: 'Origem',
          className: 'hidden text-fg-muted lg:table-cell',
          headerClassName: 'hidden lg:table-cell',
          render: (row) => ORIGIN_LABEL[row.related_entity ?? 'manual'] ?? row.related_entity,
        },
        {
          key: 'notes',
          header: 'Observação',
          className: 'hidden max-w-48 truncate text-fg-subtle xl:table-cell',
          headerClassName: 'hidden xl:table-cell',
          render: (row) => row.notes ?? '—',
        },
      ]}
      aside={
        <AsideTip title="O histórico não se corrige: se acrescenta">
          Um lançamento errado é consertado por outro, em sentido contrário — nunca
          apagando o primeiro. É o que permite explicar, meses depois, por que o saldo
          é o que é.
        </AsideTip>
      }
    />
  )
}

const ORIGIN_LABEL: Record<string, string> = {
  manual: 'Manual',
  service_orders: 'Ordem de serviço',
  sales: 'Venda',
  sale_items: 'Venda',
  lab_orders: 'Laboratório',
}

/** Quantidade sem casas quando é inteira — quase sempre é. */
const formatNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',')
