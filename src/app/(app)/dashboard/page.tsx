'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  FileSearch, ClipboardList, CheckCircle2, MessageSquare,
  Trophy, ArrowRight, Search, CarFront, XCircle, DollarSign, Plus,
} from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useAdvogados } from '@/context/AdvogadosContext'
import { useEventos } from '@/context/EventosContext'
import { useConsultasPlacas } from '@/context/ConsultaPlacasContext'
import { computeDashboardStats } from '@/services/diligenciaService'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusDiligenciaBadge, StatusPagamentoBadge, EmpresaBadge } from '@/components/shared/StatusBadge'
import { formatCurrency } from '@/lib/utils'
import { EmpresaCliente, StatusEvento, StatusPagamento, StatusDiligencia } from '@/types'

type Filtro = 'todos' | EmpresaCliente

function statsCliente(diligencias: ReturnType<typeof useDiligencias>['diligencias'], cliente: EmpresaCliente) {
  const mes = new Date()
  const mesStr = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`
  const all = diligencias.filter((d) => d.empresaCliente === cliente)
  const doMes = all.filter((d) => d.createdAt.startsWith(mesStr))
  const pendentes = all.filter((d) => d.status === StatusDiligencia.EmAndamento)
  const concluidas = all.filter((d) => d.cicloFinalizado)
  const valorTotal = all.reduce((s, d) => s + d.valorDiligencia, 0)
  const valorPendente = all.filter((d) => d.statusPagamento !== StatusPagamento.Pago).reduce((s, d) => s + d.valorDiligencia, 0)
  return { total: all.length, doMes: doMes.length, pendentes: pendentes.length, concluidas: concluidas.length, valorTotal, valorPendente }
}

export default function DashboardPage() {
  const { diligencias } = useDiligencias()
  const { advogadoMap } = useAdvogados()
  const { eventos } = useEventos()
  const { consultasPlacas } = useConsultasPlacas()
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const diligenciasFiltradas = useMemo(
    () => filtro === 'todos' ? diligencias : diligencias.filter((d) => d.empresaCliente === filtro),
    [diligencias, filtro]
  )

  const stats = useMemo(() => {
    const base = computeDashboardStats(diligenciasFiltradas)
    return {
      ...base,
      eventosNovos: eventos.filter((e) => e.statusEvento === StatusEvento.Pendente).length,
    }
  }, [diligenciasFiltradas, eventos])

  const recentes = useMemo(() => diligenciasFiltradas.slice(0, 5), [diligenciasFiltradas])

  const statsPlacas = useMemo(() => {
    const localizadas = consultasPlacas.filter((c) => c.resultado === 'Localizada')
    return {
      total: consultasPlacas.length,
      localizadas: localizadas.length,
      naoLocalizadas: consultasPlacas.filter((c) => c.resultado === 'Não localizada').length,
      totalPago: localizadas.reduce((s, c) => s + (c.valor ?? 0), 0),
    }
  }, [consultasPlacas])

  const statsBat = useMemo(() => statsCliente(diligencias, EmpresaCliente.BatBrasil), [diligencias])
  const statsVtal = useMemo(() => statsCliente(diligencias, EmpresaCliente.VTAL), [diligencias])

  return (
    <div className="space-y-6">
      {/* Cabeçalho com filtro rápido */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Visão geral do sistema de diligências</p>
        </div>
        <div className="flex gap-1.5">
          {(['todos', EmpresaCliente.BatBrasil, EmpresaCliente.VTAL] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filtro === f
                  ? f === EmpresaCliente.VTAL ? 'bg-purple-600 text-white'
                    : f === EmpresaCliente.BatBrasil ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'todos' ? 'Todos' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Stats gerais (aplicam o filtro) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard title="Eventos novos" value={stats.eventosNovos} icon={FileSearch} color="blue" subtitle="Aguardando triagem" />
        <StatCard title="Em andamento" value={stats.diligenciasEmAndamento} icon={ClipboardList} color="amber" />
        <StatCard title="Realizadas" value={stats.diligenciasRealizadas} icon={CheckCircle2} color="emerald" subtitle="Serviço executado" />
        <StatCard title="Concluídas" value={stats.ciclosFinalizados} icon={Trophy} color="slate" subtitle="Processo finalizado" />
        <StatCard title="Pesq. pendentes" value={stats.pesquisasPendentes} icon={MessageSquare} color="purple" subtitle="Aguardando resposta" />
        <StatCard title="Pesq. concluídas" value={stats.pesquisasConcluidas} icon={Search} color="blue" subtitle="Respondidas" />
      </div>

      {/* Totais financeiros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Total pago — Diligências</p>
          <p className="text-2xl font-bold text-emerald-800 mt-1">{formatCurrency(stats.valorTotalPago)}</p>
          <p className="text-xs text-emerald-600 mt-1">
            {filtro === 'todos' ? 'Acumulado · todas as diligências' : `Acumulado · ${filtro}`}
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Total pago — Consulta de Placas</p>
          <p className="text-2xl font-bold text-blue-800 mt-1">{formatCurrency(statsPlacas.totalPago)}</p>
          <p className="text-xs text-blue-600 mt-1">{statsPlacas.localizadas} consulta{statsPlacas.localizadas !== 1 ? 's' : ''} localizada{statsPlacas.localizadas !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Visão por cliente (sempre mostrada, não afetada pelo filtro) */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Visão por cliente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* BAT BRASIL */}
          <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/40 space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">BAT BRASIL</span>
              <span className="text-xs text-slate-500">{statsBat.total} diligências</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-slate-500">Este mês</p>
                <p className="font-semibold text-slate-800">{statsBat.doMes}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Pendentes</p>
                <p className="font-semibold text-amber-700">{statsBat.pendentes}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Concluídas</p>
                <p className="font-semibold text-emerald-700">{statsBat.concluidas}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Valor total</p>
                <p className="font-semibold text-slate-800">{formatCurrency(statsBat.valorTotal)}</p>
              </div>
            </div>
            <div className="pt-1 border-t border-blue-200">
              <p className="text-xs text-slate-500">Valor pendente de pgto</p>
              <p className="font-semibold text-red-600">{formatCurrency(statsBat.valorPendente)}</p>
            </div>
          </div>

          {/* V.TAL */}
          <div className="border border-purple-200 rounded-xl p-4 bg-purple-50/40 space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">V.TAL</span>
              <span className="text-xs text-slate-500">{statsVtal.total} diligências</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-slate-500">Este mês</p>
                <p className="font-semibold text-slate-800">{statsVtal.doMes}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Pendentes</p>
                <p className="font-semibold text-amber-700">{statsVtal.pendentes}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Concluídas</p>
                <p className="font-semibold text-emerald-700">{statsVtal.concluidas}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Valor total</p>
                <p className="font-semibold text-slate-800">{formatCurrency(statsVtal.valorTotal)}</p>
              </div>
            </div>
            <div className="pt-1 border-t border-purple-200">
              <p className="text-xs text-slate-500">Valor pendente de pgto</p>
              <p className="font-semibold text-red-600">{formatCurrency(statsVtal.valorPendente)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Consulta de Placas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Consulta de Placas</h2>
          <Link href="/consulta-placas">
            <Button variant="ghost" size="sm">Ver todas <ArrowRight className="w-3.5 h-3.5" /></Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard title="Total de consultas" value={statsPlacas.total} icon={CarFront} color="blue" />
          <StatCard title="Localizadas" value={statsPlacas.localizadas} icon={CheckCircle2} color="emerald" />
          <StatCard title="Não localizadas" value={statsPlacas.naoLocalizadas} icon={XCircle} color="red" />
          <StatCard title="Total pago placas" value={formatCurrency(statsPlacas.totalPago)} icon={DollarSign} color="blue" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Diligências recentes (respeitam filtro) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Diligências recentes {filtro !== 'todos' && <span className="text-xs font-normal text-slate-400 ml-1">({filtro})</span>}</CardTitle>
              <Link href="/diligencias">
                <Button variant="ghost" size="sm">Ver todas <ArrowRight className="w-3.5 h-3.5" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-slate-50">
              {recentes.map((d) => {
                const adv = advogadoMap.get(d.advogadoId)
                return (
                  <li key={d.id}>
                    <Link href={`/diligencias/${d.id}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-sm font-medium text-slate-800 truncate">{d.vitima}</p>
                          <EmpresaBadge empresaCliente={d.empresaCliente} />
                        </div>
                        <p className="text-xs text-slate-500 truncate">{d.ccc} · {d.cidade}/{d.uf}</p>
                        {adv && <p className="text-xs text-slate-400 truncate">{adv.nomeCompleto}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <StatusDiligenciaBadge status={d.status} />
                        <StatusPagamentoBadge status={d.statusPagamento} />
                      </div>
                    </Link>
                  </li>
                )
              })}
              {recentes.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-slate-400">Nenhuma diligência encontrada</li>
              )}
            </ul>
          </CardBody>
        </Card>

        {/* Ações rápidas */}
        <Card>
          <CardHeader><CardTitle>Ações rápidas</CardTitle></CardHeader>
          <CardBody className="grid grid-cols-2 gap-2">
            <Link href="/diligencias/nova?cliente=bat">
              <Button variant="secondary" size="sm" className="w-full"><Plus className="w-3.5 h-3.5" /> Diligência BAT</Button>
            </Link>
            <Link href="/diligencias/nova?cliente=vtal">
              <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-700 text-white"><Plus className="w-3.5 h-3.5" /> Diligência V.TAL</Button>
            </Link>
            <Link href="/triagem">
              <Button variant="secondary" size="sm" className="w-full"><FileSearch className="w-3.5 h-3.5" /> Triagem</Button>
            </Link>
            <Link href="/advogados/novo">
              <Button variant="secondary" size="sm" className="w-full">Novo advogado</Button>
            </Link>
            <Link href="/pesquisa">
              <Button variant="secondary" size="sm" className="w-full"><MessageSquare className="w-3.5 h-3.5" /> Pesquisas</Button>
            </Link>
            <Link href="/consulta-placas/nova">
              <Button variant="secondary" size="sm" className="w-full"><CarFront className="w-3.5 h-3.5" /> Nova consulta placa</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
