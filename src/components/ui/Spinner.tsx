export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-6 text-sm text-ink-400">
      <span
        className="size-4 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600"
        aria-hidden
      />
      {label ?? 'Carregando…'}
    </div>
  )
}
