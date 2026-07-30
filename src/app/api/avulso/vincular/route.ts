import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabaseServer'
import type { SupabaseClient } from '@supabase/supabase-js'

// POST /api/avulso/vincular
// Vincula um documento avulso a uma diligência (CCC). Copia os tokens/links do
// ZapSign do avulso para a diligência e, se o documento já estiver assinado,
// baixa o PDF assinado e grava no anexo da diligência — para entrar no PDF final.
//
// Assinaturas FUTURAS fluem sozinhas: como o token do avulso passa a ser o
// zapsign_document_id_* da diligência, o webhook do ZapSign vai achar a
// diligência e salvar o assinado automaticamente.

const STORAGE_BUCKET = 'documentos'

interface ParteDoc {
  token?: string | null
  filename?: string | null
  linkAdriana?: string | null
  linkAdvogado?: string | null
}

export interface VincularAvulsoBody {
  avulsoId: string
  diligenciaId: string
  contrato?: ParteDoc
  recibo?: ParteDoc
}

// Consulta o documento na ZapSign; se já assinado, baixa o PDF e grava no Storage
// no MESMO caminho que o webhook usa (para futuras regravações baterem).
async function baixarAssinadoSeHouver(
  token: string,
  apiToken: string,
  supabase: SupabaseClient,
  diligenciaId: string,
  tipo: 'contrato' | 'recibo',
): Promise<string | null> {
  try {
    const res = await fetch(`https://api.zapsign.com.br/api/v1/docs/${token}/`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 'signed' || !data.signed_file) return null

    const pdfRes = await fetch(data.signed_file)
    if (!pdfRes.ok) return null
    const bytes = Buffer.from(await pdfRes.arrayBuffer())

    const path = `diligencias/${diligenciaId}/${tipo}-assinado.pdf`
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, bytes, { contentType: 'application/pdf', upsert: true })
    if (error) { console.error('[vincular] upload assinado:', error.message); return null }

    return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl
  } catch (e) {
    console.error('[vincular] baixarAssinado:', e)
    return null
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as VincularAvulsoBody
  const { avulsoId, diligenciaId, contrato, recibo } = body

  if (!diligenciaId) {
    return NextResponse.json({ error: 'diligenciaId ausente.' }, { status: 400 })
  }

  const apiToken = process.env.ZAPSIGN_API_TOKEN
  const supabase = createSupabaseServiceClient()

  const patch: Record<string, unknown> = {}
  let contratoAssinado = false
  let reciboAssinado = false

  if (contrato?.token) {
    patch.zapsign_document_id_contrato = contrato.token
    if (contrato.filename) patch.anexo_contrato_gerado = contrato.filename
    if (contrato.linkAdriana) patch.link_assinatura_adriana = contrato.linkAdriana
    if (contrato.linkAdvogado) patch.link_assinatura_advogado_contrato = contrato.linkAdvogado
    const signedUrl = apiToken
      ? await baixarAssinadoSeHouver(contrato.token, apiToken, supabase, diligenciaId, 'contrato')
      : null
    if (signedUrl) {
      patch.anexo_contrato_assinado = signedUrl
      patch.status_assinatura_contrato = 'assinado'
      contratoAssinado = true
    } else {
      patch.status_assinatura_contrato = 'pendente'
    }
  }

  if (recibo?.token) {
    patch.zapsign_document_id_recibo = recibo.token
    if (recibo.filename) patch.anexo_recibo_gerado = recibo.filename
    if (recibo.linkAdvogado) patch.link_assinatura_advogado_recibo = recibo.linkAdvogado
    const signedUrl = apiToken
      ? await baixarAssinadoSeHouver(recibo.token, apiToken, supabase, diligenciaId, 'recibo')
      : null
    if (signedUrl) {
      patch.anexo_recibo_assinado = signedUrl
      patch.status_assinatura_recibo = 'assinado'
      reciboAssinado = true
    } else {
      patch.status_assinatura_recibo = 'pendente'
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'O avulso não tem contrato nem recibo para vincular.' }, { status: 400 })
  }

  const { error: upErr } = await supabase.from('diligencias').update(patch).eq('id', diligenciaId)
  if (upErr) {
    console.error('[vincular] update diligência:', upErr.message)
    return NextResponse.json({ error: `Banco (diligência): ${upErr.message}` }, { status: 500 })
  }

  if (avulsoId) {
    const { error: avErr } = await supabase
      .from('documentos_avulsos')
      .update({ diligencia_vinculada_id: diligenciaId })
      .eq('id', avulsoId)
    if (avErr) console.error('[vincular] marcar avulso:', avErr.message)
  }

  return NextResponse.json({ ok: true, contratoAssinado, reciboAssinado })
}
