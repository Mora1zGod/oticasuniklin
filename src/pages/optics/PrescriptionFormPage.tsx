import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAppContext, useBranchId } from '@/auth/SessionProvider'
import { useBranding } from '@/branding/BrandingProvider'
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
  cx,
} from '@/components/ui/primitives'
import {
  IconCheckCircle,
  IconChevronRight,
  IconFile,
  IconGlasses,
  IconIdea,
  IconLayers,
} from '@/components/ui/icons'
import { describeError } from '@/lib/errors'
import { clearDraft, useDraft } from '@/lib/draft'
import { formatDate, formatDocument, formatPhone, today } from '@/lib/format'
import { CustomerPicker } from '@/components/CustomerPicker'

type Eye = 'OD' | 'OS'
type Zone = 'far' | 'near'

type MeasureForm = {
  sphere_dpt: string
  cylinder_dpt: string
  axis_deg: string
  addition_dpt: string
  dnp_mm: string
  /** Altura INDICADA pelo prescritor. A medida na armação escolhida é da O.S. */
  fitting_height_mm: string
}

const emptyMeasure = (): MeasureForm => ({
  sphere_dpt: '',
  cylinder_dpt: '',
  axis_deg: '',
  addition_dpt: '',
  dnp_mm: '',
  fitting_height_mm: '',
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
  const { branding } = useBranding()
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
  const [vertexDistance, setVertexDistance] = useState('')
  const [pantoscopic, setPantoscopic] = useState('')
  const [frameWrap, setFrameWrap] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [measures, setMeasures] = useState<Record<`${Eye}-${Zone}`, MeasureForm>>({
    'OD-far': emptyMeasure(),
    'OS-far': emptyMeasure(),
    'OD-near': emptyMeasure(),
    'OS-near': emptyMeasure(),
  })

  // ----------------------------- Rascunho -----------------------------
  // Transcrever uma receita é digitar número por número, olho por olho. Se a
  // aba recarregar no meio, o operador não recomeça: os valores voltam.
  //
  // A chave separa a receita nova da nova versão de uma existente — são duas
  // intenções diferentes, e o rascunho de uma não pode vazar na outra.
  const draftKey = `uniklin.draft.receita.${ctx.tenant_id}.${supersedesId ?? 'nova'}`
  const preenchida = Object.values(measures).some((m) =>
    Object.values(m).some((v) => v.trim() !== ''),
  )
  const { recovered, discard } = useDraft({
    key: draftKey,
    value: {
      customerId, prescriberId, issuedAt, validUntil, visionUse, source,
      cylinderNotation, notes, vertexDistance, pantoscopic, frameWrap, measures,
    },
    restore: (saved) => {
      setCustomerId(saved.customerId)
      setPrescriberId(saved.prescriberId)
      setIssuedAt(saved.issuedAt)
      setValidUntil(saved.validUntil)
      setVisionUse(saved.visionUse)
      setSource(saved.source)
      setCylinderNotation(saved.cylinderNotation)
      setNotes(saved.notes)
      setVertexDistance(saved.vertexDistance)
      setPantoscopic(saved.pantoscopic)
      setFrameWrap(saved.frameWrap)
      setMeasures(saved.measures)
    },
    enabled: preenchida || Boolean(customerId) || Boolean(prescriberId) || Boolean(notes),
    reset: () => {
      setCustomerId('')
      setPrescriberId('')
      setIssuedAt(today())
      setValidUntil('')
      setVisionUse('far')
      setSource('external_document')
      setCylinderNotation('negative')
      setNotes('')
      setVertexDistance('')
      setPantoscopic('')
      setFrameWrap('')
      setMeasures({
        'OD-far': emptyMeasure(),
        'OS-far': emptyMeasure(),
        'OD-near': emptyMeasure(),
        'OS-near': emptyMeasure(),
      })
    },
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
      setVertexDistance(data.vertex_distance_mm?.toString() ?? '')
      setPantoscopic(data.pantoscopic_angle_deg?.toString() ?? '')
      setFrameWrap(data.frame_wrap_angle_deg?.toString() ?? '')
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
          fitting_height_mm: m.fitting_height_mm?.toString() ?? '',
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
          vertex_distance_mm: numeric(vertexDistance),
          pantoscopic_angle_deg: numeric(pantoscopic),
          frame_wrap_angle_deg: numeric(frameWrap),
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
            const height = numeric(m.fitting_height_mm)
            if (
              sphere === null &&
              cylinder === null &&
              addition === null &&
              dnp === null &&
              height === null
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
              fitting_height_mm: height,
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
    onSuccess: (id) => {
      clearDraft(draftKey)
      navigate(`/optica/receitas/${id}`)
    },
    onError: (err) => setError(describeError(err)),
  })

  const prescriber = prescribers.data?.find((p) => p.id === prescriberId)

  // A lista de conferência do painel lateral lê o próprio formulário: ela marca
  // o que já está preenchido, em vez de repetir uma cartilha genérica.
  const filled = Object.values(measures)
  const hasAnyMeasure = filled.some(
    (measure) => numeric(measure.sphere_dpt) !== null || numeric(measure.cylinder_dpt) !== null,
  )
  const hasAddition = filled.some((measure) => numeric(measure.addition_dpt) !== null)
  const hasDnp = filled.some((measure) => numeric(measure.dnp_mm) !== null)

  return (
    <>
      <PageHeader
        title={supersedesId ? 'Nova versão da receita' : 'Nova receita'}
        subtitle={
          supersedesId
            ? `Substitui a receita de ${formatDate(previous.data?.issued_at)}. A anterior fica no histórico e as O.S. antigas não mudam.`
            : 'Registre a prescrição e mantenha o histórico do cliente sempre atualizado.'
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <IconCheckCircle className="size-4" />
              {save.isPending ? 'Emitindo…' : 'Emitir receita'}
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {recovered && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <span>{
            'Recuperamos a receita que você estava transcrevendo antes da página ' +
            'recarregar. Confira os valores de cada olho antes de emitir.'
          }</span>
          <Button variant="ghost" onClick={discard}>
            Descartar e começar do zero
          </Button>
        </div>
      )}


      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
        {/* ------------------------------ Esquerda ------------------------------ */}
        <div className="min-w-0 space-y-4">
          <Card
            title={
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                <IconFile className="size-4 text-brand-600" />
                Dados da receita
              </span>
            }
          >
            <p className="mb-4 -mt-1 text-xs text-fg-subtle">
              Informações gerais da prescrição e do profissional responsável.
            </p>

            <div className="grid grid-cols-12 gap-3">
              <Field label="Cliente" required className="col-span-12 sm:col-span-6">
                <CustomerPicker value={customerId} onChange={setCustomerId} />
              </Field>

              <Field label="Prescritor" className="col-span-12 sm:col-span-6">
                <Select
                  value={prescriberId}
                  onChange={(e) => setPrescriberId(e.target.value)}
                >
                  <option value="">Não informado</option>
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

              <Field label="Uso" className="col-span-12 sm:col-span-3">
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
                hint="Como veio na receita — o banco não transpõe."
              >
                <Select
                  value={cylinderNotation}
                  onChange={(e) =>
                    setCylinderNotation(e.target.value as typeof cylinderNotation)
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
                  <option value="customer_report">Relato do cliente</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                <IconGlasses className="size-4 text-brand-600" />
                Grau por olho
              </span>
            }
            bodyClassName="p-0"
          >
            <p className="px-4 pt-3 text-xs text-fg-subtle">
              Preencha os valores de refração de cada olho. A DNP aqui é a medida
              clínica prescrita — a de montagem é tirada na O.S.
            </p>

            <div className="table-scroll mt-2">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-y border-line bg-surface-sunken text-[0.6875rem] tracking-wide text-fg-subtle uppercase">
                    <th className="px-4 py-2.5 text-left font-medium">Olho</th>
                    <th className="px-3 py-2.5 text-left font-medium">Esférico (D)</th>
                    <th className="px-3 py-2.5 text-left font-medium">Cilíndrico (D)</th>
                    <th className="px-3 py-2.5 text-left font-medium">Eixo (°)</th>
                    <th className="px-3 py-2.5 text-left font-medium">DNP (mm)</th>
                    <th className="px-3 py-2.5 text-left font-medium">Adição (D)</th>
                    <th className="px-3 py-2.5 text-left font-medium">Altura (mm)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(['OD', 'OS'] as const).map((eye) => {
                    const measure = measures[`${eye}-far`]
                    return (
                      <tr key={eye}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-fg">{eye}</span>
                          <span className="ml-1.5 text-xs text-fg-subtle">
                            {eye === 'OD' ? 'direito' : 'esquerdo'}
                          </span>
                        </td>
                        {(
                          [
                            ['sphere_dpt', '0,00'],
                            ['cylinder_dpt', '0,00'],
                            ['axis_deg', '0'],
                            ['dnp_mm', '32,0'],
                          ] as const
                        ).map(([field, placeholder]) => (
                          <td key={field} className="px-3 py-3">
                            <Input
                              className="tnum w-24 text-center"
                              inputMode="decimal"
                              placeholder={placeholder}
                              value={measure[field]}
                              onChange={(e) => setMeasure(eye, 'far', field, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="px-3 py-3">
                          <Input
                            className="tnum w-24 text-center"
                            inputMode="decimal"
                            placeholder={needsAddition ? '0,00' : '—'}
                            disabled={!needsAddition}
                            title={
                              needsAddition
                                ? undefined
                                : 'A adição só existe em multifocal, bifocal ou ocupacional.'
                            }
                            value={measure.addition_dpt}
                            onChange={(e) =>
                              setMeasure(eye, 'far', 'addition_dpt', e.target.value)
                            }
                          />
                        </td>
                        <td className="px-3 py-3">
                          <Input
                            className="tnum w-24 text-center"
                            inputMode="decimal"
                            placeholder="22,0"
                            value={measure.fitting_height_mm}
                            onChange={(e) =>
                              setMeasure(eye, 'far', 'fitting_height_mm', e.target.value)
                            }
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {needsAddition && (
              <div className="border-t border-line p-4">
                <p className="mb-2 text-xs font-medium text-fg-muted">
                  Grau de perto, quando a receita traz os dois valores separados
                </p>
                <div className="table-scroll">
                  <table className="w-full min-w-[30rem] text-sm">
                    <tbody className="divide-y divide-line">
                      {(['OD', 'OS'] as const).map((eye) => (
                        <tr key={eye}>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            <span className="font-semibold text-fg">{eye}</span>
                            <span className="ml-1.5 text-xs text-fg-subtle">perto</span>
                          </td>
                          {(
                            [
                              ['sphere_dpt', 'Esférico'],
                              ['cylinder_dpt', 'Cilíndrico'],
                              ['axis_deg', 'Eixo'],
                              ['dnp_mm', 'DNP'],
                            ] as const
                          ).map(([field, label]) => (
                            <td key={field} className="py-2 pr-3">
                              <Input
                                className="tnum w-24 text-center"
                                inputMode="decimal"
                                aria-label={`${label} de perto do ${eye}`}
                                placeholder={label}
                                value={measures[`${eye}-near`][field]}
                                onChange={(e) =>
                                  setMeasure(eye, 'near', field, e.target.value)
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                <IconLayers className="size-4 text-brand-600" />
                Medidas de adaptação
              </span>
            }
          >
            <p className="mb-3 -mt-1 text-xs text-fg-subtle">
              O que o prescritor indicou para a adaptação. A medida tirada na armação
              escolhida continua sendo registrada na O.S. e pode ser diferente desta.
            </p>
            <div className="grid grid-cols-12 gap-3">
              <Field
                label="Distância vértice (mm)"
                className="col-span-12 sm:col-span-4"
                hint="Em que distância a refração foi medida."
              >
                <Input
                  className="tnum"
                  inputMode="decimal"
                  placeholder="12,0"
                  value={vertexDistance}
                  onChange={(e) => setVertexDistance(e.target.value)}
                />
              </Field>
              <Field
                label="Ângulo pantoscópico (°)"
                className="col-span-12 sm:col-span-4"
                hint="Inclinação indicada para a armação."
              >
                <Input
                  className="tnum"
                  inputMode="decimal"
                  placeholder="8,0"
                  value={pantoscopic}
                  onChange={(e) => setPantoscopic(e.target.value)}
                />
              </Field>
              <Field
                label="Curva da armação (°)"
                className="col-span-12 sm:col-span-4"
                hint="Wrap indicado, quando informado."
              >
                <Input
                  className="tnum"
                  inputMode="decimal"
                  placeholder="5,0"
                  value={frameWrap}
                  onChange={(e) => setFrameWrap(e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                <IconFile className="size-4 text-brand-600" />
                Observações clínicas
              </span>
            }
            actions={<span className="tnum text-xs text-fg-subtle">{notes.length}/500</span>}
          >
            <Textarea
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações do prescritor, adaptações, queixas e informações relevantes…"
            />
          </Card>

          <Alert tone="warning">
            <span className="font-semibold">Importante.</span> Depois de emitida, a
            receita não pode ser editada. Corrigir gera uma nova versão, e o histórico
            do cliente é preservado — as O.S. já abertas continuam com o grau que
            usaram.
          </Alert>
        </div>

        {/* ------------------------------- Direita ------------------------------- */}
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <div
            className="overflow-hidden rounded-card px-4 py-5 text-white"
            style={{
              background:
                'linear-gradient(135deg, var(--color-brand-700) 0%, var(--color-brand-500) 100%)',
            }}
          >
            <p className="text-[0.625rem] tracking-[0.18em] uppercase opacity-70">
              {branding.subtitle}
            </p>
            <p className="mt-2 text-lg leading-tight font-semibold">
              {branding.loginHeadline}
            </p>
            <p className="mt-2 text-xs leading-relaxed opacity-80">
              {branding.loginDescription}
            </p>
          </div>

          {customerId && <CustomerSummaryCard customerId={customerId} />}

          {prescriber && (
            <Card title={<span className="text-sm font-semibold text-fg">Prescritor</span>}>
              <p className="text-sm font-medium text-fg">{prescriber.full_name}</p>
              {prescriber.council_number && (
                <p className="mt-0.5 text-xs text-fg-subtle">
                  {prescriber.council_type} {prescriber.council_number}
                  {prescriber.council_state ? `-${prescriber.council_state}` : ''}
                </p>
              )}
              <p className="mt-2 text-xs text-fg-subtle">
                O nome e o registro são copiados para a receita no momento da emissão —
                se o cadastro dele mudar depois, esta receita continua dizendo a verdade
                do dia em que foi emitida.
              </p>
            </Card>
          )}

          <Card
            title={
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                <IconIdea className="size-4 text-brand-600" />
                Receita completa
              </span>
            }
            bodyClassName="p-3"
          >
            <ul className="space-y-2">
              {[
                {
                  done: Boolean(customerId),
                  text: 'Escolha o cliente da receita',
                },
                {
                  done: Boolean(issuedAt),
                  text: 'Confirme a data de emissão',
                },
                {
                  done: Boolean(validUntil),
                  text: 'Informe até quando ela vale',
                },
                {
                  done: hasAnyMeasure,
                  text: 'Preencha o grau de pelo menos um olho',
                },
                {
                  done: !needsAddition || hasAddition,
                  text: needsAddition
                    ? 'Informe a adição — este uso exige'
                    : 'Adição não se aplica ao uso escolhido',
                },
                {
                  done: hasDnp,
                  text: 'Registre a DNP quando a receita trouxer',
                },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-2 text-xs">
                  <IconCheckCircle
                    className={cx(
                      'mt-0.5 size-4 shrink-0',
                      item.done ? 'text-emerald-600' : 'text-line-strong',
                    )}
                  />
                  <span className={item.done ? 'text-fg-muted' : 'text-fg-subtle'}>
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}

/** Quem vai usar estes óculos: confira antes de emitir. */
function CustomerSummaryCard({ customerId }: { customerId: string }) {
  const customer = useQuery({
    queryKey: ['prescription-customer', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_customer_overview')
        .select('id,display_name,tax_document,primary_phone,birth_date')
        .eq('id', customerId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const last = useQuery({
    queryKey: ['prescription-last', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('optical_prescriptions')
        .select('id,issued_at,revision')
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .order('issued_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const person = customer.data
  if (!person) return null

  return (
    <Card
      title={<span className="text-sm font-semibold text-fg">Resumo do cliente</span>}
      actions={
        <Link
          to={`/clientes/${person.id}`}
          className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
        >
          Ver cadastro <IconChevronRight className="size-3.5" />
        </Link>
      }
    >
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
          {(person.display_name ?? '?')
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? '')
            .join('')}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{person.display_name}</p>
          <p className="truncate text-xs text-fg-subtle">
            {[formatDocument(person.tax_document), formatPhone(person.primary_phone)]
              .filter(Boolean)
              .join('  ·  ') || 'Sem documento e telefone no cadastro'}
          </p>
        </div>
      </div>

      <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-fg-subtle">Nascimento</dt>
          <dd className="tnum text-fg">
            {person.birth_date ? formatDate(person.birth_date) : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fg-subtle">Receita vigente</dt>
          <dd className="tnum text-fg">
            {last.data ? `${formatDate(last.data.issued_at)} (v${last.data.revision})` : '—'}
          </dd>
        </div>
      </dl>
    </Card>
  )
}
