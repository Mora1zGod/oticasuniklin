import { useEffect, type ReactNode } from 'react'
import { Button, cx } from './primitives'

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8">
      <div
        className={cx(
          'w-full rounded-lg bg-white shadow-xl',
          size === 'sm' && 'max-w-md',
          size === 'md' && 'max-w-2xl',
          size === 'lg' && 'max-w-4xl',
          size === 'xl' && 'max-w-6xl',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
            ✕
          </Button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
