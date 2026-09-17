import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAppContext, useBranchId } from '@/auth/SessionProvider'
import { Tabs, TabPanel } from '@/components/ui/Tabs'
import { Alert, Badge, Card, PageHeader, Select } from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/Spinner'
import { describeError } from '@/lib/errors'
import { formatDate, formatDateTime, formatDiopter, formatMm } from '@/lib/format'
import { ServiceOrderFittingTab } from './ServiceOrderFittingTab'
import { ServiceOrderLensTab } from './ServiceOrderLensTab'
import { ServiceOrderLabTab } from './ServiceOrderLabTab'

export function ServiceOrderDetailPage() {
  const { id = '' } = useParams()
  const ctx = useAppContext()
  const branchId = useBranchId()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('receita')
  const [error, setError] = useState<string | null>(null)

  const order = useQuery({
    queryKey: ['service-order', id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('v_service_order_production')
        .select('*')
        .eq('service_order_id', id)
        .single()
      if (err) throw err
      return data
    },
  })

  const raw = useQuery({
    queryKey: ['service-order-raw', id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('service_orders')
        .select('*')
        .eq('id', id)
        .single()
      if (err) throw err
      return data
    },
  })

  /** Só os próximos estados permitidos — a máquina de estados é dado (ADR-010). */
  const transitions = useQuery({
    queryKey: ['so-transitions', raw.data?.status_id],
    enabled: Boolean(raw.data?.status_id),
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('service_order_status_transitions')
        .select('to_status_id, service_order_statuses!service_order_status_transitions_to_status_id_fkey(id, code, label, stage)')
        .eq('from_status_id', raw.data!.status_id)
      if (err) throw err
      return data ?? []
    },
  })

  const changeStatus = useMutation({
    mutationFn: async (statusId: string) => {
      setError(null)
      const { data: target, error: statusError } = await supabase
        .from('service_order_statuses')
        .select('stage, notifies_customer, label')
        .eq('id', statusId)
        .single()
      if (statusError) throw statusError

      const { error: err } = await supabase
        .from('service_orders')
        .update(
          target.stage === 'delivered'
            ? { status_id: statusId, delivered_at: new Date().toISOString() }
            : { status_id: statusId },
        )
        .eq('id', id)
      if (err) throw err

      // Entrega: libera a reserva e baixa o estoque da armação.
      if (target.stage === 'delivered' && raw.data?.frame_product_id) {
        const { data: balance } = await supabase
          .from('stock_balances')
          .select('id, quantity, reserved_quantity')
          .eq('branch_id', branchId)
          .eq('product_id', raw.data.frame_product_id)
          .maybeSingle()

        if (balance) {
          await supabase
            .from('stock_balances')
            .update({
              quantity: Number(balance.quantity) - 1,
              reserved_quantity: Math.max(0, Number(balance.reserved_quantity) - 1),
            })
            .eq('id', balance.id)

          await supabase.from('stock_movements').insert({
            tenant_id: ctx.tenant_id,
            branch_id: branchId,
            product_id: raw.data.frame_product_id,
            movement_kind: 'sale_out',
            quantity: 1,
            direction: -1,
            related_entity: 'service_orders',
            related_entity_id: id,
            performed_by: ctx.app_user_id,
          })
        }
      }

      // Situação marcada para avisar o cliente registra a comunicação.
      if (target.notifies_customer && raw.data?.customer_id) {
        await supabase.from('customer_communications').insert({
          customer_id: raw.data.customer_id,
          tenant_id: ctx.tenant_id,
          branch_id: branchId,
          channel: 'whatsapp',
          direction: 'outbound',
          subject: 'Óculos pronto',
          body: `Sua O.S. #${order.data?.number} está ${target.label.toLowerCase()}.`,
          related_entity: 'service_orders',
          related_entity_id: id,
          created_by: ctx.app_user_id,
        })
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['service-order', id] })
      void queryClient.invalidateQueries({ queryKey: ['service-order-raw', id] })
      void queryClient.invalidateQueries({ queryKey: ['so-history', id] })
    },
    onError: (err) => setError(describeError(err)),
  })

  const history = useQuery({
    queryKey: ['so-history', id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('service_order_status_history')
        .select('*, service_order_statuses!service_order_status_history_to_status_id_fkey(label)')
        .eq('service_order_id', id)
        .order('changed_at', { ascending: false })
      if (err) throw err
      return data ?? []
    },
  })

  if (order.isLoading || raw.isLoading) return <Spinner />
  if (!order.data || !raw.data) return <Alert>Ordem de serviço não encontrada.</Alert>

  const o = order.data
  const isDraft = o.status_stage === 'draft'

  return (
    <>
      <PageHeader
        title={`O.S. #${o.number}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={o.status_stage === 'delivered' ? 'success' : 'info'}>
              {o.status_code}
            </Badge>
            <Link to={`/clientes/${o.customer_id}`} className="text-brand-700 hover:underline">
              {o.customer_name}
            </Link>
            <span className="text-slate-400">·</span>
            <span>aberta em {formatDate(o.opened_at)}</span>
            {o.promised_at && <span>· prometida {formatDate(o.promised_at)}</span>}
          </span>
        }
        actions={
          transitions.data && transitions.data.length > 0 ? (
            <Select
              className="w-56"
              value=""
              onChange={(e) => e.target.value && changeStatus.mutate(e.target.value)}
              disabled={changeStatus.isPending}
            >
              <option value="">Mudar situação…</option>
              {transitions.data.map((t) => (
                <option key={t.to_status_id} value={t.to_status_id}>
                  {t.service_order_statuses?.label ?? t.to_status_id}
                </option>
              ))}
            </Select>
          ) : null
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {!isDraft && (
        <div className="mb-4">
          <Alert tone="info">
            A produção já começou: a receita utilizada está congelada. Alterações de
            grau exigem uma nova O.S. ou um retrabalho.
          </Alert>
        </div>
      )}

      <Card bodyClassName="px-4 pt-0 pb-4">
        <Tabs
          active={tab}
          onChange={setTab}
          items={[
            { id: 'receita', label: 'Receita utilizada' },
            { id: 'montagem', label: 'Medidas de montagem' },
            { id: 'lente', label: 'Lente' },
            { id: 'laboratorio', label: 'Laboratório' },
            { id: 'historico', label: 'Histórico' },
          ]}
        />

        <TabPanel>
          {tab === 'receita' && (
            <div className="space-y-3">
              <div className="table-scroll">
                <table className="w-full min-w-max text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                      <th className="px-3 py-2">Olho</th>
                      <th className="px-3 py-2">Esférico</th>
                      <th className="px-3 py-2">Cilíndrico</th>
                      <th className="px-3 py-2">Eixo</th>
                      <th className="px-3 py-2">Adição</th>
                      <th className="px-3 py-2">DNP prescrita</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-3 py-2 font-medium">OD</td>
                      <td className="px-3 py-2 tabular-nums">{formatDiopter(o.od_sphere_used)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatDiopter(o.od_cylinder_used)}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {o.od_axis_used !== null ? `${o.od_axis_used}°` : '—'}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatDiopter(o.od_addition_used)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatMm(o.od_dnp_prescribed)}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium">OE</td>
                      <td className="px-3 py-2 tabular-nums">{formatDiopter(o.os_sphere_used)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatDiopter(o.os_cylinder_used)}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {o.os_axis_used !== null ? `${o.os_axis_used}°` : '—'}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatDiopter(o.os_addition_used)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatMm(o.os_dnp_prescribed)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Cópia congelada da receita de {formatDate(o.prescription_issued_at)}
                {o.prescriber_name ? `, emitida por ${o.prescriber_name}` : ''}
                {o.source_revision ? ` (versão ${o.source_revision})` : ''}.{' '}
                {o.source_prescription_id && (
                  <Link
                    to={`/optica/receitas/${o.source_prescription_id}`}
                    className="text-brand-700 hover:underline"
                  >
                    Ver a receita de origem
                  </Link>
                )}
                . Se o cliente cadastrar uma receita nova, estes valores não mudam.
              </div>
            </div>
          )}

          {tab === 'montagem' && (
            <ServiceOrderFittingTab serviceOrderId={id} tenantId={raw.data.tenant_id} />
          )}
          {tab === 'lente' && (
            <ServiceOrderLensTab
              serviceOrderId={id}
              tenantId={raw.data.tenant_id}
              saleId={raw.data.sale_id}
            />
          )}
          {tab === 'laboratorio' && (
            <ServiceOrderLabTab serviceOrderId={id} tenantId={raw.data.tenant_id} />
          )}

          {tab === 'historico' && (
            <ul className="space-y-2 text-sm">
              {history.data?.map((h) => (
                <li key={h.id} className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                  <span className="text-slate-700">
                    {h.service_order_statuses?.label ?? '—'}
                  </span>
                  <span className="text-xs text-slate-500">{formatDateTime(h.changed_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>
      </Card>
    </>
  )
}
