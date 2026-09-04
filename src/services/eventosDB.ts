import { supabase } from '@/lib/supabase'
import { Evento } from '@/types'
import { EventoRow } from '@/types/db'
import { toEvento } from '@/lib/mappers'

export async function fetchEventos(signal?: AbortSignal): Promise<Evento[]> {
  // Igual a fetchDiligencias: o Supabase corta em 1000 linhas por requisição.
  // Paginamos com .range() para nunca perder um evento da Triagem.
  const PAGE = 1000
  const all: EventoRow[] = []
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from('eventos')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) throw error
    const rows = (data ?? []) as EventoRow[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all.map(toEvento)
}

export async function patchEvento(
  id: string,
  patch: { status_evento?: string; diligencia_id?: string | null; foi_atualizado?: boolean; motivo_arquivamento?: string | null },
): Promise<void> {
  const { error } = await supabase.from('eventos').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteEvento(id: string): Promise<void> {
  const { error } = await supabase.from('eventos').delete().eq('id', id)
  if (error) throw error
}

export async function insertEvento(
  e: Omit<Evento, 'id' | 'createdAt'>,
): Promise<Evento> {
  const payload = {
    ccc: e.ccc,
    data_evento: e.dataEvento,
    hora_evento: e.horaEvento,
    data_informativo: e.dataRecebimento,
    hora_informativo: e.horaRecebimento,
    tipo_operador: e.operacao,
    empresa: e.empresa,
    segmento: e.segmento,
    classificacao_evento: e.tipoEvento,
    nivel_agressao: e.nivelAgressao,
    motorista_agredido: e.motoristaAgredido,
    nome_vitima: e.nomeVitima || null,
    cargo_vitima: e.cargoVitima || null,
    telefone_vitima: e.telefoneVitima || null,
    cidade: e.cidade,
    uf: e.uf,
    gtst: e.gtsc,
    modalidade: e.modalidade ?? null,
    status_evento: e.statusEvento,
    diligencia_id: e.diligenciaId ?? null,
  }
  const { data, error } = await supabase.from('eventos').insert(payload).select().single()
  if (error) {
    console.error('[insertEvento] Supabase error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    throw new Error(`Supabase: ${error.message}${error.details ? ` — ${error.details}` : ''}`)
  }
  return toEvento(data as EventoRow)
}
