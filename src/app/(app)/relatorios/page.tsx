'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  BarChart3, Calendar, Users, MapPin, ClipboardList,
  DollarSign, CheckCircle2, Clock, Star, TrendingUp,
} from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useAdvogados } from '@/context/AdvogadosContext'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Input } from '@/components/ui/Input'
import { StatusDiligenciaBadge, StatusPagamentoBadge } from '@/components/shared/StatusBadge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StatusDiligencia, StatusPagamento, StatusPesquisa, ModoDiligencia } from '@/types'

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

  const [dataInicio, setDataInicio] = useState(() => primeiroDiaMes(new Date()))
  const [dataFim, setDataFim] = useState(() => ultimoDiaMes(new Date()))

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
      const data = d.createdAt.split('T')[0]
      return data >= dataInicio && data <= dataFim
    })
  }, [diligencias, dataInicio, dataFim])

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
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-blue-600 flex-shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-slate-800">Relatórios</h1>
          <p className="text-sm text-slate-500 mt-0.5">Indicadores das diligências por período</p>
        </div>
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
          <p className="text-xs text-slate-400 mt-2">
            {ind.total} diligência{ind.total !== 1 ? 's' : ''} no período selecionado
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
                      <Td>
                        <div>{d.tipoEvento}</div>
                        <span className="text-xs text-slate-400">{d.modoDiligencia}</span>
                      </Td>
                      <Td>{d.cidade}/{d.uf}</Td>
                      <Td className="whitespace-nowrap">{formatDate(d.createdAt.split('T')[0])}</Td>
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
