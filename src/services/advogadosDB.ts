import { supabase } from '@/lib/supabase'
import { Advogado } from '@/types'
import { AdvogadoRow } from '@/types/db'
import { toAdvogado, fromAdvogado } from '@/lib/mappers'

export async function fetchAdvogados(): Promise<Advogado[]> {
  const { data, error } = await supabase
    .from('advogados')
    .select('*')
    .order('nome_completo')
  if (error) throw error
  return (data as AdvogadoRow[]).map(toAdvogado)
}

export async function insertAdvogado(a: Omit<Advogado, 'id' | 'createdAt'>): Promise<Advogado> {
  const payload = fromAdvogado(a)
  console.log('[insertAdvogado] payload enviado ao Supabase:', JSON.stringify(payload, null, 2))
  const { data, error } = await supabase
    .from('advogados')
    .insert(payload)
    .select()
    .single()
  if (error) {
    console.error('[insertAdvogado] ERRO do Supabase:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    throw new Error(`Supabase: ${error.message}${error.details ? ` — ${error.details}` : ''}`)
  }
  return toAdvogado(data as AdvogadoRow)
}

export async function patchAdvogado(id: string, patch: Partial<Advogado>): Promise<void> {
  const row: Partial<Omit<AdvogadoRow, 'id' | 'created_at' | 'updated_at'>> = {}
  if ('nomeCompleto' in patch) row.nome_completo = patch.nomeCompleto
  if ('cpf' in patch) row.cpf = patch.cpf ?? null
  if ('oab' in patch) row.oab = patch.oab
  if ('endereco' in patch) row.endereco = patch.endereco
  if ('cidadePrincipal' in patch) row.cidade_principal = patch.cidadePrincipal
  if ('uf' in patch) row.uf = patch.uf
  if ('cidadesAtendidas' in patch) row.cidades_atendidas = patch.cidadesAtendidas
  if ('telefone' in patch) row.telefone = patch.telefone
  if ('whatsapp' in patch) row.whatsapp = patch.whatsapp ?? null
  if ('chavePix' in patch) row.chave_pix = patch.chavePix ?? null
  if ('observacoes' in patch) row.observacoes = patch.observacoes ?? null
  if (Object.keys(row).length === 0) return
  const { error } = await supabase.from('advogados').update(row).eq('id', id)
  if (error) {
    console.error('[patchAdvogado] ERRO do Supabase:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    throw new Error(`Supabase: ${error.message}${error.details ? ` — ${error.details}` : ''}`)
  }
}
