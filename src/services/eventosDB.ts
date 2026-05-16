import { supabase } from '@/lib/supabase'
import { Evento } from '@/types'
import { EventoRow } from '@/types/db'
import { toEvento } from '@/lib/mappers'

export async function fetchEventos(): Promise<Evento[]> {
  const { data, error } = await supabase
    .from('eventos')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as EventoRow[]).map(toEvento)
}

export async function patchEvento(
  id: string,
  patch: { status_evento?: string; diligencia_id?: string | null },
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
