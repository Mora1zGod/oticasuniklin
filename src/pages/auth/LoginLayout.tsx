import type { ReactNode } from 'react'
import { brandingCssVars, type Branding } from '@/branding/branding'
import { IconGlasses } from '@/components/ui/icons'

/**
 * Casco visual da tela de login. Vive separado da LoginPage porque a tela de
 * Identidade Visual o reaproveita no preview ao vivo — o que o administrador vê
 * enquanto edita é o layout de verdade, não um desenho parecido.
 *
 * Nada aqui é texto fixo: tudo vem do branding da ótica.
 */
export function LoginLayout({
  branding,
  children,
  /** No preview, encolhe tipografia e espaçamento sem mudar a composição. */
  compact = false,
}: {
  branding: Branding
  children: ReactNode
  compact?: boolean
}) {
  const [headBefore, headHighlight] = splitHeadline(
    branding.loginHeadline,
    branding.loginHighlight,
  )

  const benefits = [branding.benefit1, branding.benefit2, branding.benefit3].filter(Boolean)

  return (
    <div
      className={
        // @container: os pontos de quebra olham a LARGURA DESTE BLOCO, não a da
        // janela. No login real dá no mesmo; no preview da Identidade Visual é o
        // que faz a miniatura mostrar a composição de desktop de verdade.
        '@container relative isolate overflow-hidden ' +
        (compact ? 'h-full' : 'min-h-full')
      }
      style={{
        ...brandingCssVars(branding),
        backgroundColor: 'var(--brand-background)',
        color: 'var(--brand-text)',
      }}
    >
      {/* Fundo: imagem opcional + halos de cor. Decoração, nunca conteúdo. */}
      {branding.loginBackgroundUrl && (
        <img
          src={branding.loginBackgroundUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-20 size-full object-cover opacity-35"
        />
      )}
      <div
        aria-hidden
        className="absolute -top-1/4 -left-1/4 -z-10 size-[70vw] rounded-full opacity-25 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, var(--brand-primary) 0%, transparent 65%)',
        }}
      />
      <div
        aria-hidden
        className="absolute -right-1/5 -bottom-1/3 -z-10 size-[60vw] rounded-full opacity-20 blur-3xl"
        style={{
          background: 'radial-gradient(circle, var(--brand-accent) 0%, transparent 65%)',
        }}
      />

      {/* Imagem institucional: integrada por gradiente, não colada por cima. */}
      {branding.loginImageUrl && (
        <div aria-hidden className="absolute inset-y-0 right-0 -z-10 hidden w-[42%] @5xl:block">
          <img
            src={branding.loginImageUrl}
            alt=""
            className="size-full object-cover object-left"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to right, var(--brand-background) 0%, ' +
                'color-mix(in oklab, var(--brand-background) 80%, transparent) 35%, ' +
                'color-mix(in oklab, var(--brand-background) 35%, transparent) 100%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, var(--brand-background) 0%, transparent 28%, ' +
                'transparent 72%, var(--brand-background) 100%)',
            }}
          />
        </div>
      )}

      <div
        className={
          'relative mx-auto grid w-full items-center gap-10 short:gap-6 ' +
          // Sem imagem institucional, a terceira coluna só criaria vazio — e a
          // largura máxima encolhe para o texto e o card não ficarem em pontas
          // opostas de uma tela larga.
          (branding.loginImageUrl
            ? 'max-w-[1400px] @5xl:grid-cols-[minmax(0,1fr)_minmax(0,25rem)_minmax(0,0.55fr)] '
            : 'max-w-[62rem] @5xl:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] ') +
          (compact
            ? 'h-full gap-6 px-6 py-8'
            : 'min-h-svh px-5 py-10 short:py-5 shorter:py-3 @xl:px-8 @5xl:px-12')
        }
      >
        {/* ---------------- Institucional (esquerda) ---------------- */}
        <section className="hidden @5xl:block">
          <h2
            className={
              'max-w-[11ch] font-semibold tracking-tight text-balance ' +
              (compact
                ? 'text-2xl leading-[1.15]'
                : 'text-[2.75rem] leading-[1.06] short:text-[2.25rem]')
            }
          >
            {headBefore}
            {headHighlight && (
              <span className="block" style={{ color: 'var(--brand-primary)' }}>
                {headHighlight}
              </span>
            )}
          </h2>

          <p
            className={
              'max-w-md opacity-70 ' +
              (compact
                ? 'mt-3 text-xs'
                : 'mt-5 text-[0.9375rem] leading-relaxed short:mt-3')
            }
          >
            {branding.loginDescription}
          </p>

          {benefits.length > 0 && (
            <ul className={compact ? 'mt-5 space-y-2.5' : 'mt-9 space-y-4 short:mt-5 short:space-y-2.5'}>
              {benefits.map((benefit, index) => (
                <li key={benefit} className="flex items-center gap-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor:
                        'color-mix(in oklab, var(--brand-primary) 16%, transparent)',
                      color: 'var(--brand-accent)',
                    }}
                  >
                    <BenefitIcon index={index} className="size-4.5" />
                  </span>
                  <span className={compact ? 'text-xs' : 'text-sm'}>{benefit}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------------- Autenticação (centro) ---------------- */}
        <section className="mx-auto w-full max-w-sm">
          <header className={compact ? 'mb-4 text-center' : 'mb-7 text-center short:mb-4'}>
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.companyName}
                className={
                  'mx-auto w-auto object-contain ' +
                  (compact ? 'max-h-10' : 'max-h-16 short:max-h-12')
                }
              />
            ) : (
              <>
                <span
                  className={
                    'mx-auto mb-3 flex items-center justify-center rounded-2xl short:mb-2 ' +
                    (compact ? 'size-10' : 'size-14 short:size-11')
                  }
                  style={{
                    backgroundColor:
                      'color-mix(in oklab, var(--brand-primary) 18%, transparent)',
                    color: 'var(--brand-primary)',
                  }}
                >
                  {branding.logoIconUrl ? (
                    <img
                      src={branding.logoIconUrl}
                      alt=""
                      className="size-2/3 object-contain"
                    />
                  ) : (
                    <IconGlasses className={compact ? 'size-5' : 'size-7 short:size-6'} />
                  )}
                </span>
                <h1
                  className={
                    'font-semibold tracking-tight ' +
                    (compact ? 'text-base' : 'text-2xl short:text-xl')
                  }
                >
                  {branding.companyName}
                </h1>
              </>
            )}
            <p
              className={
                'tracking-[0.18em] uppercase opacity-55 ' +
                (compact ? 'mt-1 text-[0.5625rem]' : 'mt-2 text-[0.6875rem]')
              }
            >
              {branding.subtitle}
            </p>
          </header>

          <div
            className={
              'rounded-2xl border shadow-2xl backdrop-blur-sm ' +
              (compact ? 'p-4' : 'p-6 short:p-4')
            }
            style={{
              backgroundColor: 'color-mix(in oklab, var(--brand-surface) 88%, transparent)',
              borderColor: 'color-mix(in oklab, var(--brand-text) 12%, transparent)',
              boxShadow: '0 25px 60px -20px rgb(0 0 0 / 0.6)',
            }}
          >
            {children}
          </div>

          <p
            className={
              'mx-auto max-w-sm text-center leading-relaxed opacity-55 ' +
              (compact ? 'mt-3 text-[0.625rem]' : 'mt-6 text-xs short:mt-3')
            }
          >
            {branding.loginFootnote}
          </p>
        </section>

        {/* Coluna direita: espaço reservado à imagem institucional do fundo. */}
        {branding.loginImageUrl && <div aria-hidden className="hidden @5xl:block" />}
      </div>
    </div>
  )
}

/** Separa a headline na palavra destacada, sem depender de ordem fixa. */
function splitHeadline(headline: string, highlight: string): [string, string | null] {
  if (!highlight) return [headline, null]
  const at = headline.lastIndexOf(highlight)
  if (at < 0) return [headline, null]
  return [headline.slice(0, at).trimEnd(), headline.slice(at)]
}

function BenefitIcon({ index, className }: { index: number; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className,
  }
  if (index === 0) {
    return (
      <svg {...common}>
        <path d="M4 19.5h16" />
        <path d="M7 16.5V11M12 16.5V6M17 16.5v-3.5" />
      </svg>
    )
  }
  if (index === 1) {
    return (
      <svg {...common}>
        <circle cx="9" cy="8.5" r="3" />
        <path d="M3 19a6 6 0 0 1 12 0" />
        <path d="M16 6.2a3 3 0 0 1 0 5.6" />
        <path d="M17.5 14.6A5.6 5.6 0 0 1 21 19" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9.5 4.1-1.9 7-5.3 7-9.5V6Z" />
      <path d="m9.2 12 2 2 3.6-3.8" />
    </svg>
  )
}
