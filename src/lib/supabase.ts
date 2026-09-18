import { createClient } from '@supabase/supabase-js'
import { resolveTenantBase } from '@/branding/branding'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja .env.example).',
  )
}

/**
 * Trava contra a chave errada.
 *
 * O Vite embute as variáveis `VITE_*` no bundle, que é público. Se alguém colar
 * aqui a chave secreta do Supabase (`sb_secret_…` ou a legada `service_role`),
 * ela vai parar dentro do JavaScript servido a qualquer visitante — e essa
 * chave IGNORA a RLS, ou seja, daria acesso total ao banco.
 *
 * O Supabase recusa esse uso no navegador ("Forbidden use of secret API key in
 * browser"), mas o erro só aparece na primeira requisição, depois do build e do
 * deploy. Aqui a falha acontece imediatamente e diz o que fazer.
 */
function assertPublicKey(key: string): void {
  const isSecretFormat = key.startsWith('sb_secret_')

  // Chave legada: JWT cujo payload traz "role": "service_role"
  let isLegacyServiceRole = false
  const payload = key.split('.')[1]
  if (key.startsWith('eyJ') && payload) {
    try {
      const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
      isLegacyServiceRole = claims?.role === 'service_role'
    } catch {
      // não é um JWT legível: segue o fluxo normal
    }
  }

  if (isSecretFormat || isLegacyServiceRole) {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY está com a CHAVE SECRETA do Supabase. ' +
        'Ela ignora a RLS e não pode ir para o navegador. ' +
        'Use a chave "Publishable" (sb_publishable_…) ou a "anon public" legada, ' +
        'em Project Settings → API Keys. ' +
        'Se a chave secreta já foi publicada em algum deploy, revogue-a no painel.',
    )
  }
}

assertPublicKey(anonKey)

/**
 * Cliente único do app. A chave publishable é pública por design — quem protege
 * os dados é a RLS, habilitada em todas as tabelas de negócio (ADR-008).
 */
/**
 * Qual ótica esta aba está operando.
 *
 * Vai como cabeçalho em toda requisição porque o endereço é que identifica a
 * ótica (uniklin.com/nomedaotica). Quem tem acesso a mais de uma — a ótica que
 * opera a plataforma — muda de ótica mudando de endereço, e o banco confere:
 * o cabeçalho escolhe entre as óticas da pessoa, nunca dá acesso a uma nova.
 */
const tenantSlug = resolveTenantBase().slug

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  ...(tenantSlug ? { global: { headers: { 'x-tenant-slug': tenantSlug } } } : {}),
})
