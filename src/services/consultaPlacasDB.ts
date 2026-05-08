import { supabase } from '@/lib/supabase'
import { ConsultaPlaca } from '@/types'
import { ConsultaPlacaRow } from '@/types/db'
import { toConsultaPlaca, fromConsultaPlaca } from '@/lib/mappers'

const STORAGE_BUCKET = 'documentos'

export async function fetchConsultasPlacas(): Promise<ConsultaPlaca[]> {
  const { data, error } = await supabase
    .from('consultas_placas')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as ConsultaPlacaRow[]).map(toConsultaPlaca)
}

export async function insertConsultaPlaca(
  c: Omit<ConsultaPlaca, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ConsultaPlaca> {
  const { data, error } = await supabase
    .from('consultas_placas')
    .insert(fromConsultaPlaca(c))
    .select()
    .single()
  if (error) {
    const msg = [
      error.message || 'Erro desconhecido no Supabase',
      error.details && `Detalhes: ${error.details}`,
      error.hint && `Dica: ${error.hint}`,
      error.code && `[${error.code}]`,
    ].filter(Boolean).join(' — ')
    throw new Error(msg)
  }
  return toConsultaPlaca(data as ConsultaPlacaRow)
}

export async function patchConsultaPlaca(id: string, patch: Partial<ConsultaPlaca>): Promise<void> {
  const row: Record<string, unknown> = {}
  if ('placa' in patch) row.placa = patch.placa
  if ('solicitante' in patch) row.solicitante = patch.solicitante
  if ('dataConsulta' in patch) row.data_consulta = patch.dataConsulta
  if ('resultado' in patch) row.resultado = patch.resultado ?? null
  if ('observacoes' in patch) row.observacoes = patch.observacoes ?? null
  if ('anexoResultado' in patch) row.anexo_resultado = patch.anexoResultado ?? null
  if ('valor' in patch) row.valor = patch.valor ?? null
  if ('comprovantePagamento' in patch) row.comprovante_pagamento = patch.comprovantePagamento ?? null
  if (Object.keys(row).length === 0) return
  const { error } = await supabase.from('consultas_placas').update(row).eq('id', id)
  if (error) throw error
}

export async function uploadArquivoConsultaPlaca(
  consultaId: string,
  campo: 'anexo_resultado' | 'comprovante_pagamento',
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'pdf'
  const path = `consultas-placas/${consultaId}/${campo}.${ext}`

  const { error: upError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true })

  if (upError) throw new Error(`Storage upload: ${upError.message}`)

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
