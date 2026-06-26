import { supabase } from '@/lib/supabase'
import { CadastroAdvogado, StatusCadastro } from '@/types'
import { CadastroAdvogadoRow } from '@/types/db'
import { toCadastroAdvogado } from '@/lib/mappers'

// Busca os cadastros enviados pelo link público que ainda aguardam aprovação.
export async function fetchCadastrosPendentes(): Promise<CadastroAdvogado[]> {
  const { data, error } = await supabase
    .from('cadastros_advogados')
    .select('*')
    .eq('status', 'pendente')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as CadastroAdvogadoRow[]).map(toCadastroAdvogado)
}

// Marca um cadastro como aprovado (guardando o advogado gerado) ou descartado.
export async function updateCadastroStatus(
  id: string,
  status: StatusCadastro,
  advogadoId?: string,
): Promise<void> {
  const patch: { status: StatusCadastro; advogado_id?: string } = { status }
  if (advogadoId) patch.advogado_id = advogadoId
  const { error } = await supabase
    .from('cadastros_advogados')
    .update(patch)
    .eq('id', id)
  if (error) {
    console.error('[updateCadastroStatus] ERRO do Supabase:', error.message)
    throw new Error(`Supabase: ${error.message}`)
  }
}
