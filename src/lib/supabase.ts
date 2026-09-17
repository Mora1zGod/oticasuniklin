import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja .env.example).',
  )
}

/**
 * Cliente único do app. A `anon key` é pública por design — quem protege os
 * dados é a RLS, habilitada em todas as tabelas de negócio (ADR-008).
 * A `service_role` key NUNCA entra no frontend.
 */
export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
