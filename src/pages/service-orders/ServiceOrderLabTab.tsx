import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppContext, useBranchId } from '@/auth/SessionProvider'
import { DataTable } from '@/components/DataTable'
import { Alert, Badge, Button, Card, Field, Input, Select } from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/Spinner'
import { describeError } from '@/lib/errors'
import { formatDate, formatMoney } from '@/lib/format'

const LAB_STATUS: Record<string, { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' }> = {
  draft: { label: 'Rascunho', tone: 'neutral' },
  sent: { label: 'Enviado', tone: 'info' },
  acknowledged: { label: 'Confirmado', tone: 'info' },
  in_production: { label: 'Em produção', tone: 'info' },
  shipped: { label: 'Despachado', tone: 'info' },
  received: { label: 'Recebido', tone: 'success' },
  rejected: { label: 'Recusado', tone: 'danger' },
  cancelled: { label: 'Cancelado', tone: 'danger' },
}

export function ServiceOrderLabTab({
  serviceOrderId,
  tenantId,
}: {
  serviceOrderId: string
  tenantId: string
}) {
  const ctx = useAppContext()
  const branchId = useBranchId()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [laboratoryId, setLaboratoryId] = useState('')
  const [externalNumber, setExternalNumber] = useState('')
  const [cost, setCost] = useState('')

  const orders = useQuery({
    queryKey: ['so-lab-orders', serviceOrderId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('lab_orders')
        .select('*, laboratories(trade_name), lab_order_items(*)')
        .eq('service_order_id', serviceOrderId)
        .order('created_at', { ascending: false })
      if (err) throw err
      return data ?? []
    },
  })

  const specs = useQuery({
    queryKey: ['so-lens-specs-lab', serviceOrderId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('service_order_lens_specs')
        .select('id, eye, laboratory_id, supply_mode, unit_cost')
        .eq('service_order_id', serviceOrderId)
      if (err) throw err
      return data ?? []
    },
  })

  const labs = useQuery({
    queryKey: ['labs', tenantId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('laboratories')
        .select('id, trade_name, default_lead_days')
        .eq('is_active', true)
        .order('trade_name')
      if (err) throw err
      return data ?? []
    },
  })

  const send = useMutation({
    mutationFn: async () => {
      setError(null)
      if (!laboratoryId) throw new Error('Escolha o laboratório.')

      const surfaced = (specs.data ?? []).filter((s) => s.supply_mode === 'surfaced')
      if (surfaced.length === 0) {
        throw new Error(
          'Nenhuma lente surfaçada nesta O.S. Lentes prontas de estoque não vão ao laboratório.',
        )
      }

      const lab = labs.data?.find((l) => l.id === laboratoryId)
      const expected = new Date()
      expected.setDate(expected.getDate() + (lab?.default_lead_days ?? 5))

      const { data: number, error: numberError } = await supabase.rpc(
        'next_document_number',
        { p_branch_id: branchId, p_document_type: 'lab_order' },
      )
      if (numberError) throw numberError

      const { data: labOrder, error: labError } = await supabase
        .from('lab_orders')
        .insert({
          tenant_id: tenantId,
          branch_id: branchId,
          service_order_id: serviceOrderId,
          laboratory_id: laboratoryId,
          number,
          external_number: externalNumber || null,
          status: 'sent',
          sent_at: new Date().toISOString(),
          expected_at: expected.toISOString(),
          total_cost: cost ? Number(cost.replace(',', '.')) : null,
          created_by: ctx.app_user_id,
        })
        .select('id')
        .single()
      if (labError) throw labError

      const items = surfaced.map((spec) => ({
        lab_order_id: labOrder.id,
        lens_spec_id: spec.id,
        eye: spec.eye,
        cost: spec.unit_cost,
      }))
      const { error: itemsError } = await supabase.from('lab_order_items').insert(items)
      if (itemsError) throw itemsError
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['so-lab-orders', serviceOrderId] })
      setLaboratoryId('')
      setExternalNumber('')
      setCost('')
    },
    onError: (err) => setError(describeError(err)),
  })

  const receive = useMutation({
    mutationFn: async (labOrderId: string) => {
      setError(null)
      const { error: err } = await supabase
        .from('lab_orders')
        .update({ status: 'received', received_at: new Date().toISOString() })
        .eq('id', labOrderId)
      if (err) throw err
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['so-lab-orders', serviceOrderId] }),
    onError: (err) => setError(describeError(err)),
  })

  if (orders.isLoading || specs.isLoading) return <Spinner />

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <Card title="Enviar ao laboratório">
        <div className="grid grid-cols-12 gap-3">
          <Field label="Laboratório" required className="col-span-12 sm:col-span-5">
            <Select value={laboratoryId} onChange={(e) => setLaboratoryId(e.target.value)}>
              <option value="">—</option>
              {labs.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.trade_name} ({l.default_lead_days} dias)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Número no laboratório" className="col-span-12 sm:col-span-4">
            <Input
              value={externalNumber}
              onChange={(e) => setExternalNumber(e.target.value)}
            />
          </Field>
          <Field label="Custo total" className="col-span-12 sm:col-span-3">
            <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3">
          <Button onClick={() => send.mutate()} disabled={send.isPending}>
            {send.isPending ? 'Enviando…' : 'Gerar pedido'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          O pedido leva as lentes surfaçadas desta O.S. — {specs.data?.filter((s) => s.supply_mode === 'surfaced').length ?? 0} de{' '}
          {specs.data?.length ?? 0} especificadas.
        </p>
      </Card>

      <Card title="Pedidos" bodyClassName="p-0">
        <DataTable
          rows={orders.data}
          rowKey={(row) => row.id}
          emptyTitle="Nenhum pedido ao laboratório"
          columns={[
            { key: 'number', header: 'Pedido', render: (r) => `#${r.number}` },
            { key: 'lab', header: 'Laboratório', render: (r) => r.laboratories?.trade_name ?? '—' },
            { key: 'external', header: 'Nº no lab', render: (r) => r.external_number ?? '—' },
            {
              key: 'status',
              header: 'Situação',
              render: (r) => {
                const info = LAB_STATUS[r.status] ?? { label: r.status, tone: 'neutral' as const }
                return <Badge tone={info.tone}>{info.label}</Badge>
              },
            },
            { key: 'sent', header: 'Enviado', render: (r) => formatDate(r.sent_at) },
            { key: 'expected', header: 'Previsto', render: (r) => formatDate(r.expected_at) },
            {
              key: 'cost',
              header: 'Custo',
              numeric: true,
              render: (r) => (r.total_cost === null ? '—' : formatMoney(Number(r.total_cost))),
            },
            {
              key: 'actions',
              header: '',
              numeric: true,
              render: (r) =>
                r.status !== 'received' && r.status !== 'cancelled' ? (
                  <Button variant="secondary" size="sm" onClick={() => receive.mutate(r.id)}>
                    Receber
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>
    </div>
  )
}
