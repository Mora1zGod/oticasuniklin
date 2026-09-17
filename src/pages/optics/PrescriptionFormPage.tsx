import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAppContext, useBranchId } from '@/auth/SessionProvider'
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui/primitives'
import { describeError } from '@/lib/errors'
import { formatDate, today } from '@/lib/format'
import { CustomerPicker } from '@/components/CustomerPicker'

type Eye = 'OD' | 'OS'
type Zone = 'far' | 'near'

type MeasureForm = {
  sphere_dpt: string
  cylinder_dpt: string
  axis_deg: string
  addition_dpt: string
  dnp_mm: string
}

const emptyMeasure = (): MeasureForm => ({
  sphere_dpt: '',
  cylinder_dpt: '',
  axis_deg: '',
  addition_dpt: '',
  dnp_mm: '',
})

const numeric = (v: string): number | null => {
  const clean = v.trim().replace(',', '.')
  if (clean === '') return null
  const n = Number(clean)
  return Number.isFinite(n) ? n : null
}

/**
 * Receita = prescrição clínica (ADR-001). Esta tela NÃO tem tipo de lente,
 * material, índice, tratamento, fabricante nem preço — isso é escolha comercial
 * e vive na O.S.
 *
 * A receita é imutável depois de emitida (ADR-002): corrigir gera nova versão,
 * encadeada por `supersedes_prescription_id`.
 */
export function PrescriptionFormPage() {
  const ctx = useAppContext()
  const branchId = useBranchId()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const supersedesId = params.get('substitui')
  const [customerId, setCustomerId] = useState(params.get('cliente') ?? '')
  const [prescriberId, setPrescriberId] = useState('')
  const [issuedAt, setIssuedAt] = useState(today())
  const [validUntil, setValidUntil] = useState('')
  const [visionUse, setVisionUse] = useState<
    'far' | 'near' | 'multifocal' | 'bifocal' | 'occupational' | 'intermediate'
  >('far')
  const [source, setSource] = useState<'external_document' | 'in_store_exam' | 'customer_report'>(
    'external_document',
  )
  const [cylinderNotation, setCylinderNotation] = useState<'negative' | 'positive'>('negative')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [measures, setMeasures] = useState<Record<`${Eye}-${Zone}`, MeasureForm>>({
    'OD-far': emptyMeasure(),
    'OS-far': emptyMeasure(),
    'OD-near': emptyMeasure(),
    'OS-near': emptyMeasure(),
  })

  const needsAddition = visionUse === 'multifocal' || visionUse === 'bifocal' || visionUse === 'occupational'

  const prescribers = useQuery({
    queryKey: ['prescribers', ctx.tenant_id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('prescribers')
        .select('id, full_name, council_type, council_number, council_state')
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('full_name')
      if (err) throw err
      return data ?? []
    },
  })

  /** Ao criar nova versão, parte dos valores da receita anterior. */
  const previous = useQuery({
    queryKey: ['prescription', supersedesId],
    enabled: Boolean(supersedesId),
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('optical_prescriptions')
        .select('*, optical_prescription_measures(*)')
        .eq('id', supersedesId!)
        .single()
      if (err) throw err
      setCustomerId(data.customer_id)
      setPrescriberId(data.prescriber_id ?? '')
      setVisionUse(data.vision_use)
      setCylinderNotation(data.cylinder_notation)
      const next = {
        'OD-far': emptyMeasure(),
        'OS-far': emptyMeasure(),
        'OD-near': emptyMeasure(),
        'OS-near': emptyMeasure(),
      }
      for (const m of data.optical_prescription_measures) {
        if (m.vision_zone !== 'far' && m.vision_zone !== 'near') continue
        next[`${m.eye as Eye}-${m.vision_zone}`] = {
          sphere_dpt: m.sphere_dpt?.toString() ?? '',
          cylinder_dpt: m.cylinder_dpt?.toString() ?? '',
          axis_deg: m.axis_deg?.toString() ?? '',
          addition_dpt: m.addition_dpt?.toString() ?? '',
          dnp_mm: m.dnp_mm?.toString() ?? '',
        }
      }
      setMeasures(next)
      return data
    },
  })

  const setMeasure = (eye: Eye, zone: Zone, field: keyof MeasureForm, value: string) =>
    setMeasures((prev) => ({
      ...prev,
      [`${eye}-${zone}`]: { ...prev[`${eye}-${zone}`], [field]: value },
    }))

  const save = useMutation({
    mutationFn: async () => {
      setError(null)
      if (!customerId) throw new Error('Escolha o cliente.')
      if (!issuedAt) throw new Error('Informe a data de emissão.')

      const prescriber = prescribers.data?.find((p) => p.id === prescriberId)

      // 1. cabeçalho em rascunho — medidas só entram enquanto está em draft
      const { data: created, error: createError } = await supabase
        .from('optical_prescriptions')
        .insert({
          tenant_id: ctx.tenant_id,
          customer_id: customerId,
          branch_id: branchId,
          prescriber_id: prescriberId || null,
          prescriber_name_snapshot: prescriber?.full_name ?? null,
          prescriber_council_snapshot: prescriber?.council_number
            ? `${prescriber.council_type ?? ''} ${prescriber.council_number}/${prescriber.council_state ?? ''}`.trim()
            : null,
          issued_at: issuedAt,
          valid_until: validUntil || null,
          vision_use: visionUse,
          source,
          cylinder_notation: cylinderNotation,
          clinical_notes: notes || null,
          status: 'draft',
          supersedes_prescription_id: supersedesId,
          created_by: ctx.app_user_id,
        })
        .select('id')
        .single()
      if (createError) throw createError

      // 2. medidas por olho — DNP aqui é a medida CLÍNICA (ADR-007)
      const rows = (['OD', 'OS'] as const).flatMap((eye) =>
        (['far', 'near'] as const)
          .map((zone) => {
            const m = measures[`${eye}-${zone}`]
            const sphere = numeric(m.sphere_dpt)
            const cylinder = numeric(m.cylinder_dpt)
            const addition = numeric(m.addition_dpt)
            const dnp = numeric(m.dnp_mm)
            if (
              sphere === null && cylinder === null && addition === null && dnp === null
            ) {
              return null
            }
            return {
              prescription_id: created.id,
              eye,
              vision_zone: zone,
              sphere_dpt: sphere,
              cylinder_dpt: cylinder,
              axis_deg: numeric(m.axis_deg),
              addition_dpt: addition,
              dnp_mm: dnp,
            }
          })
          .filter((row): row is NonNullable<typeof row> => row !== null),
      )

      if (rows.length === 0) throw new Error('Informe ao menos o grau de um olho.')

      const { error: measuresError } = await supabase
        .from('optical_prescription_measures')
        .insert(rows)
      if (measuresError) throw measuresError

      // 3. ativar — a versão anterior vira 'superseded' pelo trigger do banco
      const { error: activateError } = await supabase
        .from('optical_prescriptions')
        .update({ status: 'active' })
        .eq('id', created.id)
      if (activateError) throw activateError

      return created.id
    },
    onSuccess: (id) => navigate(`/optica/receitas/${id}`),
    onError: (err) => setError(describeError(err)),
  })

  return (
    <>
      <PageHeader
        title={supersedesId ? 'Nova versão da receita' : 'Nova receita'}
        subtitle={
          supersedesId
            ? `Substitui a receita de ${formatDate(previous.data?.issued_at)}. A anterior fica no histórico e as O.S. antigas não mudam.`
            : 'Prescrição clínica. A lente, o material e o tratamento são escolhidos depois, na O.S.'
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="space-y-4">
        <Card title="Dados da receita">
          <div className="grid grid-cols-12 gap-3">
            <Field label="Cliente" required className="col-span-12 sm:col-span-6">
              <CustomerPicker value={customerId} onChange={setCustomerId} />
            </Field>

            <Field label="Prescritor" className="col-span-12 sm:col-span-6">
              <Select
                value={prescriberId}
                onChange={(e) => setPrescriberId(e.target.value)}
              >
                <option value="">—</option>
                {prescribers.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                    {p.council_number ? ` — ${p.council_type} ${p.council_number}` : ''}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Emitida em" required className="col-span-12 sm:col-span-3">
              <Input
                type="date"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
              />
            </Field>

            <Field label="Válida até" className="col-span-12 sm:col-span-3">
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </Field>

            <Field label="Uso" required className="col-span-12 sm:col-span-3">
              <Select
                value={visionUse}
                onChange={(e) => setVisionUse(e.target.value as typeof visionUse)}
              >
                <option value="far">Longe</option>
                <option value="near">Perto</option>
                <option value="intermediate">Intermediário</option>
                <option value="multifocal">Multifocal</option>
                <option value="bifocal">Bifocal</option>
                <option value="occupational">Ocupacional</option>
              </Select>
            </Field>

            <Field
              label="Cilindro escrito em"
              className="col-span-12 sm:col-span-3"
              hint="Guardamos como veio na receita, sem transpor."
            >
              <Select
                value={cylinderNotation}
                onChange={(e) =>
                  setCylinderNotation(e.target.value as 'negative' | 'positive')
                }
              >
                <option value="negative">Cilindro negativo (−)</option>
                <option value="positive">Cilindro positivo (+)</option>
              </Select>
            </Field>

            <Field label="Origem" className="col-span-12 sm:col-span-6">
              <Select
                value={source}
                onChange={(e) => setSource(e.target.value as typeof source)}
              >
                <option value="external_document">Receita externa (documento)</option>
                <option value="in_store_exam">Exame na ótica</option>
                <option value="customer_report">Informado pelo cliente</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card
          title="Grau por olho"
          actions={
            <span className="text-xs text-slate-500">
              DNP aqui é a medida clínica prescrita — a de montagem fica na O.S.
            </span>
          }
        >
          <div className="table-scroll">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                  <th className="px-2 py-2">Olho</th>
                  <th className="px-2 py-2">Esférico</th>
                  <th className="px-2 py-2">Cilíndrico</th>
                  <th className="px-2 py-2">Eixo (°)</th>
                  {needsAddition && <th className="px-2 py-2">Adição</th>}
                  <th className="px-2 py-2">DNP (mm)</th>
                </tr>
              </thead>
              <tbody>
                {(['OD', 'OS'] as const).map((eye) => (
                  <tr key={eye} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium text-slate-700">
                      {eye}
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        {eye === 'OD' ? 'direito' : 'esquerdo'}
                      </span>
                    </td>
                    {(['sphere_dpt', 'cylinder_dpt', 'axis_deg'] as const).map((field) => (
                      <td key={field} className="px-2 py-2">
                        <Input
                          className="w-24"
                          inputMode="decimal"
                          placeholder={field === 'axis_deg' ? '0–180' : '0,00'}
                          value={measures[`${eye}-far`][field]}
                          onChange={(e) => setMeasure(eye, 'far', field, e.target.value)}
                        />
                      </td>
                    ))}
                    {needsAddition && (
                      <td className="px-2 py-2">
                        <Input
                          className="w-24"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={measures[`${eye}-far`].addition_dpt}
                          onChange={(e) =>
                            setMeasure(eye, 'far', 'addition_dpt', e.target.value)
                          }
                        />
                      </td>
                    )}
                    <td className="px-2 py-2">
                      <Input
                        className="w-24"
                        inputMode="decimal"
                        placeholder="32,0"
                        value={measures[`${eye}-far`].dnp_mm}
                        onChange={(e) => setMeasure(eye, 'far', 'dnp_mm', e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {needsAddition && (
            <p className="mt-3 text-xs text-slate-500">
              A adição informada vale para os dois olhos na zona de perto. Lentes
              multifocais e bifocais exigem adição — o banco recusa a O.S. sem ela.
            </p>
          )}
        </Card>

        <Card title="Observações clínicas">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anotações do prescritor, adaptação, queixas…"
          />
        </Card>

        <div className="flex gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Emitir receita'}
          </Button>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
        </div>

        <p className="text-xs text-slate-500">
          Depois de emitida, a receita não pode ser editada — é documento clínico.
          Correções geram uma nova versão, e o histórico do cliente fica preservado.
        </p>
      </div>
    </>
  )
}
