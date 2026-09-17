import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { DataTable } from '@/components/DataTable'
import { Badge, Button, Card, Checkbox, PageHeader, SearchInput } from '@/components/ui/primitives'
import { formatDate, formatDiopter } from '@/lib/format'

export function PrescriptionListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [onlyActive, setOnlyActive] = useState(true)

  const list = useQuery({
    queryKey: ['prescriptions', search, onlyActive],
    queryFn: async () => {
      let q = supabase.from('v_customer_prescriptions').select('*').limit(200)
      if (onlyActive) q = q.eq('status', 'active')
      const { data, error } = await q.order('issued_at', { ascending: false })
      if (error) throw error
      const rows = data ?? []
      if (!search.trim()) return rows

      const term = search.trim().toLowerCase()
      const { data: matches } = await supabase
        .from('customers')
        .select('id')
        .ilike('display_name', `%${term}%`)
      const ids = new Set((matches ?? []).map((m) => m.id))
      return rows.filter((r) => r.customer_id && ids.has(r.customer_id))
    },
  })

  const customers = useQuery({
    queryKey: ['prescription-customers', list.data?.length],
    enabled: Boolean(list.data && list.data.length > 0),
    queryFn: async () => {
      const ids = [...new Set((list.data ?? []).map((r) => r.customer_id).filter(Boolean))]
      const { data, error } = await supabase
        .from('customers')
        .select('id, display_name')
        .in('id', ids as string[])
      if (error) throw error
      return new Map((data ?? []).map((c) => [c.id, c.display_name]))
    },
  })

  return (
    <>
      <PageHeader
        title="Receitas"
        subtitle="Prescrição clínica do cliente. A lente escolhida fica na ordem de serviço."
        actions={
          <Link to="/optica/receitas/nova">
            <Button>+ Receita</Button>
          </Link>
        }
      />

      <Card
        bodyClassName="p-0"
        title={
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente…"
              className="w-64"
            />
            <Checkbox
              label="Só receitas vigentes"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
            />
          </div>
        }
      >
        <DataTable
          rows={list.data}
          loading={list.isLoading}
          rowKey={(row) => String(row.id)}
          onRowClick={(row) => navigate(`/optica/receitas/${row.id}`)}
          emptyTitle="Nenhuma receita"
          columns={[
            {
              key: 'customer',
              header: 'Cliente',
              render: (row) =>
                customers.data?.get(String(row.customer_id)) ?? '—',
            },
            { key: 'issued', header: 'Emitida', render: (row) => formatDate(row.issued_at) },
            { key: 'rev', header: 'Versão', render: (row) => `v${row.revision ?? 1}` },
            {
              key: 'status',
              header: 'Situação',
              render: (row) => (
                <Badge tone={row.status === 'active' ? 'success' : 'neutral'} dot>
                  {row.status === 'active' ? 'Vigente' : 'Substituída'}
                </Badge>
              ),
            },
            {
              key: 'od',
              header: 'OD',
              render: (row) =>
                `${formatDiopter(row.od_sphere)} ${formatDiopter(row.od_cylinder)} ${row.od_axis ?? '—'}°`,
            },
            {
              key: 'os',
              header: 'OE',
              render: (row) =>
                `${formatDiopter(row.os_sphere)} ${formatDiopter(row.os_cylinder)} ${row.os_axis ?? '—'}°`,
            },
            { key: 'use', header: 'Uso', render: (row) => row.vision_use ?? '—' },
            {
              key: 'prescriber',
              header: 'Prescritor',
              render: (row) => row.prescriber_name ?? '—',
            },
          ]}
        />
      </Card>
    </>
  )
}
