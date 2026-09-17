export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500">
      <span
        className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"
        aria-hidden
      />
      {label ?? 'Carregando…'}
    </div>
  )
}
