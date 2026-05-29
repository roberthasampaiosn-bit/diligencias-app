import { supabase } from '@/lib/supabase'
import { DocumentoAvulso } from '@/types'
import { DocumentoAvulsoRow } from '@/types/db'

function toDocumentoAvulso(row: DocumentoAvulsoRow): DocumentoAvulso {
  return {
    id: row.id,
    advogadoId: row.advogado_id,
    advogadoNome: row.advogado_nome,
    tipo: row.tipo as DocumentoAvulso['tipo'],
    valor: row.valor,
    dataAtendimento: row.data_atendimento ?? undefined,
    tipoServico: row.tipo_servico ?? undefined,
    filenameContrato: row.filename_contrato ?? undefined,
    zapsignTokenContrato: row.zapsign_token_contrato ?? undefined,
    linkAssinaturaAdriana: row.link_assinatura_adriana ?? undefined,
    linkAssinaturaAdvogadoContrato: row.link_assinatura_advogado_contrato ?? undefined,
    filenameRecibo: row.filename_recibo ?? undefined,
    zapsignTokenRecibo: row.zapsign_token_recibo ?? undefined,
    linkAssinaturaAdvogadoRecibo: row.link_assinatura_advogado_recibo ?? undefined,
    createdAt: row.created_at,
  }
}

export async function fetchDocumentosAvulsos(): Promise<DocumentoAvulso[]> {
  const { data, error } = await supabase
    .from('documentos_avulsos')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as DocumentoAvulsoRow[]).map(toDocumentoAvulso)
}

export async function insertDocumentoAvulso(
  doc: Omit<DocumentoAvulso, 'id' | 'createdAt'>,
): Promise<DocumentoAvulso> {
  const payload = {
    advogado_id: doc.advogadoId,
    advogado_nome: doc.advogadoNome,
    tipo: doc.tipo,
    valor: doc.valor,
    data_atendimento: doc.dataAtendimento ?? null,
    tipo_servico: doc.tipoServico ?? null,
    filename_contrato: doc.filenameContrato ?? null,
    zapsign_token_contrato: doc.zapsignTokenContrato ?? null,
    link_assinatura_adriana: doc.linkAssinaturaAdriana ?? null,
    link_assinatura_advogado_contrato: doc.linkAssinaturaAdvogadoContrato ?? null,
    filename_recibo: doc.filenameRecibo ?? null,
    zapsign_token_recibo: doc.zapsignTokenRecibo ?? null,
    link_assinatura_advogado_recibo: doc.linkAssinaturaAdvogadoRecibo ?? null,
  }
  const { data, error } = await supabase
    .from('documentos_avulsos')
    .insert(payload)
    .select()
    .single()
  if (error) throw new Error(`Supabase: ${error.message}`)
  return toDocumentoAvulso(data as DocumentoAvulsoRow)
}
