import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Database } from '@/types/database'

export type TableName = keyof Database['public']['Tables']
export type Row<T extends TableName> = Database['public']['Tables'][T]['Row']
export type Insert<T extends TableName> = Database['public']['Tables'][T]['Insert']
export type Update<T extends TableName> = Database['public']['Tables'][T]['Update']

export type ViewName = keyof Database['public']['Views']
export type ViewRow<T extends ViewName> = Database['public']['Views'][T]['Row']

export type Relation = TableName | ViewName

/**
 * Acesso tipado: use `supabase.from('tabela')` diretamente nas telas. Envolver
 * em um genérico faz o postgrest-js perder a inferência de coluna (o T vira
 * união de todas as tabelas), então aqui só reexportamos o cliente.
 */
export { supabase }

/**
 * Acesso sem tipagem de tabela, para código genérico que recebe o nome da
 * relação em runtime (CrudPage). O TypeScript não consegue provar que uma
 * coluna existe quando a tabela é um parâmetro genérico — aqui a checagem é do
 * banco (RLS + constraints), e a tipagem fica na borda do componente.
 */
export const looseFrom = (table: string) =>
  (supabase as unknown as SupabaseClient).from(table)

/**
 * Converte "" em null antes de mandar pro banco: campo vazio de formulário é
 * ausência de dado, não string vazia (as constraints de documento contam com isso).
 */
export function blanksToNull<T extends Record<string, unknown>>(payload: T): T {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    out[key] = value === '' ? null : value
  }
  return out as T
}

/** Erro do Postgrest vira exceção — o React Query trata em onError. */
export function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error
  if (data === null) throw new Error('Registro não encontrado.')
  return data
}
