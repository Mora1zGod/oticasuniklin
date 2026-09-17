/**
 * Rosca com legenda.
 *
 * Rosca é uma forma exigente: sozinha, obriga a comparar ângulos. Por isso cada
 * fatia aparece também na legenda, com o número e o percentual — quem precisa do
 * valor lê, quem precisa da proporção olha. As cores vêm da escala de séries,
 * validada para daltonismo nos dois temas, e as fatias têm um vão para não se
 * fundirem num bloco só.
 *
 * A cor acompanha a categoria (o campo `series`), nunca a posição na lista: um
 * filtro que tira uma fatia não pode repintar as que ficaram.
 */
export type DonutSlice = {
  key: string
  label: string
  value: number
  /** Posição fixa na escala de séries (1 a 5). */
  series: number
}

export const SERIES_COLOR: Record<number, string> = {
  1: 'var(--color-series-1)',
  2: 'var(--color-series-2)',
  3: 'var(--color-series-3)',
  4: 'var(--color-series-4)',
  5: 'var(--color-series-5)',
}

export function Donut({
  slices,
  centerValue,
  centerLabel,
  formatValue = (value) => String(value),
  layout = 'row',
}: {
  slices: DonutSlice[]
  centerValue: string
  centerLabel: string
  formatValue?: (value: number) => string
  /** 'row' põe a legenda ao lado; 'column' embaixo, para colunas estreitas. */
  layout?: 'row' | 'column'
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  if (total === 0) return null

  const radius = 52
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div
      className={
        layout === 'row'
          ? 'flex flex-col items-center gap-5 sm:flex-row'
          : 'flex flex-col items-center gap-4'
      }
    >
      <svg
        viewBox="0 0 140 140"
        className="size-32 shrink-0 -rotate-90"
        role="img"
        aria-label={`${centerValue} ${centerLabel}, distribuído em ${slices.length} categorias`}
      >
        {slices.map((slice) => {
          const fraction = slice.value / total
          const length = Math.max(fraction * circumference - 2, 1)
          const element = (
            <circle
              key={slice.key}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={SERIES_COLOR[slice.series] ?? 'var(--color-line-strong)'}
              strokeWidth="18"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
            />
          )
          offset += fraction * circumference
          return element
        })}
        <g style={{ transformOrigin: '70px 70px' }} className="rotate-90">
          <text
            x="70"
            y="68"
            textAnchor="middle"
            className="fill-fg text-[0.9375rem] font-semibold"
          >
            {centerValue}
          </text>
          <text
            x="70"
            y="82"
            textAnchor="middle"
            className="fill-fg-subtle text-[0.5rem] tracking-wide uppercase"
          >
            {centerLabel}
          </text>
        </g>
      </svg>

      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2.5 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: SERIES_COLOR[slice.series] }}
            />
            <span className="min-w-0 flex-1 truncate text-fg-muted">{slice.label}</span>
            <span className="tnum shrink-0 text-xs font-medium text-fg">
              {formatValue(slice.value)}
            </span>
            <span className="tnum w-9 shrink-0 text-right text-xs text-fg-subtle">
              {Math.round((slice.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
