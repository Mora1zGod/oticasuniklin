export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-6 text-sm text-fg-subtle">
      <span
        className="size-4 animate-spin rounded-full border-2 border-line-strong border-t-brand-600"
        aria-hidden
      />
      {label ?? 'Carregando…'}
    </div>
  )
}
