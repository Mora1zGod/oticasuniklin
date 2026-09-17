import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppContext, useBranchId } from '@/auth/SessionProvider'
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
import { formatDateTime } from '@/lib/format'
import type { Row } from '@/lib/db'

type MovementKind = Row<'stock_movements'>['movement_kind']

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

export function StockBalancesPage() {
  const ctx = useAppContext()
  const branchId = useBranchId()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
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
    queryKey: ['stock-balances', branchId, search],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('stock_balances')
        .select('*, products(name, sku, product_kind)')
        .eq('branch_id', branchId)
      if (err) throw err
      const rows = data ?? []
      if (!search.trim()) return rows
      const term = search.trim().toLowerCase()
      return rows.filter((r) => r.products?.name?.toLowerCase().includes(term))
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
      setOpen(false)
      setForm({ product_id: '', movement_kind: 'purchase_in', quantity: '1', unit_cost: '', notes: '' })
    },
    onError: (err) => setError(describeError(err)),
  })

  return (
    <>
      <PageHeader
        title="Estoque"
        subtitle="Saldo por filial. Reserva e baixa da armação acompanham a venda e a entrega da O.S."
        actions={<Button onClick={() => setOpen(true)}>Movimentar estoque</Button>}
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <Card
        bodyClassName="p-0"
        title={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto…"
            className="w-64"
          />
        }
      >
        <DataTable
          rows={balances.data}
          loading={balances.isLoading}
          rowKey={(row) => row.id}
          emptyTitle="Nenhum produto com saldo nesta filial"
          columns={[
            { key: 'product', header: 'Produto', render: (r) => r.products?.name ?? '—' },
            { key: 'sku', header: 'SKU', render: (r) => r.products?.sku ?? '—' },
            {
              key: 'qty',
              header: 'Saldo',
              numeric: true,
              render: (r) => Number(r.quantity).toFixed(0),
            },
            {
              key: 'reserved',
              header: 'Reservado',
              numeric: true,
              render: (r) => Number(r.reserved_quantity).toFixed(0),
            },
            {
              key: 'available',
              header: 'Disponível',
              numeric: true,
              render: (r) => {
                const available = Number(r.quantity) - Number(r.reserved_quantity)
                return (
                  <span className={available <= 0 ? 'font-medium text-red-600' : ''}>
                    {available.toFixed(0)}
                  </span>
                )
              },
            },
          ]}
        />
      </Card>

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
              Lançar
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
              {(Object.entries(MOVEMENT_LABEL) as [MovementKind, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Quantidade" required className="col-span-12 sm:col-span-3">
            <Input
              inputMode="decimal"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </Field>

          <Field label="Custo unitário" className="col-span-12 sm:col-span-3">
            <Input
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
      </Modal>
    </>
  )
}

export function StockMovementsPage() {
  const branchId = useBranchId()

  const movements = useQuery({
    queryKey: ['stock-movements', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*, products(name, sku)')
        .eq('branch_id', branchId)
        .order('occurred_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data ?? []
    },
  })

  return (
    <>
      <PageHeader
        title="Movimentações de estoque"
        subtitle="Cada entrada, saída e reserva com a origem que a gerou."
      />
      <Card bodyClassName="p-0">
        <DataTable
          rows={movements.data}
          loading={movements.isLoading}
          rowKey={(row) => row.id}
          emptyTitle="Nenhuma movimentação"
          columns={[
            { key: 'when', header: 'Quando', render: (r) => formatDateTime(r.occurred_at) },
            { key: 'product', header: 'Produto', render: (r) => r.products?.name ?? '—' },
            {
              key: 'kind',
              header: 'Movimento',
              render: (r) => (
                <Badge
                  tone={r.direction === 1 ? 'success' : r.direction === -1 ? 'danger' : 'neutral'}
                >
                  {MOVEMENT_LABEL[r.movement_kind] ?? r.movement_kind}
                </Badge>
              ),
            },
            {
              key: 'qty',
              header: 'Qtd.',
              numeric: true,
              render: (r) =>
                `${r.direction === -1 ? '−' : r.direction === 1 ? '+' : ''}${Number(r.quantity).toFixed(0)}`,
            },
            {
              key: 'origin',
              header: 'Origem',
              render: (r) =>
                r.related_entity === 'service_orders'
                  ? 'Ordem de serviço'
                  : (r.related_entity ?? 'manual'),
            },
            { key: 'notes', header: 'Observação', render: (r) => r.notes ?? '—' },
          ]}
        />
      </Card>
    </>
  )
}
