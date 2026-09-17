import { useState } from 'react'
import type { Branding } from '@/branding/branding'
import { LoginLayout } from './LoginLayout'
import { LoginForm, type LoginFormMode } from './LoginForm'

/**
 * A tela de login de verdade, em miniatura e sem autenticação. A tela de
 * Identidade Visual a usa para mostrar o efeito de cada alteração — como é o
 * mesmo LoginLayout/LoginForm do login real, o preview não pode divergir dele.
 */
export function LoginPreview({ branding }: { branding: Branding }) {
  const [mode, setMode] = useState<LoginFormMode>('signin')
  const [showPassword, setShowPassword] = useState(false)

  return (
    <LoginLayout branding={branding} compact>
      <LoginForm
        compact
        inert
        mode={mode}
        onModeChange={setMode}
        email=""
        onEmailChange={() => {}}
        password=""
        onPasswordChange={() => {}}
        showPassword={showPassword}
        onShowPasswordChange={setShowPassword}
        onSubmit={(event) => event.preventDefault()}
      />
    </LoginLayout>
  )
}
