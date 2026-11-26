import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabaseServer'

// POST /api/zapsign/sem-assinatura  { diligenciaId, tipo: 'contrato' | 'recibo' }
// "Encerrar sem assinatura": quando o escritório desiste de esperar a assinatura,
// baixa da ZapSign o PDF que foi ENVIADO (sem assinatura), anexa no lugar do
// documento assinado e registra na observação interna. A pendência sai e o PDF
// final passa a incluir esse documento. Exige usuário logado.

const BUCKET = 'documentos'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Faça login novamente.' }, { status: 401 })
  const supabase = createSupabaseServiceClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !auth.user) return NextResponse.json({ error: 'Sessão expirada — faça login novamente.' }, { status: 401 })

  const apiToken = process.env.ZAPSIGN_API_TOKEN
  if (!apiToken) return NextResponse.json({ error: 'ZAPSIGN_API_TOKEN não configurado.' }, { status: 500 })

  const body = (await req.json().catch(() => ({}))) as { diligenciaId?: string; tipo?: string }
  const tipo = body.tipo === 'recibo' ? 'recibo' : body.tipo === 'contrato' ? 'contrato' : null
  if (!body.diligenciaId || !tipo) return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })

  const { data: d, error } = await supabase.from('diligencias')
    .select('id, zapsign_document_id_contrato, zapsign_document_id_recibo, observacao_interna')
    .eq('id', body.diligenciaId).single()
  if (error || !d) return NextResponse.json({ error: 'Diligência não encontrada.' }, { status: 404 })
  const docToken = tipo === 'contrato' ? d.zapsign_document_id_contrato : d.zapsign_document_id_recibo
  if (!docToken) return NextResponse.json({ error: `Este ${tipo} nunca foi gerado na ZapSign — use "Não se aplica".` }, { status: 400 })

  const zap = await fetch(`https://api.zapsign.com.br/api/v1/docs/${docToken}/`, { headers: { Authorization: `Bearer ${apiToken}` } })
  if (!zap.ok) return NextResponse.json({ error: `ZapSign respondeu ${zap.status}.` }, { status: 502 })
  const doc = await zap.json()
  // Se no meio tempo foi assinado, usa o assinado.
  const assinado = doc.status === 'signed' && doc.signed_file
  const arquivo = assinado ? doc.signed_file : doc.original_file
  if (!arquivo) return NextResponse.json({ error: 'A ZapSign não devolveu o arquivo.' }, { status: 502 })
  const pdf = await fetch(arquivo)
  if (!pdf.ok) return NextResponse.json({ error: 'Não consegui baixar o PDF da ZapSign.' }, { status: 502 })

  const path = `diligencias/${d.id}/${tipo}-${assinado ? 'assinado' : 'sem-assinatura'}-${Date.now()}.pdf`
  const up = await supabase.storage.from(BUCKET).upload(path, Buffer.from(await pdf.arrayBuffer()), { contentType: 'application/pdf', upsert: true })
  if (up.error) return NextResponse.json({ error: `Storage: ${up.error.message}` }, { status: 500 })
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const nota = assinado ? '' : `[${tipo === 'contrato' ? 'Contrato' : 'Recibo'} anexado SEM assinatura em ${hoje} — encerrado sem aguardar]`
  const patch: Record<string, unknown> = {
    [tipo === 'contrato' ? 'anexo_contrato_assinado' : 'anexo_recibo_assinado']: url,
    updated_at: new Date().toISOString(),
  }
  if (assinado) patch[tipo === 'contrato' ? 'status_assinatura_contrato' : 'status_assinatura_recibo'] = 'assinado'
  if (nota) patch.observacao_interna = [d.observacao_interna, nota].filter(Boolean).join('\n')
  const upd = await supabase.from('diligencias').update(patch).eq('id', d.id)
  if (upd.error) return NextResponse.json({ error: `Banco: ${upd.error.message}` }, { status: 500 })

  return NextResponse.json({ ok: true, url, assinado: !!assinado })
}
