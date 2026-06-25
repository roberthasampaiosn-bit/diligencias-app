import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// keepalive: garante que gravações curtas (ex.: registrar envio de WhatsApp)
// completem mesmo se a aba perder o foco ou navegar logo após — ao abrir o
// WhatsApp o navegador pode descartar requisições em voo. Payloads são pequenos
// (bem abaixo do limite de 64KB do keepalive).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (input, init) => fetch(input, { ...init, keepalive: true }),
  },
})
