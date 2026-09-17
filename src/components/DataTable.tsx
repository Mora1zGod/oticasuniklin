import type { ReactNode } from 'react'
import { EmptyState, cx } from './ui/primitives'
import { Spinner } from './ui/Spinner'

export type Column<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
  /** Alinha à direita (valores monetários e numéricos). */
  numeric?: boolean
}

export function DataTable<T>({
  rows,
  columns,
  loading,
  emptyTitle = 'Nada por aqui ainda',
  emptyDescription,
  emptyAction,
  onRowClick,
  rowKey,
}: {
  rows: T[] | undefined
  columns: Column<T>[]
  loading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  onRowClick?: (row: T) => void
  rowKey: (row: T) => string
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
    )
  }

  return (
    <div className="table-scroll">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="text-left">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cx(
                  'border-b border-line bg-surface-sunken px-3.5 py-2.5',
                  'text-[0.6875rem] font-semibold tracking-wider text-fg-muted uppercase',
                  col.numeric && 'text-right',
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cx(
                'transition-colors',
                onRowClick && 'cursor-pointer hover:bg-brand-50/50 dark:hover:bg-brand-500/8',
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cx(
                    'px-3.5 py-2.5 align-middle text-fg',
                    col.numeric && 'tnum text-right',
                    col.className,
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
