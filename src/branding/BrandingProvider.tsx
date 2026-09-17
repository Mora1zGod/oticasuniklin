import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/auth/SessionProvider'
import {
  DEFAULT_BRANDING,
  brandingCssVars,
  resolveTenantSlug,
  toBranding,
  type Branding,
} from './branding'

type BrandingState = {
  branding: Branding
  loading: boolean
  /** Recarrega depois de salvar na tela de Identidade Visual. */
  refresh: () => Promise<void>
}

const BrandingCtx = createContext<BrandingState | null>(null)

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { context } = useSession()
  const tenantId = context?.status === 'ready' ? context.tenant_id : null

  const query = useQuery({
    queryKey: ['branding', tenantId ?? resolveTenantSlug() ?? 'default'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Branding> => {
      // Depois do login: a marca é a do tenant da sessão.
      if (tenantId) {
        const { data, error } = await supabase
          .from('tenant_branding')
          .select('*')
          .eq('tenant_id', tenantId)
          .maybeSingle()
        if (error) throw error

        const { data: tenant } = await supabase
          .from('tenants')
          .select('slug, trade_name')
          .eq('id', tenantId)
          .maybeSingle()

        return toBranding({ ...(tenant ?? {}), ...(data ?? {}) }, tenantId)
      }

      // Na tela de login ainda não há sessão: a função devolve só dado público.
      const { data, error } = await supabase.rpc('branding_for_login', {
        p_slug: resolveTenantSlug(),
      })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return toBranding(row as Record<string, string | null> | null, row?.tenant_id ?? null)
    },
  })

  const branding = query.data ?? DEFAULT_BRANDING

  // As variáveis vão no <html> para qualquer tela poder usar var(--brand-*).
  useEffect(() => {
    const root = document.documentElement
    const vars = brandingCssVars(branding)
    for (const [name, value] of Object.entries(vars)) {
      root.style.setProperty(name, value)
    }
  }, [branding])

  // Título e favicon acompanham a marca.
  useEffect(() => {
    document.title = branding.companyName
    if (!branding.faviconUrl) return
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = branding.faviconUrl
  }, [branding.companyName, branding.faviconUrl])

  const value = useMemo<BrandingState>(
    () => ({
      branding,
      loading: query.isLoading,
      refresh: async () => {
        await query.refetch()
      },
    }),
    [branding, query],
  )

  return <BrandingCtx.Provider value={value}>{children}</BrandingCtx.Provider>
}

export function useBranding(): BrandingState {
  const ctx = useContext(BrandingCtx)
  if (!ctx) throw new Error('useBranding precisa estar dentro de <BrandingProvider>')
  return ctx
}
