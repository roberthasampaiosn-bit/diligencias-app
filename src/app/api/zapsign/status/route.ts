import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabaseServer'

// POST /api/zapsign/status  { tokens: string[] }
// Consulta na ZapSign quem já assinou cada documento (Adriana x advogado), para a
// tela "Resolver pendências" mostrar exatamente o que falta (ex.: "falta a
// Adriana assinar"). Só leitura; exige usuário logado.

export interface StatusSigner { nome: string; assinou: boolean; adriana: boolean }
export interface StatusDoc { status: string; signers: StatusSigner[] }
export type StatusZapSignResult = Record<string, StatusDoc | null>

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Faça login novamente.' }, { status: 401 })
  const { data, error } = await createSupabaseServiceClient().auth.getUser(token)
  if (error || !data.user) return NextResponse.json({ error: 'Sessão expirada — faça login novamente.' }, { status: 401 })

  const apiToken = process.env.ZAPSIGN_API_TOKEN
  if (!apiToken) return NextResponse.json({ error: 'ZAPSIGN_API_TOKEN não configurado.' }, { status: 500 })

  const body = (await req.json().catch(() => ({}))) as { tokens?: string[] }
  const tokens = Array.from(new Set((body.tokens ?? []).filter((t) => typeof t === 'string' && /^[\w-]{8,}$/.test(t)))).slice(0, 100)
  const emailAdriana = (process.env.ZAPSIGN_EMAIL_ADRIANA ?? '').toLowerCase()

  const result: StatusZapSignResult = {}
  await Promise.all(tokens.map(async (t) => {
    try {
      const res = await fetch(`https://api.zapsign.com.br/api/v1/docs/${t}/`, {
        headers: { Authorization: `Bearer ${apiToken}` },
        cache: 'no-store',
      })
      if (!res.ok) { result[t] = null; return }
      const doc = await res.json()
      result[t] = {
        status: String(doc.status ?? ''),
        signers: (doc.signers ?? []).map((s: { name?: string; email?: string; status?: string }) => ({
          nome: String(s.name ?? ''),
          assinou: s.status === 'signed',
          adriana: (!!emailAdriana && (s.email ?? '').toLowerCase() === emailAdriana) || /^adriana\b/i.test(s.name ?? ''),
        })),
      }
    } catch {
      result[t] = null
    }
  }))

  return NextResponse.json(result)
}
