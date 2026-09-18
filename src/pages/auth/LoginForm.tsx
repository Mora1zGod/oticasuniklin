import type { FormEvent, ReactNode } from 'react'

/**
 * Formulário de acesso — só a aparência. Toda a autenticação continua na
 * LoginPage; este componente existe porque a tela de Identidade Visual mostra o
 * login de verdade no preview, e um desenho parecido envelheceria sozinho.
 */
export type LoginFormMode = 'signin' | 'signup'

export function LoginForm({
  mode,
  onModeChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  showPassword,
  onShowPasswordChange,
  error,
  notice,
  busy = false,
  onSubmit,
  /** No preview: sem foco, sem digitação, sem envio. */
  inert = false,
  compact = false,
}: {
  mode: LoginFormMode
  onModeChange: (mode: LoginFormMode) => void
  email: string
  onEmailChange: (value: string) => void
  password: string
  onPasswordChange: (value: string) => void
  showPassword: boolean
  onShowPasswordChange: (value: boolean) => void
  error?: string | null
  notice?: string | null
  busy?: boolean
  onSubmit: (event: FormEvent) => void
  inert?: boolean
  compact?: boolean
}) {
  return (
    <form
      onSubmit={onSubmit}
      className={compact ? 'space-y-2.5' : 'space-y-4 short:space-y-3'}
      inert={inert}
    >
      <div>
        <h2
          className={
            'font-semibold tracking-tight ' + (compact ? 'text-sm' : 'text-lg')
          }
        >
          {mode === 'signin' ? 'Bem-vindo(a) de volta!' : 'Criar sua conta'}
        </h2>
        <p className={'opacity-65 ' + (compact ? 'mt-0.5 text-[0.6875rem]' : 'mt-1 text-sm')}>
          {mode === 'signin'
            ? 'Acesse sua conta e continue gerenciando sua ótica.'
            : 'Use o mesmo e-mail do convite que você recebeu.'}
        </p>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="info">{notice}</Notice>}

      <label className="block">
        <span
          className={
            'block font-medium opacity-80 ' +
            (compact ? 'mb-1 text-[0.625rem]' : 'mb-1.5 text-xs')
          }
        >
          E-mail
        </span>
        <span className="relative block">
          <MailIcon
            className={
              'pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 opacity-45 ' +
              (compact ? 'size-3.5' : 'size-4.5')
            }
          />
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            autoComplete="email"
            placeholder="seu@email.com"
            required={!inert}
            readOnly={inert}
            tabIndex={inert ? -1 : undefined}
            className={field(compact)}
            style={FIELD_STYLE}
          />
        </span>
      </label>

      <label className="block">
        <span
          className={
            'block font-medium opacity-80 ' +
            (compact ? 'mb-1 text-[0.625rem]' : 'mb-1.5 text-xs')
          }
        >
          Senha
        </span>
        <span className="relative block">
          <LockIcon
            className={
              'pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 opacity-45 ' +
              (compact ? 'size-3.5' : 'size-4.5')
            }
          />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            placeholder="Sua senha"
            minLength={6}
            required={!inert}
            readOnly={inert}
            tabIndex={inert ? -1 : undefined}
            className={field(compact) + (compact ? ' pr-9' : ' pr-11')}
            style={FIELD_STYLE}
          />
          <button
            type="button"
            onClick={() => onShowPasswordChange(!showPassword)}
            tabIndex={inert ? -1 : undefined}
            className={
              'brand-eye absolute top-1/2 right-2 -translate-y-1/2 flex items-center ' +
              'justify-center rounded-lg transition ' +
              (compact ? 'size-6' : 'size-8')
            }
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? (
              <EyeOffIcon className={compact ? 'size-3.5' : 'size-4.5'} />
            ) : (
              <EyeIcon className={compact ? 'size-3.5' : 'size-4.5'} />
            )}
          </button>
        </span>
        {mode === 'signup' && (
          <span
            className={
              'block opacity-55 ' + (compact ? 'mt-1 text-[0.625rem]' : 'mt-1.5 text-xs')
            }
          >
            Mínimo de 6 caracteres.
          </span>
        )}
      </label>

      <button
        type="submit"
        disabled={busy}
        tabIndex={inert ? -1 : undefined}
        className={
          'flex w-full items-center justify-center gap-2 rounded-xl font-semibold text-white ' +
          'transition-opacity disabled:opacity-60 ' +
          (compact ? 'h-8 text-xs' : 'h-11 text-sm')
        }
        style={{
          background:
            'linear-gradient(135deg, var(--brand-accent) 0%, var(--brand-primary) 70%)',
          boxShadow: '0 10px 30px -12px var(--brand-primary)',
        }}
      >
        {busy ? 'Aguarde…' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
        {!busy && <ArrowIcon className={compact ? 'size-3' : 'size-4'} />}
      </button>

      <p className={'text-center opacity-70 ' + (compact ? 'text-[0.6875rem]' : 'text-sm')}>
        {mode === 'signin' ? 'Ainda não tem conta? ' : 'Já tem conta? '}
        <button
          type="button"
          onClick={() => onModeChange(mode === 'signin' ? 'signup' : 'signin')}
          tabIndex={inert ? -1 : undefined}
          className="font-medium underline-offset-2 hover:underline"
          style={{ color: 'var(--brand-accent)' }}
        >
          {mode === 'signin' ? 'Criar agora' : 'Entrar'}
        </button>
      </p>
    </form>
  )
}

const field = (compact: boolean): string =>
  'brand-field w-full rounded-xl border outline-none transition ' +
  'placeholder:opacity-40 focus:border-[var(--brand-primary)] ' +
  (compact ? 'py-1.5 pr-2.5 pl-8 text-xs' : 'py-2.5 pr-3 pl-10 text-sm')

const FIELD_STYLE: React.CSSProperties = {
  backgroundColor: 'color-mix(in oklab, var(--brand-background) 55%, transparent)',
  borderColor: 'color-mix(in oklab, var(--brand-text) 15%, transparent)',
  color: 'var(--brand-text)',
}

function Notice({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg px-3 py-2 text-sm"
      style={{
        backgroundColor:
          tone === 'error' ? 'rgb(220 38 38 / 0.14)' : 'rgb(56 189 248 / 0.14)',
        color: tone === 'error' ? 'rgb(252 165 165)' : 'var(--brand-accent)',
      }}
    >
      {children}
    </div>
  )
}

type IconProps = { className?: string }
const svg = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const MailIcon = ({ className }: IconProps) => (
  <svg {...svg} className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </svg>
)
const LockIcon = ({ className }: IconProps) => (
  <svg {...svg} className={className}>
    <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" />
    <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
  </svg>
)
const EyeIcon = ({ className }: IconProps) => (
  <svg {...svg} className={className}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.75" />
  </svg>
)
const EyeOffIcon = ({ className }: IconProps) => (
  <svg {...svg} className={className}>
    <path d="M3 3l18 18" />
    <path d="M10.6 6.1A8.6 8.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3.2 3.8" />
    <path d="M6.3 8.2A16 16 0 0 0 2.5 12S6 18 12 18a8.9 8.9 0 0 0 3.4-.65" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
)
const ArrowIcon = ({ className }: IconProps) => (
  <svg {...svg} className={className}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
)
