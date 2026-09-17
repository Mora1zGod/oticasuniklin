import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppContext } from '@/auth/SessionProvider'
import { Alert, Button, Card, Field, Input, Select } from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/Spinner'
import { describeError } from '@/lib/errors'

const num = (v: string): number | null => {
  const clean = v.trim().replace(',', '.')
  if (clean === '') return null
  const n = Number(clean)
  return Number.isFinite(n) ? n : null
}

/**
 * Medidas de montagem (ADR-007). A DNP aqui é OUTRA medida, não a da receita:
 * é aferida contra a armação escolhida, na postura de uso. O DP total é medida
 * de montagem/legado — em face assimétrica ele não equivale à soma das DNPs.
 */
export function ServiceOrderFittingTab({
  serviceOrderId,
  tenantId,
}: {
  serviceOrderId: string
  tenantId: string
}) {
  const ctx = useAppContext()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    dp_total_mm: '',
    dp_source: 'measured' as 'measured' | 'derived_from_dnp' | 'from_prescription',
    frame_lens_width_mm: '',
    frame_bridge_mm: '',
    frame_vertical_box_mm: '',
    vertex_distance_mm: '',
    pantoscopic_tilt_deg: '',
    measurement_method: 'manual' as 'manual' | 'pupilometer' | 'digital_photo' | 'app',
    od_dnp: '',
    od_height: '',
    os_dnp: '',
    os_height: '',
  })

  const fitting = useQuery({
    queryKey: ['so-fitting', serviceOrderId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('service_order_fittings')
        .select('*, service_order_fitting_measures(*)')
        .eq('service_order_id', serviceOrderId)
        .maybeSingle()
      if (err) throw err
      return data
    },
  })

  /** Sugere as medidas da armação do catálogo quando ainda não há montagem. */
  const frameAttributes = useQuery({
    queryKey: ['so-frame-attributes', serviceOrderId],
    enabled: !fitting.data,
    queryFn: async () => {
      const { data: order, error: orderError } = await supabase
        .from('service_orders')
        .select('frame_product_id')
        .eq('id', serviceOrderId)
        .single()
      if (orderError) throw orderError
      if (!order.frame_product_id) return null

      const { data, error: err } = await supabase
        .from('frame_attributes')
        .select('*')
        .eq('product_id', order.frame_product_id)
        .maybeSingle()
      if (err) throw err
      return data
    },
  })

  useEffect(() => {
    const f = fitting.data
    if (f) {
      const od = f.service_order_fitting_measures.find((m) => m.eye === 'OD')
      const os = f.service_order_fitting_measures.find((m) => m.eye === 'OS')
      setForm({
        dp_total_mm: f.dp_total_mm?.toString() ?? '',
        dp_source: f.dp_source,
        frame_lens_width_mm: f.frame_lens_width_mm?.toString() ?? '',
        frame_bridge_mm: f.frame_bridge_mm?.toString() ?? '',
        frame_vertical_box_mm: f.frame_vertical_box_mm?.toString() ?? '',
        vertex_distance_mm: f.vertex_distance_mm?.toString() ?? '',
        pantoscopic_tilt_deg: f.pantoscopic_tilt_deg?.toString() ?? '',
        measurement_method: f.measurement_method,
        od_dnp: od?.dnp_mm?.toString() ?? '',
        od_height: od?.fitting_height_mm?.toString() ?? '',
        os_dnp: os?.dnp_mm?.toString() ?? '',
        os_height: os?.fitting_height_mm?.toString() ?? '',
      })
      return
    }
    const attrs = frameAttributes.data
    if (attrs) {
      setForm((prev) => ({
        ...prev,
        frame_lens_width_mm: attrs.lens_width_mm?.toString() ?? '',
        frame_bridge_mm: attrs.bridge_mm?.toString() ?? '',
        frame_vertical_box_mm: attrs.vertical_box_mm?.toString() ?? '',
      }))
    }
  }, [fitting.data, frameAttributes.data])

  const save = useMutation({
    mutationFn: async () => {
      setError(null)
      const odDnp = num(form.od_dnp)
      const osDnp = num(form.os_dnp)
      if (odDnp === null || osDnp === null) {
        throw new Error('Informe a DNP de montagem dos dois olhos.')
      }

      const payload = {
        service_order_id: serviceOrderId,
        tenant_id: tenantId,
        dp_total_mm: num(form.dp_total_mm),
        dp_source: form.dp_source,
        frame_lens_width_mm: num(form.frame_lens_width_mm),
        frame_bridge_mm: num(form.frame_bridge_mm),
        frame_vertical_box_mm: num(form.frame_vertical_box_mm),
        vertex_distance_mm: num(form.vertex_distance_mm),
        pantoscopic_tilt_deg: num(form.pantoscopic_tilt_deg),
        measurement_method: form.measurement_method,
        measured_by: ctx.app_user_id,
      }

      const { data: upserted, error: err } = await supabase
        .from('service_order_fittings')
        .upsert(payload, { onConflict: 'service_order_id' })
        .select('id')
        .single()
      if (err) throw err

      const measures = [
        {
          service_order_fitting_id: upserted.id,
          eye: 'OD' as const,
          dnp_mm: odDnp,
          fitting_height_mm: num(form.od_height),
        },
        {
          service_order_fitting_id: upserted.id,
          eye: 'OS' as const,
          dnp_mm: osDnp,
          fitting_height_mm: num(form.os_height),
        },
      ]

      const { error: measuresError } = await supabase
        .from('service_order_fitting_measures')
        .upsert(measures, { onConflict: 'service_order_fitting_id,eye' })
      if (measuresError) throw measuresError
    },
    onSuccess: () => {
      setSaved(true)
      void queryClient.invalidateQueries({ queryKey: ['so-fitting', serviceOrderId] })
      void queryClient.invalidateQueries({ queryKey: ['service-order', serviceOrderId] })
    },
    onError: (err) => setError(describeError(err)),
  })

  if (fitting.isLoading) return <Spinner />

  const set = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const sumOfDnp = (num(form.od_dnp) ?? 0) + (num(form.os_dnp) ?? 0)
  const dpTotal = num(form.dp_total_mm)
  const divergence = dpTotal !== null && sumOfDnp > 0 && Math.abs(dpTotal - sumOfDnp) > 0.6

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="success">Medidas salvas.</Alert>}

      <Card title="Medidas por olho">
        <div className="table-scroll">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                <th className="px-2 py-2">Olho</th>
                <th className="px-2 py-2">DNP de montagem (mm)</th>
                <th className="px-2 py-2">Altura (mm)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="px-2 py-2 font-medium">OD</td>
                <td className="px-2 py-2">
                  <Input
                    className="w-28"
                    inputMode="decimal"
                    value={form.od_dnp}
                    onChange={(e) => set('od_dnp', e.target.value)}
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    className="w-28"
                    inputMode="decimal"
                    value={form.od_height}
                    onChange={(e) => set('od_height', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td className="px-2 py-2 font-medium">OE</td>
                <td className="px-2 py-2">
                  <Input
                    className="w-28"
                    inputMode="decimal"
                    value={form.os_dnp}
                    onChange={(e) => set('os_dnp', e.target.value)}
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    className="w-28"
                    inputMode="decimal"
                    value={form.os_height}
                    onChange={(e) => set('os_height', e.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Esta DNP é aferida contra a armação escolhida — pode divergir da DNP da
          receita, e isso é informação, não erro. Altura é obrigatória em multifocal
          e bifocal.
        </p>
      </Card>

      <Card title="DP total e parâmetros">
        <div className="grid grid-cols-12 gap-3">
          <Field label="DP total (mm)" className="col-span-12 sm:col-span-3">
            <Input
              inputMode="decimal"
              value={form.dp_total_mm}
              onChange={(e) => set('dp_total_mm', e.target.value)}
            />
          </Field>
          <Field label="Origem do DP" className="col-span-12 sm:col-span-3">
            <Select
              value={form.dp_source}
              onChange={(e) => set('dp_source', e.target.value)}
            >
              <option value="measured">Medido</option>
              <option value="derived_from_dnp">Derivado das DNPs</option>
              <option value="from_prescription">Veio na receita</option>
            </Select>
          </Field>
          <Field label="Método de medição" className="col-span-12 sm:col-span-3">
            <Select
              value={form.measurement_method}
              onChange={(e) => set('measurement_method', e.target.value)}
            >
              <option value="manual">Manual (régua)</option>
              <option value="pupilometer">Pupilômetro</option>
              <option value="digital_photo">Foto digital</option>
              <option value="app">Aplicativo</option>
            </Select>
          </Field>
          <Field label="Distância vértice (mm)" className="col-span-12 sm:col-span-3">
            <Input
              inputMode="decimal"
              value={form.vertex_distance_mm}
              onChange={(e) => set('vertex_distance_mm', e.target.value)}
            />
          </Field>

          <Field label="Aro / horizontal (mm)" className="col-span-12 sm:col-span-3">
            <Input
              inputMode="decimal"
              value={form.frame_lens_width_mm}
              onChange={(e) => set('frame_lens_width_mm', e.target.value)}
            />
          </Field>
          <Field label="Ponte (mm)" className="col-span-12 sm:col-span-3">
            <Input
              inputMode="decimal"
              value={form.frame_bridge_mm}
              onChange={(e) => set('frame_bridge_mm', e.target.value)}
            />
          </Field>
          <Field label="Vertical (mm)" className="col-span-12 sm:col-span-3">
            <Input
              inputMode="decimal"
              value={form.frame_vertical_box_mm}
              onChange={(e) => set('frame_vertical_box_mm', e.target.value)}
            />
          </Field>
          <Field label="Inclinação pantoscópica (°)" className="col-span-12 sm:col-span-3">
            <Input
              inputMode="decimal"
              value={form.pantoscopic_tilt_deg}
              onChange={(e) => set('pantoscopic_tilt_deg', e.target.value)}
            />
          </Field>
        </div>

        {divergence && (
          <div className="mt-3">
            <Alert tone="warning">
              O DP total informado ({form.dp_total_mm} mm) difere da soma das DNPs (
              {sumOfDnp.toFixed(1)} mm). Isso é normal em face assimétrica — confira se
              é o caso.
            </Alert>
          </div>
        )}
      </Card>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? 'Salvando…' : 'Salvar medidas'}
      </Button>
    </div>
  )
}
