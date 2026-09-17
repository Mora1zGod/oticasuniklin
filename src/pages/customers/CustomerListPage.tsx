import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAppContext } from '@/auth/SessionProvider'
import { DataTable, type Column } from '@/components/DataTable'
import { Badge, Button, Card, Checkbox, PageHeader, SearchInput } from '@/components/ui/primitives'
import { formatDate, formatDocument, formatPhone } from '@/lib/format'
import { CustomerQuickCreate } from './CustomerQuickCreate'
import type { ViewRow } from '@/lib/db'

type OverviewRow = ViewRow<'v_customer_overview'>

export function CustomerListPage() {
  const ctx = useAppContext()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [onlyPending, setOnlyPending] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)

  const list = useQuery({
    queryKey: ['customers', ctx.tenant_id, search, onlyPending],
    queryFn: async () => {
      let q = supabase.from('v_customer_overview').select('*').limit(200)
      if (search.trim()) {
        const term = `%${search.trim()}%`
        q = q.or(`display_name.ilike.${term},tax_document.ilike.${term}`)
      }
      const { data, error } = await q.order('display_name')
      if (error) throw error
      const rows = data ?? []
      return onlyPending
        ? rows.filter((r) => (r.pending_fields?.length ?? 0) > 0)
        : rows
    },
  })

  const columns: Column<OverviewRow>[] = [
    {
      key: 'name',
      header: 'Cliente',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.display_name}</p>
          <p className="text-xs text-slate-500">
            {row.party_type === 'company' ? 'Pessoa jurídica' : 'Pessoa física'}
            {row.created_at_branch_name ? ` · cadastrado em ${row.created_at_branch_name}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'document',
      header: 'CPF / CNPJ',
      render: (row) => (row.tax_document ? formatDocument(row.tax_document) : '—'),
    },
    {
      key: 'phone',
      header: 'Telefone',
      render: (row) => (row.primary_phone ? formatPhone(row.primary_phone) : '—'),
    },
    {
      key: 'birth',
      header: 'Nascimento',
      render: (row) => formatDate(row.birth_date),
    },
    {
      key: 'status',
      header: 'Cadastro',
      render: (row) => {
        const pending = row.pending_fields ?? []
        if (row.record_status === 'complete' && pending.length === 0) {
          return (
            <Badge tone="success" dot>
              Completo
            </Badge>
          )
        }
        return (
          <Badge tone="warning" dot>
            Faltam {pending.length} campo{pending.length === 1 ? '' : 's'}
          </Badge>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="O cliente pertence à rede: você atende em qualquer filial sem duplicar o cadastro."
        actions={<Button onClick={() => setQuickOpen(true)}>+ Cliente</Button>}
      />

      <Card
        bodyClassName="p-0"
        title={
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, CPF ou CNPJ…"
              className="w-72"
            />
            <Checkbox
              label="Só cadastros incompletos"
              checked={onlyPending}
              onChange={(e) => setOnlyPending(e.target.checked)}
            />
          </div>
        }
      >
        <DataTable
          rows={list.data}
          columns={columns}
          loading={list.isLoading}
          rowKey={(row) => String(row.id)}
          onRowClick={(row) => navigate(`/clientes/${row.id}`)}
          emptyTitle="Nenhum cliente encontrado"
          emptyDescription="Cadastre o primeiro cliente para começar a vender."
          emptyAction={<Button onClick={() => setQuickOpen(true)}>+ Cliente</Button>}
        />
      </Card>

      <CustomerQuickCreate
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        onCreated={(id) => navigate(`/clientes/${id}`)}
      />
    </>
  )
}
