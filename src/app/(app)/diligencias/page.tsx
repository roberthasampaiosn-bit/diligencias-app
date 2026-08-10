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
import { formatCurrency, formatDate, tituloDiligencia, normalizarBusca, documentosFaltando } from '@/lib/utils'
import { Diligencia, StatusDiligencia, StatusPagamento, ModoDiligencia, EmpresaCliente, Advogado } from '@/types'

// ── Documentos faltando ───────────────────────────────────────────────────────
// Lógica compartilhada com o Dashboard — ver documentosFaltando em @/lib/utils.
const docsFaltando = documentosFaltando

// ── Ordenação inteligente ─────────────────────────────────────────────────────

function prioridade(d: Diligencia): number {
  if (d.incompleta) return -1                              // rascunhos da triagem no topo (precisam ser completados)
  if (d.status === StatusDiligencia.EmAndamento) return 0
  const sit = situacaoCiclo(d)
  const precisaAcao = sit.tone === 'amber' || sit.docsFaltam.length > 0   // aguardando pagamento ou docs faltando
  return precisaAcao ? 1 : 2                                  // 2 = concluída sem pendência
}

function dataDiligencia(d: Diligencia): string {
  return d.dataAtendimento ?? d.dataInformativo ?? d.createdAt.split('T')[0]
}

// Data usada para ORDENAR a lista: prioriza atendimento, depois ligação ao advogado, depois evento.
// Mantida separada de dataDiligencia (que é usada no filtro de "últimos 30 dias").
function dataEventoOrd(d: Diligencia): string {
  return d.dataAtendimento ?? d.dataLigacaoAdvogado ?? d.dataEvento ?? d.dataInformativo ?? d.createdAt.split('T')[0]
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

// Rótulos curtos dos documentos, para caber na coluna Situação.
const DOC_CURTO: Record<string, string> = {
  'Contrato assinado': 'Contrato',
  'Recibo assinado': 'Recibo',
  'Comprovante de pagamento': 'Comp. pagamento',
  'Comprovante de serviço': 'Comp. serviço',
}

function situacaoCiclo(d: Diligencia): { label: string; tone: SitTone; docsFaltam: string[] } {
  if (d.status === StatusDiligencia.EmAndamento) return { label: 'Em andamento', tone: 'slate', docsFaltam: [] }
  // Realizada: só é pendência real um pagamento presencial com valor em aberto.
  const aguardaPagamento = d.modoDiligencia !== ModoDiligencia.Remoto
    && (d.valorDiligencia ?? 0) > 0
    && d.statusPagamento !== StatusPagamento.Pago
  if (aguardaPagamento) return { label: 'Aguardando pagamento', tone: 'amber', docsFaltam: [] }
  // Sem pendência → concluída. Mantém o aviso de docs só se o ciclo foi finalizado.
  return { label: 'Concluída', tone: 'emerald', docsFaltam: d.cicloFinalizado ? docsFaltando(d) : [] }
}

// ── Row memoizado ─────────────────────────────────────────────────────────────

const DiligenciaRowDesktop = memo(function DiligenciaRowDesktop({
  d, adv,
}: { d: Diligencia; adv: Advogado | undefined }) {
  const router = useRouter()
  const dataRef = d.dataAtendimento ?? d.dataLigacaoAdvogado ?? d.dataEvento ?? d.dataInformativo
  const sit = situacaoCiclo(d)
  // Rascunho da triagem → clicar leva direto ao formulário de edição para completar.
  const destino = d.incompleta ? `/diligencias/${d.id}/editar` : `/diligencias/${d.id}`
  return (
    <tr
      className={`cursor-pointer transition-colors ${d.incompleta ? 'bg-amber-50/70 hover:bg-amber-100/70' : 'hover:bg-slate-50'}`}
      onClick={() => router.push(destino)}
    >
      <td className="px-4 py-3">
        <span className="font-mono text-xs font-semibold text-blue-700">{d.ccc}</span>
        {d.incompleta && (
          <span className="mt-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            <AlertTriangle className="w-3 h-3" /> Rascunho
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{dataRef ? formatDate(dataRef) : '—'}</td>
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
        {d.incompleta ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
            <AlertTriangle className="w-3 h-3" /> Completar cadastro
          </span>
        ) : (
        <div className="space-y-1">
          <span className={`text-xs font-medium ${SIT_TONE[sit.tone]}`}>
            {sit.tone === 'emerald' ? '✓ ' : ''}{sit.label}
          </span>
          {sit.docsFaltam.length > 0 && (
            <div className="flex items-start gap-1 text-amber-600">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span className="text-xs font-medium max-w-[180px]">
                {sit.docsFaltam.length} doc{sit.docsFaltam.length > 1 ? 's' : ''} faltando: {sit.docsFaltam.map((x) => DOC_CURTO[x] ?? x).join(', ')}
              </span>
            </div>
          )}
        </div>
        )}
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
  // Rascunhos da triagem (incompleta) APARECEM nesta lista, mas marcados com o
  // selo "Rascunho" e no topo — assim dá para achar e completar aqui mesmo.
  // (Dashboard/Relatórios continuam ignorando rascunhos; só a lista os mostra.)
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
      // Rascunhos ficam sempre visíveis (não somem no corte de 30 dias) para não
      // se perderem antes de serem completados.
      l = l.filter((d) => d.incompleta || dataDiligencia(d) >= corteStr)
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
      const q = normalizarBusca(search)
      l = l.filter(
        (d) =>
          normalizarBusca(d.ccc).includes(q) ||
          normalizarBusca(d.vitima).includes(q) ||
          normalizarBusca(d.empresaCliente).includes(q) ||
          normalizarBusca(d.empresa).includes(q) ||
          normalizarBusca(d.cidade).includes(q) ||
          normalizarBusca(advogadoMap.get(d.advogadoId)?.nomeCompleto).includes(q)
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
                <Link key={d.id} href={d.incompleta ? `/diligencias/${d.id}/editar` : `/diligencias/${d.id}`} className={`block px-4 py-3.5 ${d.incompleta ? 'bg-amber-50/70 hover:bg-amber-100/70' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-slate-800 text-sm truncate">{tituloDiligencia(d)}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <EmpresaBadge empresaCliente={d.empresaCliente} />
                      <StatusDiligenciaBadge status={d.status} />
                    </div>
                  </div>
                  {d.incompleta && (
                    <span className="mb-1 inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      <AlertTriangle className="w-3 h-3" /> Rascunho · completar
                    </span>
                  )}
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
                  {d.incompleta ? (
                    <p className="text-xs font-semibold mt-1 text-amber-700">⚠ Rascunho da triagem — toque para completar o cadastro</p>
                  ) : (
                  <p className={`text-xs font-medium mt-1 ${SIT_TONE[sit.tone]}`}>
                    {sit.tone === 'emerald' ? '✓ ' : ''}{sit.label}
                    {sit.docsFaltam.length > 0 ? ` · ${sit.docsFaltam.length} doc${sit.docsFaltam.length > 1 ? 's' : ''} faltando: ${sit.docsFaltam.map((x) => DOC_CURTO[x] ?? x).join(', ')}` : ''}
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
