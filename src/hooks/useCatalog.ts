import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppContext } from '@/auth/SessionProvider'

export type CatalogItem = {
  id: string
  code: string
  label: string
  sort_order: number
  is_platform: boolean
}

/**
 * Lista efetiva de um catálogo configurável (ADR-010): itens do tenant
 * sobrepõem os da plataforma quando o `code` coincide.
 */
export function useCatalog(catalogKey: string) {
  const ctx = useAppContext()
  return useQuery({
    queryKey: ['catalog', catalogKey, ctx.tenant_id],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CatalogItem[]> => {
      const { data, error } = await supabase.rpc('resolve_catalog', {
        p_catalog_key: catalogKey,
        p_tenant_id: ctx.tenant_id,
      })
      if (error) throw error
      return [...(data ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label),
      )
    },
  })
}
