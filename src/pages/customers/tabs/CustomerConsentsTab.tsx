import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { DataTable } from '@/components/DataTable'
import { Alert, Badge, Button, Card } from '@/components/ui/primitives'
import { describeError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'

const PURPOSES = [
  { value: 'data_processing', label: 'Tratamento de dados cadastrais' },
  { value: 'health_data', label: 'Dados de saúde (receita e medidas)' },
  { value: 'marketing', label: 'Comunicações de marketing' },
  { value: 'image_use', label: 'Uso de imagem' },
  { value: 'third_party_sharing', label: 'Compartilhamento com terceiros' },
] as const

type Purpose = (typeof PURPOSES)[number]['value']

/**
 * Consentimento é do titular perante o controlador — o TENANT, não a loja
 * (ADR-008). Por isso não há recorte por filial aqui.
 */
export function CustomerConsentsTab({
  customerId,
  tenantId,
}: {
  customerId: string
  tenantId: string
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const consents = useQuery({
    queryKey: ['customer-consents', customerId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('customer_consents')
        .select('*')
        .eq('customer_id', customerId)
        .order('granted_at', { ascending: false })
      if (err) throw err
      return data ?? []
    },
  })

  const currentFor = (purpose: Purpose) =>
    consents.data?.find((c) => c.purpose === purpose && c.revoked_at === null && c.granted)

  const grant = useMutation({
    mutationFn: async (purpose: Purpose) => {
      setError(null)
      const { error: err } = await supabase.from('customer_consents').insert({
        customer_id: customerId,
        tenant_id: tenantId,
        purpose,
        granted: true,
        source: 'atendimento na loja',
      })
      if (err) throw err
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer-consents', customerId] })
      void queryClient.invalidateQueries({ queryKey: ['customer-overview', customerId] })
    },
    onError: (err) => setError(describeError(err)),
  })

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      setError(null)
      const { error: err } = await supabase
        .from('customer_consents')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id)
      if (err) throw err
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer-consents', customerId] })
      void queryClient.invalidateQueries({ queryKey: ['customer-overview', customerId] })
    },
    onError: (err) => setError(describeError(err)),
  })

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <Card title="Consentimentos">
        <div className="space-y-2">
          {PURPOSES.map((purpose) => {
            const active = currentFor(purpose.value)
            return (
              <div
                key={purpose.value}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2"
              >
                <div>
                  <p className="text-sm text-slate-800">{purpose.label}</p>
                  {active && (
                    <p className="text-xs text-slate-500">
                      Concedido em {formatDateTime(active.granted_at)}
                    </p>
                  )}
                </div>
                {active ? (
                  <div className="flex items-center gap-2">
                    <Badge tone="success">Ativo</Badge>
                    <Button variant="secondary" size="sm" onClick={() => revoke.mutate(active.id)}>
                      Revogar
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => grant.mutate(purpose.value)}>
                    Registrar consentimento
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="Histórico" bodyClassName="p-0">
        <DataTable
          rows={consents.data}
          loading={consents.isLoading}
          rowKey={(row) => row.id}
          emptyTitle="Nenhum registro de consentimento"
          columns={[
            {
              key: 'purpose',
              header: 'Finalidade',
              render: (row) =>
                PURPOSES.find((p) => p.value === row.purpose)?.label ?? row.purpose,
            },
            {
              key: 'granted',
              header: 'Concedido em',
              render: (row) => formatDateTime(row.granted_at),
            },
            {
              key: 'revoked',
              header: 'Revogado em',
              render: (row) => (row.revoked_at ? formatDateTime(row.revoked_at) : '—'),
            },
            { key: 'source', header: 'Origem', render: (row) => row.source ?? '—' },
          ]}
        />
      </Card>
    </div>
  )
}
