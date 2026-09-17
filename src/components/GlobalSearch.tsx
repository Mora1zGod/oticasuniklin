import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/auth/SessionProvider'
import { NAV } from './nav'
import { cx } from './ui/primitives'
import { Spinner } from './ui/Spinner'
import { IconCart, IconClipboard, IconSearch, IconUsers } from './ui/icons'

/**
 * Busca global (Ctrl+K).
 *
 * Um balconista com o cliente na frente não navega por menu: ele digita o nome
 * e entra. Por isso a busca é a peça mais larga do cabeçalho e atende quatro
 * coisas de uma vez — cliente, O.S., venda e tela.
 */
export function useGlobalSearchHotkey(open: () => void): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        open()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
}

type Hit = {
  id: string
  label: string
  detail?: string
  to: string
  kind: 'tela' | 'cliente' | 'os' | 'venda'
}

const KIND_ICON = {
  tela: IconSearch,
  cliente: IconUsers,
  os: IconClipboard,
  venda: IconCart,
} as const

const KIND_LABEL = {
  tela: 'Tela',
  cliente: 'Cliente',
  os: 'O.S.',
  venda: 'Venda',
} as const

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const { can } = useSession()
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [cursor, setCursor] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => input.current?.focus(), [])

  // Telas respondem na hora; não vale esperar a rede para isso.
  const screens = useMemo<Hit[]>(() => {
    const needle = normalize(term)
    if (!needle) return []
    return NAV.flatMap((group) =>
      group.items
        .filter((item) => !item.permission || can(item.permission))
        .filter((item) => normalize(item.label).includes(needle))
        .map<Hit>((item) => ({
          id: 'tela:' + item.to,
          label: item.label,
          detail: group.label,
          to: item.to,
          kind: 'tela',
        })),
    ).slice(0, 5)
  }, [term, can])

  const remote = useQuery({
    queryKey: ['busca-global', term],
    enabled: term.trim().length >= 2,
    staleTime: 15_000,
    queryFn: async (): Promise<Hit[]> => {
      const text = term.trim()
      const digits = text.replace(/\D/g, '')
      const hits: Hit[] = []

      if (can('customer.read')) {
        // A view já traz o documento (CPF/CNPJ mora no perfil, não em customers).
        const { data } = await supabase
          .from('v_customer_overview')
          .select('id, display_name, tax_document, primary_phone')
          .or(
            digits
              ? `display_name.ilike.%${text}%,tax_document.ilike.%${digits}%`
              : `display_name.ilike.%${text}%`,
          )
          .limit(6)
        for (const row of data ?? []) {
          hits.push({
            id: 'cliente:' + row.id,
            label: row.display_name ?? '—',
            detail: [row.tax_document, row.primary_phone].filter(Boolean).join(' · ') || undefined,
            to: `/clientes/${row.id}`,
            kind: 'cliente',
          })
        }
      }

      // Número de O.S. e de venda são inteiros por filial: só busca se digitou número.
      if (digits && can('service_order.read')) {
        const { data } = await supabase
          .from('service_orders')
          .select('id, number, customer_id')
          .eq('number', Number(digits))
          .limit(3)
        for (const row of data ?? []) {
          hits.push({
            id: 'os:' + row.id,
            label: `O.S. #${row.number}`,
            to: `/ordens-de-servico/${row.id}`,
            kind: 'os',
          })
        }
      }

      if (digits && can('sale.read')) {
        const { data } = await supabase
          .from('sales')
          .select('id, number, total_amount')
          .eq('number', Number(digits))
          .limit(3)
        for (const row of data ?? []) {
          hits.push({
            id: 'venda:' + row.id,
            label: `Venda #${row.number}`,
            to: `/comercial/vendas/${row.id}`,
            kind: 'venda',
          })
        }
      }

      return hits
    },
  })

  const hits = [...screens, ...(remote.data ?? [])]

  useEffect(() => setCursor(0), [term])

  const go = (hit: Hit | undefined) => {
    if (!hit) return
    navigate(hit.to)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/50 p-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Buscar no sistema"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <IconSearch className="size-4.5 shrink-0 text-fg-subtle" />
          <input
            ref={input}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose()
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setCursor((c) => Math.min(c + 1, hits.length - 1))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setCursor((c) => Math.max(c - 1, 0))
              }
              if (event.key === 'Enter') go(hits[cursor])
            }}
            placeholder="Nome do cliente, CPF, número da O.S., da venda ou o nome de uma tela…"
            className="h-14 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
          />
          <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[0.625rem] text-fg-subtle">
            Esc
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {term.trim().length < 2 ? (
            <p className="px-3 py-6 text-center text-xs text-fg-subtle">
              Digite ao menos duas letras. Números procuram O.S. e venda.
            </p>
          ) : hits.length === 0 ? (
            remote.isFetching ? (
              <Spinner />
            ) : (
              <p className="px-3 py-6 text-center text-xs text-fg-subtle">
                Nada encontrado para “{term.trim()}”.
              </p>
            )
          ) : (
            hits.map((hit, index) => {
              const Icon = KIND_ICON[hit.kind]
              return (
                <button
                  key={hit.id}
                  onClick={() => go(hit)}
                  onMouseEnter={() => setCursor(index)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left',
                    index === cursor ? 'bg-surface-sunken' : '',
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">{hit.label}</span>
                    {hit.detail && (
                      <span className="block truncate text-xs text-fg-subtle">
                        {hit.detail}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[0.625rem] tracking-wide text-fg-subtle uppercase">
                    {KIND_LABEL[hit.kind]}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

const normalize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
