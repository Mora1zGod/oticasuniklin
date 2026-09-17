import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from './SessionProvider'
import { Spinner } from '@/components/ui/Spinner'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { authSession, context, loading } = useSession()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Carregando sua ótica…" />
      </div>
    )
  }

  if (!authSession) {
    return <Navigate to="/entrar" state={{ from: location.pathname }} replace />
  }

  // Autenticado no Supabase mas ainda sem ótica: onboarding (migration 0010).
  if (context?.status === 'needs_onboarding') {
    return <Navigate to="/primeiro-acesso" replace />
  }

  if (context?.status !== 'ready') {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
          Não foi possível carregar o contexto da sua ótica. Recarregue a página ou
          entre novamente.
        </div>
      </div>
    )
  }

  return <>{children}</>
}
