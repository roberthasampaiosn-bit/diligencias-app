import { createClient } from '@supabase/supabase-js'

// Cliente com service_role — usar SOMENTE em rotas de API (server-side).
// Nunca importar em componentes client-side.
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}
