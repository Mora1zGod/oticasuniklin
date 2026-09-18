import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable, type Column } from './DataTable'
import { useRecordForm, type RecordField } from './RecordForm'
import { Button, Card, Input, PageHeader } from './ui/primitives'
import { looseFrom, type Row, type TableName } from '@/lib/db'

/**
 * Campo do formulário de cadastro. É o que permite que os cadastros simples
 * (categorias, marcas, formas de pagamento…) existam sem uma tela artesanal
 * cada. O desenho do campo mora em `RecordForm`, que esta tela e a de catálogo
 * compartilham.
 */
export type CrudField = RecordField

export type CrudConfig<T extends TableName> = {
  table: T
  title: string
  subtitle?: string
  singular: string
  columns: Column<Row<T>>[]
  fields: CrudField[]
  /** Coluna usada na busca livre. */
  searchColumn?: string
  orderBy?: { column: string; ascending?: boolean }
  /** Filtro fixo aplicado na listagem (ex.: só produtos de um tipo). */
  filter?: Record<string, string>
  /** Colunas preenchidas automaticamente na criação. */
  withTenant?: boolean
  /** Catálogos de plataforma têm linhas com tenant_id nulo (somente leitura). */
  includePlatformRows?: boolean
  canWrite?: boolean
  extraActions?: ReactNode
}

export function CrudPage<T extends TableName>(config: CrudConfig<T>) {
  const [search, setSearch] = useState('')
  const canWrite = config.canWrite ?? true

  const form = useRecordForm({
    table: config.table,
    singular: config.singular,
    fields: config.fields,
    withTenant: config.withTenant !== false,
  })
  const queryKey = [config.table, config.filter, search, config.orderBy]

  const list = useQuery({
    queryKey,
    queryFn: async () => {
      let q = looseFrom(config.table).select('*')
      for (const [column, value] of Object.entries(config.filter ?? {})) {
        q = q.eq(column, value)
      }
      if (search && config.searchColumn) {
        q = q.ilike(config.searchColumn, `%${search}%`)
      }
      const order = config.orderBy ?? { column: 'created_at', ascending: false }
      const { data, error: err } = await q.order(order.column, {
        ascending: order.ascending ?? true,
      })
      if (err) throw err
      return (data ?? []) as unknown as Row<T>[]
    },
  })

  const columns = useMemo<Column<Row<T>>[]>(() => config.columns, [config.columns])

  return (
    <>
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={
          <>
            {config.extraActions}
            {canWrite && (
              <Button onClick={form.openCreate}>+ {config.singular}</Button>
            )}
          </>
        }
      />

      <Card
        bodyClassName="p-0"
        title={
          config.searchColumn ? (
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar…"
              className="w-64"
            />
          ) : (
            <span className="text-sm text-fg-muted">
              {list.data?.length ?? 0} registro(s)
            </span>
          )
        }
      >
        <DataTable
          rows={list.data}
          columns={columns}
          loading={list.isLoading}
          rowKey={(row) => String((row as { id: string }).id)}
          onRowClick={
            canWrite ? (row) => form.openEdit(row as Record<string, unknown>) : undefined
          }
          emptyTitle={`Nenhum registro de ${config.title.toLowerCase()}`}
          emptyAction={
            canWrite ? (
              <Button onClick={form.openCreate}>+ {config.singular}</Button>
            ) : undefined
          }
        />
      </Card>

      {form.modal}
    </>
  )
}
