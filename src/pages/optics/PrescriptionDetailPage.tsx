import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Alert, Badge, Button, Card, PageHeader } from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, formatDiopter, formatMm } from '@/lib/format'

const STATUS: Record<string, { label: string; tone: 'success' | 'neutral' | 'warning' }> = {
  active: { label: 'Vigente', tone: 'success' },
  superseded: { label: 'Substituída', tone: 'neutral' },
  draft: { label: 'Rascunho', tone: 'warning' },
  void: { label: 'Anulada', tone: 'warning' },
}

export function PrescriptionDetailPage() {
  const { id = '' } = useParams()

  const prescription = useQuery({
    queryKey: ['prescription-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('optical_prescriptions')
        .select('*, optical_prescription_measures(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })

  const customer = useQuery({
    queryKey: ['prescription-customer', prescription.data?.customer_id],
    enabled: Boolean(prescription.data?.customer_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('display_name')
        .eq('id', prescription.data!.customer_id)
        .single()
      if (error) throw error
      return data
    },
  })

  /** Toda a cadeia de versões (R1 → R2 → …) compartilha a mesma raiz. */
  const versions = useQuery({
    queryKey: ['prescription-versions', prescription.data?.root_prescription_id],
    enabled: Boolean(prescription.data?.root_prescription_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('optical_prescriptions')
        .select('id, revision, issued_at, status')
        .eq('root_prescription_id', prescription.data!.root_prescription_id!)
        .order('revision')
      if (error) throw error
      return data ?? []
    },
  })

  /** O.S. que usaram esta receita — o snapshot guarda a procedência. */
  const usedIn = useQuery({
    queryKey: ['prescription-usage', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_order_prescriptions')
        .select('service_order_id, snapshot_taken_at, service_orders(number, opened_at)')
        .eq('source_prescription_id', id)
      if (error) throw error
      return data ?? []
    },
  })

  if (prescription.isLoading) return <Spinner />
  if (!prescription.data) return <Alert>Receita não encontrada.</Alert>

  const p = prescription.data
  const status = STATUS[p.status] ?? { label: p.status, tone: 'neutral' as const }
  const measure = (eye: 'OD' | 'OS', zone: 'far' | 'near') =>
    p.optical_prescription_measures.find((m) => m.eye === eye && m.vision_zone === zone)

  return (
    <>
      <PageHeader
        title={`Receita de ${formatDate(p.issued_at)}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span>versão {p.revision}</span>
            <Link
              to={`/clientes/${p.customer_id}`}
              className="text-brand-700 hover:underline"
            >
              {customer.data?.display_name ?? 'cliente'}
            </Link>
          </span>
        }
        actions={
          <Link to={`/optica/receitas/nova?substitui=${p.id}`}>
            <Button variant="secondary">Nova versão</Button>
          </Link>
        }
      />

      {p.status === 'superseded' && (
        <div className="mb-4">
          <Alert tone="info">
            Esta versão foi substituída por outra mais recente. Ela continua no
            histórico e as O.S. que a usaram seguem mostrando exatamente estes valores.
          </Alert>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Grau prescrito" className="lg:col-span-2" bodyClassName="p-0">
          <div className="table-scroll">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                  <th className="px-3 py-2">Olho</th>
                  <th className="px-3 py-2">Esférico</th>
                  <th className="px-3 py-2">Cilíndrico</th>
                  <th className="px-3 py-2">Eixo</th>
                  <th className="px-3 py-2">Adição</th>
                  <th className="px-3 py-2">DNP clínica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(['OD', 'OS'] as const).map((eye) => {
                  const m = measure(eye, 'far')
                  return (
                    <tr key={eye}>
                      <td className="px-3 py-2 font-medium text-slate-700">{eye}</td>
                      <td className="px-3 py-2 tabular-nums">{formatDiopter(m?.sphere_dpt)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatDiopter(m?.cylinder_dpt)}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {m?.axis_deg !== null && m?.axis_deg !== undefined ? `${m.axis_deg}°` : '—'}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatDiopter(m?.addition_dpt)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatMm(m?.dnp_mm)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            Cilindro escrito em notação{' '}
            {p.cylinder_notation === 'negative' ? 'negativa (−)' : 'positiva (+)'}. A DNP
            acima é a prescrita; a de montagem é aferida na O.S. contra a armação escolhida.
          </p>
        </Card>

        <div className="space-y-4">
          <Card title="Dados">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Prescritor</dt>
                <dd className="text-right text-slate-800">
                  {p.prescriber_name_snapshot ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Conselho</dt>
                <dd className="text-right text-slate-800">
                  {p.prescriber_council_snapshot ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Uso</dt>
                <dd className="text-right text-slate-800">{p.vision_use}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Válida até</dt>
                <dd className="text-right text-slate-800">{formatDate(p.valid_until)}</dd>
              </div>
            </dl>
            {p.clinical_notes && (
              <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
                {p.clinical_notes}
              </p>
            )}
          </Card>

          <Card title="Versões">
            <ul className="space-y-1 text-sm">
              {versions.data?.map((v) => (
                <li key={v.id}>
                  <Link
                    to={`/optica/receitas/${v.id}`}
                    className={
                      v.id === p.id
                        ? 'font-medium text-slate-900'
                        : 'text-brand-700 hover:underline'
                    }
                  >
                    v{v.revision} · {formatDate(v.issued_at)}
                  </Link>
                  {v.status === 'active' && (
                    <Badge tone="success" className="ml-2">
                      vigente
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Usada em produção">
            {usedIn.data && usedIn.data.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {usedIn.data.map((u) => (
                  <li key={u.service_order_id}>
                    <Link
                      to={`/ordens-de-servico/${u.service_order_id}`}
                      className="text-brand-700 hover:underline"
                    >
                      O.S. #{u.service_orders?.number}
                    </Link>
                    <span className="ml-2 text-xs text-slate-500">
                      snapshot em {formatDate(u.snapshot_taken_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                Ainda não usada em nenhuma ordem de serviço.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
