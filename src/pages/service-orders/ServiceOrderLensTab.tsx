import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Alert, Badge, Button, Card, Checkbox, Field, Input, Select } from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/Spinner'
import { describeError } from '@/lib/errors'

type Eye = 'OD' | 'OS'

type LensForm = {
  product_id: string
  lens_type_id: string
  lens_material_id: string
  refractive_index: string
  design: string
  supply_mode: 'stock' | 'surfaced'
  diameter_mm: string
  base_curve: string
  laboratory_id: string
  treatments: string[]
}

const emptyLens = (): LensForm => ({
  product_id: '',
  lens_type_id: '',
  lens_material_id: '',
  refractive_index: '',
  design: 'spherical',
  supply_mode: 'surfaced',
  diameter_mm: '',
  base_curve: '',
  laboratory_id: '',
  treatments: [],
})

const num = (v: string): number | null => {
  const clean = v.trim().replace(',', '.')
  if (clean === '') return null
  const n = Number(clean)
  return Number.isFinite(n) ? n : null
}

/**
 * Especificação da lente: tipo, material, índice, tratamento, fabricante e
 * laboratório (ADR-001). NADA disso pertence à receita — é escolha comercial e
 * técnica, feita aqui, por olho.
 */
export function ServiceOrderLensTab({
  serviceOrderId,
  tenantId,
  saleId,
}: {
  serviceOrderId: string
  tenantId: string
  saleId: string | null
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [sameForBoth, setSameForBoth] = useState(true)
  const [lenses, setLenses] = useState<Record<Eye, LensForm>>({
    OD: emptyLens(),
    OS: emptyLens(),
  })

  const specs = useQuery({
    queryKey: ['so-lens-specs', serviceOrderId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('service_order_lens_specs')
        .select('*, service_order_lens_treatments(*)')
        .eq('service_order_id', serviceOrderId)
      if (err) throw err
      return data ?? []
    },
  })

  const catalog = useQuery({
    queryKey: ['lens-catalog', tenantId],
    queryFn: async () => {
      const [types, materials, treatments, labs, products] = await Promise.all([
        supabase.from('lens_types').select('*').eq('is_active', true).order('label'),
        supabase.from('lens_materials').select('*').eq('is_active', true).order('label'),
        supabase.from('lens_treatments').select('*').eq('is_active', true).order('label'),
        supabase.from('laboratories').select('id, trade_name').eq('is_active', true).order('trade_name'),
        supabase
          .from('products')
          .select('id, name, lens_attributes(*)')
          .eq('product_kind', 'lens')
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('name'),
      ])
      return {
        types: types.data ?? [],
        materials: materials.data ?? [],
        treatments: treatments.data ?? [],
        labs: labs.data ?? [],
        products: products.data ?? [],
      }
    },
  })

  const saleItems = useQuery({
    queryKey: ['so-sale-items', saleId],
    enabled: Boolean(saleId),
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('sale_items')
        .select('id, description, eye, product_id')
        .eq('sale_id', saleId!)
      if (err) throw err
      return data ?? []
    },
  })

  useEffect(() => {
    if (!specs.data || specs.data.length === 0) return
    const next: Record<Eye, LensForm> = { OD: emptyLens(), OS: emptyLens() }
    for (const spec of specs.data) {
      next[spec.eye as Eye] = {
        product_id: spec.product_id ?? '',
        lens_type_id: spec.lens_type_id ?? '',
        lens_material_id: spec.lens_material_id ?? '',
        refractive_index: spec.refractive_index?.toString() ?? '',
        design: spec.design ?? 'spherical',
        supply_mode: spec.supply_mode,
        diameter_mm: spec.diameter_mm?.toString() ?? '',
        base_curve: spec.base_curve?.toString() ?? '',
        laboratory_id: spec.laboratory_id ?? '',
        treatments: spec.service_order_lens_treatments
          .map((t) => t.treatment_id)
          .filter((id): id is string => id !== null),
      }
    }
    setLenses(next)
    setSameForBoth(JSON.stringify(next.OD) === JSON.stringify(next.OS))
  }, [specs.data])

  const setLens = (eye: Eye, patch: Partial<LensForm>) => {
    setSaved(false)
    setLenses((prev) => {
      const updated = { ...prev[eye], ...patch }
      return sameForBoth ? { OD: updated, OS: updated } : { ...prev, [eye]: updated }
    })
  }

  /** Escolher um produto-lente do catálogo preenche os atributos técnicos. */
  const applyProduct = (eye: Eye, productId: string) => {
    const product = catalog.data?.products.find((p) => p.id === productId)
    const attrs = product?.lens_attributes
    setLens(eye, {
      product_id: productId,
      lens_type_id: attrs?.lens_type_id ?? '',
      lens_material_id: attrs?.lens_material_id ?? '',
      refractive_index: attrs?.refractive_index?.toString() ?? '',
      design: attrs?.design ?? 'spherical',
      supply_mode: attrs?.supply_mode ?? 'surfaced',
      diameter_mm: attrs?.diameter_mm?.toString() ?? '',
      base_curve: attrs?.base_curve?.toString() ?? '',
      laboratory_id: attrs?.default_laboratory_id ?? '',
    })
  }

  const save = useMutation({
    mutationFn: async () => {
      setError(null)
      for (const eye of ['OD', 'OS'] as const) {
        const lens = lenses[eye]
        if (!lens.lens_type_id) throw new Error(`Escolha o tipo de lente do olho ${eye}.`)

        const type = catalog.data?.types.find((t) => t.id === lens.lens_type_id)
        const material = catalog.data?.materials.find((m) => m.id === lens.lens_material_id)
        const product = catalog.data?.products.find((p) => p.id === lens.product_id)
        const saleItem = saleItems.data?.find(
          (i) => i.product_id === lens.product_id && (i.eye === eye || i.eye === 'both'),
        )

        const { data: spec, error: specError } = await supabase
          .from('service_order_lens_specs')
          .upsert(
            {
              service_order_id: serviceOrderId,
              tenant_id: tenantId,
              eye,
              product_id: lens.product_id || null,
              sale_item_id: saleItem?.id ?? null,
              lens_type_id: lens.lens_type_id,
              lens_material_id: lens.lens_material_id || null,
              lens_type_label: type?.label ?? null,
              lens_material_label: material?.label ?? null,
              manufacturer_name: product?.name ?? null,
              refractive_index: num(lens.refractive_index),
              design: lens.design as 'spherical',
              supply_mode: lens.supply_mode,
              diameter_mm: num(lens.diameter_mm),
              base_curve: num(lens.base_curve),
              laboratory_id: lens.laboratory_id || null,
            },
            { onConflict: 'service_order_id,eye' },
          )
          .select('id')
          .single()
        if (specError) throw specError

        await supabase
          .from('service_order_lens_treatments')
          .delete()
          .eq('lens_spec_id', spec.id)

        if (lens.treatments.length > 0) {
          const rows = lens.treatments.map((treatmentId) => ({
            lens_spec_id: spec.id,
            tenant_id: tenantId,
            treatment_id: treatmentId,
            treatment_label:
              catalog.data?.treatments.find((t) => t.id === treatmentId)?.label ?? '—',
          }))
          const { error: err } = await supabase
            .from('service_order_lens_treatments')
            .insert(rows)
          if (err) throw err
        }
      }
    },
    onSuccess: () => {
      setSaved(true)
      void queryClient.invalidateQueries({ queryKey: ['so-lens-specs', serviceOrderId] })
    },
    onError: (err) => setError(describeError(err)),
  })

  if (specs.isLoading || catalog.isLoading) return <Spinner />

  const renderEye = (eye: Eye) => {
    const lens = lenses[eye]
    const type = catalog.data?.types.find((t) => t.id === lens.lens_type_id)

    return (
      <Card
        key={eye}
        title={`${eye} — ${eye === 'OD' ? 'olho direito' : 'olho esquerdo'}`}
        actions={
          type?.requires_fitting_height ? <Badge tone="warning">exige altura</Badge> : null
        }
      >
        <div className="grid grid-cols-12 gap-3">
          <Field label="Produto do catálogo" className="col-span-12">
            <Select
              value={lens.product_id}
              onChange={(e) => applyProduct(eye, e.target.value)}
            >
              <option value="">— escolher manualmente —</option>
              {catalog.data?.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tipo de lente" required className="col-span-12 sm:col-span-6">
            <Select
              value={lens.lens_type_id}
              onChange={(e) => setLens(eye, { lens_type_id: e.target.value })}
            >
              <option value="">—</option>
              {catalog.data?.types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Material" className="col-span-12 sm:col-span-6">
            <Select
              value={lens.lens_material_id}
              onChange={(e) => {
                const material = catalog.data?.materials.find((m) => m.id === e.target.value)
                setLens(eye, {
                  lens_material_id: e.target.value,
                  refractive_index:
                    material?.default_refractive_index?.toString() ?? lens.refractive_index,
                })
              }}
            >
              <option value="">—</option>
              {catalog.data?.materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Índice" className="col-span-12 sm:col-span-3">
            <Input
              inputMode="decimal"
              value={lens.refractive_index}
              onChange={(e) => setLens(eye, { refractive_index: e.target.value })}
            />
          </Field>

          <Field label="Desenho" className="col-span-12 sm:col-span-3">
            <Select
              value={lens.design}
              onChange={(e) => setLens(eye, { design: e.target.value })}
            >
              <option value="spherical">Esférico</option>
              <option value="aspheric">Asférico</option>
              <option value="bi_aspheric">Bi-asférico</option>
              <option value="freeform">Freeform</option>
              <option value="digital">Digital</option>
            </Select>
          </Field>

          <Field label="Fornecimento" className="col-span-12 sm:col-span-3">
            <Select
              value={lens.supply_mode}
              onChange={(e) =>
                setLens(eye, { supply_mode: e.target.value as 'stock' | 'surfaced' })
              }
            >
              <option value="surfaced">Surfaçada (laboratório)</option>
              <option value="stock">Pronta (estoque)</option>
            </Select>
          </Field>

          <Field label="Laboratório" className="col-span-12 sm:col-span-3">
            <Select
              value={lens.laboratory_id}
              onChange={(e) => setLens(eye, { laboratory_id: e.target.value })}
            >
              <option value="">—</option>
              {catalog.data?.labs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.trade_name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Diâmetro (mm)" className="col-span-12 sm:col-span-3">
            <Input
              inputMode="decimal"
              value={lens.diameter_mm}
              onChange={(e) => setLens(eye, { diameter_mm: e.target.value })}
            />
          </Field>

          <Field label="Curva base" className="col-span-12 sm:col-span-3">
            <Input
              inputMode="decimal"
              value={lens.base_curve}
              onChange={(e) => setLens(eye, { base_curve: e.target.value })}
            />
          </Field>

          <div className="col-span-12">
            <p className="mb-1 text-xs font-medium text-slate-700">Tratamentos</p>
            <div className="flex flex-wrap gap-3">
              {catalog.data?.treatments.map((t) => (
                <Checkbox
                  key={t.id}
                  label={t.label}
                  checked={lens.treatments.includes(t.id)}
                  onChange={(e) =>
                    setLens(eye, {
                      treatments: e.target.checked
                        ? [...lens.treatments, t.id]
                        : lens.treatments.filter((id) => id !== t.id),
                    })
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="success">Especificação salva.</Alert>}

      <Checkbox
        label="Mesma lente para os dois olhos"
        checked={sameForBoth}
        onChange={(e) => {
          setSameForBoth(e.target.checked)
          if (e.target.checked) setLenses((prev) => ({ OD: prev.OD, OS: prev.OD }))
        }}
      />

      {renderEye('OD')}
      {!sameForBoth && renderEye('OS')}

      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? 'Salvando…' : 'Salvar especificação'}
      </Button>

      <p className="text-xs text-slate-500">
        Tipo, material, índice e tratamento são escolha comercial — por isso ficam
        aqui, na O.S., e não na receita clínica.
      </p>
    </div>
  )
}
