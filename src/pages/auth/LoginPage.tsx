import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/auth/SessionProvider'
import { useBranding } from '@/branding/BrandingProvider'
import { resolveTenantBase } from '@/branding/branding'
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
      // Para onde o link do e-mail de confirmação leva.
      //
      // Sem isto o Supabase usa a "Site URL" do projeto, que nasce apontando
      // para `http://localhost:3000` — o link chega ao cliente mandando abrir o
      // localhost DELE, que não existe. A pessoa clica, o navegador diz que não
      // consegue acessar o site, e trocar de navegador não adianta.
      //
      // Com o endereço da ótica aqui, o link volta para o lugar certo: quem se
      // cadastra em /nomedaotica confirma e cai dentro dela, não na raiz.
      const { basename } = resolveTenantBase()
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}${basename}` },
      })
      if (err) {
        setError(describeError(err))
      } else if (!data.session) {
        setNotice(
          'Enviamos um e-mail de confirmação. Abra o link por aqui mesmo, no ' +
            'mesmo aparelho, e depois entre com a sua senha.',
        )
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
