import type { ReactNode } from 'react'
import { cx } from './primitives'

export type TabItem = { id: string; label: string; badge?: number | string }

export function Tabs({
  items,
  active,
  onChange,
}: {
  items: TabItem[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="table-scroll border-b border-line">
      <nav className="flex min-w-max gap-1" role="tablist">
        {items.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={active === item.id}
            onClick={() => onChange(item.id)}
            className={cx(
              '-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors',
              active === item.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-fg-subtle hover:border-line-strong hover:text-fg',
            )}
          >
            {item.label}
            {item.badge !== undefined && item.badge !== 0 && (
              <span className="ml-1.5 rounded-md bg-surface-sunken px-1.5 py-0.5 text-[0.6875rem] text-fg-muted">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}

export function TabPanel({ children }: { children: ReactNode }) {
  return <div className="pt-4">{children}</div>
}
