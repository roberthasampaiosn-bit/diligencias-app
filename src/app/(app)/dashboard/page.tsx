'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  FileSearch, ClipboardList, CheckCircle2, MessageSquare,
  Trophy, ArrowRight, Search,
} from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useAdvogados } from '@/context/AdvogadosContext'
import { useEventos } from '@/context/EventosContext'
import { computeDashboardStats } from '@/services/diligenciaService'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusDiligenciaBadge, StatusPagamentoBadge } from '@/components/shared/StatusBadge'
import { formatCurrency } from '@/lib/utils'
import { StatusEvento } from '@/types'

export default function DashboardPage() {
  const { diligencias } = useDiligencias()
  const { advogadoMap } = useAdvogados()
  const { eventos } = useEventos()

  const stats = useMemo(() => {
    const base = computeDashboardStats(diligencias)
    return {
      ...base,
      eventosNovos: eventos.filter((e) => e.statusEvento === StatusEvento.Pendente).length,
    }
  }, [diligencias, eventos])

  const recentes = useMemo(() => diligencias.slice(0, 5), [diligencias])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Visão geral do sistema de diligências</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard title="Eventos novos" value={stats.eventosNovos} icon={FileSearch} color="blue" subtitle="Aguardando triagem" />
        <StatCard title="Em andamento" value={stats.diligenciasEmAndamento} icon={ClipboardList} color="amber" />
        <StatCard title="Diligências realizadas" value={stats.diligenciasRealizadas} icon={CheckCircle2} color="emerald" subtitle="Serviço executado" />
        <StatCard title="Diligências concluídas" value={stats.ciclosFinalizados} icon={Trophy} color="slate" subtitle="Processo finalizado" />
        <StatCard title="Pesquisas pendentes" value={stats.pesquisasPendentes} icon={MessageSquare} color="purple" subtitle="Aguardando resposta" />
        <StatCard title="Pesquisas concluídas" value={stats.pesquisasConcluidas} icon={Search} color="blue" subtitle="Respondidas" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Total pago</p>
          <p className="text-2xl font-bold text-emerald-800 mt-1">{formatCurrency(stats.valorTotalPago)}</p>
          <p className="text-xs text-emerald-600 mt-1">Acumulado · todas as diligências</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Diligências recentes</CardTitle>
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
                        <p className="text-sm font-medium text-slate-800 truncate">{d.vitima}</p>
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
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ações rápidas</CardTitle></CardHeader>
          <CardBody className="grid grid-cols-2 gap-2">
            <Link href="/diligencias/nova">
              <Button variant="secondary" size="sm" className="w-full"><ClipboardList className="w-3.5 h-3.5" /> Nova diligência</Button>
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
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
