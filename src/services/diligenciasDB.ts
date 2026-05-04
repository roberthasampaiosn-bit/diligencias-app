import { supabase } from '@/lib/supabase'
import { Diligencia, Ligacao, Pesquisa, Anexos, AvaliacaoAdvogado } from '@/types'
import { DiligenciaRow, LigacaoRow } from '@/types/db'
import { toDiligencia, fromDiligencia, toLigacao } from '@/lib/mappers'

const STORAGE_BUCKET = 'documentos'

const CAMPO_TO_FILENAME: Record<keyof Anexos, string> = {
  contratoGerado: 'contrato-gerado',
  contratoAssinado: 'contrato-assinado',
  reciboGerado: 'recibo-gerado',
  reciboAssinado: 'recibo-assinado',
  comprovantePagamento: 'comprovante-pagamento',
  comprovanteServico: 'comprovante-servico',
}

export async function uploadArquivoAnexo(
  diligenciaId: string,
  campo: keyof Anexos,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'pdf'
  const path = `diligencias/${diligenciaId}/${CAMPO_TO_FILENAME[campo]}.${ext}`

  const { error: upError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true })

  if (upError) throw new Error(`Storage upload: ${upError.message}`)

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  const publicUrl = data.publicUrl

  await patchAnexo(diligenciaId, campo, publicUrl)
  return publicUrl
}

export async function fetchDiligencias(): Promise<Diligencia[]> {
  const { data, error } = await supabase
    .from('diligencias')
    .select('*, ligacoes(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as DiligenciaRow[]).map(toDiligencia)
}

export async function insertDiligencia(
  d: Omit<Diligencia, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Diligencia> {
  const payload = fromDiligencia(d)

  if (!payload.uf) {
    throw new Error(
      `Campo UF é obrigatório e chegou vazio ("${payload.uf}"). ` +
      `Verifique se a UF foi selecionada no formulário.`,
    )
  }

  const { data, error } = await supabase
    .from('diligencias')
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error('[insertDiligencia] Supabase error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    const msg = [
      error.message || 'Erro desconhecido no Supabase',
      error.details && `Detalhes: ${error.details}`,
      error.hint && `Dica: ${error.hint}`,
      error.code && `[${error.code}]`,
    ].filter(Boolean).join(' — ')
    throw new Error(msg)
  }

  return toDiligencia({ ...(data as DiligenciaRow), ligacoes: [] })
}

// Generic patch for scalar and nested fields of a diligência.
export async function patchDiligencia(id: string, patch: Partial<Diligencia>): Promise<void> {
  const row: Record<string, unknown> = {}

  if ('ccc' in patch) row.ccc = patch.ccc
  if ('vitima' in patch) row.vitima = patch.vitima
  if ('telefoneVitima' in patch) row.telefone_vitima = patch.telefoneVitima
  if ('cargo' in patch) row.cargo = patch.cargo
  if ('empresa' in patch) row.empresa = patch.empresa
  if ('cidade' in patch) row.cidade = patch.cidade
  if ('uf' in patch) row.uf = patch.uf
  if ('tipoEvento' in patch) row.tipo_evento = patch.tipoEvento
  if ('tipoDiligencia' in patch) row.tipo_diligencia = patch.tipoDiligencia
  if ('modoDiligencia' in patch) row.modo_diligencia = patch.modoDiligencia
  if ('advogadoId' in patch) row.advogado_id = patch.advogadoId
  if ('valorDiligencia' in patch) row.valor_diligencia = patch.valorDiligencia ?? null
  if ('observacoes' in patch) row.observacoes = patch.observacoes ?? null
  if ('dpRegistrou' in patch) row.dp_registrou = patch.dpRegistrou ?? null
  if ('status' in patch) row.status = patch.status
  if ('statusPagamento' in patch) row.status_pagamento = patch.statusPagamento
  if ('cicloFinalizado' in patch) row.ciclo_finalizado = patch.cicloFinalizado
  if ('eventoId' in patch) row.evento_id = patch.eventoId ?? null
  if ('observacaoInterna' in patch) row.observacao_interna = patch.observacaoInterna ?? null
  if ('zapsignDocumentIdContrato' in patch) row.zapsign_document_id_contrato = patch.zapsignDocumentIdContrato ?? null
  if ('zapsignDocumentIdRecibo' in patch) row.zapsign_document_id_recibo = patch.zapsignDocumentIdRecibo ?? null
  if ('linkAssinaturaAdriana' in patch) row.link_assinatura_adriana = patch.linkAssinaturaAdriana ?? null
  if ('linkAssinaturaAdvogadoContrato' in patch) row.link_assinatura_advogado_contrato = patch.linkAssinaturaAdvogadoContrato ?? null
  if ('linkAssinaturaAdvogadoRecibo' in patch) row.link_assinatura_advogado_recibo = patch.linkAssinaturaAdvogadoRecibo ?? null
  if ('statusAssinaturaContrato' in patch) row.status_assinatura_contrato = patch.statusAssinaturaContrato ?? null
  if ('statusAssinaturaRecibo' in patch) row.status_assinatura_recibo = patch.statusAssinaturaRecibo ?? null

  if ('pesquisa' in patch && patch.pesquisa) {
    const p = patch.pesquisa
    row.pesquisa_status = p.status
    if ('dataEnvioWhatsApp' in p) row.pesquisa_data_envio_whatsapp = p.dataEnvioWhatsApp ?? null
    if ('mensagemEnviada' in p) row.pesquisa_mensagem_enviada = p.mensagemEnviada ?? null
    if ('respostaVitima' in p) row.pesquisa_resposta_vitima = p.respostaVitima ?? null
    if ('dataCombinada' in p) row.pesquisa_data_combinada = p.dataCombinada ?? null
    if ('observacoes' in p) row.pesquisa_observacoes = p.observacoes ?? null
  }

  if ('avaliacao' in patch) {
    if (patch.avaliacao) {
      row.avaliacao_nota = patch.avaliacao.nota
      row.avaliacao_observacao = patch.avaliacao.observacao ?? null
      row.avaliacao_contratar_novamente = patch.avaliacao.contratariaNovamente ?? null
      row.avaliacao_data = new Date().toISOString()
    } else {
      row.avaliacao_nota = null
      row.avaliacao_observacao = null
      row.avaliacao_contratar_novamente = null
      row.avaliacao_data = null
    }
  }

  if ('anexos' in patch && patch.anexos) {
    const a = patch.anexos
    if ('contratoGerado' in a) row.anexo_contrato_gerado = a.contratoGerado ?? null
    if ('contratoAssinado' in a) row.anexo_contrato_assinado = a.contratoAssinado ?? null
    if ('reciboGerado' in a) row.anexo_recibo_gerado = a.reciboGerado ?? null
    if ('reciboAssinado' in a) row.anexo_recibo_assinado = a.reciboAssinado ?? null
    if ('comprovantePagamento' in a) row.anexo_comprovante_pagamento = a.comprovantePagamento ?? null
    if ('comprovanteServico' in a) row.anexo_comprovante_servico = a.comprovanteServico ?? null
  }

  if (Object.keys(row).length === 0) return
  const { error } = await supabase.from('diligencias').update(row).eq('id', id)
  if (error) throw error
}

// Efficient partial-pesquisa update — avoids sending full diligencia object.
export async function patchPesquisa(id: string, pp: Partial<Pesquisa>): Promise<void> {
  const row: Record<string, unknown> = {}
  if ('status' in pp) row.pesquisa_status = pp.status
  if ('dataEnvioWhatsApp' in pp) row.pesquisa_data_envio_whatsapp = pp.dataEnvioWhatsApp ?? null
  if ('mensagemEnviada' in pp) row.pesquisa_mensagem_enviada = pp.mensagemEnviada ?? null
  if ('respostaVitima' in pp) row.pesquisa_resposta_vitima = pp.respostaVitima ?? null
  if ('dataCombinada' in pp) row.pesquisa_data_combinada = pp.dataCombinada ?? null
  if ('observacoes' in pp) row.pesquisa_observacoes = pp.observacoes ?? null
  if (Object.keys(row).length === 0) return
  const { error } = await supabase.from('diligencias').update(row).eq('id', id)
  if (error) throw error
}

// Single-field anexo update.
export async function patchAnexo(
  id: string,
  campo: keyof Anexos,
  valor: string,
): Promise<void> {
  const colMap: Record<keyof Anexos, string> = {
    contratoGerado: 'anexo_contrato_gerado',
    contratoAssinado: 'anexo_contrato_assinado',
    reciboGerado: 'anexo_recibo_gerado',
    reciboAssinado: 'anexo_recibo_assinado',
    comprovantePagamento: 'anexo_comprovante_pagamento',
    comprovanteServico: 'anexo_comprovante_servico',
  }
  const { error } = await supabase
    .from('diligencias')
    .update({ [colMap[campo]]: valor })
    .eq('id', id)
  if (error) throw error
}

export async function insertLigacao(
  diligenciaId: string,
  ligacao: Omit<Ligacao, 'id'>,
): Promise<Ligacao> {
  if (!diligenciaId) throw new Error('diligenciaId é obrigatório')
  if (!ligacao.data || !/^\d{4}-\d{2}-\d{2}$/.test(ligacao.data))
    throw new Error(`Data inválida: "${ligacao.data}" — use YYYY-MM-DD`)
  if (!ligacao.hora || !/^\d{2}:\d{2}(:\d{2})?$/.test(ligacao.hora))
    throw new Error(`Hora inválida: "${ligacao.hora}" — use HH:MM`)

  const payload = {
    diligencia_id: diligenciaId,
    data: ligacao.data,
    hora: ligacao.hora,
    duracao: ligacao.duracao ?? null,
    resultado: ligacao.resultado ?? null,
    observacao: ligacao.observacao ?? null,
  }

  console.log('[insertLigacao] payload:', payload)

  const { data, error } = await supabase
    .from('ligacoes')
    .insert(payload)
    .select()
    .single()

  if (error) {
    // PostgrestError não serializa via JSON.stringify — logar propriedades individuais
    console.error('[insertLigacao] code:', error.code)
    console.error('[insertLigacao] message:', error.message)
    console.error('[insertLigacao] details:', error.details)
    console.error('[insertLigacao] hint:', error.hint)
    const msg = [
      error.message || 'Erro desconhecido no Supabase',
      error.details && `Detalhes: ${error.details}`,
      error.hint && `Dica: ${error.hint}`,
      error.code && `[${error.code}]`,
    ].filter(Boolean).join(' — ')
    throw new Error(msg)
  }

  return toLigacao(data as LigacaoRow)
}
