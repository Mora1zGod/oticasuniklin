import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/auth/SessionProvider'
import { useBranding } from '@/branding/BrandingProvider'
import { describeError } from '@/lib/errors'
import { LoginLayout } from './LoginLayout'
import { LoginForm, type LoginFormMode } from './LoginForm'

/**
 * A autenticação em si não mudou: e-mail/senha do Supabase Auth, com signup e a
 * regra de convite (quem foi convidado cria a conta com o mesmo e-mail e o
 * trigger on_auth_user_created libera o acesso).
 */
export function LoginPage() {
  const { authSession, loading } = useSession()
  const { branding } = useBranding()
  const [mode, setMode] = useState<LoginFormMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      } else if (!data.session) {
        setNotice('Confira seu e-mail para confirmar o cadastro e depois entre.')
      }
    }
    setBusy(false)
  }

  return (
    <LoginLayout branding={branding}>
      <LoginForm
        mode={mode}
        onModeChange={(next) => {
          setMode(next)
          setError(null)
          setNotice(null)
        }}
        email={email}
        onEmailChange={setEmail}
        password={password}
        onPasswordChange={setPassword}
        showPassword={showPassword}
        onShowPasswordChange={setShowPassword}
        error={error}
        notice={notice}
        busy={busy}
        onSubmit={submit}
      />
    </LoginLayout>
  )
}
