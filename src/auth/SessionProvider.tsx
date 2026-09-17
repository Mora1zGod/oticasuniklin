import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type SessionBranch = {
  id: string
  code: string
  trade_name: string
  is_default: boolean
  role: string
}

export type AppContextReady = {
  status: 'ready'
  app_user_id: string
  tenant_id: string
  full_name: string
  email: string
  is_tenant_admin: boolean
  is_salesperson: boolean
  tenant: { id: string; slug: string; trade_name: string }
  branches: SessionBranch[]
  permissions: string[]
}

export type AppContext = AppContextReady | { status: 'needs_onboarding' }

type SessionState = {
  authSession: Session | null
  context: AppContext | null
  loading: boolean
  /** Filial em que o usuário está operando agora. */
  branchId: string | null
  setBranchId: (id: string) => void
  can: (permission: string) => boolean
  reload: () => Promise<void>
  signOut: () => Promise<void>
}

const SessionCtx = createContext<SessionState | null>(null)
const BRANCH_STORAGE_KEY = 'uniklin.branch'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [authSession, setAuthSession] = useState<Session | null>(null)
  const [context, setContext] = useState<AppContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [branchId, setBranchIdState] = useState<string | null>(null)

  async function loadContext(session: Session | null) {
    if (!session) {
      setContext(null)
      setBranchIdState(null)
      setLoading(false)
      return
    }
    const { data, error } = await supabase.rpc('current_session_context')
    if (error) {
      console.error('current_session_context', error)
      setContext(null)
    } else {
      const ctx = data as unknown as AppContext
      setContext(ctx)
      if (ctx.status === 'ready') {
        const stored = localStorage.getItem(BRANCH_STORAGE_KEY)
        const valid = ctx.branches.find((b) => b.id === stored)
        const fallback = ctx.branches.find((b) => b.is_default) ?? ctx.branches[0]
        setBranchIdState(valid?.id ?? fallback?.id ?? null)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthSession(data.session)
      void loadContext(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session)
      setLoading(true)
      void loadContext(session)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const value = useMemo<SessionState>(() => {
    const ready = context?.status === 'ready' ? context : null
    return {
      authSession,
      context,
      loading,
      branchId,
      setBranchId: (id: string) => {
        localStorage.setItem(BRANCH_STORAGE_KEY, id)
        setBranchIdState(id)
      },
      can: (permission: string) =>
        ready ? ready.is_tenant_admin || ready.permissions.includes(permission) : false,
      reload: async () => {
        setLoading(true)
        await loadContext(authSession)
      },
      signOut: async () => {
        await supabase.auth.signOut()
        localStorage.removeItem(BRANCH_STORAGE_KEY)
      },
    }
  }, [authSession, context, loading, branchId])

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}

export function useSession(): SessionState {
  const ctx = useContext(SessionCtx)
  if (!ctx) throw new Error('useSession precisa estar dentro de <SessionProvider>')
  return ctx
}

/** Contexto já pronto — use nas telas internas, depois do ProtectedRoute. */
export function useAppContext(): AppContextReady {
  const { context } = useSession()
  if (context?.status !== 'ready') {
    throw new Error('Contexto da ótica indisponível')
  }
  return context
}

/** Filial ativa. As telas operacionais sempre gravam nela. */
export function useBranchId(): string {
  const { branchId } = useSession()
  if (!branchId) throw new Error('Nenhuma filial selecionada')
  return branchId
}
