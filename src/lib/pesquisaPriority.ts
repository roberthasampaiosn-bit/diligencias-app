import { Diligencia, StatusPesquisa } from '@/types'

export function pesquisaPriority(d: Diligencia): number {
  if (d.pesquisa.status === StatusPesquisa.Concluida) return 10
  // Pendente: prioriza quem tem retorno agendado para hoje ou antes
  if (d.pesquisa.dataCombinada) {
    const today = new Date().toISOString().split('T')[0]
    return d.pesquisa.dataCombinada.split(' ')[0] <= today ? 1 : 2
  }
  return 3
}
