import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { DataTable } from '@/components/DataTable'
import { Modal } from '@/components/ui/Modal'
import { Alert, Badge, Button, Card, Checkbox, Field, Input, Select } from '@/components/ui/primitives'
import { describeError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { useCatalog } from '@/hooks/useCatalog'

/**
 * Vínculo cliente↔cliente em N:N (ADR-003): um dependente pode ter pai E mãe
 * como responsáveis, o responsável financeiro pode não ser o legal, e a relação
 * tem vigência. Não existe entidade "Família".
 */
export function CustomerRelationshipsTab({
  customerId,
  tenantId,
}: {
  customerId: string
  tenantId: string
}) {
  const queryClient = useQueryClient()
  const types = useCatalog('relationship_type')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    related_customer_id: '',
    relationship_entry_id: '',
    is_financial_responsible: false,
    is_legal_guardian: false,
    is_pickup_authorized: false,
  })

  const relationships = useQuery({
    queryKey: ['customer-relationships', customerId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('customer_relationships')
        .select('*')
        .or(`customer_id.eq.${customerId},related_customer_id.eq.${customerId}`)
        .is('valid_to', null)
      if (err) throw err

      const ids = new Set<string>()
      for (const rel of data ?? []) {
        ids.add(rel.customer_id === customerId ? rel.related_customer_id : rel.customer_id)
      }
      if (ids.size === 0) return []

      const { data: people, error: peopleError } = await supabase
        .from('customers')
        .select('id, display_name')
        .in('id', [...ids])
      if (peopleError) throw peopleError

      const byId = new Map((people ?? []).map((p) => [p.id, p.display_name]))
      return (data ?? []).map((rel) => {
        const otherId =
          rel.customer_id === customerId ? rel.related_customer_id : rel.customer_id
        return {
          ...rel,
          otherId,
          otherName: byId.get(otherId) ?? '—',
          /** true = o outro é o responsável por este cliente */
          otherIsResponsible: rel.customer_id === customerId,
        }
      })
    },
  })

  const candidates = useQuery({
    queryKey: ['customer-search', tenantId, search],
    enabled: open && search.trim().length >= 2,
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('customers')
        .select('id, display_name')
        .neq('id', customerId)
        .is('deleted_at', null)
        .ilike('display_name', `%${search.trim()}%`)
        .limit(10)
      if (err) throw err
      return data ?? []
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      setError(null)
      if (!form.related_customer_id) throw new Error('Escolha o cliente relacionado.')
      if (!form.relationship_entry_id) throw new Error('Escolha o tipo de vínculo.')
      const { error: err } = await supabase.from('customer_relationships').insert({
        tenant_id: tenantId,
        customer_id: customerId,
        related_customer_id: form.related_customer_id,
        relationship_entry_id: form.relationship_entry_id,
        is_financial_responsible: form.is_financial_responsible,
        is_legal_guardian: form.is_legal_guardian,
        is_pickup_authorized: form.is_pickup_authorized,
      })
      if (err) throw err
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer-relationships', customerId] })
      setOpen(false)
      setSearch('')
      setForm({
        related_customer_id: '',
        relationship_entry_id: '',
        is_financial_responsible: false,
        is_legal_guardian: false,
        is_pickup_authorized: false,
      })
    },
    onError: (err) => setError(describeError(err)),
  })

  const end = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await supabase
        .from('customer_relationships')
        .update({ valid_to: new Date().toISOString().slice(0, 10) })
        .eq('id', id)
      if (err) throw err
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['customer-relationships', customerId] }),
    onError: (err) => setError(describeError(err)),
  })

  const typeLabel = (id: string) => types.data?.find((t) => t.id === id)?.label ?? '—'

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <Card
        title="Responsáveis e dependentes"
        bodyClassName="p-0"
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            + Vínculo
          </Button>
        }
      >
        <DataTable
          rows={relationships.data}
          loading={relationships.isLoading}
          rowKey={(row) => row.id}
          emptyTitle="Nenhum vínculo registrado"
          emptyDescription="Use para ligar filho e responsável, cônjuges ou empresa e funcionário."
          columns={[
            {
              key: 'person',
              header: 'Pessoa',
              render: (row) => (
                <Link to={`/clientes/${row.otherId}`} className="text-brand-700 hover:underline">
                  {row.otherName}
                </Link>
              ),
            },
            {
              key: 'type',
              header: 'Vínculo',
              render: (row) => (
                <span>
                  {typeLabel(row.relationship_entry_id)}
                  <span className="ml-1 text-xs text-slate-400">
                    ({row.otherIsResponsible ? 'responsável' : 'dependente'})
                  </span>
                </span>
              ),
            },
            {
              key: 'flags',
              header: 'Responsabilidades',
              render: (row) => (
                <div className="flex flex-wrap gap-1">
                  {row.is_financial_responsible && <Badge tone="info">Financeiro</Badge>}
                  {row.is_legal_guardian && <Badge tone="warning">Legal</Badge>}
                  {row.is_pickup_authorized && <Badge>Retirada</Badge>}
                </div>
              ),
            },
            {
              key: 'since',
              header: 'Desde',
              render: (row) => formatDate(row.valid_from),
            },
            {
              key: 'actions',
              header: '',
              numeric: true,
              render: (row) => (
                <Button variant="ghost" size="sm" onClick={() => end.mutate(row.id)}>
                  Encerrar
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        title="Novo vínculo"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Salvar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Buscar cliente" hint="Digite ao menos 2 letras.">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} />
          </Field>

          {candidates.data && candidates.data.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-slate-200">
              {candidates.data.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setForm({ ...form, related_customer_id: c.id })}
                  className={
                    'block w-full px-3 py-2 text-left text-sm hover:bg-brand-50 dark:hover:bg-brand-500/10 ' +
                    (form.related_customer_id === c.id ? 'bg-brand-50 font-medium dark:bg-brand-500/15' : '')
                  }
                >
                  {c.display_name}
                </button>
              ))}
            </div>
          )}

          <Field label="Tipo de vínculo" required>
            <Select
              value={form.relationship_entry_id}
              onChange={(e) => setForm({ ...form, relationship_entry_id: e.target.value })}
            >
              <option value="">—</option>
              {types.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <p className="text-xs text-slate-500">
            A pessoa escolhida é o <strong>responsável</strong>; este cliente é o
            dependente do vínculo.
          </p>

          <div className="space-y-2">
            <Checkbox
              label="Responsável financeiro (paga as compras)"
              checked={form.is_financial_responsible}
              onChange={(e) =>
                setForm({ ...form, is_financial_responsible: e.target.checked })
              }
            />
            <Checkbox
              label="Responsável legal (menor de idade, curatela)"
              checked={form.is_legal_guardian}
              onChange={(e) => setForm({ ...form, is_legal_guardian: e.target.checked })}
            />
            <Checkbox
              label="Autorizado a retirar o produto"
              checked={form.is_pickup_authorized}
              onChange={(e) => setForm({ ...form, is_pickup_authorized: e.target.checked })}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
