import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DataTable, type Column } from './DataTable'
import { Modal } from './ui/Modal'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from './ui/primitives'
import { blanksToNull, looseFrom, type Row, type TableName } from '@/lib/db'
import { describeError } from '@/lib/errors'
import { useAppContext } from '@/auth/SessionProvider'

/**
 * Descreve um campo do formulário de cadastro. É o que permite que os cadastros
 * simples (categorias, marcas, laboratórios, formas de pagamento, prescritores…)
 * existam sem uma tela artesanal cada.
 */
export type CrudField = {
  name: string
  label: string
  type?: 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'textarea' | 'email'
  required?: boolean
  hint?: string
  placeholder?: string
  options?: { value: string; label: string }[]
  /** Largura em colunas da grade de 12. */
  span?: number
  step?: string
  defaultValue?: string | number | boolean | null
}

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

type FormState = Record<string, string | number | boolean | null>

/**
 * O Tailwind gera classe a partir de string literal no código: `col-span-${n}`
 * não existiria no CSS final. Por isso o mapa é estático.
 */
const SPAN_CLASS: Record<number, string> = {
  2: 'sm:col-span-2',
  3: 'sm:col-span-3',
  4: 'sm:col-span-4',
  6: 'sm:col-span-6',
  8: 'sm:col-span-8',
  9: 'sm:col-span-9',
  12: 'sm:col-span-12',
}

function initialState(fields: CrudField[], row?: Record<string, unknown>): FormState {
  const state: FormState = {}
  for (const field of fields) {
    const current = row?.[field.name]
    if (current !== undefined && current !== null) {
      state[field.name] =
        typeof current === 'boolean' || typeof current === 'number'
          ? current
          : String(current)
    } else if (row) {
      state[field.name] = field.type === 'checkbox' ? false : ''
    } else {
      state[field.name] = field.defaultValue ?? (field.type === 'checkbox' ? false : '')
    }
  }
  return state
}

export function CrudPage<T extends TableName>(config: CrudConfig<T>) {
  const ctx = useAppContext()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FormState>({})
  const [error, setError] = useState<string | null>(null)

  const canWrite = config.canWrite ?? true
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

  const save = useMutation({
    mutationFn: async (values: FormState) => {
      const payload = blanksToNull({ ...values }) as Record<string, unknown>
      for (const field of config.fields) {
        if (field.type === 'number' && payload[field.name] !== null) {
          payload[field.name] = Number(payload[field.name])
        }
      }
      if (editing) {
        const { error: err } = await looseFrom(config.table)
          .update(payload)
          .eq('id', String((editing as { id: string }).id))
        if (err) throw err
      } else {
        if (config.withTenant !== false) payload['tenant_id'] = ctx.tenant_id
        const { error: err } = await looseFrom(config.table).insert(payload)
        if (err) throw err
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [config.table] })
      closeForm()
    },
    onError: (err) => setError(describeError(err)),
  })

  function openCreate() {
    setEditing(null)
    setForm(initialState(config.fields))
    setError(null)
    setCreating(true)
  }

  function openEdit(row: Row<T>) {
    const record = row as Record<string, unknown>
    // Linha semeada pela plataforma (tenant_id nulo) é só leitura.
    if ('tenant_id' in record && record['tenant_id'] === null) return
    setEditing(record)
    setForm(initialState(config.fields, record))
    setError(null)
  }

  function closeForm() {
    setCreating(false)
    setEditing(null)
    setError(null)
  }

  const columns = useMemo<Column<Row<T>>[]>(() => config.columns, [config.columns])

  return (
    <>
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={
          <>
            {config.extraActions}
            {canWrite && <Button onClick={openCreate}>+ {config.singular}</Button>}
          </>
        }
      />

      <Card
        bodyClassName="p-0"
        title={
          config.searchColumn ? (
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="w-64"
            />
          ) : (
            <span className="text-sm text-slate-500">{list.data?.length ?? 0} registro(s)</span>
          )
        }
      >
        <DataTable
          rows={list.data}
          columns={columns}
          loading={list.isLoading}
          rowKey={(row) => String((row as { id: string }).id)}
          onRowClick={canWrite ? openEdit : undefined}
          emptyTitle={`Nenhum registro de ${config.title.toLowerCase()}`}
          emptyAction={
            canWrite ? <Button onClick={openCreate}>+ {config.singular}</Button> : undefined
          }
        />
      </Card>

      <Modal
        open={creating || editing !== null}
        title={editing ? `Editar ${config.singular}` : `Novo ${config.singular}`}
        onClose={closeForm}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
              {save.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        }
      >
        {error && (
          <div className="mb-3">
            <Alert>{error}</Alert>
          </div>
        )}
        <div className="grid grid-cols-12 gap-3">
          {config.fields.map((field) => {
            const value = form[field.name]
            const set = (v: string | number | boolean) =>
              setForm((prev) => ({ ...prev, [field.name]: v }))

            return (
              <Field
                key={field.name}
                label={field.type === 'checkbox' ? undefined : field.label}
                hint={field.hint}
                required={field.required}
                className={`col-span-12 ${SPAN_CLASS[field.span ?? 6] ?? 'sm:col-span-6'}`}
              >
                {field.type === 'checkbox' ? (
                  <Checkbox
                    label={field.label}
                    checked={Boolean(value)}
                    onChange={(e) => set(e.target.checked)}
                  />
                ) : field.type === 'select' ? (
                  <Select value={String(value ?? '')} onChange={(e) => set(e.target.value)}>
                    <option value="">—</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                ) : field.type === 'textarea' ? (
                  <Textarea
                    value={String(value ?? '')}
                    onChange={(e) => set(e.target.value)}
                    placeholder={field.placeholder}
                  />
                ) : (
                  <Input
                    type={field.type ?? 'text'}
                    step={field.step}
                    value={String(value ?? '')}
                    onChange={(e) => set(e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                )}
              </Field>
            )
          })}
        </div>
      </Modal>
    </>
  )
}
