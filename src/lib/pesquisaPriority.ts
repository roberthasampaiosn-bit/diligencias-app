import { Diligencia, StatusPesquisa } from '@/types'
import { hojeBR } from '@/lib/utils'

export function pesquisaPriority(d: Diligencia): number {
  if (d.pesquisa.status === StatusPesquisa.Concluida) return 10
  // Pendente: prioriza quem tem retorno agendado para hoje ou antes
  if (d.pesquisa.dataCombinada) {
    return d.pesquisa.dataCombinada.split(' ')[0] <= hojeBR() ? 1 : 2
  }
  // "Qualquer dia após X" (só horário) vale para hoje também
  if (d.pesquisa.horaEntrevista) return 1
  return 3
}
