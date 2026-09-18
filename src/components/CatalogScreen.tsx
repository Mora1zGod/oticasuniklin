import { useMemo, useState, type ComponentType, type ReactNode, type SVGProps } from 'react'
import {
  Button,
  Card,
  PageHeader,
  SearchInput,
  Select,
  cx,
} from './ui/primitives'
import { Spinner } from './ui/Spinner'
import { StatTile, type StatTone } from './ui/StatTile'
import { IconChevronRight, IconPlus } from './ui/icons'

/**
 * Tela de catálogo: materiais, tratamentos, laboratórios, prescritores.
 *
 * As quatro respondem à mesma pergunta — "o que a ótica tem cadastrado aqui, o
 * que disso está em uso e o que precisa de atenção" — e por isso têm a mesma
 * anatomia: números no topo, filtros, a lista e, ao lado, o recorte que dá
 * sentido aos números. Uma peça só; quatro usos.
 *
 * O que muda de uma para outra é o conteúdo, não a forma. Cada tela entrega
 * seus indicadores, colunas e filtros; a paginação e a busca ficam aqui.
 */
export type CatalogColumn<T> = {
  key: string
  header: string
  /** Classes da célula — use para alinhar à direita ou esconder em tela estreita. */
  className?: string
  headerClassName?: string
  render: (row: T) => ReactNode
}

export type CatalogFilter<T> = {
  id: string
  label: string
  options: { value: string; label: string }[]
  match: (row: T, value: string) => boolean
}

export type CatalogStat = {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: StatTone
  label: string
  value: ReactNode
  hint?: ReactNode
  delta?: number | null
}

const PAGE_SIZE = 8

export function CatalogScreen<T>({
  title,
  subtitle,
  addLabel,
  onAdd,
  stats,
  rows,
  loading,
  rowKey,
  columns,
  searchPlaceholder,
  searchText,
  filters = [],
  aside,
  emptyTitle = 'Nenhum registro',
  onRowClick,
}: {
  title: string
  subtitle: string
  addLabel?: string
  onAdd?: () => void
  stats: CatalogStat[]
  rows: T[] | undefined
  loading?: boolean
  rowKey: (row: T) => string
  columns: CatalogColumn<T>[]
  searchPlaceholder: string
  /** Tudo que a busca por texto deve varrer nesta linha. */
  searchText: (row: T) => string
  filters?: CatalogFilter<T>[]
  /** Painel da direita: o recorte que explica os números. */
  aside?: ReactNode
  emptyTitle?: string
  onRowClick?: (row: T) => void
}) {
  const [term, setTerm] = useState('')
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const [page, setPage] = useState(1)

  const all = rows ?? []

  const visible = useMemo(() => {
    const needle = normalize(term)
    return all.filter((row) => {
      if (needle && !normalize(searchText(row)).includes(needle)) return false
      return filters.every((filter) => {
        const value = chosen[filter.id]
        return !value || filter.match(row, value)
      })
    })
    // `searchText`/`filters` vêm da tela e são estáveis o bastante para isto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, term, chosen])

  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const slice = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const dirty = Boolean(term) || Object.values(chosen).some(Boolean)

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          onAdd && (
            <Button onClick={onAdd}>
              <IconPlus className="size-4" />
              {addLabel ?? 'Novo'}
            </Button>
          )
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
        <div className="min-w-0 space-y-4">
          {/* --------------------------- Indicadores --------------------------- */}
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {stats.map((stat) => (
              <StatTile
                key={stat.label}
                icon={stat.icon}
                tone={stat.tone}
                label={stat.label}
                value={stat.value}
                hint={stat.hint}
                delta={stat.delta}
              />
            ))}
          </div>

          {/* ----------------------------- Filtros ----------------------------- */}
          <Card>
            <div className="flex flex-wrap items-end gap-3">
              <SearchInput
                value={term}
                onChange={(event) => {
                  setTerm(event.target.value)
                  setPage(1)
                }}
                placeholder={searchPlaceholder}
                className="min-w-56 flex-1"
              />

              {filters.map((filter) => (
                <Select
                  key={filter.id}
                  value={chosen[filter.id] ?? ''}
                  onChange={(event) => {
                    setChosen({ ...chosen, [filter.id]: event.target.value })
                    setPage(1)
                  }}
                  className="w-full py-2 text-xs sm:w-40 lg:w-44"
                  aria-label={filter.label}
                >
                  <option value="">{filter.label}</option>
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ))}

              <Button
                variant="ghost"
                className="ml-auto"
                disabled={!dirty}
                onClick={() => {
                  setTerm('')
                  setChosen({})
                  setPage(1)
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </Card>

          {/* ------------------------------ Lista ------------------------------ */}
          <Card
            title={
              <span className="text-sm font-semibold text-fg">
                {visible.length} registro{visible.length === 1 ? '' : 's'}
              </span>
            }
            bodyClassName="p-0"
          >
            {loading ? (
              <Spinner />
            ) : slice.length === 0 ? (
              <p className="py-14 text-center text-sm text-fg-subtle">
                {dirty ? 'Nenhum resultado com os filtros atuais.' : emptyTitle}
              </p>
            ) : (
              <>
                <div className="table-scroll">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line bg-surface-sunken text-[0.6875rem] tracking-wide text-fg-subtle uppercase">
                        {columns.map((column) => (
                          <th
                            key={column.key}
                            className={cx(
                              'px-4 py-2.5 text-left font-medium',
                              column.headerClassName ?? column.className,
                            )}
                          >
                            {column.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {slice.map((row) => (
                        <tr
                          key={rowKey(row)}
                          onClick={onRowClick ? () => onRowClick(row) : undefined}
                          className={cx(
                            'hover:bg-surface-sunken',
                            onRowClick && 'cursor-pointer',
                          )}
                        >
                          {columns.map((column) => (
                            <td
                              key={column.key}
                              className={cx('px-4 py-3', column.className)}
                            >
                              {column.render(row)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
                  <p className="text-xs text-fg-subtle">
                    Mostrando {(current - 1) * PAGE_SIZE + 1} a{' '}
                    {Math.min(current * PAGE_SIZE, visible.length)} de {visible.length}
                  </p>

                  {pages > 1 && (
                    <div className="flex items-center gap-1">
                      <PageButton
                        disabled={current === 1}
                        onClick={() => setPage(current - 1)}
                        label="Página anterior"
                      >
                        <IconChevronRight className="size-4 rotate-180" />
                      </PageButton>

                      {Array.from({ length: pages }, (_, index) => index + 1)
                        .filter(
                          (number) =>
                            number === 1 ||
                            number === pages ||
                            Math.abs(number - current) <= 1,
                        )
                        .map((number, index, list) => (
                          <span key={number} className="flex items-center gap-1">
                            {index > 0 && number - list[index - 1]! > 1 && (
                              <span className="px-1 text-xs text-fg-subtle">…</span>
                            )}
                            <PageButton
                              active={number === current}
                              onClick={() => setPage(number)}
                              label={`Página ${number}`}
                            >
                              {number}
                            </PageButton>
                          </span>
                        ))}

                      <PageButton
                        disabled={current === pages}
                        onClick={() => setPage(current + 1)}
                        label="Próxima página"
                      >
                        <IconChevronRight className="size-4" />
                      </PageButton>
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>

        {aside && <div className="space-y-4">{aside}</div>}
      </div>
    </>
  )
}

function PageButton({
  children,
  onClick,
  active,
  disabled,
  label,
}: {
  children: ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  label: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex size-8 items-center justify-center rounded-lg text-xs font-medium transition-colors',
        active
          ? 'bg-brand-600 text-white'
          : 'text-fg-muted hover:bg-surface-sunken disabled:opacity-40 disabled:hover:bg-transparent',
      )}
    >
      {children}
    </button>
  )
}

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

/** Bloco de apoio do painel lateral: lista curta com número à direita. */
export function AsideRanking({
  items,
}: {
  items: { key: string; rank?: ReactNode; title: string; detail?: string; value: ReactNode }[]
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-xs text-fg-subtle">Nada a mostrar ainda.</p>
  }
  return (
    <ul className="space-y-0.5">
      {items.map((item, index) => (
        <li
          key={item.key}
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-sunken"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-[0.6875rem] font-semibold text-fg-muted">
            {item.rank ?? index + 1}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-medium text-fg">{item.title}</span>
            {item.detail && (
              <span className="block truncate text-xs text-fg-subtle">{item.detail}</span>
            )}
          </span>
          <span className="shrink-0 text-right text-sm font-medium text-fg">
            {item.value}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Cartão de orientação do painel lateral. */
export function AsideTip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-card border border-line bg-brand-50 px-3.5 py-3 dark:bg-brand-500/10">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface text-brand-600 dark:text-brand-300">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="size-4"
        >
          <path d="M9.5 18h5M10 21h4" />
          <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 2h5.2c0-.8.3-1.5.9-2A6 6 0 0 0 12 3Z" />
        </svg>
      </span>
      <p className="text-xs leading-relaxed text-brand-900 dark:text-brand-200">
        <span className="mb-0.5 block font-semibold">{title}</span>
        {children}
      </p>
    </div>
  )
}
