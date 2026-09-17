import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

export const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ')

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 ' +
    'active:bg-brand-800 disabled:bg-brand-300 disabled:shadow-none',
  secondary:
    'bg-surface text-fg ring-1 ring-line-strong shadow-xs hover:bg-canvas ' +
    'hover:ring-line-strong disabled:text-fg-subtle',
  ghost: 'text-fg-muted hover:bg-surface-sunken hover:text-fg disabled:text-fg-subtle',
  danger: 'bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700 disabled:bg-red-300',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
}) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium',
        'transition-colors duration-150 disabled:cursor-not-allowed',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9.5 px-4 text-sm',
        BUTTON_STYLES[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Campos de formulário
// ---------------------------------------------------------------------------

const FIELD_BASE =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-fg shadow-xs ' +
  'transition-colors placeholder:text-fg-subtle hover:border-line-strong ' +
  'focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/15 ' +
  'disabled:bg-canvas disabled:text-fg-subtle'

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label?: string
  hint?: string
  error?: string | null
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="mb-1.5 block text-xs font-medium text-fg-muted">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-fg-subtle">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(FIELD_BASE, className)} {...rest} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(FIELD_BASE, 'min-h-20', className)} {...rest} />
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(FIELD_BASE, 'pr-8', className)} {...rest}>
      {children}
    </select>
  )
}

/** Campo de busca com lupa — usado nas listagens. */
export function SearchInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className={cx('relative block', className)}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
      >
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </svg>
      <input className={cx(FIELD_BASE, 'pl-9')} {...rest} />
    </span>
  )
}

export function Checkbox({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label
      className={cx(
        'flex cursor-pointer items-center gap-2 text-sm text-fg select-none',
        className,
      )}
    >
      <input
        type="checkbox"
        className="size-4 rounded border-line-strong text-brand-600 transition focus:ring-brand-500/30"
        {...rest}
      />
      {label}
    </label>
  )
}

// ---------------------------------------------------------------------------
// Superfícies
// ---------------------------------------------------------------------------

export function Card({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      className={cx(
        'rounded-card border border-line bg-surface shadow-sm shadow-ink-900/4',
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          {typeof title === 'string' ? (
            <h2 className="text-sm font-semibold tracking-tight text-fg">{title}</h2>
          ) : (
            title
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const BADGE_STYLES: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-fg ring-line',
  success:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 ' +
    'dark:bg-emerald-500/12 dark:text-emerald-300 dark:ring-emerald-500/25',
  warning:
    'bg-amber-50 text-amber-800 ring-amber-200 ' +
    'dark:bg-amber-500/12 dark:text-amber-300 dark:ring-amber-500/25',
  danger:
    'bg-red-50 text-red-700 ring-red-200 ' +
    'dark:bg-red-500/12 dark:text-red-300 dark:ring-red-500/25',
  info:
    'bg-brand-50 text-brand-700 ring-brand-200 ' +
    'dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30',
}

const DOT_STYLES: Record<Tone, string> = {
  neutral: 'bg-fg-subtle',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-brand-500',
}

export function Badge({
  tone = 'neutral',
  dot,
  children,
  className,
}: {
  tone?: Tone
  /** Ponto colorido à esquerda — use em situação/estado, não em rótulo. */
  dot?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        'ring-1 ring-inset whitespace-nowrap',
        BADGE_STYLES[tone],
        className,
      )}
    >
      {dot && <span className={cx('size-1.5 rounded-full', DOT_STYLES[tone])} />}
      {children}
    </span>
  )
}

export function Alert({
  tone = 'danger',
  children,
}: {
  tone?: Tone
  children: ReactNode
}) {
  if (!children) return null
  return (
    <div
      className={cx(
        'flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ring-1 ring-inset',
        BADGE_STYLES[tone],
      )}
      role="alert"
    >
      <span className={cx('mt-1.5 size-1.5 shrink-0 rounded-full', DOT_STYLES[tone])} />
      <span className="min-w-0">{children}</span>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-surface-sunken">
        <span className="size-2 rounded-full bg-line-strong" />
      </div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="max-w-sm text-xs text-fg-subtle">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.375rem] leading-tight font-semibold tracking-tight text-fg">
          {title}
        </h1>
        {subtitle && <div className="mt-1 text-sm text-fg-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
