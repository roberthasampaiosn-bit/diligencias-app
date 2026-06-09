import { Diligencia, DashboardStats, StatusDiligencia, StatusPagamento, StatusPesquisa, EmpresaCliente } from '@/types'

// Funções puras — sem estado interno. O estado vive no AppContext.

export function computeDashboardStats(diligencias: Diligencia[]): DashboardStats {
  const mesAtual = new Date()
  const mesStr = `${mesAtual.getFullYear()}-${String(mesAtual.getMonth() + 1).padStart(2, '0')}`
  const doMes = (d: Diligencia) => (d.dataAtendimento ?? d.createdAt.split('T')[0]).startsWith(mesStr)

  const emAndamento = diligencias.filter((d) => d.status === StatusDiligencia.EmAndamento)
  const realizadas = diligencias.filter((d) => d.status === StatusDiligencia.Realizada)
  const realizadasMes = diligencias.filter((d) => d.status === StatusDiligencia.Realizada && doMes(d))
  const pesquisasPendentes = diligencias.filter(
    (d) =>
      d.status === StatusDiligencia.Realizada &&
      d.pesquisa.status !== StatusPesquisa.Concluida &&
      d.empresaCliente !== EmpresaCliente.VTAL
  )
  const pesquisasConcluidas = diligencias.filter(
    (d) =>
      d.pesquisa.status === StatusPesquisa.Concluida &&
      d.empresaCliente !== EmpresaCliente.VTAL
  )
  const ciclosFinalizados = diligencias.filter((d) => d.cicloFinalizado)
  const ciclosFinalizadosMes = diligencias.filter((d) => d.cicloFinalizado && doMes(d))
  const pagas = diligencias.filter((d) => d.statusPagamento === StatusPagamento.Pago)
  const valorPago = pagas.reduce((acc, d) => acc + d.valorDiligencia, 0)
  const valorPagoMes = pagas.filter(doMes).reduce((acc, d) => acc + d.valorDiligencia, 0)

  return {
    eventosNovos: 0,
    diligenciasEmAndamento: emAndamento.length,
    diligenciasRealizadas: realizadas.length,
    diligenciasRealizadasMes: realizadasMes.length,
    pesquisasPendentes: pesquisasPendentes.length,
    pesquisasConcluidas: pesquisasConcluidas.length,
    ciclosFinalizados: ciclosFinalizados.length,
    ciclosFinalizadosMes: ciclosFinalizadosMes.length,
    totalDiligencias: diligencias.length,
    valorTotalPago: valorPago,
    valorTotalPagoMes: valorPagoMes,
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
