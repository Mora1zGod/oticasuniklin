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
          <tr className="border-b border-slate-200 text-left">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cx(
                  'px-3 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase',
                  col.numeric && 'text-right',
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cx(
                'transition',
                onRowClick && 'cursor-pointer hover:bg-brand-50/60',
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cx(
                    'px-3 py-2 align-middle text-slate-700',
                    col.numeric && 'text-right tabular-nums',
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
