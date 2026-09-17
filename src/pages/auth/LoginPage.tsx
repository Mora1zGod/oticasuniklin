import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/auth/SessionProvider'
import { Alert, Button, Field, Input } from '@/components/ui/primitives'
import { IconGlasses } from '@/components/ui/icons'
import { describeError } from '@/lib/errors'

export function LoginPage() {
  const { authSession, loading } = useSession()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && authSession) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)

    if (mode === 'signin') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) setError(describeError(err))
    } else {
      const { data, error: err } = await supabase.auth.signUp({ email, password })
      if (err) {
        setError(describeError(err))
      } else if (data.session) {
        // Confirmação de e-mail desligada: já entra.
      } else {
        setNotice('Confira seu e-mail para confirmar o cadastro e depois entre.')
      }
    }
    setBusy(false)
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-ink-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15">
            <IconGlasses className="size-6" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-white">Óticas Uniklin</h1>
          <p className="mt-1 text-sm text-ink-300">Gestão para óticas</p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-card bg-white p-6 shadow-2xl shadow-ink-950/40"
        >
          {error && <Alert>{error}</Alert>}
          {notice && <Alert tone="info">{notice}</Alert>}

          <Field label="E-mail" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </Field>

          <Field label="Senha" required hint={mode === 'signup' ? 'Mínimo de 6 caracteres.' : undefined}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </Field>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Aguarde…' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
          </Button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError(null)
              setNotice(null)
            }}
            className="w-full text-center text-xs text-ink-400 transition-colors hover:text-brand-700"
          >
            {mode === 'signin'
              ? 'Ainda não tem conta? Criar agora'
              : 'Já tem conta? Entrar'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs leading-relaxed text-ink-400">
          Foi convidado pela sua ótica? Crie a conta com o mesmo e-mail do convite —
          o acesso é liberado automaticamente.
        </p>
      </div>
    </div>
  )
}
