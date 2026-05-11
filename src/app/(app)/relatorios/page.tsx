'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  BarChart3, Calendar, Users, MapPin, ClipboardList,
  DollarSign, CheckCircle2, Clock, Star, TrendingUp, CarFront, XCircle, Download,
} from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useAdvogados } from '@/context/AdvogadosContext'
import { useConsultasPlacas } from '@/context/ConsultaPlacasContext'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { StatusDiligenciaBadge, StatusPagamentoBadge, EmpresaBadge } from '@/components/shared/StatusBadge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Diligencia, StatusDiligencia, StatusPagamento, StatusPesquisa, ModoDiligencia, EmpresaCliente } from '@/types'

// ─── helpers de data ──────────────────────────────────────────────────────────

function primeiroDiaMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function ultimoDiaMes(d: Date): string {
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${ultimo.getFullYear()}-${String(ultimo.getMonth() + 1).padStart(2, '0')}-${String(ultimo.getDate()).padStart(2, '0')}`
}

function hojeStr(): string {
  return new Date().toISOString().split('T')[0]
}

function diasAtras(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// ─── células de tabela ────────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
      {children}
    </th>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-3 text-sm text-slate-700 ${className ?? ''}`}>
      {children}
    </td>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const { diligencias } = useDiligencias()
  const { advogadoMap } = useAdvogados()
  const { consultasPlacas } = useConsultasPlacas()

  const [dataInicio, setDataInicio] = useState(() => primeiroDiaMes(new Date()))
  const [dataFim, setDataFim] = useState(() => ultimoDiaMes(new Date()))
  const [filtroSolicitante, setFiltroSolicitante] = useState('')
  const [filtroEmpresa, setFiltroEmpresa] = useState<'todas' | EmpresaCliente>('todas')
  const [exportando, setExportando] = useState(false)

  function aplicarEstesMes() {
    const now = new Date()
    setDataInicio(primeiroDiaMes(now))
    setDataFim(ultimoDiaMes(now))
  }

  function aplicarMesPassado() {
    const mesPassado = new Date()
    mesPassado.setDate(1)
    mesPassado.setMonth(mesPassado.getMonth() - 1)
    setDataInicio(primeiroDiaMes(mesPassado))
    setDataFim(ultimoDiaMes(mesPassado))
  }

  function aplicarUltimos30() {
    setDataInicio(diasAtras(30))
    setDataFim(hojeStr())
  }

  const filtradas = useMemo(() => {
    return diligencias.filter((d) => {
      // Usa data do evento/atendimento quando disponível; caso contrário, data de criação
      const data = d.dataAtendimento ?? d.createdAt.split('T')[0]
      if (data < dataInicio || data > dataFim) return false
      if (filtroEmpresa !== 'todas' && d.empresaCliente !== filtroEmpresa) return false
      return true
    })
  }, [diligencias, dataInicio, dataFim, filtroEmpresa])

  async function exportarExcel() {
    setExportando(true)
    try {
      const XLSX = await import('xlsx')

      // Filtra por período; cada aba já separa por cliente
      const porPeriodo = diligencias.filter((d) => {
        const data = d.dataAtendimento ?? d.createdAt.split('T')[0]
        return data >= dataInicio && data <= dataFim
      })

      const bat   = porPeriodo.filter((d) => d.empresaCliente === EmpresaCliente.BatBrasil)
      const batCC = bat.filter((d) => d.valorDiligencia > 0)  // com custo
      const vtal  = porPeriodo.filter((d) => d.empresaCliente === EmpresaCliente.VTAL)

      function dateBR(s?: string) {
        if (!s) return ''
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        return m ? `${m[3]}/${m[2]}/${m[1]}` : s
      }

      function ano(d: Diligencia)   { return d.dataAtendimento ? Number(d.dataAtendimento.split('-')[0]) : '' }
      function mes(d: Diligencia)   { return d.dataAtendimento ? Number(d.dataAtendimento.split('-')[1]) : '' }
      function dia(d: Diligencia)   { return d.dataAtendimento ? Number(d.dataAtendimento.split('-')[2]) : '' }
      function dataFmt(d: Diligencia) {
        if (!d.dataAtendimento) return ''
        const [y, m, dd] = d.dataAtendimento.split('-')
        return `${m}/${dd}/${y}`
      }

      // ── Aba 1: BAT — Suporte Jurídico Remoto (todas as diligências BAT) ──────
      const dadosSJR = bat.map((d) => ({
        'CCC':                                d.ccc,
        'Vítima':                             d.vitima,
        'Telefone':                           d.telefoneVitima && d.telefoneVitima !== '00000000000' ? d.telefoneVitima : '',
        'Cargo':                              d.cargo ?? '',
        'Ano':                                ano(d),
        'Mês':                                mes(d),
        'Dia':                                dia(d),
        'Tipo de evento':                     d.tipoEvento,
        'horário evento':                     d.horaEvento ?? '',
        'Data envio informativo':             dateBR(d.dataInformativo),
        'horário envio informativo':          d.horaInformativo ?? '',
        'Assistencia jurídica colaborador':   d.modoDiligencia === 'Remoto' ? 'Remota' : d.modoDiligencia,
        'Data ligação do advogado':           dateBR(d.dataLigacaoAdvogado),
        'horário ligação advogado':           d.horaLigacaoAdvogado ?? '',
        'Advogado':                           advogadoMap.get(d.advogadoId)?.nomeCompleto ?? '—',
        'UF':                                 d.uf,
        'Região GTSC':                        d.regiaoGtsc ?? '',
        'Cidade':                             d.cidade,
        'Operação':                           d.operacao ?? '',
        'Empresa':                            d.empresa,
        'Segmento':                           d.segmento ?? '',
        'Motorista agredido':                 d.motoristaAgredido ?? '',
        'DP que registrou':                   d.dpRegistrou ?? '',
        'Observação':                         d.observacoes ?? '',
        'Sobra de mercadoria':                d.sobraMercadoria ?? '',
        'Boletim':                            d.numeroBOProcesso ?? '',
        'Pesquisa':                           d.pesquisa.status,
        'Entrevistador':                      d.pesquisa.entrevistador ?? '',
        'Observações':                        d.pesquisa.observacoes ?? '',
        'Data entrevista':                    d.pesquisa.dataCombinada ? formatDate(d.pesquisa.dataCombinada) : '',
        'Hora entrevista':                    d.pesquisa.horaEntrevista ?? '',
      }))

      // ── Aba 2: BAT — Diligências com custo (presencial/advogado acionado) ────
      const dadosSCBase = batCC.map((d) => ({
        'Ano':                                                   ano(d),
        'Mês':                                                   mes(d),
        'Dia':                                                   dia(d),
        'Data':                                                  dataFmt(d),
        'Região GTSC':                                           '',
        'UF':                                                    d.uf,
        'Cidade':                                                d.cidade,
        'Operação':                                              '',
        'Tipo de diligência':                                    d.tipoDiligencia,
        'Observação':                                            d.observacoes ?? '',
        'ID CCC (Quando aplicável)':                             d.ccc,
        'Número do Processo/Boletim de Ocorrência/Inquérito Policial': d.numeroBOProcesso ?? '',
        'Local de atendimento':                                  d.localAtendimento ?? '',
        'Modo de atendimento':                                   d.modoDiligencia,
        'Nome do Advogado':                                      advogadoMap.get(d.advogadoId)?.nomeCompleto ?? '—',
        'Telefone':                                              d.telefoneVitima && d.telefoneVitima !== '00000000000' ? d.telefoneVitima : '',
        'Valor pago correspondente':                             d.valorDiligencia,
        'Valor adv acionante':                                   '',
      }))

      // ── Aba 3: V.TAL ─────────────────────────────────────────────────────────
      let seq = 1
      const dadosVTAL = vtal.map((d) => ({
        'Seq.':                                                  seq++,
        'Ano':                                                   ano(d),
        'Mês':                                                   mes(d),
        'Dia':                                                   dia(d),
        'Data':                                                  dataFmt(d),
        'UF':                                                    d.uf,
        'Cidade':                                                d.cidade,
        'Tipo de diligência':                                    d.tipoDiligencia,
        'Macros':                                                d.macro ?? '',
        'Observação':                                            d.observacoes ?? '',
        'Número do Processo/Boletim de Ocorrência/Inquérito Policial': d.numeroBOProcesso ?? '',
        'Local de atendimento':                                  d.localAtendimento ?? '',
        'Resultado da demanda':                                  d.resultadoDemanda ?? '',
        'Status':                                                d.status,
        'Modo de atendimento':                                   d.modoDiligencia,
        'Nome do Advogado':                                      advogadoMap.get(d.advogadoId)?.nomeCompleto ?? '—',
        'Centro de Custo':                                       d.centroCusto ?? '',
        'Valor':                                                 d.valorDiligencia,
      }))

      const wb = XLSX.utils.book_new()

      const wsSJR = XLSX.utils.json_to_sheet(dadosSJR)
      wsSJR['!cols'] = [
        { wch: 18 }, { wch: 30 }, { wch: 16 }, { wch: 18 },
        { wch: 6  }, { wch: 6  }, { wch: 6  }, { wch: 22 },
        { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
        { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 6  },
        { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 25 },
        { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 30 },
        { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
        { wch: 30 }, { wch: 14 }, { wch: 10 },
      ]
      XLSX.utils.book_append_sheet(wb, wsSJR, 'BAT - Suporte Jurídico')

      const wsSCBase = XLSX.utils.json_to_sheet(dadosSCBase)
      wsSCBase['!cols'] = [
        { wch: 6  }, { wch: 6  }, { wch: 6  }, { wch: 12 },
        { wch: 14 }, { wch: 6  }, { wch: 18 }, { wch: 14 },
        { wch: 30 }, { wch: 30 }, { wch: 18 }, { wch: 40 },
        { wch: 22 }, { wch: 14 }, { wch: 28 }, { wch: 16 },
        { wch: 16 }, { wch: 14 },
      ]
      XLSX.utils.book_append_sheet(wb, wsSCBase, 'BAT - Com Custo')

      const wsVTAL = XLSX.utils.json_to_sheet(dadosVTAL)
      wsVTAL['!cols'] = [
        { wch: 6  }, { wch: 6  }, { wch: 6  }, { wch: 6  },
        { wch: 12 }, { wch: 6  }, { wch: 18 }, { wch: 28 },
        { wch: 22 }, { wch: 30 }, { wch: 40 }, { wch: 22 },
        { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 28 },
        { wch: 14 }, { wch: 10 },
      ]
      XLSX.utils.book_append_sheet(wb, wsVTAL, 'V.TAL')

      XLSX.writeFile(wb, `diligencias_${dataInicio}_${dataFim}.xlsx`)
    } finally {
      setExportando(false)
    }
  }

  // ── Indicadores ──────────────────────────────────────────────────────────────
  const ind = useMemo(() => {
    const presenciais = filtradas.filter((d) => d.modoDiligencia === ModoDiligencia.Presencial).length
    const remotas = filtradas.filter((d) => d.modoDiligencia === ModoDiligencia.Remoto).length
    const pesquisasPendentes = filtradas.filter(
      (d) => d.pesquisa.status !== StatusPesquisa.Concluida,
    ).length
    const pesquisasRespondidas = filtradas.filter(
      (d) => d.pesquisa.status === StatusPesquisa.Concluida,
    ).length
    const realizadas = filtradas.filter((d) => d.status === StatusDiligencia.Realizada).length
    const finalizadas = filtradas.filter((d) => d.cicloFinalizado).length
    const pagas = filtradas.filter((d) => d.statusPagamento === StatusPagamento.Pago)
    const totalPago = pagas.reduce((s, d) => s + d.valorDiligencia, 0)
    const ticketMedio = pagas.length > 0 ? totalPago / pagas.length : 0
    const advogadosAcionados = new Set(filtradas.map((d) => d.advogadoId)).size

    return {
      total: filtradas.length,
      presenciais,
      remotas,
      pesquisasPendentes,
      pesquisasRespondidas,
      realizadas,
      finalizadas,
      totalPago,
      ticketMedio,
      advogadosAcionados,
    }
  }, [filtradas])

  // ── Consultas de Placas filtradas ────────────────────────────────────────────
  const consultasFiltradas = useMemo(() => {
    return consultasPlacas.filter((c) => {
      const data = c.dataConsulta
      if (data < dataInicio || data > dataFim) return false
      if (filtroSolicitante && !c.solicitante.toLowerCase().includes(filtroSolicitante.toLowerCase())) return false
      return true
    })
  }, [consultasPlacas, dataInicio, dataFim, filtroSolicitante])

  const indPlacas = useMemo(() => {
    const localizadas = consultasFiltradas.filter((c) => c.resultado === 'Localizada')
    const naoLocalizadas = consultasFiltradas.filter((c) => c.resultado === 'Não localizada')
    return {
      total: consultasFiltradas.length,
      localizadas: localizadas.length,
      naoLocalizadas: naoLocalizadas.length,
      totalPago: localizadas.reduce((s, c) => s + (c.valor ?? 0), 0),
    }
  }, [consultasFiltradas])

  // ── Resumo por advogado ───────────────────────────────────────────────────────
  const resumoAdvogados = useMemo(() => {
    const mapa = new Map<string, { nome: string; quantidade: number; totalPago: number; notas: number[] }>()

    filtradas.forEach((d) => {
      const adv = advogadoMap.get(d.advogadoId)
      const nome = adv?.nomeCompleto ?? '—'
      const entry = mapa.get(d.advogadoId) ?? { nome, quantidade: 0, totalPago: 0, notas: [] }
      entry.quantidade++
      if (d.statusPagamento === StatusPagamento.Pago) entry.totalPago += d.valorDiligencia
      if (d.avaliacao?.nota != null) entry.notas.push(d.avaliacao.nota)
      mapa.set(d.advogadoId, entry)
    })

    return Array.from(mapa.values())
      .map((e) => ({
        ...e,
        media: e.notas.length > 0
          ? (e.notas.reduce((a, b) => a + b, 0) / e.notas.length).toFixed(1)
          : null,
      }))
      .sort((a, b) => b.quantidade - a.quantidade)
  }, [filtradas, advogadoMap])

  // ── Resumo por cidade/UF ──────────────────────────────────────────────────────
  const resumoCidades = useMemo(() => {
    const mapa = new Map<string, { cidadeUF: string; quantidade: number; presenciais: number; remotas: number }>()

    filtradas.forEach((d) => {
      const key = `${d.cidade}/${d.uf}`
      const entry = mapa.get(key) ?? { cidadeUF: key, quantidade: 0, presenciais: 0, remotas: 0 }
      entry.quantidade++
      if (d.modoDiligencia === ModoDiligencia.Presencial) entry.presenciais++
      else entry.remotas++
      mapa.set(key, entry)
    })

    return Array.from(mapa.values()).sort((a, b) => b.quantidade - a.quantidade)
  }, [filtradas])

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-blue-600 flex-shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Relatórios</h1>
            <p className="text-sm text-slate-500 mt-0.5">Indicadores das diligências por período</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" loading={exportando} onClick={exportarExcel}>
          <Download className="w-4 h-4" /> Exportar Excel
        </Button>
      </div>

      {/* Filtro de período */}
      <Card>
        <CardBody>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex items-end gap-3 flex-1">
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-5">
                <Calendar className="w-4 h-4 text-slate-400" />
              </div>
              <div className="w-44">
                <Input
                  label="Data inicial"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <span className="text-slate-400 mb-2.5">até</span>
              <div className="w-44">
                <Input
                  label="Data final"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-1.5 pb-0.5">
              <button
                onClick={aplicarEstesMes}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                Este mês
              </button>
              <button
                onClick={aplicarMesPassado}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Mês passado
              </button>
              <button
                onClick={aplicarUltimos30}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Últimos 30 dias
              </button>
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500 self-center mr-1">Empresa:</span>
            <button onClick={() => setFiltroEmpresa('todas')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filtroEmpresa === 'todas' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              Todas
            </button>
            <button onClick={() => setFiltroEmpresa(filtroEmpresa === EmpresaCliente.BatBrasil ? 'todas' : EmpresaCliente.BatBrasil)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filtroEmpresa === EmpresaCliente.BatBrasil ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              BAT BRASIL
            </button>
            <button onClick={() => setFiltroEmpresa(filtroEmpresa === EmpresaCliente.VTAL ? 'todas' : EmpresaCliente.VTAL)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filtroEmpresa === EmpresaCliente.VTAL ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              V.TAL
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {ind.total} diligência{ind.total !== 1 ? 's' : ''} no período selecionado
            {filtroEmpresa !== 'todas' && <span className="ml-1">· filtrado por <strong>{filtroEmpresa}</strong></span>}
          </p>
        </CardBody>
      </Card>

      {/* Indicadores — linha 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Total diligências" value={ind.total} icon={ClipboardList} color="blue" />
        <StatCard title="Presenciais" value={ind.presenciais} icon={MapPin} color="slate" subtitle={`${ind.remotas} remotas`} />
        <StatCard title="Diligências realizadas" value={ind.realizadas} icon={CheckCircle2} color="emerald" subtitle="Serviço executado" />
        <StatCard title="Diligências concluídas" value={ind.finalizadas} icon={CheckCircle2} color="purple" subtitle="Processo finalizado" />
      </div>

      {/* Indicadores — linha 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard title="Pesquisas pendentes" value={ind.pesquisasPendentes} icon={Clock} color="amber" />
        <StatCard title="Pesquisas concluídas" value={ind.pesquisasRespondidas} icon={CheckCircle2} color="emerald" />
        <StatCard title="Advogados acionados" value={ind.advogadosAcionados} icon={Users} color="slate" />
      </div>

      {/* Indicadores financeiros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard title="Total pago" value={formatCurrency(ind.totalPago)} icon={DollarSign} color="emerald" />
        <StatCard
          title="Ticket médio"
          value={formatCurrency(ind.ticketMedio)}
          icon={TrendingUp}
          color="blue"
          subtitle="das diligências pagas"
        />
      </div>

      {/* Tabela 1 — Resumo por advogado */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <CardTitle>Resumo por advogado</CardTitle>
          </div>
        </CardHeader>
        {resumoAdvogados.length === 0 ? (
          <CardBody>
            <p className="text-sm text-slate-400 text-center py-6">Nenhum dado no período.</p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <Th>Advogado</Th>
                  <Th>Diligências</Th>
                  <Th>Total pago</Th>
                  <Th>Média avaliação</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {resumoAdvogados.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <Td><span className="font-medium text-slate-800">{row.nome}</span></Td>
                    <Td><span className="font-semibold">{row.quantidade}</span></Td>
                    <Td>{formatCurrency(row.totalPago)}</Td>
                    <Td>
                      {row.media != null ? (
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          {row.media}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Tabela 2 — Resumo por cidade/UF */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <CardTitle>Resumo por cidade/UF</CardTitle>
          </div>
        </CardHeader>
        {resumoCidades.length === 0 ? (
          <CardBody>
            <p className="text-sm text-slate-400 text-center py-6">Nenhum dado no período.</p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <Th>Cidade/UF</Th>
                  <Th>Total</Th>
                  <Th>Presenciais</Th>
                  <Th>Remotas</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {resumoCidades.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <Td><span className="font-medium text-slate-800">{row.cidadeUF}</span></Td>
                    <Td><span className="font-semibold">{row.quantidade}</span></Td>
                    <Td>{row.presenciais}</Td>
                    <Td>{row.remotas}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ─── Seção Consulta de Placas ─────────────────────────────────────────── */}
      <div className="pt-2 space-y-5">
        <div className="flex items-center gap-2">
          <CarFront className="w-5 h-5 text-blue-600" />
          <div>
            <h2 className="text-lg font-bold text-slate-800">Consulta de Placas</h2>
            <p className="text-xs text-slate-400">Filtros de período aplicados acima</p>
          </div>
        </div>

        {/* Filtro por solicitante */}
        <Card>
          <CardBody>
            <div className="flex items-end gap-3">
              <div className="w-56">
                <Input
                  label="Filtrar por solicitante"
                  value={filtroSolicitante}
                  onChange={(e) => setFiltroSolicitante(e.target.value)}
                  placeholder="Nome do solicitante..."
                />
              </div>
              {filtroSolicitante && (
                <button
                  onClick={() => setFiltroSolicitante('')}
                  className="mb-0.5 text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  Limpar
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">{indPlacas.total} consulta{indPlacas.total !== 1 ? 's' : ''} no período</p>
          </CardBody>
        </Card>

        {/* Indicadores de placas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard title="Total de consultas" value={indPlacas.total} icon={CarFront} color="blue" />
          <StatCard title="Localizadas" value={indPlacas.localizadas} icon={CheckCircle2} color="emerald" />
          <StatCard title="Não localizadas" value={indPlacas.naoLocalizadas} icon={XCircle} color="red" />
          <StatCard title="Total pago" value={formatCurrency(indPlacas.totalPago)} icon={DollarSign} color="emerald" />
        </div>

        {/* Tabela de consultas */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CarFront className="w-4 h-4 text-slate-400" />
              <CardTitle>Consultas no período</CardTitle>
              <span className="text-xs text-slate-400">({indPlacas.total})</span>
            </div>
          </CardHeader>
          {consultasFiltradas.length === 0 ? (
            <CardBody>
              <p className="text-sm text-slate-400 text-center py-6">Nenhuma consulta de placa no período.</p>
            </CardBody>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <Th>Placa</Th>
                    <Th>Solicitante</Th>
                    <Th>Data</Th>
                    <Th>Resultado</Th>
                    <Th>Valor</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {consultasFiltradas.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <Td><span className="font-mono font-bold text-slate-800">{c.placa}</span></Td>
                      <Td>{c.solicitante}</Td>
                      <Td className="whitespace-nowrap">{formatDate(c.dataConsulta)}</Td>
                      <Td>
                        {c.resultado === 'Localizada' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" /> Localizada
                          </span>
                        ) : c.resultado === 'Não localizada' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <XCircle className="w-3 h-3" /> Não localizada
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </Td>
                      <Td className="font-semibold whitespace-nowrap">
                        {c.resultado === 'Localizada' && c.valor != null
                          ? formatCurrency(c.valor)
                          : <span className="text-slate-400">—</span>
                        }
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Tabela 3 — Eventos do período */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-slate-400" />
            <CardTitle>Eventos do período</CardTitle>
            <span className="text-xs text-slate-400">({filtradas.length})</span>
          </div>
        </CardHeader>
        {filtradas.length === 0 ? (
          <CardBody>
            <p className="text-sm text-slate-400 text-center py-6">Nenhuma diligência no período.</p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <Th>CCC / Vítima</Th>
                  <Th>Empresa</Th>
                  <Th>Tipo</Th>
                  <Th>Cidade/UF</Th>
                  <Th>Data</Th>
                  <Th>Status</Th>
                  <Th>Pagamento</Th>
                  <Th>Valor</Th>
                  <Th>Advogado</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtradas.map((d) => {
                  const adv = advogadoMap.get(d.advogadoId)
                  return (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <Td>
                        <Link
                          href={`/diligencias/${d.id}`}
                          className="font-medium text-slate-800 hover:text-blue-600 block"
                        >
                          {d.vitima}
                        </Link>
                        <span className="font-mono text-xs text-blue-600">{d.ccc}</span>
                      </Td>
                      <Td><EmpresaBadge empresaCliente={d.empresaCliente} /></Td>
                      <Td>
                        <div>{d.tipoEvento}</div>
                        <span className="text-xs text-slate-400">{d.modoDiligencia}</span>
                      </Td>
                      <Td>{d.cidade}/{d.uf}</Td>
                      <Td className="whitespace-nowrap">{d.dataAtendimento ? formatDate(d.dataAtendimento) : '—'}</Td>
                      <Td><StatusDiligenciaBadge status={d.status} /></Td>
                      <Td>
                        {d.modoDiligencia === ModoDiligencia.Remoto
                          ? <span className="text-slate-400">—</span>
                          : <StatusPagamentoBadge status={d.statusPagamento} />
                        }
                      </Td>
                      <Td className="font-semibold whitespace-nowrap">{formatCurrency(d.valorDiligencia)}</Td>
                      <Td className="max-w-[140px] truncate">{adv?.nomeCompleto ?? '—'}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
