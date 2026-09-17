import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Input, cx } from './ui/primitives'
import { formatDocument } from '@/lib/format'

/**
 * Busca de cliente por nome ou documento. Usado em receita, orçamento, venda
 * e O.S. — o cliente é do tenant, então a busca não filtra por filial (ADR-008).
 */
export function CustomerPicker({
  value,
  onChange,
  placeholder = 'Buscar por nome, CPF ou CNPJ…',
  disabled,
}: {
  value: string
  onChange: (customerId: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const selected = useQuery({
    queryKey: ['customer-picker-selected', value],
    enabled: Boolean(value),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_customer_overview')
        .select('id, display_name, tax_document, primary_phone')
        .eq('id', value)
        .single()
      if (error) throw error
      return data
    },
  })

  const results = useQuery({
    queryKey: ['customer-picker', search],
    enabled: open && search.trim().length >= 2,
    queryFn: async () => {
      const term = `%${search.trim()}%`
      const { data, error } = await supabase
        .from('v_customer_overview')
        .select('id, display_name, tax_document, primary_phone')
        .or(`display_name.ilike.${term},tax_document.ilike.${term}`)
        .limit(10)
      if (error) throw error
      return data ?? []
    },
  })

  useEffect(() => {
    if (!value) setOpen(false)
  }, [value])

  if (value && selected.data && !open) {
    return (
      <div className="flex items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">
            {selected.data.display_name}
          </p>
          <p className="truncate text-xs text-slate-500">
            {selected.data.tax_document
              ? formatDocument(selected.data.tax_document)
              : 'sem documento'}
          </p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              onChange('')
              setSearch('')
              setOpen(true)
            }}
            className="ml-2 shrink-0 text-xs text-brand-700 hover:underline"
          >
            trocar
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <Input
        value={search}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          setSearch(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />
      {open && results.data && results.data.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {results.data.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(String(c.id))
                  setSearch('')
                  setOpen(false)
                }}
                className={cx(
                  'block w-full px-3 py-2 text-left text-sm hover:bg-brand-50',
                )}
              >
                <span className="font-medium text-slate-800">{c.display_name}</span>
                {c.tax_document && (
                  <span className="ml-2 text-xs text-slate-500">
                    {formatDocument(c.tax_document)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && search.trim().length >= 2 && results.data?.length === 0 && (
        <p className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg">
          Nenhum cliente encontrado.
        </p>
      )}
    </div>
  )
}
