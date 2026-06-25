'use client'

import { useState, useMemo, memo, useRef, useEffect, Suspense, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ClipboardList, Plus, MapPin, SlidersHorizontal, X, AlertTriangle } from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useAdvogados } from '@/context/AdvogadosContext'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusDiligenciaBadge, StatusPagamentoBadge, EmpresaBadge } from '@/components/shared/StatusBadge'
import { formatCurrency, formatDate, tituloDiligencia } from '@/lib/utils'
import { Diligencia, StatusDiligencia, StatusPagamento, ModoDiligencia, EmpresaCliente, Advogado } from '@/types'

// ── Documentos faltando ───────────────────────────────────────────────────────

function docsFaltando(d: Diligencia): string[] {
  if (!d.cicloFinalizado || d.dispensarDocumentos) return []
  const faltam: string[] = []
  if (!d.anexos.contratoAssinado) faltam.push('Contrato assinado')
  if (!d.anexos.reciboAssinado) faltam.push('Recibo assinado')
  if ((d.valorDiligencia ?? 0) > 0 && d.statusPagamento === StatusPagamento.Pago && !d.anexos.comprovantePagamento)
    faltam.push('Comprovante de pagamento')
  if (!d.anexos.comprovanteServico) faltam.push('Comprovante de serviço')
  return faltam
}

// ── Ordenação inteligente ─────────────────────────────────────────────────────

function prioridade(d: Diligencia): number {
  if (d.status === StatusDiligencia.EmAndamento) return 0
  if (d.status === StatusDiligencia.Realizada && !d.cicloFinalizado) return 1
  return 2
}

function dataDiligencia(d: Diligencia): string {
  return d.dataAtendimento ?? d.dataInformativo ?? d.createdAt.split('T')[0]
}

// Data usada para ORDENAR a lista: prioriza a data do evento (o fato em si).
// Mantida separada de dataDiligencia (que é usada no filtro de "últimos 30 dias").
function dataEventoOrd(d: Diligencia): string {
  return d.dataEvento ?? d.dataAtendimento ?? d.dataInformativo ?? d.createdAt.split('T')[0]
}

function sortDiligencias(list: Diligencia[]): Diligencia[] {
  return [...list].sort((a, b) => {
    const pa = prioridade(a), pb = prioridade(b)
    if (pa !== pb) return pa - pb                          // em andamento primeiro
    const da = dataEventoOrd(a), db = dataEventoOrd(b)
    if (da !== db) return db.localeCompare(da)             // evento mais recente em cima
    return (b.ccc ?? '').localeCompare(a.ccc ?? '')        // desempate: CCC decrescente
  })
}

// ── Situação do ciclo (coluna "Situação") ─────────────────────────────────────

type SitTone = 'slate' | 'amber' | 'blue' | 'emerald'
const SIT_TONE: Record<SitTone, string> = {
  slate: 'text-slate-400', amber: 'text-amber-600', blue: 'text-blue-600', emerald: 'text-emerald-600',
}

function situacaoCiclo(d: Diligencia): { label: string; tone: SitTone; docs: number } {
  if (d.cicloFinalizado) return { label: 'Concluída', tone: 'emerald', docs: docsFaltando(d).length }
  if (d.status === StatusDiligencia.EmAndamento) return { label: 'Em andamento', tone: 'slate', docs: 0 }
  // Realizada, ciclo ainda aberto: pode fechar (remota/sem docs/paga) ou trava no pagamento
  const podeConcluir = d.modoDiligencia === ModoDiligencia.Remoto || !!d.dispensarDocumentos || d.statusPagamento === StatusPagamento.Pago
  return podeConcluir
    ? { label: 'Pronta p/ concluir', tone: 'blue', docs: 0 }
    : { label: 'Aguardando pagamento', tone: 'amber', docs: 0 }
}

// ── Row memoizado ─────────────────────────────────────────────────────────────

const DiligenciaRowDesktop = memo(function DiligenciaRowDesktop({
  d, adv,
}: { d: Diligencia; adv: Advogado | undefined }) {
  const router = useRouter()
  const dataEv = d.dataEvento ?? d.dataAtendimento ?? d.dataInformativo
  const sit = situacaoCiclo(d)
  return (
    <tr
      className="hover:bg-slate-50 cursor-pointer transition-colors"
      onClick={() => router.push(`/diligencias/${d.id}`)}
    >
      <td className="px-4 py-3">
        <span className="font-mono text-xs font-semibold text-blue-700">{d.ccc}</span>
      </td>
      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{dataEv ? formatDate(dataEv) : '—'}</td>
      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{d.cidade}/{d.uf}</td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-800 truncate max-w-[180px]">{tituloDiligencia(d)}</p>
        <p className="text-xs text-slate-400">{d.tipoEvento}</p>
      </td>
      <td className="px-4 py-3"><EmpresaBadge empresaCliente={d.empresaCliente} /></td>
      <td className="px-4 py-3">
        <p className="text-slate-600 truncate max-w-[160px]">{adv?.nomeCompleto ?? '—'}</p>
      </td>
      <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">{formatCurrency(d.valorDiligencia)}</td>
      <td className="px-4 py-3"><StatusDiligenciaBadge status={d.status} /></td>
      <td className="px-4 py-3">
        {d.modoDiligencia === ModoDiligencia.Remoto
          ? <span className="text-xs text-slate-400">—</span>
          : <StatusPagamentoBadge status={d.statusPagamento} />
        }
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          <span className={`text-xs font-medium ${SIT_TONE[sit.tone]}`}>
            {sit.tone === 'emerald' ? '✓ ' : ''}{sit.label}
          </span>
          {sit.docs > 0 && (
            <div className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span className="text-xs font-medium">
                {sit.docs} doc{sit.docs > 1 ? 's' : ''} faltando
              </span>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
})

// ── Filtros avançados (dropdown) ──────────────────────────────────────────────

type FiltroStatus = 'todos' | StatusDiligencia | 'pendencia' | 'cicloFechado'
type FiltroModo   = 'todos' | ModoDiligencia
type FiltroPeriodo = '30d' | 'todos'

interface FiltrosAvancados {
  status: FiltroStatus
  modo: FiltroModo
  periodo: FiltroPeriodo
}

function FiltrosDropdown({
  filtros, onChange, onClear,
}: {
  filtros: FiltrosAvancados
  onChange: (f: Partial<FiltrosAvancados>) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const hasActive = filtros.status !== 'todos' || filtros.modo !== 'todos' || filtros.periodo !== '30d'

  function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
          active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
          hasActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Filtros
        {hasActive && <span className="w-1.5 h-1.5 rounded-full bg-white/80 inline-block" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</p>
            {hasActive && (
              <button onClick={() => { onClear(); setOpen(false) }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" /> Limpar
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip label="Todos" active={filtros.status === 'todos'} onClick={() => onChange({ status: 'todos' })} />
            <Chip label="Em andamento" active={filtros.status === StatusDiligencia.EmAndamento} onClick={() => onChange({ status: StatusDiligencia.EmAndamento })} />
            <Chip label="Realizada" active={filtros.status === StatusDiligencia.Realizada} onClick={() => onChange({ status: StatusDiligencia.Realizada })} />
            <Chip label="Pendência documental" active={filtros.status === 'pendencia'} onClick={() => onChange({ status: 'pendencia' })} />
            <Chip label="Ciclo fechado" active={filtros.status === 'cicloFechado'} onClick={() => onChange({ status: 'cicloFechado' })} />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Modo</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip label="Todos" active={filtros.modo === 'todos'} onClick={() => onChange({ modo: 'todos' })} />
              <Chip label="Presencial" active={filtros.modo === ModoDiligencia.Presencial} onClick={() => onChange({ modo: ModoDiligencia.Presencial })} />
              <Chip label="Remoto" active={filtros.modo === ModoDiligencia.Remoto} onClick={() => onChange({ modo: ModoDiligencia.Remoto })} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Período</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip label="Últimos 30 dias" active={filtros.periodo === '30d'} onClick={() => onChange({ periodo: '30d' })} />
              <Chip label="Todas" active={filtros.periodo === 'todos'} onClick={() => onChange({ periodo: 'todos' })} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page Content ──────────────────────────────────────────────────────────────

function DiligenciasContent() {
  const searchParams = useSearchParams()
  const { diligencias } = useDiligencias()
  const { advogadoMap } = useAdvogados()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(searchParams.get('ccc') || '')

  const paramEmpresa = searchParams.get('empresa') as EmpresaCliente | null
  const paramStatus = searchParams.get('status') as StatusDiligencia | null
  const paramCiclo = searchParams.get('ciclo')
  const initialStatus: FiltroStatus = paramCiclo === 'fechado' ? 'cicloFechado' : paramStatus ?? 'todos'
  const hasFilter = !!(paramEmpresa || paramStatus || paramCiclo)

  const [filtroEmpresa, setFiltroEmpresa] = useState<'todas' | EmpresaCliente>(paramEmpresa ?? 'todas')
  const [filtrosAvancados, setFiltrosAvancados] = useState<FiltrosAvancados>({ status: initialStatus, modo: 'todos', periodo: hasFilter ? 'todos' : '30d' })

  function updateFiltro(partial: Partial<FiltrosAvancados>) {
    startTransition(() => setFiltrosAvancados((f) => ({ ...f, ...partial })))
  }

  function clearFiltros() {
    startTransition(() => setFiltrosAvancados({ status: 'todos', modo: 'todos', periodo: '30d' }))
  }

  const lista = useMemo(() => {
    let l = diligencias
    if (filtrosAvancados.periodo === '30d') {
      const corte = new Date()
      corte.setDate(corte.getDate() - 30)
      const corteStr = corte.toISOString().split('T')[0]
      l = l.filter((d) => dataDiligencia(d) >= corteStr)
    }
    if (filtroEmpresa !== 'todas') l = l.filter((d) => d.empresaCliente === filtroEmpresa)
    if (filtrosAvancados.status === 'pendencia') {
      l = l.filter((d) => d.status === StatusDiligencia.Realizada && !d.cicloFinalizado)
    } else if (filtrosAvancados.status === 'cicloFechado') {
      l = l.filter((d) => d.cicloFinalizado)
    } else if (filtrosAvancados.status !== 'todos') {
      l = l.filter((d) => d.status === filtrosAvancados.status)
    }
    if (filtrosAvancados.modo !== 'todos') l = l.filter((d) => d.modoDiligencia === filtrosAvancados.modo)
    if (search) {
      const q = search.toLowerCase()
      l = l.filter(
        (d) =>
          d.ccc.toLowerCase().includes(q) ||
          d.vitima.toLowerCase().includes(q) ||
          d.empresaCliente.toLowerCase().includes(q) ||
          d.empresa.toLowerCase().includes(q) ||
          d.cidade.toLowerCase().includes(q) ||
          (advogadoMap.get(d.advogadoId)?.nomeCompleto ?? '').toLowerCase().includes(q)
      )
    }
    return sortDiligencias(l)
  }, [diligencias, search, filtrosAvancados, filtroEmpresa])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Diligências</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {lista.length} exibidas
            {filtrosAvancados.periodo === '30d' && <span className="text-slate-400"> · últimos 30 dias · <button className="underline hover:text-slate-600" onClick={() => updateFiltro({ periodo: 'todos' })}>ver todas ({diligencias.length})</button></span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/diligencias/nova?cliente=bat">
            <Button size="md" variant="secondary"><Plus className="w-4 h-4" /> Nova diligência BAT BRASIL</Button>
          </Link>
          <Link href="/diligencias/nova?cliente=vtal">
            <Button size="md" className="bg-purple-600 hover:bg-purple-700 text-white"><Plus className="w-4 h-4" /> Nova diligência V.TAL</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <SearchInput value={search} onChange={setSearch} placeholder="CCC, vítima, advogado, cidade..." className="sm:w-64" />
            <div className="flex gap-1.5 flex-wrap items-center">
              {/* Filtros rápidos de cliente */}
              {(['todas', EmpresaCliente.BatBrasil, EmpresaCliente.VTAL] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => startTransition(() => setFiltroEmpresa(f))}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    filtroEmpresa === f
                      ? f === EmpresaCliente.VTAL ? 'bg-purple-600 text-white'
                        : f === EmpresaCliente.BatBrasil ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f === 'todas' ? 'Todas' : f}
                </button>
              ))}
              <div className="w-px bg-slate-200 h-5" />
              {/* Filtros avançados */}
              <FiltrosDropdown filtros={filtrosAvancados} onChange={updateFiltro} onClear={clearFiltros} />
            </div>
          </div>
        </CardHeader>

        {lista.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nenhuma diligência encontrada"
            action={<Link href="/diligencias/nova"><Button size="sm"><Plus className="w-3.5 h-3.5" /> Nova</Button></Link>} />
        ) : (
          <CardBody className="p-0">
            {/* Mobile */}
            <div className="sm:hidden divide-y divide-slate-50">
              {lista.map((d) => {
                const sit = situacaoCiclo(d)
                return (
                <Link key={d.id} href={`/diligencias/${d.id}`} className="block px-4 py-3.5 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-slate-800 text-sm truncate">{tituloDiligencia(d)}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <EmpresaBadge empresaCliente={d.empresaCliente} />
                      <StatusDiligenciaBadge status={d.status} />
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 font-mono mb-1">{d.ccc}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{d.cidade}/{d.uf}</span>
                    <span>{formatCurrency(d.valorDiligencia)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-slate-400 truncate">{advogadoMap.get(d.advogadoId)?.nomeCompleto}</p>
                    {d.modoDiligencia === ModoDiligencia.Remoto
                      ? <span className="text-xs text-slate-400">—</span>
                      : <StatusPagamentoBadge status={d.statusPagamento} />
                    }
                  </div>
                  <p className={`text-xs font-medium mt-1 ${SIT_TONE[sit.tone]}`}>
                    {sit.tone === 'emerald' ? '✓ ' : ''}{sit.label}
                    {sit.docs > 0 ? ` · ${sit.docs} doc${sit.docs > 1 ? 's' : ''} faltando` : ''}
                  </p>
                </Link>
                )
              })}
            </div>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['CCC', 'Data do evento', 'Local', 'Vítima', 'Cliente', 'Advogado', 'Valor', 'Status', 'Pagamento', 'Situação'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lista.map((d) => (
                    <DiligenciaRowDesktop key={d.id} d={d} adv={advogadoMap.get(d.advogadoId)} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  )
}

export default function DiligenciasPage() {
  return <Suspense><DiligenciasContent /></Suspense>
}
