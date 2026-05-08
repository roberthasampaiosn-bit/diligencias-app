'use client'

import { useState, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { Plus, CarFront, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { useConsultasPlacas } from '@/context/ConsultaPlacasContext'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ResultadoConsultaPlaca } from '@/types'

function ResultadoBadge({ resultado }: { resultado?: ResultadoConsultaPlaca }) {
  if (!resultado) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Sem resultado</span>
  }
  if (resultado === 'Localizada') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="w-3 h-3" /> Localizada
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
      <XCircle className="w-3 h-3" /> Não localizada
    </span>
  )
}

function isPendente(c: { resultado?: string; valor?: number; anexoResultado?: string; comprovantePagamento?: string }) {
  return c.resultado === 'Localizada' && (!c.valor || !c.anexoResultado || !c.comprovantePagamento)
}

function ConsultaPlacasContent() {
  const { consultasPlacas } = useConsultasPlacas()
  const [search, setSearch] = useState('')
  const [filtroResultado, setFiltroResultado] = useState<'todos' | ResultadoConsultaPlaca>('todos')

  const mesAtual = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [])

  // Mapa de placas para detectar duplicatas
  const placasMap = useMemo(() => {
    const m = new Map<string, number>()
    consultasPlacas.forEach((c) => {
      m.set(c.placa, (m.get(c.placa) ?? 0) + 1)
    })
    return m
  }, [consultasPlacas])

  const lista = useMemo(() => {
    let l = consultasPlacas
    if (filtroResultado !== 'todos') {
      l = l.filter((c) => c.resultado === filtroResultado)
    }
    if (search) {
      const q = search.toLowerCase()
      l = l.filter((c) =>
        c.placa.toLowerCase().includes(q) ||
        c.solicitante.toLowerCase().includes(q) ||
        c.dataConsulta.includes(q)
      )
    }
    return l
  }, [consultasPlacas, search, filtroResultado])

  // Stats apenas do mês atual
  const totais = useMemo(() => {
    const doMes = consultasPlacas.filter((c) => c.dataConsulta.startsWith(mesAtual))
    return {
      total: doMes.length,
      localizadas: doMes.filter((c) => c.resultado === 'Localizada').length,
      naoLocalizadas: doMes.filter((c) => c.resultado === 'Não localizada').length,
    }
  }, [consultasPlacas, mesAtual])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Consulta de Placas</h1>
          <p className="text-sm text-slate-500 mt-0.5">{totais.total} consulta{totais.total !== 1 ? 's' : ''} registrada{totais.total !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/consulta-placas/nova">
          <Button><Plus className="w-4 h-4" /> Nova consulta</Button>
        </Link>
      </div>

      {/* Resumo do mês atual */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{totais.total}</p>
          <p className="text-xs text-slate-400 mt-1">este mês</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 shadow-sm p-4">
          <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Localizadas</p>
          <p className="text-2xl font-bold text-emerald-800 mt-1">{totais.localizadas}</p>
          <p className="text-xs text-emerald-600 mt-1">este mês</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm p-4">
          <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Não localizadas</p>
          <p className="text-2xl font-bold text-red-800 mt-1">{totais.naoLocalizadas}</p>
          <p className="text-xs text-red-500 mt-1">este mês</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por placa, solicitante ou data..."
              className="sm:w-72"
            />
            <div className="flex gap-1.5 flex-wrap">
              {(['todos', 'Localizada', 'Não localizada'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltroResultado(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                    filtroResultado === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        {lista.length === 0 ? (
          <CardBody>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CarFront className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">Nenhuma consulta encontrada</p>
              <p className="text-xs text-slate-400 mt-1">Tente ajustar os filtros ou cadastre uma nova consulta.</p>
            </div>
          </CardBody>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden divide-y divide-slate-50">
              {lista.map((c) => {
                const isDuplicada = (placasMap.get(c.placa) ?? 0) > 1
                return (
                  <Link key={c.id} href={`/consulta-placas/${c.id}`} className="block px-4 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-slate-800 text-sm">{c.placa}</span>
                        {isDuplicada && (
                          <span title="Placa já consultada antes" className="flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                            <AlertTriangle className="w-3 h-3" /> Repetida
                          </span>
                        )}
                      </div>
                      <ResultadoBadge resultado={c.resultado} />
                    </div>
                    <p className="text-xs text-slate-500">{c.solicitante} · {formatDate(c.dataConsulta)}</p>
                    {c.resultado === 'Localizada' && c.valor != null && (
                      <p className="text-xs font-semibold text-emerald-700 mt-1">{formatCurrency(c.valor)}</p>
                    )}
                    {isPendente(c) && (
                      <p className="flex items-center gap-1 text-xs text-amber-600 font-medium mt-1">
                        <AlertTriangle className="w-3 h-3" /> Dados pendentes
                      </p>
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Placa', 'Solicitante', 'Data', 'Resultado', 'Valor', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lista.map((c) => {
                    const isDuplicada = (placasMap.get(c.placa) ?? 0) > 1
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link href={`/consulta-placas/${c.id}`} className="font-mono font-bold text-slate-800 hover:text-blue-700 hover:underline cursor-pointer">
                              {c.placa}
                            </Link>
                            {isDuplicada && (
                              <span title="Placa já consultada antes" className="flex items-center gap-0.5 text-xs text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded-md">
                                <AlertTriangle className="w-3 h-3" /> Repetida
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{c.solicitante}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(c.dataConsulta)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <ResultadoBadge resultado={c.resultado} />
                            {isPendente(c) && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                                <AlertTriangle className="w-3 h-3" /> Dados pendentes
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                          {c.resultado === 'Localizada' && c.valor != null ? formatCurrency(c.valor) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/consulta-placas/${c.id}`} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Ver</Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

export default function ConsultaPlacasPage() {
  return (
    <Suspense>
      <ConsultaPlacasContent />
    </Suspense>
  )
}
