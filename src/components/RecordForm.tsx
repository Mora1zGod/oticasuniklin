import { useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/auth/SessionProvider'
import { blanksToNull, looseFrom, type TableName } from '@/lib/db'
import { describeError } from '@/lib/errors'
import { CepField } from './CepField'
import { Modal } from './ui/Modal'
import { Alert, Button, Checkbox, Field, Input, Select, Textarea } from './ui/primitives'

/**
 * O formulário de cadastro, separado da tela que o abre.
 *
 * Existe porque duas cascas diferentes precisam do MESMO formulário: a lista
 * simples (CrudPage) e a tela de catálogo com indicadores (CatalogScreen). Se
 * cada uma tivesse o seu, a validação e o tratamento de erro passariam a
 * divergir na primeira correção feita de um lado só.
 */
export type RecordField = {
  name: string
  label: string
  type?:
    | 'text'
    | 'number'
    | 'date'
    | 'checkbox'
    | 'select'
    | 'textarea'
    | 'email'
    /** CEP que preenche logradouro, bairro, cidade e UF do próprio formulário. */
    | 'cep'
  required?: boolean
  hint?: string
  placeholder?: string
  options?: { value: string; label: string }[]
  /** Largura em colunas da grade de 12. */
  span?: number
  step?: string
  defaultValue?: string | number | boolean | null
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

export function initialState(
  fields: RecordField[],
  row?: Record<string, unknown>,
): FormState {
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

export function useRecordForm<T extends TableName>({
  table,
  singular,
  fields,
  withTenant = true,
}: {
  table: T
  singular: string
  fields: RecordField[]
  withTenant?: boolean
}) {
  const ctx = useAppContext()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [form, setForm] = useState<FormState>({})
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async () => {
      const payload = blanksToNull({ ...form }) as Record<string, unknown>
      for (const field of fields) {
        if (field.type === 'number' && payload[field.name] !== null) {
          payload[field.name] = Number(payload[field.name])
        }
      }
      if (editing) {
        const { error: err } = await looseFrom(table)
          .update(payload)
          .eq('id', String((editing as { id: string }).id))
        if (err) throw err
      } else {
        if (withTenant) payload['tenant_id'] = ctx.tenant_id
        const { error: err } = await looseFrom(table).insert(payload)
        if (err) throw err
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [table] })
      close()
    },
    onError: (err) => setError(describeError(err)),
  })

  function openCreate() {
    setEditing(null)
    setForm(initialState(fields))
    setError(null)
    setOpen(true)
  }

  function openEdit(row: Record<string, unknown>) {
    // Linha semeada pela plataforma (tenant_id nulo) é só leitura.
    if ('tenant_id' in row && row['tenant_id'] === null) return
    setEditing(row)
    setForm(initialState(fields, row))
    setError(null)
    setOpen(true)
  }

  function close() {
    setOpen(false)
    setEditing(null)
    setError(null)
  }

  const modal: ReactNode = (
    <Modal
      open={open}
      title={editing ? `Editar ${singular}` : `Novo ${singular}`}
      onClose={close}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
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
        {fields.map((field) => {
          const value = form[field.name]
          const set = (next: string | number | boolean) =>
            setForm((previous) => ({ ...previous, [field.name]: next }))

          // O CEP escreve em outros campos do mesmo formulário.
          if (field.type === 'cep') {
            return (
              <CepField
                key={field.name}
                label={field.label}
                className={`col-span-12 ${SPAN_CLASS[field.span ?? 6] ?? 'sm:col-span-6'}`}
                value={String(value ?? '')}
                onChange={set}
                onFound={(found) =>
                  setForm((previous) => ({
                    ...previous,
                    [field.name]: found.zipCode,
                    street: found.street || previous['street'] || '',
                    district: found.district || previous['district'] || '',
                    city: found.city || previous['city'] || '',
                    state_code: found.stateCode || previous['state_code'] || '',
                  }))
                }
              />
            )
          }

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
                  onChange={(event) => set(event.target.checked)}
                />
              ) : field.type === 'select' ? (
                <Select
                  value={String(value ?? '')}
                  onChange={(event) => set(event.target.value)}
                >
                  <option value="">—</option>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : field.type === 'textarea' ? (
                <Textarea
                  value={String(value ?? '')}
                  onChange={(event) => set(event.target.value)}
                  placeholder={field.placeholder}
                />
              ) : (
                <Input
                  type={field.type ?? 'text'}
                  step={field.step}
                  value={String(value ?? '')}
                  onChange={(event) => set(event.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              )}
            </Field>
          )
        })}
      </div>
    </Modal>
  )

  return { openCreate, openEdit, modal }
}
