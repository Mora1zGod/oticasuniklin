import type { ComponentType, ReactNode, SVGProps } from 'react'
import { Link } from 'react-router-dom'
import { cx } from './primitives'
import { IconArrowDown, IconArrowUp, IconChevronRight } from './icons'

/**
 * O número que abre uma tela: ícone com a cor do assunto, rótulo, valor e uma
 * linha de contexto. Vive aqui, e não numa tela, porque o painel inicial e as
 * telas do financeiro leem a mesma peça — e um indicador que muda de forma de
 * tela para tela obriga o operador a reaprender a ler.
 */
export type StatTone = 'brand' | 'success' | 'warning' | 'danger' | 'violet' | 'neutral'

const TONE: Record<StatTone, string> = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  danger: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  neutral: 'bg-surface-sunken text-fg-muted',
}

export function StatTile({
  icon: Icon,
  tone = 'brand',
  label,
  value,
  hint,
  delta,
  to,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: StatTone
  label: string
  value: ReactNode
  hint?: ReactNode
  /** Variação percentual. Só aparece quando existe base de comparação. */
  delta?: number | null
  to?: string
}) {
  const body = (
    <div className="h-full rounded-card border border-line bg-surface p-4 shadow-sm shadow-ink-900/4 transition-colors hover:border-brand-200 dark:hover:border-brand-500/40">
      <div className="flex items-start gap-3">
        <span
          className={cx(
            'flex size-10 shrink-0 items-center justify-center rounded-xl',
            TONE[tone],
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-fg-muted">{label}</p>
          <p className="tnum mt-0.5 text-[1.5rem] leading-none font-semibold text-fg">
            {value}
          </p>
        </div>
        {to && <IconChevronRight className="mt-1 size-4 shrink-0 text-fg-subtle" />}
      </div>

      {(hint || delta !== null) && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[0.6875rem] text-fg-subtle">
          {delta !== null && delta !== undefined && (
            <span
              className={cx(
                'flex items-center gap-0.5 font-semibold',
                delta >= 0 ? 'text-emerald-600' : 'text-red-600',
              )}
            >
              {delta >= 0 ? (
                <IconArrowUp className="size-3" />
              ) : (
                <IconArrowDown className="size-3" />
              )}
              {Math.abs(delta)}%
            </span>
          )}
          {hint}
        </p>
      )}
    </div>
  )

  return to ? (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  )
}
