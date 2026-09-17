import { useState } from 'react'
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
import { formatDate, formatDiopter } from '@/lib/format'

/**
 * Abertura de O.S. O passo decisivo é o SNAPSHOT: `take_prescription_snapshot`
 * copia a receita para dentro da O.S. (ADR-002). Daqui em diante a O.S. lê a
 * própria cópia — uma R2 futura não altera esta produção.
 */
export function ServiceOrderFormPage() {
  const ctx = useAppContext()
  const branchId = useBranchId()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const saleId = params.get('venda')
  const [customerId, setCustomerId] = useState(params.get('cliente') ?? '')
  const [prescriptionId, setPrescriptionId] = useState('')
  const [frameSource, setFrameSource] = useState<
    'store_stock' | 'customer_own' | 'supplier_direct'
  >('store_stock')
  const [frameProductId, setFrameProductId] = useState('')
  const [frameDescription, setFrameDescription] = useState('')
  const [promisedAt, setPromisedAt] = useState('')
  const [error, setError] = useState<string | null>(null)

  /** Vindo de uma venda, o cliente e a armação já estão definidos. */
  const sale = useQuery({
    queryKey: ['so-sale', saleId],
    enabled: Boolean(saleId),
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('id', saleId!)
        .single()
      if (err) throw err
      if (data.customer_id) setCustomerId(data.customer_id)
      const frameItem = data.sale_items.find((i) => i.stock_branch_id !== null)
      if (frameItem?.product_id) setFrameProductId(frameItem.product_id)
      return data
    },
  })

  const prescriptions = useQuery({
    queryKey: ['so-prescriptions', customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('v_customer_prescriptions')
        .select('*')
        .eq('customer_id', customerId)
        .in('status', ['active', 'superseded'])
        .order('issued_at', { ascending: false })
      if (err) throw err
      const rows = data ?? []
      const current = rows.find((r) => r.status === 'active')
      if (current && !prescriptionId) setPrescriptionId(String(current.id))
      return rows
    },
  })

  const frames = useQuery({
    queryKey: ['so-frames', ctx.tenant_id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('products')
        .select('id, name, sku')
        .in('product_kind', ['frame', 'sunglass'])
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name')
      if (err) throw err
      return data ?? []
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      setError(null)
      if (!customerId) throw new Error('Escolha o cliente.')
      if (!prescriptionId) throw new Error('Escolha a receita que será usada.')
      if (frameSource === 'store_stock' && !frameProductId) {
        throw new Error('Escolha a armação do estoque.')
      }

      const { data: initialStatus, error: statusError } = await supabase
        .from('service_order_statuses')
        .select('id')
        .eq('is_initial', true)
        .single()
      if (statusError) throw statusError

      const { data: number, error: numberError } = await supabase.rpc(
        'next_document_number',
        { p_branch_id: branchId, p_document_type: 'service_order' },
      )
      if (numberError) throw numberError

      const frameItem = sale.data?.sale_items.find(
        (i) => i.product_id === frameProductId,
      )

      const { data: order, error: orderError } = await supabase
        .from('service_orders')
        .insert({
          tenant_id: ctx.tenant_id,
          branch_id: branchId,
          number,
          customer_id: customerId,
          sale_id: saleId,
          status_id: initialStatus.id,
          frame_source: frameSource,
          frame_product_id: frameSource === 'store_stock' ? frameProductId : null,
          frame_sale_item_id: frameItem?.id ?? null,
          frame_description: frameSource === 'store_stock' ? null : frameDescription || null,
          promised_at: promisedAt ? new Date(promisedAt).toISOString() : null,
          created_by: ctx.app_user_id,
        })
        .select('id')
        .single()
      if (orderError) throw orderError

      // SNAPSHOT — a partir daqui a O.S. é autossuficiente (ADR-002).
      const { error: snapshotError } = await supabase.rpc('take_prescription_snapshot', {
        p_service_order_id: order.id,
        p_prescription_id: prescriptionId,
        p_created_by: ctx.app_user_id,
      })
      if (snapshotError) throw snapshotError

      // Reserva da armação do estoque da filial.
      if (frameSource === 'store_stock' && frameProductId) {
        const { data: balance } = await supabase
          .from('stock_balances')
          .select('id, quantity, reserved_quantity')
          .eq('branch_id', branchId)
          .eq('product_id', frameProductId)
          .maybeSingle()

        if (balance) {
          await supabase
            .from('stock_balances')
            .update({ reserved_quantity: Number(balance.reserved_quantity) + 1 })
            .eq('id', balance.id)

          await supabase.from('stock_movements').insert({
            tenant_id: ctx.tenant_id,
            branch_id: branchId,
            product_id: frameProductId,
            movement_kind: 'reserve',
            quantity: 1,
            direction: 0,
            related_entity: 'service_orders',
            related_entity_id: order.id,
            performed_by: ctx.app_user_id,
          })
        }
      }

      return order.id
    },
    onSuccess: (id) => navigate(`/ordens-de-servico/${id}`),
    onError: (err) => setError(describeError(err)),
  })

  const chosen = prescriptions.data?.find((p) => String(p.id) === prescriptionId)

  return (
    <>
      <PageHeader
        title="Nova ordem de serviço"
        subtitle={saleId ? `A partir da venda #${sale.data?.number ?? ''}` : undefined}
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="space-y-4">
        <Card title="Cliente e receita">
          <div className="grid grid-cols-12 gap-3">
            <Field label="Cliente" required className="col-span-12 sm:col-span-6">
              <CustomerPicker
                value={customerId}
                onChange={setCustomerId}
                disabled={Boolean(saleId)}
              />
            </Field>

            <Field
              label="Receita a usar"
              required
              className="col-span-12 sm:col-span-6"
              hint="A O.S. guarda uma cópia congelada desta receita."
            >
              <Select
                value={prescriptionId}
                onChange={(e) => setPrescriptionId(e.target.value)}
              >
                <option value="">—</option>
                {prescriptions.data?.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {formatDate(p.issued_at)} · v{p.revision}
                    {p.status === 'active' ? ' (vigente)' : ' (anterior)'}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {chosen && (
            <div className="mt-3 rounded-md bg-surface-sunken px-3 py-2 text-sm">
              <p className="mb-1 text-xs font-medium text-slate-500 uppercase">
                Grau que será congelado nesta O.S.
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 tabular-nums">
                <span>
                  <strong>OD</strong> {formatDiopter(chosen.od_sphere)}{' '}
                  {formatDiopter(chosen.od_cylinder)} {chosen.od_axis ?? '—'}°
                  {chosen.od_addition ? ` add ${formatDiopter(chosen.od_addition)}` : ''}
                </span>
                <span>
                  <strong>OE</strong> {formatDiopter(chosen.os_sphere)}{' '}
                  {formatDiopter(chosen.os_cylinder)} {chosen.os_axis ?? '—'}°
                  {chosen.os_addition ? ` add ${formatDiopter(chosen.os_addition)}` : ''}
                </span>
                {chosen.status !== 'active' && (
                  <Badge tone="warning">usando uma receita anterior</Badge>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card title="Armação">
          <div className="grid grid-cols-12 gap-3">
            <Field label="Origem" required className="col-span-12 sm:col-span-4">
              <Select
                value={frameSource}
                onChange={(e) => setFrameSource(e.target.value as typeof frameSource)}
              >
                <option value="store_stock">Do estoque da loja</option>
                <option value="customer_own">Do cliente</option>
                <option value="supplier_direct">Direto do fornecedor</option>
              </Select>
            </Field>

            {frameSource === 'store_stock' ? (
              <Field label="Armação" required className="col-span-12 sm:col-span-8">
                <Select
                  value={frameProductId}
                  onChange={(e) => setFrameProductId(e.target.value)}
                >
                  <option value="">—</option>
                  {frames.data?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                      {f.sku ? ` (${f.sku})` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Descrição da armação" className="col-span-12 sm:col-span-8">
                <Input
                  value={frameDescription}
                  onChange={(e) => setFrameDescription(e.target.value)}
                  placeholder="Marca, modelo, cor, estado"
                />
              </Field>
            )}

            <Field label="Prometida para" className="col-span-12 sm:col-span-4">
              <Input
                type="date"
                value={promisedAt}
                onChange={(e) => setPromisedAt(e.target.value)}
              />
            </Field>
          </div>

          {frameSource === 'store_stock' && (
            <p className="mt-2 text-xs text-slate-500">
              A armação fica reservada ao abrir a O.S. e a baixa acontece na entrega.
            </p>
          )}
        </Card>

        <div className="flex gap-2">
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? 'Abrindo…' : 'Abrir O.S. e congelar receita'}
          </Button>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
        </div>
      </div>
    </>
  )
}
