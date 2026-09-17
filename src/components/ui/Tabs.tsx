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
    <div className="table-scroll border-b border-slate-200">
      <nav className="flex min-w-max gap-1" role="tablist">
        {items.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={active === item.id}
            onClick={() => onChange(item.id)}
            className={cx(
              'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition',
              active === item.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
            )}
          >
            {item.label}
            {item.badge !== undefined && item.badge !== 0 && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
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
