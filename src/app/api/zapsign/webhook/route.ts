import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabaseServer'

// POST /api/zapsign/webhook
// Configurar no painel ZapSign:
//   Dashboard > Configurações > Webhooks > URL: https://<seu-domínio>/api/zapsign/webhook
//
// Evento: doc_signed — dispara para CADA assinatura.
//   payload.status === 'signed'  → todos os signatários assinaram → salvar PDF
//   payload.status === 'pending' → ainda falta alguém             → ignorar
//
// ATENÇÃO: payload.signed_file expira em 60 minutos. O PDF deve ser baixado
// imediatamente ao receber o webhook.
//
// Estrutura real do payload (flat — sem wrapper 'document'):
// {
//   event_type: "doc_signed",
//   token: "<document_token>",
//   status: "signed" | "pending",
//   signed_file: "<url_temporaria>",
//   ...
// }

// Payload real da ZapSign (campos relevantes no nível raiz)
interface ZapSignWebhookPayload {
  event_type: string
  token: string
  status: string
  signed_file?: string | null
  name?: string
}

const STORAGE_BUCKET = 'documentos'

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Parse do payload ──────────────────────────────────────────────────────
  let payload: ZapSignWebhookPayload
  try {
    payload = await req.json()
  } catch {
    console.error('[webhook] Payload inválido — não é JSON')
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const { event_type, token: documentToken, status, signed_file } = payload

  console.log(`[webhook] Recebido: event_type=${event_type} token=${documentToken} status=${status}`)

  // ── 2. Filtrar apenas doc_signed quando todos os signatários concluíram ──────
  if (event_type !== 'doc_signed') {
    console.log(`[webhook] Ignorando evento: ${event_type}`)
    return NextResponse.json({ ok: true, ignored: event_type })
  }

  if (status !== 'signed') {
    // Documento ainda tem signatários pendentes — aguardar próximo disparo
    console.log(`[webhook] doc_signed com status "${status}" — aguardando demais assinaturas.`)
    return NextResponse.json({ ok: true, ignored: `status=${status}` })
  }

  if (!documentToken) {
    console.error('[webhook] token ausente no payload')
    return NextResponse.json({ error: 'token ausente no payload.' }, { status: 400 })
  }

  // ── 3. Localizar a diligência pelo token (contrato ou recibo) ────────────────
  const supabase = createSupabaseServiceClient()

  const { data: rows, error: findErr } = await supabase
    .from('diligencias')
    .select('id, zapsign_document_id_contrato, zapsign_document_id_recibo')
    .or(
      `zapsign_document_id_contrato.eq.${documentToken},zapsign_document_id_recibo.eq.${documentToken}`,
    )
    .limit(1)

  if (findErr) {
    console.error('[webhook] Erro ao buscar diligência:', findErr.message, findErr.details)
    return NextResponse.json({ error: findErr.message }, { status: 500 })
  }

  if (!rows?.length) {
    console.warn('[webhook] Diligência não encontrada para token:', documentToken)
    // Retornar 200 para a ZapSign não retentar
    return NextResponse.json({ ok: false, message: 'Diligência não encontrada.' })
  }

  const row = rows[0] as {
    id: string
    zapsign_document_id_contrato: string | null
    zapsign_document_id_recibo: string | null
  }

  const diligenciaId = row.id
  const tipo: 'contrato' | 'recibo' =
    row.zapsign_document_id_contrato === documentToken ? 'contrato' : 'recibo'

  console.log(`[webhook] Diligência ${diligenciaId} — tipo: ${tipo}`)

  // ── 4. Obter URL do PDF assinado ─────────────────────────────────────────────
  // Prioriza o campo no payload (expira em 60 min — baixar IMEDIATAMENTE).
  // Se ausente, busca via API da ZapSign.
  let signedFileUrl: string = signed_file ?? ''

  if (!signedFileUrl) {
    const apiToken = process.env.ZAPSIGN_API_TOKEN
    if (!apiToken) {
      console.error('[webhook] ZAPSIGN_API_TOKEN não configurado')
      return NextResponse.json({ error: 'ZAPSIGN_API_TOKEN não configurado.' }, { status: 500 })
    }

    console.log(`[webhook] signed_file ausente no payload — buscando via API para token ${documentToken}`)
    const docRes = await fetch(`https://api.zapsign.com.br/api/v1/docs/${documentToken}/`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })

    if (!docRes.ok) {
      const errText = await docRes.text()
      console.error(`[webhook] Erro ${docRes.status} ao buscar documento na ZapSign:`, errText)
      return NextResponse.json({ error: `ZapSign API ${docRes.status}: ${errText}` }, { status: 502 })
    }

    const docData = await docRes.json()
    signedFileUrl = docData.signed_file ?? ''
    console.log('[webhook] signed_file via API:', signedFileUrl || '(vazio)')
  }

  if (!signedFileUrl) {
    console.error('[webhook] URL do PDF assinado não disponível para token:', documentToken)
    return NextResponse.json({ error: 'signed_file não disponível.' }, { status: 502 })
  }

  // ── 5. Baixar o PDF assinado (link expira em 60 min) ─────────────────────────
  console.log('[webhook] Baixando PDF assinado...')
  const pdfRes = await fetch(signedFileUrl)
  if (!pdfRes.ok) {
    console.error(`[webhook] Erro ${pdfRes.status} ao baixar PDF assinado`)
    return NextResponse.json({ error: `Download PDF falhou: ${pdfRes.status}` }, { status: 502 })
  }
  const pdfBytes = await pdfRes.arrayBuffer()
  console.log(`[webhook] PDF baixado: ${pdfBytes.byteLength} bytes`)

  // ── 6. Upload no Supabase Storage ────────────────────────────────────────────
  const storagePath =
    tipo === 'contrato'
      ? `diligencias/${diligenciaId}/contrato-assinado.pdf`
      : `diligencias/${diligenciaId}/recibo-assinado.pdf`

  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true })

  if (upErr) {
    console.error('[webhook] Erro no upload para Storage:', upErr.message)
    return NextResponse.json({ error: `Storage: ${upErr.message}` }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
  const publicUrl = urlData.publicUrl
  console.log('[webhook] PDF salvo no Storage:', publicUrl)

  // ── 7. Atualizar a diligência no banco ───────────────────────────────────────
  const dbPatch: Record<string, string> =
    tipo === 'contrato'
      ? { anexo_contrato_assinado: publicUrl, status_assinatura_contrato: 'assinado' }
      : { anexo_recibo_assinado: publicUrl, status_assinatura_recibo: 'assinado' }

  const { error: patchErr } = await supabase
    .from('diligencias')
    .update(dbPatch)
    .eq('id', diligenciaId)

  if (patchErr) {
    console.error('[webhook] Erro ao atualizar diligência:', patchErr.message, patchErr.details)
    return NextResponse.json({ error: `DB: ${patchErr.message}` }, { status: 500 })
  }

  console.log(`[webhook] ✓ ${tipo} assinado salvo — diligência ${diligenciaId}`)
  return NextResponse.json({ ok: true, tipo, diligenciaId, publicUrl })
}
