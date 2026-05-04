import { Diligencia, DashboardStats, StatusDiligencia, StatusPagamento, StatusPesquisa } from '@/types'

// Funções puras — sem estado interno. O estado vive no AppContext.

export function computeDashboardStats(diligencias: Diligencia[]): DashboardStats {
  const emAndamento = diligencias.filter((d) => d.status === StatusDiligencia.EmAndamento)
  const realizadas = diligencias.filter((d) => d.status === StatusDiligencia.Realizada)
  const pesquisasPendentes = diligencias.filter(
    (d) =>
      d.status === StatusDiligencia.Realizada &&
      d.pesquisa.status !== StatusPesquisa.Concluida
  )
  const pesquisasConcluidas = diligencias.filter(
    (d) => d.pesquisa.status === StatusPesquisa.Concluida
  )
  const ciclosFinalizados = diligencias.filter((d) => d.cicloFinalizado)
  const valorPago = diligencias.filter((d) => d.statusPagamento === StatusPagamento.Pago).reduce((acc, d) => acc + d.valorDiligencia, 0)

  return {
    eventosNovos: 0,
    diligenciasEmAndamento: emAndamento.length,
    diligenciasRealizadas: realizadas.length,
    pesquisasPendentes: pesquisasPendentes.length,
    pesquisasConcluidas: pesquisasConcluidas.length,
    ciclosFinalizados: ciclosFinalizados.length,
    totalDiligencias: diligencias.length,
    valorTotalPago: valorPago,
  }
}

export function makeDiligencia(data: Omit<Diligencia, 'id' | 'createdAt' | 'updatedAt'>): Diligencia {
  return {
    ...data,
    id: `dil-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function applyUpdate(diligencia: Diligencia, patch: Partial<Diligencia>): Diligencia {
  return { ...diligencia, ...patch, updatedAt: new Date().toISOString() }
}
