'use client'

import { useState, useMemo, memo, useRef, useEffect, Suspense, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ClipboardList, Plus, MapPin, SlidersHorizontal, X, AlertTriangle } from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useAdvogados } from '@/context/AdvogadosContext'
import { useEventos } from '@/context/EventosContext'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusDiligenciaBadge, StatusPagamentoBadge, EmpresaBadge } from '@/components/shared/StatusBadge'
import { formatCurrency, formatDate, tituloDiligencia, normalizarBusca, documentosFaltando } from '@/lib/utils'
import { Diligencia, StatusDiligencia, StatusPagamento, ModoDiligencia, EmpresaCliente, Advogado, StatusEvento } from '@/types'

// ── Documentos faltando ───────────────────────────────────────────────────────
// Lógica compartilhada com o Dashboard — ver documentosFaltando em @/lib/utils.
const docsFaltando = documentosFaltando

// ── Ordenação por CCC ─────────────────────────────────────────────────────────
// A lista é ordenada pelo CCC, do mais recente (número maior) para o mais antigo.
// Como o CCC tem formato fixo e zero-preenchido (BR-2026080033), a comparação de
// texto decrescente já coloca os mais novos no topo. Quem quiser ver "em andamento",
// "docs faltando" etc. usa os filtros — a ordem base é sempre a do CCC.

function dataDiligencia(d: Diligencia): string {
  return d.dataAtendimento ?? d.dataInformativo ?? d.createdAt.split('T')[0]
}

// Data de CHEGADA da diligência (quando o caso entrou): prioriza a data do
// informativo/e-mail recebido, depois a data do evento, depois a criação.
function dataChegada(d: Diligencia): string {
  return d.dataInformativo ?? d.dataEvento ?? d.dataLigacaoAdvogado ?? d.createdAt.split('T')[0]
}

// Tem número de CCC de verdade? (contém dígitos — exclui "AVULSO", vazio, etc.)
function temNumeroCcc(ccc: string | undefined): boolean {
  return !!ccc && /\d/.test(ccc)
}

// Ordena por ORDEM DE CHEGADA (mais recente em cima). Não ordena pelo texto do
// CCC — os prefixos por cliente ("BR-…", "CCC-…", "AVULSO") faziam as letras
// furarem a fila dos números na ordem alfabética. Quem tem número de CCC vem
// primeiro; avulsas/placeholder (só letras ou sem CCC) vão para o fim.
function sortDiligencias(list: Diligencia[]): Diligencia[] {
  return [...list].sort((a, b) => {
    const na = temNumeroCcc(a.ccc), nb = temNumeroCcc(b.ccc)
    if (na !== nb) return na ? -1 : 1
    const cmp = dataChegada(b).localeCompare(dataChegada(a)) // mais recente primeiro
    if (cmp !== 0) return cmp
    return (b.ccc ?? '').localeCompare(a.ccc ?? '')          // desempate estável por CCC
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
  d, adv, naTriagem,
}: { d: Diligencia; adv: Advogado | undefined; naTriagem: boolean }) {
  const router = useRouter()
  const dataRef = d.dataAtendimento ?? d.dataLigacaoAdvogado ?? d.dataEvento ?? d.dataInformativo
  const sit = situacaoCiclo(d)
  // Ainda na triagem → clicar leva direto ao formulário para classificar/completar.
  const destino = naTriagem ? `/diligencias/${d.id}/editar` : `/diligencias/${d.id}`
  return (
    <tr
      className={`cursor-pointer transition-colors ${naTriagem ? 'bg-amber-50/70 hover:bg-amber-100/70' : 'hover:bg-slate-50'}`}
      onClick={() => router.push(destino)}
    >
      <td className="px-4 py-3">
        <span className="font-mono text-xs font-semibold text-blue-700">{d.ccc}</span>
        {naTriagem && (
          <span className="mt-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            <AlertTriangle className="w-3 h-3" /> Na triagem
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
        {naTriagem ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
            <AlertTriangle className="w-3 h-3" /> Completar na triagem
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

// ── Alerta de CCC faltando na sequência ───────────────────────────────────────
// Os CCCs seguem o formato BR-AAAAMMNNNN, com o contador NNNN reiniciando a cada
// mês (ex.: agosto vai de BR-2026080001 em diante). Se um e-mail não entra no
// sistema (falha do Power Automate/webhook), abre um "buraco" na numeração que
// antes passava despercebido. Aqui detectamos esses buracos no MÊS CORRENTE e
// avisamos — assim nenhum CCC some silenciosamente. Só o mês atual é checado, para
// não alarmar com meses antigos (ex.: maio, encerrado em lote de propósito).

const IGNORAR_KEY = 'ccc-buracos-ignorados'

function detectarBuracosCCC(cccs: string[]): string[] {
  const now = new Date()
  const prefixo = `BR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const seqs = cccs
    .filter((c) => c && c.startsWith(prefixo))
    .map((c) => parseInt(c.slice(prefixo.length), 10))
    .filter((n) => Number.isFinite(n))
  if (seqs.length === 0) return []
  const presentes = new Set(seqs)
  const max = Math.max(...seqs)
  const faltando: string[] = []
  for (let n = 1; n <= max; n++) {
    if (!presentes.has(n)) faltando.push(`${prefixo}${String(n).padStart(4, '0')}`)
  }
  return faltando
}

function CCCGapAlert({ cccs }: { cccs: string[] }) {
  const [ignorados, setIgnorados] = useState<Set<string>>(new Set())
  // Carrega os ignorados só no cliente (evita divergência de hidratação).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(IGNORAR_KEY)
      if (raw) setIgnorados(new Set(JSON.parse(raw) as string[]))
    } catch { /* ignora localStorage indisponível */ }
  }, [])

  const faltando = useMemo(
    () => detectarBuracosCCC(cccs).filter((c) => !ignorados.has(c)),
    [cccs, ignorados],
  )

  function ignorar(ccc: string) {
    setIgnorados((prev) => {
      const next = new Set(prev)
      next.add(ccc)
      try { localStorage.setItem(IGNORAR_KEY, JSON.stringify([...next])) } catch { /* ok */ }
      return next
    })
  }

  if (faltando.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">
            {faltando.length === 1
              ? 'Falta 1 CCC na sequência deste mês'
              : `Faltam ${faltando.length} CCCs na sequência deste mês`}
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Estes números não estão no sistema — provavelmente o e-mail não chegou pela triagem.
            Confira sua caixa de entrada e lance o que faltar. Se algum número não existe mesmo, clique no × para ignorá-lo.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {faltando.map((ccc) => (
              <span key={ccc} className="inline-flex items-center gap-1 rounded-md bg-white border border-amber-300 px-2 py-1 text-xs font-mono font-semibold text-amber-800">
                {ccc}
                <button
                  onClick={() => ignorar(ccc)}
                  title="Ignorar este número (não existe / não é do escritório)"
                  className="text-amber-400 hover:text-amber-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page Content ──────────────────────────────────────────────────────────────

function DiligenciasContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { diligencias } = useDiligencias()
  const { eventos } = useEventos()
  // "Na triagem" = a diligência veio do e-mail e você ainda NÃO clicou em
  // "criar diligência" (o evento continua pendente). Esses itens APARECEM nesta
  // lista com o selo "Na triagem" — assim a busca por CCC sempre acha, mesmo que
  // ainda estejam na Triagem. Ao completar/graduar, o selo some. Carimbo único =
  // status do evento (não mexe em Dashboard/Relatórios/Pesquisa).
  const eventosPendentes = useMemo(
    () => new Set(eventos.filter((e) => e.statusEvento === StatusEvento.Pendente).map((e) => e.id)),
    [eventos],
  )
  const naTriagem = (d: Diligencia) => !!d.eventoId && eventosPendentes.has(d.eventoId)
  const { advogadoMap } = useAdvogados()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(searchParams.get('ccc') || '')

  const paramEmpresa = searchParams.get('empresa') as EmpresaCliente | null
  const paramStatus = searchParams.get('status')
  const paramModo = searchParams.get('modo') as ModoDiligencia | null
  const paramPeriodo = searchParams.get('periodo')
  const paramCiclo = searchParams.get('ciclo')
  // `status` na URL carrega o valor completo do filtro (inclui 'pendencia' e
  // 'cicloFechado'); `ciclo=fechado` é mantido só por compatibilidade com links
  // antigos.
  const initialStatus: FiltroStatus = paramCiclo === 'fechado' ? 'cicloFechado' : (paramStatus as FiltroStatus | null) ?? 'todos'
  const hasFilter = !!(paramEmpresa || paramStatus || paramCiclo || paramModo)
  const initialPeriodo: 'todos' | '30d' = paramPeriodo === 'todos' || paramPeriodo === '30d' ? paramPeriodo : hasFilter ? 'todos' : '30d'

  const [filtroEmpresa, setFiltroEmpresa] = useState<'todas' | EmpresaCliente>(paramEmpresa ?? 'todas')
  const [filtrosAvancados, setFiltrosAvancados] = useState<FiltrosAvancados>({ status: initialStatus, modo: paramModo ?? 'todos', periodo: initialPeriodo })

  // Reflete busca + filtros na URL. Assim, ao voltar de um detalhe (router.back),
  // o histórico traz o mesmo estado e a lista — que lê tudo da URL no mount —
  // reaparece exatamente como estava. `replace` não cria entrada nova no histórico.
  useEffect(() => {
    const p = new URLSearchParams()
    if (search.trim()) p.set('ccc', search.trim())
    if (filtroEmpresa !== 'todas') p.set('empresa', filtroEmpresa)
    if (filtrosAvancados.status !== 'todos') p.set('status', filtrosAvancados.status)
    if (filtrosAvancados.modo !== 'todos') p.set('modo', filtrosAvancados.modo)
    if (filtrosAvancados.periodo !== '30d') p.set('periodo', filtrosAvancados.periodo)
    const qs = p.toString()
    if (qs !== searchParams.toString()) {
      router.replace(qs ? `/diligencias?${qs}` : '/diligencias', { scroll: false })
    }
  }, [search, filtroEmpresa, filtrosAvancados, router, searchParams])

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
      // Itens ainda na triagem ficam sempre visíveis (não somem no corte de 30
      // dias) para não se perderem antes de serem completados.
      l = l.filter((d) => naTriagem(d) || dataDiligencia(d) >= corteStr)
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
  }, [diligencias, search, filtrosAvancados, filtroEmpresa, eventosPendentes])

  // União de todos os CCCs (diligências + eventos) para o detector de buracos.
  // Sempre a lista completa — independe dos filtros da tela — para não deixar de
  // avisar um sumiço só porque o filtro corrente esconderia o registro.
  const todosCCCs = useMemo(() => {
    const s = new Set<string>()
    for (const d of diligencias) if (d.ccc) s.add(d.ccc)
    for (const e of eventos) if (e.ccc) s.add(e.ccc)
    return [...s]
  }, [diligencias, eventos])

  return (
    <div className="space-y-5">
      <CCCGapAlert cccs={todosCCCs} />
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
                const emTriagem = naTriagem(d)
                return (
                <Link key={d.id} href={emTriagem ? `/diligencias/${d.id}/editar` : `/diligencias/${d.id}`} className={`block px-4 py-3.5 ${emTriagem ? 'bg-amber-50/70 hover:bg-amber-100/70' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-slate-800 text-sm truncate">{tituloDiligencia(d)}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <EmpresaBadge empresaCliente={d.empresaCliente} />
                      <StatusDiligenciaBadge status={d.status} />
                    </div>
                  </div>
                  {emTriagem && (
                    <span className="mb-1 inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      <AlertTriangle className="w-3 h-3" /> Na triagem · completar
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
                  {emTriagem ? (
                    <p className="text-xs font-semibold mt-1 text-amber-700">⚠ Ainda na triagem — toque para classificar e completar</p>
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
                    <DiligenciaRowDesktop key={d.id} d={d} adv={advogadoMap.get(d.advogadoId)} naTriagem={naTriagem(d)} />
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
