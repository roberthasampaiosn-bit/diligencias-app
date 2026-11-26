import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabaseServer'

// POST /api/drive/assinar
// Autoriza o navegador a mandar o PDF final DIRETO para o Google Apps Script
// (scripts/drive-salvar-pdf.gs), que grava na pasta do mês no Google Drive.
//
// O PDF não passa por aqui (a Vercel limita 4,5 MB por requisição). Esta rota
// só devolve { scriptUrl, payload } com uma assinatura HMAC válida por 10 min;
// o segredo (GDRIVE_SCRIPT_SECRET) fica no servidor e no Apps Script, nunca no
// navegador. Assim ninguém de fora consegue jogar arquivos na pasta do Drive.

const VALIDADE_MS = 10 * 60 * 1000

export async function POST(req: NextRequest): Promise<NextResponse> {
  const scriptUrl = process.env.GDRIVE_SCRIPT_URL
  const segredo = process.env.GDRIVE_SCRIPT_SECRET
  if (!scriptUrl || !segredo) {
    return NextResponse.json(
      { error: 'Envio ao Google Drive ainda não configurado (GDRIVE_SCRIPT_URL / GDRIVE_SCRIPT_SECRET).' },
      { status: 500 },
    )
  }

  // Só usuários logados no app.
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Faça login novamente.' }, { status: 401 })
  const { data, error } = await createSupabaseServiceClient().auth.getUser(token)
  if (error || !data.user) return NextResponse.json({ error: 'Sessão expirada — faça login novamente.' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { nome?: string; empresa?: string; ano?: string; mes?: string }
  const nome = String(body.nome ?? '').trim()
  const empresa = body.empresa === 'VTAL' ? 'VTAL' : 'BAT'
  const ano = String(body.ano ?? '')
  const mes = String(body.mes ?? '').padStart(2, '0')
  if (!nome || !/^\d{4}$/.test(ano) || !/^(0[1-9]|1[0-2])$/.test(mes)) {
    return NextResponse.json({ error: 'Nome do arquivo ou mês/ano inválido.' }, { status: 400 })
  }

  const exp = Date.now() + VALIDADE_MS
  // Mesma string que o Apps Script remonta para conferir a assinatura.
  const base = [exp, empresa, ano, mes, nome].join('|')
  const sig = createHmac('sha256', segredo).update(base, 'utf8').digest('hex')

  return NextResponse.json({ scriptUrl, payload: { exp, empresa, ano, mes, nome, sig } })
}
