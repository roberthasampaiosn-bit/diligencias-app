import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// keepalive: garante que gravações curtas (ex.: registrar envio de WhatsApp)
// completem mesmo se a aba perder o foco ou navegar logo após — ao abrir o
// WhatsApp o navegador pode descartar requisições em voo.
//
// IMPORTANTE: keepalive só pode ser usado com corpos PEQUENOS. O navegador
// impõe um limite de ~64KB no corpo de requisições keepalive; acima disso ele
// REJEITA a requisição ("Failed to fetch" no Chrome, "Load failed" no iOS).
// Por isso o keepalive precisa ser condicional: se aplicado ao upload direto de
// um anexo (fallback de arquivos grandes em uploadArquivoAnexo), o upload falha
// no notebook e no iPhone. Só ligamos o keepalive quando o corpo é pequeno.
const KEEPALIVE_MAX_BYTES = 60_000

function tamanhoDoCorpo(body: BodyInit | null | undefined): number {
  if (body == null) return 0
  if (typeof body === 'string') return body.length
  if (body instanceof Blob) return body.size
  if (body instanceof ArrayBuffer) return body.byteLength
  if (ArrayBuffer.isView(body)) return body.byteLength
  // FormData / ReadableStream / URLSearchParams: tamanho desconhecido → trata
  // como "grande" para nunca arriscar estourar o limite do keepalive.
  return Number.POSITIVE_INFINITY
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (input, init) => {
      const usarKeepalive = tamanhoDoCorpo(init?.body) <= KEEPALIVE_MAX_BYTES
      return usarKeepalive ? fetch(input, { ...init, keepalive: true }) : fetch(input, init)
    },
  },
})
