'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { DollarSign, CheckCircle2, Clock, AlertCircle, Settings, CarFront, ExternalLink, Paperclip, SlidersHorizontal, X } from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useAdvogados } from '@/context/AdvogadosContext'
import { useConsultasPlacas } from '@/context/ConsultaPlacasContext'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { SearchInput } from '@/components/ui/SearchInput'
import { Input } from '@/components/ui/Input'
import { StatusPagamentoBadge, StatusDiligenciaBadge } from '@/components/shared/StatusBadge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StatusPagamento, StatusDiligencia, EmpresaCliente } from '@/types'
import { useRef, useEffect } from 'react'
import { EmpresaBadge } from '@/components/shared/StatusBadge'

function daysSince(isoDate: string): number {
  const ms = Date.now() - new Date(isoDate).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function currentMonthStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function FinanceiroPage() {
  const { diligencias, marcarPago } = useDiligencias()
  const { advogadoMap } = useAdvogados()
  const { consultasPlacas } = useConsultasPlacas()
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'pendentes' | 'atrasados' | 'pagos'>('todos')
  const [filtroEmpresa, setFiltroEmpresa] = useState<'todas' | EmpresaCliente>('todas')
  const [, startTransition] = useTransition()
  const [paying, setPaying] = useState<string | null>(null)
  const [diasAtrasado, setDiasAtrasado] = useState(30)
  const [showConfig, setShowConfig] = useState(false)
  const [showFiltros, setShowFiltros] = useState(false)
  const filtrosRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (filtrosRef.current && !filtrosRef.current.contains(e.target as Node)) setShowFiltros(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const mes = currentMonthStr()

  const statsPlacas = useMemo(() => {
    const pagas = consultasPlacas.filter((c) => c.resultado === 'Localizada' && c.valor != null)
    return {
      total: pagas.reduce((s, c) => s + (c.valor ?? 0), 0),
      count: pagas.length,
    }
  }, [consultasPlacas])

  const stats = useMemo(() => {
    const pago = diligencias.filter((d) => d.statusPagamento === StatusPagamento.Pago)
    const pendente = diligencias.filter((d) => d.statusPagamento === StatusPagamento.Pendente)
    const atrasados = pendente.filter(
      (d) => d.status === StatusDiligencia.Realizada && daysSince(d.createdAt) > diasAtrasado
    )
    const pagoMes = pago.filter((d) => (d.dataAtendimento ?? d.createdAt.split('T')[0]).startsWith(mes))
    const pendenteMes = pendente.filter((d) => (d.dataAtendimento ?? d.createdAt.split('T')[0]).startsWith(mes))

    return {
      totalGeral: diligencias.reduce((a, d) => a + d.valorDiligencia, 0),
      totalPago: pago.reduce((a, d) => a + d.valorDiligencia, 0),
      totalPendente: pendente.reduce((a, d) => a + d.valorDiligencia, 0),
      totalAtrasado: atrasados.reduce((a, d) => a + d.valorDiligencia, 0),
      countPago: pago.length,
      countPendente: pendente.length,
      countAtrasado: atrasados.length,
      totalPagoMes: pagoMes.reduce((a, d) => a + d.valorDiligencia, 0),
      totalPendenteMes: pendenteMes.reduce((a, d) => a + d.valorDiligencia, 0),
    }
  }, [diligencias, diasAtrasado, mes])

  const lista = useMemo(() => {
    let l = diligencias
    if (filtroEmpresa !== 'todas') l = l.filter((d) => d.empresaCliente === filtroEmpresa)
    if (filtro === 'pendentes') l = l.filter((d) => d.statusPagamento === StatusPagamento.Pendente)
    if (filtro === 'pagos') l = l.filter((d) => d.statusPagamento === StatusPagamento.Pago)
    if (filtro === 'atrasados') {
      l = l.filter(
        (d) => d.statusPagamento === StatusPagamento.Pendente &&
          d.status === StatusDiligencia.Realizada &&
          daysSince(d.createdAt) > diasAtrasado
      )
    }
    if (search) {
      const q = search.toLowerCase()
      l = l.filter((d) => d.vitima.toLowerCase().includes(q) || d.ccc.toLowerCase().includes(q) || d.empresa.toLowerCase().includes(q))
    }
    return [...l].sort((a, b) => {
      if (a.statusPagamento === StatusPagamento.Pendente && b.statusPagamento === StatusPagamento.Pago) return -1
      if (a.statusPagamento === StatusPagamento.Pago && b.statusPagamento === StatusPagamento.Pendente) return 1
      return 0
    })
  }, [diligencias, filtro, filtroEmpresa, search, diasAtrasado])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Financeiro</h1>
          <p className="text-sm text-slate-500 mt-0.5">Controle de pagamentos das diligências</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowConfig((v) => !v)}>
          <Settings className="w-4 h-4" /> Config
        </Button>
      </div>

      {showConfig && (
        <Card>
          <CardBody>
            <div className="flex items-center gap-4">
              <div className="w-48">
                <Input
                  label="Dias para considerar atrasado"
                  type="number"
                  min="1"
                  value={String(diasAtrasado)}
                  onChange={(e) => setDiasAtrasado(Math.max(1, parseInt(e.target.value) || 30))}
                />
              </div>
              <p className="text-xs text-slate-500 mt-5">
                Diligências <strong>realizadas</strong> com pagamento pendente há mais de {diasAtrasado} dias são marcadas como atrasadas.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Stats principais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Total pago em 2026" value={formatCurrency(stats.totalPago)} icon={CheckCircle2} color="emerald" subtitle={`${stats.countPago} diligências`} />
        <StatCard title="Pendente total" value={formatCurrency(stats.totalPendente)} icon={Clock} color="amber" subtitle={`${stats.countPendente} pendentes`} />
        <StatCard title="Atrasados" value={formatCurrency(stats.totalAtrasado)} icon={AlertCircle} color="red" subtitle={`${stats.countAtrasado} atrasadas`} />
        <StatCard title="Volume 2026" value={formatCurrency(stats.totalGeral)} icon={DollarSign} color="blue" subtitle={`${diligencias.length} diligências`} />
      </div>

      {/* Stats do mês */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Pago este mês</p>
          <p className="text-2xl font-bold text-emerald-800 mt-1">{formatCurrency(stats.totalPagoMes)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Novas pendências este mês</p>
          <p className="text-2xl font-bold text-amber-800 mt-1">{formatCurrency(stats.totalPendenteMes)}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar vítima, CCC, empresa..." className="sm:w-64" />
            <div className="flex gap-1.5 flex-wrap items-center">
              {/* Filtros rápidos de cliente */}
              {(['todas', EmpresaCliente.BatBrasil, EmpresaCliente.VTAL] as const).map((f) => (
                <button key={f} onClick={() => startTransition(() => setFiltroEmpresa(f))}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filtroEmpresa === f ? (f === EmpresaCliente.VTAL ? 'bg-purple-600 text-white' : f === EmpresaCliente.BatBrasil ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white') : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {f === 'todas' ? 'Todas' : f}
                </button>
              ))}
              <div className="w-px bg-slate-200 h-5" />
              {/* Filtros avançados */}
              <div className="relative" ref={filtrosRef}>
                <button onClick={() => setShowFiltros((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filtro !== 'todos' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros
                  {filtro !== 'todos' && <span className="w-1.5 h-1.5 rounded-full bg-white/80 inline-block" />}
                </button>
                {showFiltros && (
                  <div className="absolute right-0 top-full mt-1.5 z-30 w-52 bg-white border border-slate-200 rounded-xl shadow-lg p-3 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Status pgto</p>
                      {filtro !== 'todos' && <button onClick={() => { startTransition(() => setFiltro('todos')); setShowFiltros(false) }} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"><X className="w-3 h-3" />Limpar</button>}
                    </div>
                    {(['todos', 'pendentes', 'atrasados', 'pagos'] as const).map((f) => (
                      <button key={f} onClick={() => { startTransition(() => setFiltro(f)); setShowFiltros(false) }}
                        className={`w-full text-left px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${filtro === f ? (f === 'atrasados' ? 'bg-red-500 text-white' : 'bg-blue-600 text-white') : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {f === 'todos' ? 'Todos' : f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Mobile */}
        <div className="sm:hidden divide-y divide-slate-50">
          {lista.map((d) => {
            const adv = advogadoMap.get(d.advogadoId)
            const atrasada = d.statusPagamento === StatusPagamento.Pendente &&
              d.status === StatusDiligencia.Realizada &&
              daysSince(d.createdAt) > diasAtrasado
            return (
              <div key={d.id} className={`px-4 py-3.5 ${atrasada ? 'bg-red-50' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <Link href={`/diligencias/${d.id}`} className="font-semibold text-slate-800 text-sm hover:text-blue-600">{d.vitima}</Link>
                  <StatusPagamentoBadge status={d.statusPagamento} />
                </div>
                <p className="text-xs text-blue-600 font-mono mb-0.5">{d.ccc}</p>
                <p className="text-xs text-slate-500 mb-2">{adv?.nomeCompleto} · Pix: {adv?.chavePix}</p>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{formatCurrency(d.valorDiligencia)}</span>
                  {d.statusPagamento === StatusPagamento.Pendente && d.status === StatusDiligencia.Realizada && (
                    <Button size="sm" variant="success" loading={paying === d.id} onClick={async () => {
                      setPaying(d.id)
                      try { await marcarPago(d.id) } finally { setPaying(null) }
                    }}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Pagar
                    </Button>
                  )}
                </div>
                {atrasada && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Atrasada há {daysSince(d.createdAt)} dias
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Desktop */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['CCC / Vítima', 'Empresa', 'Advogado', 'Pix', 'Status', 'Valor', 'Pagamento', 'Ação'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lista.map((d) => {
                const adv = advogadoMap.get(d.advogadoId)
                const atrasada = d.statusPagamento === StatusPagamento.Pendente &&
                  d.status === StatusDiligencia.Realizada &&
                  daysSince(d.createdAt) > diasAtrasado
                return (
                  <tr key={d.id} className={`hover:bg-slate-50 transition-colors ${atrasada ? 'bg-red-50 hover:bg-red-100' : ''}`}>
                    <td className="px-4 py-3">
                      <Link href={`/diligencias/${d.id}`} className="font-medium text-slate-800 hover:text-blue-600 block">{d.vitima}</Link>
                      <span className="font-mono text-xs text-blue-600">{d.ccc}</span>
                      {atrasada && <span className="text-xs text-red-600 flex items-center gap-0.5 mt-0.5"><AlertCircle className="w-3 h-3" /> {daysSince(d.createdAt)}d atrasada</span>}
                    </td>
                    <td className="px-4 py-3"><EmpresaBadge empresaCliente={d.empresaCliente} /></td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700 truncate max-w-[160px]">{adv?.nomeCompleto ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">{adv?.chavePix ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3"><StatusDiligenciaBadge status={d.status} /></td>
                    <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{formatCurrency(d.valorDiligencia)}</td>
                    <td className="px-4 py-3"><StatusPagamentoBadge status={d.statusPagamento} /></td>
                    <td className="px-4 py-3">
                      {d.statusPagamento === StatusPagamento.Pendente && d.status === StatusDiligencia.Realizada && (
                        <Button size="sm" variant="success" loading={paying === d.id} onClick={async () => {
                          setPaying(d.id)
                          try { await marcarPago(d.id) } finally { setPaying(null) }
                        }}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Pagar
                        </Button>
                      )}
                      {d.statusPagamento === StatusPagamento.Pendente && d.status === StatusDiligencia.EmAndamento && (
                        <Badge variant="warning">Aguardando realização</Badge>
                      )}
                      {d.statusPagamento === StatusPagamento.Pago && (
                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── Consulta de Placas ─────────────────────────────────────────────── */}
      <div className="pt-2">
        <div className="flex items-center gap-2 mb-4">
          <CarFront className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-800">Consulta de Placas</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <StatCard
            title="Total pago — Consulta de Placas"
            value={formatCurrency(statsPlacas.total)}
            icon={DollarSign}
            color="blue"
            subtitle={`${statsPlacas.count} consulta${statsPlacas.count !== 1 ? 's' : ''} localizada${statsPlacas.count !== 1 ? 's' : ''}`}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Consultas de placas pagas</CardTitle>
          </CardHeader>
          {consultasPlacas.filter((c) => c.resultado === 'Localizada').length === 0 ? (
            <CardBody>
              <p className="text-sm text-slate-400 text-center py-6">Nenhuma consulta localizada registrada.</p>
            </CardBody>
          ) : (
            <>
              {/* Mobile */}
              <div className="sm:hidden divide-y divide-slate-50">
                {consultasPlacas
                  .filter((c) => c.resultado === 'Localizada')
                  .map((c) => (
                    <div key={c.id} className="px-4 py-3.5">
                      <div className="flex items-center justify-between mb-1">
                        <Link href={`/consulta-placas/${c.id}`} className="font-mono font-bold text-slate-800 hover:text-blue-600">{c.placa}</Link>
                        <span className="font-semibold text-emerald-700">{c.valor != null ? formatCurrency(c.valor) : '—'}</span>
                      </div>
                      <p className="text-xs text-slate-500">{c.solicitante} · {formatDate(c.dataConsulta)}</p>
                      <div className="flex gap-3 mt-1.5">
                        {c.anexoResultado && (
                          <a href={c.anexoResultado} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600">
                            <Paperclip className="w-3 h-3" /> Resultado
                          </a>
                        )}
                        {c.comprovantePagamento && (
                          <a href={c.comprovantePagamento} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600">
                            <Paperclip className="w-3 h-3" /> Comprovante
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
              {/* Desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Placa', 'Solicitante', 'Data', 'Valor', 'Resultado', 'Comprovante'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {consultasPlacas
                      .filter((c) => c.resultado === 'Localizada')
                      .map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/consulta-placas/${c.id}`} className="font-mono font-bold text-slate-800 hover:text-blue-600">{c.placa}</Link>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{c.solicitante}</td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(c.dataConsulta)}</td>
                          <td className="px-4 py-3 font-semibold text-emerald-700 whitespace-nowrap">{c.valor != null ? formatCurrency(c.valor) : '—'}</td>
                          <td className="px-4 py-3">
                            {c.anexoResultado
                              ? <a href={c.anexoResultado} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"><ExternalLink className="w-3 h-3" /> Ver</a>
                              : <span className="text-slate-400">—</span>
                            }
                          </td>
                          <td className="px-4 py-3">
                            {c.comprovantePagamento
                              ? <a href={c.comprovantePagamento} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"><ExternalLink className="w-3 h-3" /> Ver</a>
                              : <span className="text-slate-400">—</span>
                            }
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
