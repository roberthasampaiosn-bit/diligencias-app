'use client'

import { useState, useMemo, useTransition, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  MessageSquare, MessageCircle, Phone, Calendar, CheckCircle2,
  PhoneOff, Clock, AlertCircle, ExternalLink, Download, Copy,
  ArrowUp, ArrowDown, Bell,
} from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useEventos } from '@/context/EventosContext'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { StatusPesquisaBadge } from '@/components/shared/StatusBadge'
import { buildWhatsAppUrl, buildPesquisaMessage, formatDate, formatPhone, cleanPhone } from '@/lib/utils'
import {
  StatusPesquisa, StatusDiligencia, ResultadoLigacao, StatusEvento,
  EmpresaCliente, TipoDiligencia, ModoDiligencia, TipoEvento,
  StatusPagamento, normalizeEmpresa,
  Diligencia, Pesquisa, Evento,
} from '@/types'
import { AbaExcel, exportarExcelEstilizado } from '@/lib/excel'

const FORMS_BASE_URL = 'https://forms.office.com/pages/responsepage.aspx?id=dHSc_x1CV0mNR8S2TeyHtRaQVWV2fP9Cvho3pQhCA1tURDFISEJGM1hMTlJDTkFRRk1STFcwVUhPUS4u'

function buildFormUrl(ccc: string, vitima: string, cargo: string, empresa: string, cidade: string): string {
  const prefill = [
    { questionId: 'r57941ac9a944418990fe4c493b4a5f9b', answer1: ccc },
    { questionId: 'r033279bf00d84258be50cabd13d8a57e', answer1: vitima },
    { questionId: 'r7f32f2ff079b45d7bea0828936a1eebd', answer1: cargo },
    { questionId: 'r3affcd6ad3a843e1920677451b58b0cd', answer1: empresa },
    { questionId: 'rfc20581426304081bd6c393fa7c59765', answer1: cidade },
  ]
  const ifq = btoa(unescape(encodeURIComponent(JSON.stringify(prefill))))
  return `${FORMS_BASE_URL}&ifq=${ifq}`
}

const FILTROS = [
  { key: 'pendentes',  label: 'Pendentes'  },
  { key: 'concluidas', label: 'Concluídas' },
  { key: 'todas',      label: 'Todas'      },
]

const PERIODOS = [
  { key: 'semana', label: 'Esta semana'   },
  { key: 'mes',    label: 'Este mês'      },
  { key: 'ano',    label: 'Este ano'      },
  { key: 'custom', label: 'Personalizado' },
  { key: '',       label: 'Todos'         },
]

const SUB_FILTROS = [
  { key: 'agendados', label: 'Com retorno' },
  { key: 'semWa',     label: 'Sem WA'      },
  { key: 'waAntigo',  label: 'WA > 7 dias' },
]

interface ModalRetornoState    { diligenciaId: string; vitima: string }
interface ModalRespostaState   { diligenciaId: string; vitima: string }
interface ModalEncerramentoState { diligenciaId: string; vitima: string }

// ─── Helpers de período / data ────────────────────────────────────────────────

function periodoToRange(periodo: string): { ini: string; fim: string } | null {
  const hoje = new Date()
  const hojeStr = hoje.toISOString().split('T')[0]
  if (periodo === 'semana') {
    const dow = hoje.getDay()                         // 0 = Dom
    const offset = dow === 0 ? -6 : 1 - dow          // recua até segunda-feira
    const mon = new Date(hoje)
    mon.setDate(hoje.getDate() + offset)
    return { ini: mon.toISOString().split('T')[0], fim: hojeStr }
  }
  if (periodo === 'mes') return { ini: hojeStr.slice(0, 8) + '01', fim: hojeStr }
  if (periodo === 'ano') return { ini: hojeStr.slice(0, 5) + '01-01', fim: hojeStr }
  return null
}

function formatDateBR(s: string): string {
  if (!s) return ''
  const d = s.split('T')[0]
  const parts = d.split('-')
  if (parts.length !== 3) return s
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function formatDateTimeBR(s: string): string {
  if (!s) return ''
  const [date, time] = s.split('T')
  if (!date) return ''
  const parts = date.split('-')
  if (parts.length !== 3) return s
  return time
    ? `${parts[2]}/${parts[1]}/${parts[0]} ${time.slice(0, 5)}`
    : `${parts[2]}/${parts[1]}/${parts[0]}`
}

// ─── Normalização de texto (remove acentos para busca) ───────────────────────

function normalizeStr(s: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function sanitizeName(s: string | null | undefined): string {
  return (s ?? '').replace(/^[\s:]+/, '').trim()
}

// ─── Ordenação ────────────────────────────────────────────────────────────────

function getPendentePriority(d: Diligencia): number {
  const dc = d.pesquisa.dataCombinada
  const hasWA = !!d.pesquisa.dataEnvioWhatsApp

  // Retorno atrasado → máxima prioridade
  if (dc && !/^\d{2}:\d{2}$/.test(dc)) {
    const today = new Date().toISOString().split('T')[0]
    if (dc.split(' ')[0] <= today) return 1
  }

  // Sem WA enviado → precisa de contato inicial
  if (!hasWA) return 2

  // WA enviado + retorno futuro agendado
  if (dc) return 3

  // WA enviado, aguardando resposta
  return 4
}

function sortPesquisa(a: Diligencia, b: Diligencia, order: 'asc' | 'desc' = 'desc'): number {
  const aConc = a.pesquisa.status === StatusPesquisa.Concluida
  const bConc = b.pesquisa.status === StatusPesquisa.Concluida
  if (aConc !== bConc) return aConc ? 1 : -1
  const dateA = new Date(a.dataAtendimento ?? a.createdAt).getTime()
  const dateB = new Date(b.dataAtendimento ?? b.createdAt).getTime()
  if (aConc) return order === 'desc' ? dateB - dateA : dateA - dateB
  const pa = getPendentePriority(a)
  const pb = getPendentePriority(b)
  if (pa !== pb) return pa - pb
  // Dentro da mesma prioridade: quem tem menos ligações sobe (precisa de contato)
  const ligA = a.pesquisa.historicoLigacoes.length
  const ligB = b.pesquisa.historicoLigacoes.length
  if (ligA !== ligB) return ligA - ligB
  return order === 'desc' ? dateB - dateA : dateA - dateB
}

// ─── Retorno ──────────────────────────────────────────────────────────────────

type RetornoVariant = 'normal' | 'late' | 'timeonly'

function parseRetorno(
  dc: string | undefined,
  horaEntrevista?: string,
): { text: string; variant: RetornoVariant } | null {
  if (!dc && !horaEntrevista) return null

  const today = new Date().toISOString().split('T')[0]

  // Sem data, só horário: "HH:MM" em dataCombinada (legado) ou horaEntrevista sem data
  if (!dc || /^\d{2}:\d{2}$/.test(dc)) {
    const hora = /^\d{2}:\d{2}$/.test(dc ?? '') ? dc! : horaEntrevista!
    return { text: `Retorno: qualquer dia após ${hora}`, variant: 'timeonly' }
  }

  // Data+hora combinadas (legado): "YYYY-MM-DD HH:MM" ou "YYYY-MM-DDTHH:MM"
  const sep = dc.includes(' ') ? ' ' : dc.includes('T') ? 'T' : null
  if (sep) {
    const datePart = dc.slice(0, dc.indexOf(sep))
    // Prefere horaEntrevista (mais nova) sobre a hora embutida em dataCombinada
    const timePart = horaEntrevista ?? dc.slice(dc.indexOf(sep) + 1, dc.indexOf(sep) + 6)
    const [y, m, d] = datePart.split('-')
    const fmt = `${d}/${m}/${y}`
    if (datePart < today) return { text: `Retorno atrasado: ${fmt} às ${timePart}`, variant: 'late' }
    return { text: `Retorno agendado para ${fmt} às ${timePart}`, variant: 'normal' }
  }

  // Só data: "YYYY-MM-DD" — combina com horaEntrevista se existir
  if (/^\d{4}-\d{2}-\d{2}$/.test(dc)) {
    const [y, m, d] = dc.split('-')
    const fmt = `${d}/${m}/${y}`
    const timeStr = horaEntrevista ? ` às ${horaEntrevista}` : ''
    if (dc < today) return { text: `Retorno atrasado: ${fmt}${timeStr}`, variant: 'late' }
    return { text: `Retorno agendado para ${fmt}${timeStr}`, variant: 'normal' }
  }

  return null
}

// ─── Última tentativa ─────────────────────────────────────────────────────────

function getUltimaTentativa(p: Pesquisa): { label: string; dateStr: string } | null {
  type Entry = { ts: number; label: string; dateStr: string }
  const entries: Entry[] = []

  if (p.dataEnvioWhatsApp) {
    entries.push({
      ts: new Date(p.dataEnvioWhatsApp).getTime(),
      label: 'WhatsApp enviado',
      dateStr: formatDate(p.dataEnvioWhatsApp),
    })
  }

  for (const lig of p.historicoLigacoes) {
    const ts = new Date(`${lig.data}T${lig.hora}`).getTime()
    let label: string
    if (lig.resultado === ResultadoLigacao.NaoAtendeu) label = 'Ligação — não atendeu'
    else if (lig.resultado === ResultadoLigacao.PediuRetorno) label = 'Retorno agendado'
    else if (lig.resultado === ResultadoLigacao.Respondeu) label = 'Pesquisa respondida'
    else label = lig.observacao || 'Ligação'
    entries.push({ ts, label, dateStr: formatDate(lig.data) })
  }

  if (!entries.length) return null
  return entries.reduce((a, b) => (a.ts > b.ts ? a : b))
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PesquisaContent() {
  const {
    diligencias, registrarWhatsApp, registrarLigacao,
    agendarRetorno, marcarRespondida, encerrarSemResposta, atualizarPesquisa,
    createDiligencia,
  } = useDiligencias()

  const { eventos, processarEvento } = useEventos()
  const eventoMap = useMemo(
    () => Object.fromEntries(eventos.map((e) => [e.id, e])),
    [eventos],
  )

  const searchParams = useSearchParams()
  const paramFiltro = searchParams.get('filtro')
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState(
    paramFiltro && ['pendentes', 'concluidas', 'todas'].includes(paramFiltro) ? paramFiltro : 'pendentes'
  )
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [, startTransition] = useTransition()

  // ── Triagem: criação automática de diligência ao primeiro contato ────────────
  const [criandoTriagem, setCriandoTriagem] = useState<string | null>(null) // eventoId em criação

  async function criarDiligenciaDoEvento(ev: Evento): Promise<Diligencia> {
    setCriandoTriagem(ev.id)
    try {
      const tipoEv = Object.values(TipoEvento).includes(ev.tipoEvento as TipoEvento)
        ? (ev.tipoEvento as TipoEvento)
        : TipoEvento.Outro

      const nova = await createDiligencia({
        empresaCliente:   normalizeEmpresa(ev.empresa ?? ''),
        ccc:              ev.ccc,
        vitima:           sanitizeName(ev.nomeVitima),
        telefoneVitima:   ev.telefoneVitima ?? '',
        cargo:            ev.cargoVitima ?? '',
        empresa:          ev.empresa ?? '',
        cidade:           ev.cidade ?? '',
        uf:               ev.uf ?? '',
        tipoEvento:       tipoEv,
        tipoDiligencia:   TipoDiligencia.AssistenciaJuridicaRemota,
        modoDiligencia:   ModoDiligencia.Remoto,
        advogadoId:       '',
        valorDiligencia:  0,
        status:           StatusDiligencia.Realizada,
        statusPagamento:  StatusPagamento.Pendente,
        cicloFinalizado:  false,
        eventoId:         ev.id,
        dataAtendimento:  ev.dataEvento ?? undefined,
        dataEvento:       ev.dataEvento ?? undefined,
        horaEvento:       ev.horaEvento ?? undefined,
        segmento:         ev.segmento ?? undefined,
        operacao:         ev.operacao ?? undefined,
        pesquisa: {
          status:             StatusPesquisa.Pendente,
          historicoLigacoes:  [],
          tentativasWhatsApp: 0,
        },
        anexos: {
          contratoGerado:        '',
          contratoAssinado:      '',
          reciboGerado:          '',
          reciboAssinado:        '',
          comprovantePagamento:  '',
          comprovanteServico:    '',
        },
      })
      // NÃO chama processarEvento — evento permanece na triagem pendente
      // A diligência fica vinculada pelo eventoId para rastrear a pesquisa
      return nova
    } finally {
      setCriandoTriagem(null)
    }
  }

  // Card pinado durante ligação
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [pinnedAt, setPinnedAt] = useState<number | null>(null)

  // Timer de segurança: solta o pin após 15 minutos automaticamente
  useEffect(() => {
    if (!pinnedId || !pinnedAt) return
    const remaining = 15 * 60 * 1000 - (Date.now() - pinnedAt)
    if (remaining <= 0) { setPinnedId(null); setPinnedAt(null); return }
    const timer = setTimeout(() => { setPinnedId(null); setPinnedAt(null) }, remaining)
    return () => clearTimeout(timer)
  }, [pinnedId, pinnedAt])

  // Período / intervalo de datas
  const [periodoFiltro, setPeriodoFiltro] = useState<string>('')
  const [dataFiltroInicio, setDataFiltroInicio] = useState('')
  const [dataFiltroFim, setDataFiltroFim] = useState('')

  // Sub-filtros pendentes
  const [subFiltro, setSubFiltro] = useState('')

  // Notificações
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default')

  // Modal: Agendar retorno
  const [modalRetorno, setModalRetorno] = useState<ModalRetornoState | null>(null)
  const [retornoData, setRetornoData] = useState('')
  const [retornoHora, setRetornoHora] = useState('')

  // Modal: Marcar respondida
  const [modalResposta, setModalResposta] = useState<ModalRespostaState | null>(null)
  const [textoResposta, setTextoResposta] = useState('')

  // Modal: Encerrar sem resposta
  const [modalEncerramento, setModalEncerramento] = useState<ModalEncerramentoState | null>(null)
  const [obsEncerramento, setObsEncerramento] = useState('')

  // Copiar dados para entrevista
  const [copiedField, setCopiedField] = useState<string | null>(null)

  function copyToClipboard(text: string, fieldKey: string) {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldKey)
    setTimeout(() => setCopiedField(null), 1500)
  }

  // Seleção para WA em lote
  const [selectedIds, setSelectedIds] = useState(new Set<string>())

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    const pendentes = lista.filter((d) => d.pesquisa.status === StatusPesquisa.Pendente)
    setSelectedIds(new Set(pendentes.map((d) => d.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  // Helper: data do evento de uma diligência
  function getDataEvento(d: Diligencia): string | undefined {
    const ev = d.eventoId ? eventoMap[d.eventoId] : undefined
    return ev?.dataEvento ?? d.dataEvento ?? d.dataAtendimento
  }

  // Fila guiada de WA em lote
  type BatchItem = { d: Diligencia; phone: string; mensagem: string; waUrl: string }
  const [batchQueue, setBatchQueue] = useState<BatchItem[]>([])
  const [batchIdx, setBatchIdx] = useState(0)

  function startBatchWA() {
    const alvo = lista.filter((d) => selectedIds.has(d.id) && d.pesquisa.status === StatusPesquisa.Pendente)
    const queue: BatchItem[] = alvo.map((d) => {
      const phone = d.telefoneVitima.split(';')[0].trim()
      const nome = sanitizeName(d.vitima || eventoMap[d.eventoId ?? '']?.nomeVitima)
      const mensagem = buildPesquisaMessage(nome, d.tipoEvento, d.empresaCliente, getDataEvento(d))
      return { d, phone, mensagem, waUrl: buildWhatsAppUrl(phone, mensagem) }
    })
    setBatchQueue(queue)
    setBatchIdx(0)
  }

  function handleBatchNext(markAsSent: boolean) {
    const current = batchQueue[batchIdx]
    if (markAsSent && current) {
      registrarWhatsApp(current.d.id, current.mensagem)
    }
    const isLast = batchIdx + 1 >= batchQueue.length
    if (isLast) {
      setBatchQueue([])
      setBatchIdx(0)
      clearSelection()
    } else {
      setBatchIdx((i) => i + 1)
    }
  }

  function closeBatch() {
    setBatchQueue([])
    setBatchIdx(0)
  }

  // Enter para confirmar modal "Respondeu"
  useEffect(() => {
    if (!modalResposta) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        marcarRespondida(modalResposta!.diligenciaId, textoResposta)
        setModalResposta(null)
        setTextoResposta('')
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [modalResposta, textoResposta, marcarRespondida])

  // ── Notificações ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifPermission('unsupported')
      return
    }
    setNotifPermission(Notification.permission)
  }, [])

  function getRetornosHoje(items: typeof realizadas) {
    const hoje = new Date().toISOString().split('T')[0]
    return items.filter((d) => {
      if (d.pesquisa.status !== StatusPesquisa.Pendente) return false
      const dc = d.pesquisa.dataCombinada
      if (!dc || /^\d{2}:\d{2}$/.test(dc)) return false
      return dc.split(' ')[0] === hoje
    })
  }

  async function requestNotification() {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setNotifPermission(perm)
    if (perm === 'granted') notifyRetornosHoje()
  }

  function notifyRetornosHoje() {
    const itens = getRetornosHoje(realizadas)
    if (itens.length === 0) return
    const nomes = itens.slice(0, 3).map((d) => d.vitima || eventoMap[d.eventoId ?? '']?.nomeVitima || 'Pesquisa').join(', ')
    new Notification('Retornos agendados para hoje', {
      body: `${itens.length} retorno(s): ${nomes}${itens.length > 3 ? '...' : ''}`,
      icon: '/icon-192x192.png',
    })
  }

  // ── Dados filtrados ──────────────────────────────────────────────────────────

  const realizadas = useMemo(
    () => diligencias.filter((d) =>
      d.status === StatusDiligencia.Realizada &&
      d.empresaCliente !== EmpresaCliente.VTAL
    ),
    [diligencias],
  )

  const realizadasFiltradas = useMemo(() => {
    let range: { ini: string; fim: string } | null = null
    if (periodoFiltro === 'custom') {
      if (dataFiltroInicio || dataFiltroFim) {
        range = { ini: dataFiltroInicio || '2000-01-01', fim: dataFiltroFim || '9999-12-31' }
      }
    } else {
      range = periodoToRange(periodoFiltro)
    }
    if (!range) return realizadas
    const { ini, fim } = range
    return realizadas.filter((d) => {
      const ref = d.dataAtendimento ?? d.createdAt.split('T')[0]
      return ref >= ini && ref <= fim
    })
  }, [realizadas, periodoFiltro, dataFiltroInicio, dataFiltroFim])

  const stats = useMemo(() => ({
    total:     realizadasFiltradas.length,
    pendentes: realizadasFiltradas.filter((d) => d.pesquisa.status === StatusPesquisa.Pendente).length,
    concluidas: realizadasFiltradas.filter((d) => d.pesquisa.status === StatusPesquisa.Concluida).length,
  }), [realizadasFiltradas])

  // Contadores para cada botão de período (considera o filtro de status atual)
  const periodCounts = useMemo(() => {
    const applyStatusFilter = (items: Diligencia[]) => {
      if (filtro === 'pendentes') return items.filter((d) => d.pesquisa.status === StatusPesquisa.Pendente)
      if (filtro === 'concluidas') return items.filter((d) => d.pesquisa.status === StatusPesquisa.Concluida)
      return items
    }
    const result: Record<string, number> = {}
    for (const p of PERIODOS) {
      if (p.key === 'custom') {
        const ini = dataFiltroInicio || '2000-01-01'
        const fim = dataFiltroFim || '9999-12-31'
        const filtered = realizadas.filter((d) => {
          const ref = d.dataAtendimento ?? d.createdAt.split('T')[0]
          return ref >= ini && ref <= fim
        })
        result[p.key] = applyStatusFilter(filtered).length
      } else if (p.key === '') {
        result[p.key] = applyStatusFilter(realizadas).length
      } else {
        const range = periodoToRange(p.key)
        if (range) {
          const { ini, fim } = range
          const filtered = realizadas.filter((d) => {
            const ref = d.dataAtendimento ?? d.createdAt.split('T')[0]
            return ref >= ini && ref <= fim
          })
          result[p.key] = applyStatusFilter(filtered).length
        } else {
          result[p.key] = 0
        }
      }
    }
    return result
  }, [realizadas, filtro, dataFiltroInicio, dataFiltroFim])

  const lista = useMemo(() => {
    let l = realizadasFiltradas
    if (search) {
      // Busca global: ignora filtro de status para encontrar qualquer nome/CCC/telefone
      const q = normalizeStr(search)
      const ql = search.toLowerCase().trim()
      const phoneDigits = search.replace(/\D/g, '') // vazio se busca por nome
      l = l.filter((d) => {
        const v = String(d.vitima ?? '').toLowerCase().trim()
        const nomeEv = String(eventoMap[d.eventoId ?? '']?.nomeVitima ?? '').toLowerCase().trim()
        const c = String(d.ccc ?? '').toLowerCase().trim()
        return v.includes(ql) ||
          normalizeStr(d.vitima).includes(q) ||
          nomeEv.includes(ql) ||
          normalizeStr(nomeEv).includes(q) ||
          c.includes(ql) ||
          normalizeStr(d.ccc).includes(q) ||
          // Busca por telefone SÓ quando há dígitos na pesquisa
          (phoneDigits.length > 0 && String(d.telefoneVitima ?? '').replace(/\D/g, '').includes(phoneDigits))
      })
    } else {
      if (filtro === 'pendentes')  l = l.filter((d) => d.pesquisa.status === StatusPesquisa.Pendente)
      else if (filtro === 'concluidas') l = l.filter((d) => d.pesquisa.status === StatusPesquisa.Concluida)
    }
    // Sub-filtros (aplicados a pendentes)
    if (subFiltro) {
      const hoje = new Date().toISOString().split('T')[0]
      const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
      if (subFiltro === 'agendados') {
        l = l.filter((d) => d.pesquisa.status === StatusPesquisa.Pendente && !!d.pesquisa.dataCombinada)
      } else if (subFiltro === 'semWa') {
        l = l.filter((d) => d.pesquisa.status === StatusPesquisa.Pendente && !d.pesquisa.dataEnvioWhatsApp)
      } else if (subFiltro === 'waAntigo') {
        l = l.filter((d) =>
          d.pesquisa.status === StatusPesquisa.Pendente &&
          !!d.pesquisa.dataEnvioWhatsApp &&
          d.pesquisa.dataEnvioWhatsApp <= cutoff
        )
      }
      void hoje
    }
    return [...l].sort((a, b) => {
      // Card pinado sempre no topo
      if (pinnedId) {
        if (a.id === pinnedId) return -1
        if (b.id === pinnedId) return 1
      }
      return sortPesquisa(a, b, sortOrder)
    })
  }, [realizadasFiltradas, filtro, search, sortOrder, eventoMap, subFiltro, pinnedId])

  // Mapa eventoId → diligência (para mostrar status da pesquisa nos cards da triagem)
  const dilPorEventoId = useMemo(() => {
    const map: Record<string, Diligencia> = {}
    for (const d of diligencias) {
      if (d.eventoId) map[d.eventoId] = d
    }
    return map
  }, [diligencias])

  // Eventos da triagem pendentes — aparecem na fila de pesquisa
  // Só após 24h do evento e enquanto a pesquisa não estiver concluída
  const triagemPendentes = useMemo(() => {
    if (filtro !== 'pendentes') return []
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const base = eventos.filter((e) => {
      if (e.statusEvento !== StatusEvento.Pendente) return false
      if (!e.dataEvento || e.dataEvento > cutoff24h) return false
      // Pesquisa só para BAT BRASIL — VTAL não usa este fluxo
      if (normalizeEmpresa(e.empresa ?? '') === EmpresaCliente.VTAL) return false
      // Se já tem diligência vinculada e pesquisa concluída, sai da fila
      const dil = dilPorEventoId[e.id]
      if (dil && dil.pesquisa.status === StatusPesquisa.Concluida) return false
      return true
    })
    if (!search) return base
    const q = normalizeStr(search)
    const ql = search.toLowerCase().trim()
    return base.filter((e) =>
      normalizeStr(e.nomeVitima).includes(q) ||
      (e.nomeVitima ?? '').toLowerCase().includes(ql) ||
      e.ccc.toLowerCase().includes(ql)
    )
  }, [eventos, filtro, search, dilPorEventoId])

  const subFiltrosCounts = useMemo(() => {
    const pendentes = realizadasFiltradas.filter((d) => d.pesquisa.status === StatusPesquisa.Pendente)
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    return {
      agendados: pendentes.filter((d) => !!d.pesquisa.dataCombinada).length,
      semWa:     pendentes.filter((d) => !d.pesquisa.dataEnvioWhatsApp).length,
      waAntigo:  pendentes.filter((d) => !!d.pesquisa.dataEnvioWhatsApp && d.pesquisa.dataEnvioWhatsApp <= cutoff).length,
    }
  }, [realizadasFiltradas])

  // ── Handlers ────────────────────────────────────────────────────────────────

  function registrarLigacaoIniciada(d: Diligencia) {
    const now = new Date()
    registrarLigacao(d.id, {
      data: now.toISOString().split('T')[0],
      hora: now.toTimeString().slice(0, 5),
      observacao: 'Ligação iniciada',
    })
    // Pina o card no topo para manter dados visíveis durante a ligação
    setPinnedId(d.id)
    setPinnedAt(Date.now())
  }

  function handleEnviarWhatsApp(d: Diligencia, phone: string) {
    const nome = sanitizeName(d.vitima || eventoMap[d.eventoId ?? '']?.nomeVitima)
    const mensagem = buildPesquisaMessage(nome, d.tipoEvento, d.empresaCliente, getDataEvento(d))
    registrarWhatsApp(d.id, mensagem)
    window.open(buildWhatsAppUrl(phone, mensagem), '_blank')
  }

  function handleSalvarRetorno() {
    if (!modalRetorno || !retornoHora) return
    // pesquisa_data_combinada é coluna date no Supabase → trunca o horário.
    // Salvamos a data em dataCombinada e o horário em horaEntrevista separadamente.
    if (retornoData) {
      atualizarPesquisa(modalRetorno.diligenciaId, {
        dataCombinada: retornoData,
        horaEntrevista: retornoHora,
      }).catch(() => {})
    } else {
      // Sem data fixa: guarda "HH:MM" em dataCombinada (mantém comportamento legado)
      agendarRetorno(modalRetorno.diligenciaId, retornoHora)
    }
    setModalRetorno(null); setRetornoData(''); setRetornoHora('')
  }

  function handleSalvarResposta() {
    if (!modalResposta) return
    marcarRespondida(modalResposta.diligenciaId, textoResposta)
    setModalResposta(null); setTextoResposta('')
  }

  function handleConfirmarEncerramento() {
    if (!modalEncerramento || !obsEncerramento.trim()) return
    encerrarSemResposta(modalEncerramento.diligenciaId, obsEncerramento.trim())
    setModalEncerramento(null); setObsEncerramento('')
  }

  async function handleExportarPesquisas() {
    const filename = `pesquisas_${new Date().toISOString().slice(0, 10)}.xlsx`
    const linhas = lista.map((d) => {
      const twa = Math.max(d.pesquisa.tentativasWhatsApp ?? 0, d.pesquisa.dataEnvioWhatsApp ? 1 : 0)
      const nLig = d.pesquisa.historicoLigacoes.length
      const total = twa + nLig
      return [
        d.empresaCliente,
        d.ccc,
        d.vitima,
        `${d.cidade}/${d.uf}`,
        d.telefoneVitima,
        d.dataAtendimento ? formatDateBR(d.dataAtendimento) : '',
        d.pesquisa.status,
        d.pesquisa.respostaVitima || d.pesquisa.observacoes || '',
        d.pesquisa.dataConclusao ? formatDateTimeBR(d.pesquisa.dataConclusao) : '',
        total,
        nLig,
        twa,
        d.pesquisa.observacoes ?? '',
        d.pesquisa.entrevistador ?? '',
        d.pesquisa.dataConclusao ? formatDateBR(d.pesquisa.dataConclusao) : '',
      ]
    })
    const periodoLabel = PERIODOS.find((p) => p.key === periodoFiltro)?.label ?? ''
    const aba: AbaExcel = {
      nome: 'Pesquisas',
      headers: [
        'Cliente', 'CCC / ID Evento', 'Nome Pesquisado', 'Cidade/UF', 'Telefone',
        'Data do Evento', 'Status', 'Resultado',
        'Data/Hora do Contato', 'Total Tentativas', 'Por Ligação', 'Por WhatsApp',
        'Observações', 'Responsável', 'Data de Conclusão',
      ],
      linhas,
      widths: [15, 18, 25, 15, 15, 14, 14, 30, 18, 12, 12, 12, 30, 20, 16],
      tema: 'bat',
      resumo: `Total: ${lista.length} pesquisa${lista.length !== 1 ? 's' : ''}${periodoLabel && periodoLabel !== 'Todos' ? ` · ${periodoLabel}` : ''}`,
    }
    await exportarExcelEstilizado([aba], filename)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Fila de Atendimento</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {stats.pendentes} pendentes · {stats.concluidas} concluídas
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',      value: stats.total,     color: 'bg-slate-50 border-slate-200',   text: 'text-slate-800'  },
          { label: 'Pendentes',  value: stats.pendentes, color: 'bg-amber-50 border-amber-200',   text: 'text-amber-800'  },
          { label: 'Concluídas', value: stats.concluidas,color: 'bg-emerald-50 border-emerald-200',text:'text-emerald-800'},
        ].map((s) => (
          <div key={s.label} className={`border rounded-xl p-3 ${s.color}`}>
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">

            {/* Busca + ordenação + exportar + notificações */}
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar vítima, CCC..."
                  className="flex-1 min-w-0 sm:w-64"
                />
                <button
                  onClick={() => setSortOrder((o) => o === 'desc' ? 'asc' : 'desc')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  title={sortOrder === 'desc' ? 'Mais recente primeiro — clique para inverter' : 'Mais antigo primeiro — clique para inverter'}
                >
                  {sortOrder === 'desc'
                    ? <><ArrowDown className="w-3.5 h-3.5" /> Mais recente</>
                    : <><ArrowUp className="w-3.5 h-3.5" /> Mais antigo</>
                  }
                </button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleExportarPesquisas}
                  disabled={lista.length === 0}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline ml-1">Exportar Excel</span>
                  <span className="sm:hidden ml-1">Excel</span>
                </Button>
                {notifPermission !== 'unsupported' && (
                  <button
                    onClick={notifPermission === 'granted' ? notifyRetornosHoje : requestNotification}
                    title={notifPermission === 'granted' ? 'Notificar retornos de hoje' : 'Ativar notificações'}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      notifPermission === 'granted'
                        ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    {notifPermission !== 'granted' && <span className="hidden sm:inline">Ativar alertas</span>}
                  </button>
                )}
              </div>
              {search && (
                <p className="text-xs text-slate-500 pl-1">
                  {lista.length === 0
                    ? `Nenhum resultado para "${search}"`
                    : `${lista.length} resultado${lista.length !== 1 ? 's' : ''} para "${search}"`}
                </p>
              )}
            </div>

            {/* Filtro de status — com contadores do período atual */}
            <div className="flex flex-wrap gap-1.5">
              {FILTROS.map((f) => {
                const count = f.key === 'pendentes' ? stats.pendentes
                  : f.key === 'concluidas' ? stats.concluidas
                  : stats.total
                return (
                  <button
                    key={f.key}
                    onClick={() => startTransition(() => setFiltro(f.key))}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      filtro === f.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${
                      filtro === f.key ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Filtro de período — com contadores por status atual */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mr-0.5">
                Período:
              </span>
              {PERIODOS.map((p) => {
                const count = periodCounts[p.key] ?? 0
                const isActive = periodoFiltro === p.key
                return (
                  <button
                    key={p.key}
                    onClick={() => startTransition(() => {
                      setPeriodoFiltro(p.key)
                      if (p.key !== 'custom') { setDataFiltroInicio(''); setDataFiltroFim('') }
                    })}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {p.label}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${
                      isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Sub-filtros para pendentes */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mr-0.5">
                Pendentes:
              </span>
              {SUB_FILTROS.map((sf) => {
                const count = subFiltrosCounts[sf.key as keyof typeof subFiltrosCounts] ?? 0
                const isActive = subFiltro === sf.key
                return (
                  <button
                    key={sf.key}
                    onClick={() => startTransition(() => setSubFiltro(isActive ? '' : sf.key))}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {sf.label}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${
                      isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Inputs de data personalizada */}
            {periodoFiltro === 'custom' && (
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="date"
                  value={dataFiltroInicio}
                  onChange={(e) => setDataFiltroInicio(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <span className="text-slate-400 text-xs">até</span>
                <input
                  type="date"
                  value={dataFiltroFim}
                  onChange={(e) => setDataFiltroFim(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            )}
          </div>
        </CardHeader>

        {lista.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Nenhuma pesquisa encontrada"
            description="Ajuste os filtros ou aguarde novas diligências realizadas."
          />
        ) : (
          <CardBody className="p-4">
            {/* Barra de seleção em lote */}
            {lista.some((d) => d.pesquisa.status === StatusPesquisa.Pendente) && (
              <div className="flex items-center justify-between mb-3 px-1">
                <button
                  onClick={selectedIds.size > 0 ? clearSelection : selectAll}
                  className="text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors"
                >
                  {selectedIds.size > 0 ? `Desmarcar todos (${selectedIds.size})` : 'Selecionar todos pendentes'}
                </button>
                {selectedIds.size > 0 && (
                  <span className="text-xs text-slate-400">{selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}</span>
                )}
              </div>
            )}
            {/* ── Eventos da Triagem (sem diligência criada) ── */}
            {triagemPendentes.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wide">
                    Da triagem — sem diligência
                  </span>
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                    {triagemPendentes.length}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">
                    Evento recebido, pesquisa pendente
                  </span>
                </div>
                <div className="flex flex-col gap-4">
                  {triagemPendentes.map((ev) => {
                    const evPhones  = (ev.telefoneVitima ?? '').split(';').map((p) => p.trim()).filter(Boolean)
                    const evLocalidade = `${ev.cidade}/${ev.uf}`
                    const evDil     = dilPorEventoId[ev.id]        // diligência já criada para este evento (se houver)
                    const evWa      = evDil?.pesquisa.dataEnvioWhatsApp
                    const evNLig    = evDil?.pesquisa.historicoLigacoes.length ?? 0
                    const evUltima  = evDil ? getUltimaTentativa(evDil.pesquisa) : null
                    return (
                      <div key={ev.id} className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-400 rounded-xl shadow-sm p-4 space-y-3">

                        {/* Cabeçalho */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md">
                            ⏳ Triagem pendente
                          </span>
                          {evWa ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-md">
                              <MessageCircle className="w-3 h-3" /> WA enviado · {formatDate(evWa)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-400 px-2 py-0.5 rounded-md">
                              <MessageCircle className="w-3 h-3" /> Sem WA
                            </span>
                          )}
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                            evNLig === 0 ? 'bg-slate-100 text-slate-400'
                            : evNLig <= 2 ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                            <Phone className="w-3 h-3" />
                            {evNLig === 0 ? 'Sem ligação' : `${evNLig} lig.`}
                          </span>
                          {criandoTriagem === ev.id && (
                            <span className="text-[11px] text-amber-600 font-medium animate-pulse">Salvando...</span>
                          )}
                        </div>

                        {/* Dados principais */}
                        <div>
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-semibold text-slate-800">{sanitizeName(ev.nomeVitima) || '(vítima não informada)'}</span>
                            <span className="font-mono text-xs text-blue-600 font-semibold">{ev.ccc}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {ev.tipoEvento} · {evLocalidade}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {ev.dataEvento && (
                              <span className="text-xs text-slate-400">
                                Evento: {formatDate(ev.dataEvento)}{ev.horaEvento ? ` às ${ev.horaEvento}` : ''}
                              </span>
                            )}
                            {evPhones.map((phone) => (
                              <a
                                key={phone}
                                href={`tel:${phone}`}
                                className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
                              >
                                {formatPhone(phone)}
                              </a>
                            ))}
                          </div>
                        </div>

                        {/* Retorno agendado */}
                        {evDil && (() => {
                          const ret = parseRetorno(evDil.pesquisa.dataCombinada, evDil.pesquisa.horaEntrevista)
                          if (!ret) return null
                          return (
                            <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border ${
                              ret.variant === 'late'     ? 'bg-red-50 text-red-700 border-red-200'
                              : ret.variant === 'timeonly' ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {ret.variant === 'late'
                                ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                : <Clock className="w-3.5 h-3.5 flex-shrink-0" />}
                              {ret.text}
                            </div>
                          )
                        })()}

                        {/* Última tentativa */}
                        {evUltima && (
                          <p className="text-xs text-slate-500">
                            <span className="font-medium text-slate-600">Última tentativa:</span>{' '}
                            {evUltima.label}{evUltima.dateStr ? ` — ${evUltima.dateStr}` : ''}
                          </p>
                        )}

                        {/* Dados para entrevista com botões de copiar */}
                        <div className="bg-white rounded-lg p-2.5 border border-amber-100">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                            Dados para entrevista
                          </p>
                          <div className="space-y-1">
                            {[
                              { label: 'ID Evento', value: ev.ccc },
                              { label: 'Nome',      value: sanitizeName(ev.nomeVitima) },
                              { label: 'Cargo',     value: ev.cargoVitima ?? '' },
                              { label: 'Empresa',   value: ev.empresa },
                              { label: 'Localidade',value: evLocalidade },
                            ].map(({ label, value }) => {
                              const key = `ev-${ev.id}-${label}`
                              return (
                                <div key={label} className="flex items-center justify-between gap-2">
                                  <div className="flex items-baseline gap-1.5 min-w-0">
                                    <span className="text-[10px] text-slate-400 shrink-0 w-16">{label}:</span>
                                    <span className="text-xs font-medium text-slate-700 truncate">{value || '—'}</span>
                                  </div>
                                  <button
                                    onClick={() => copyToClipboard(value || '', key)}
                                    className="shrink-0 p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                    title={`Copiar ${label}`}
                                  >
                                    {copiedField === key
                                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                      : <Copy className="w-3.5 h-3.5" />
                                    }
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Ações: Ligar + WA + Formulário */}
                        <div className="flex flex-col items-start gap-1.5 pt-1 border-t border-amber-100">
                          {evPhones.map((phone, idx) => (
                            <div key={phone} className="flex gap-1.5 flex-wrap items-center">
                              {evPhones.length > 1 && (
                                <span className="text-[10px] text-slate-400 font-medium w-4 text-right shrink-0">
                                  {idx + 1}.
                                </span>
                              )}
                              <button
                                disabled={criandoTriagem === ev.id}
                                onClick={async () => {
                                  const dil = evDil ?? await criarDiligenciaDoEvento(ev)
                                  window.location.href = `tel:+55${phone}`
                                  registrarLigacaoIniciada(dil)
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                Ligar{evPhones.length > 1 ? ` · ${formatPhone(phone)}` : ''}
                              </button>
                              <button
                                disabled={criandoTriagem === ev.id}
                                onClick={async () => {
                                  // Abre a janela antes do await para não ser bloqueado pelo popup blocker
                                  const newWin = window.open('', '_blank')
                                  const dil = evDil ?? await criarDiligenciaDoEvento(ev)
                                  const nome = sanitizeName(dil.vitima || eventoMap[dil.eventoId ?? '']?.nomeVitima || ev.nomeVitima)
                                  const mensagem = buildPesquisaMessage(nome, dil.tipoEvento, dil.empresaCliente, getDataEvento(dil))
                                  registrarWhatsApp(dil.id, mensagem)
                                  const url = buildWhatsAppUrl(phone, mensagem)
                                  if (newWin) { newWin.location.href = url } else { window.open(url, '_blank') }
                                }}
                                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                                  evWa ? 'border-green-300 bg-green-100 text-green-800 hover:bg-green-200'
                                       : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                                }`}
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                {evWa ? 'Reenviar WA' : 'WhatsApp'}{evPhones.length > 1 ? ` · ${formatPhone(phone)}` : ''}
                              </button>
                            </div>
                          ))}
                          {/* Agendar retorno */}
                          <button
                            disabled={criandoTriagem === ev.id}
                            onClick={async () => {
                              const dil = evDil ?? await criarDiligenciaDoEvento(ev)
                              setModalRetorno({ diligenciaId: dil.id, vitima: sanitizeName(ev.nomeVitima) })
                              setRetornoData(''); setRetornoHora('')
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                          >
                            <Calendar className="w-3.5 h-3.5" /> Agendar retorno
                          </button>

                          <a
                            href={buildFormUrl(ev.ccc, sanitizeName(ev.nomeVitima), ev.cargoVitima ?? '', ev.empresa, ev.cidade)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Abrir formulário de entrevista
                          </a>
                          {/* Resultado */}
                          <div className="flex gap-1.5 flex-wrap pt-0.5">
                            <button
                              disabled={criandoTriagem === ev.id}
                              onClick={async () => {
                                const dil = evDil ?? await criarDiligenciaDoEvento(ev)
                                setModalResposta({ diligenciaId: dil.id, vitima: sanitizeName(ev.nomeVitima) })
                                setTextoResposta('')
                              }}
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Respondeu
                            </button>
                            <button
                              disabled={criandoTriagem === ev.id}
                              onClick={async () => {
                                const dil = evDil ?? await criarDiligenciaDoEvento(ev)
                                setModalEncerramento({ diligenciaId: dil.id, vitima: sanitizeName(ev.nomeVitima) })
                                setObsEncerramento('')
                              }}
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              <PhoneOff className="w-3.5 h-3.5" /> Encerrar
                            </button>
                          </div>
                        </div>

                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 border-t border-slate-200" />
              </div>
            )}

            <div className="flex flex-col gap-5">
              {lista.map((d) => {
                const retorno       = parseRetorno(d.pesquisa.dataCombinada, d.pesquisa.horaEntrevista)
                const ultima        = getUltimaTentativa(d.pesquisa)
                const isPendente    = d.pesquisa.status === StatusPesquisa.Pendente
                const temHistorico  =
                  d.pesquisa.dataEnvioWhatsApp ||
                  d.pesquisa.historicoLigacoes.length > 0 ||
                  d.pesquisa.respostaVitima ||
                  (!d.pesquisa.respostaVitima && d.pesquisa.status === StatusPesquisa.Concluida && d.pesquisa.observacoes)
                const twa           = Math.max(d.pesquisa.tentativasWhatsApp ?? 0, d.pesquisa.dataEnvioWhatsApp ? 1 : 0)
                const nLig          = d.pesquisa.historicoLigacoes.length
                const totalTentativas = twa + nLig

                // Data do evento: Evento vinculado → data_evento → dataAtendimento (registros antigos)
                const eventoVinculado = d.eventoId ? eventoMap[d.eventoId] : undefined
                const dataEvento = eventoVinculado?.dataEvento ?? d.dataEvento ?? d.dataAtendimento
                const horaEvento = eventoVinculado?.horaEvento ?? d.horaEvento
                // Nome efetivo: vitima da diligência ou, se vazio, do evento vinculado
                const nomeEfetivo = sanitizeName(d.vitima || eventoVinculado?.nomeVitima)

                // Telefones múltiplos (separados por ";")
                const phones = d.telefoneVitima.split(';').map((p) => p.trim()).filter(Boolean)

                const isPinned = d.id === pinnedId

                const leftBorder = isPinned
                  ? 'border-l-blue-500'
                  : !isPendente
                  ? 'border-l-emerald-500'
                  : retorno?.variant === 'late'
                  ? 'border-l-red-500'
                  : retorno?.variant === 'normal' || retorno?.variant === 'timeonly'
                  ? 'border-l-amber-400'
                  : 'border-l-blue-400'

                return (
                  <div key={d.id} className={`bg-white border border-slate-200 border-l-4 ${leftBorder} rounded-xl shadow p-4 space-y-3 ${isPinned ? 'ring-2 ring-blue-300' : ''}`}>

                    {/* Banner "Em ligação" com botão Liberar */}
                    {isPinned && (
                      <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                        <span className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 animate-pulse" /> Em ligação — dados visíveis
                        </span>
                        <button
                          onClick={() => { setPinnedId(null); setPinnedAt(null) }}
                          className="text-xs text-blue-500 hover:text-blue-700 font-semibold px-2 py-0.5 rounded hover:bg-blue-100 transition-colors"
                        >
                          ✕ Liberar
                        </button>
                      </div>
                    )}

                    {/* Status + checkbox seleção + indicador WA */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {isPendente && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(d.id)}
                          onChange={() => toggleSelected(d.id)}
                          className="w-4 h-4 rounded accent-blue-600 cursor-pointer shrink-0"
                          title="Selecionar para WA em lote"
                        />
                      )}
                      <StatusPesquisaBadge status={d.pesquisa.status} />
                      {d.pesquisa.dataEnvioWhatsApp ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-md">
                          <MessageCircle className="w-3 h-3" />
                          WA enviado · {formatDate(d.pesquisa.dataEnvioWhatsApp)}
                        </span>
                      ) : isPendente && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-400 px-2 py-0.5 rounded-md">
                          <MessageCircle className="w-3 h-3" />
                          Sem WA
                        </span>
                      )}
                      {isPendente && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                          nLig === 0
                            ? 'bg-slate-100 text-slate-400'
                            : nLig <= 2
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          <Phone className="w-3 h-3" />
                          {nLig === 0 ? 'Sem ligação' : `${nLig} lig.`}
                        </span>
                      )}
                    </div>

                    {/* Dados principais */}
                    <div>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <Link
                          href={`/diligencias/${d.id}`}
                          className="font-semibold text-slate-800 hover:text-blue-600 transition-colors"
                        >
                          {nomeEfetivo}
                        </Link>
                        <span className="font-mono text-xs text-blue-600 font-semibold">{d.ccc}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {d.tipoEvento} · {d.cidade}/{d.uf}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {dataEvento && (
                          <span className="text-xs text-slate-400">
                            Evento: {formatDate(dataEvento)}{horaEvento ? ` às ${horaEvento}` : ''}
                          </span>
                        )}
                        {phones.map((phone) => (
                          <a
                            key={phone}
                            href={`tel:${cleanPhone(phone)}`}
                            className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            {formatPhone(phone)}
                          </a>
                        ))}
                      </div>
                    </div>

                    {/* Retorno em destaque */}
                    {retorno && (
                      <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border ${
                        retorno.variant === 'late'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : retorno.variant === 'timeonly'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {retorno.variant === 'late'
                          ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          : <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                        }
                        {retorno.text}
                      </div>
                    )}

                    {/* Última tentativa */}
                    {ultima && (
                      <p className="text-xs text-slate-500">
                        <span className="font-medium text-slate-600">Última tentativa:</span>{' '}
                        {ultima.label}{ultima.dateStr ? ` — ${ultima.dateStr}` : ''}
                      </p>
                    )}

                    {/* Contador de tentativas */}
                    {totalTentativas > 0 && (
                      <p className="text-xs text-slate-400">
                        <span className="font-medium text-slate-500">
                          {totalTentativas} tentativa{totalTentativas !== 1 ? 's' : ''}
                        </span>
                        {nLig > 0 && (
                          <span> · <span className="font-medium">{nLig}</span> lig.</span>
                        )}
                        {twa > 0 && (
                          <span> · <span className="font-medium">{twa}</span> WA</span>
                        )}
                      </p>
                    )}

                    {/* Histórico em pills */}
                    {temHistorico && (
                      <div className="flex flex-wrap gap-1">
                        {d.pesquisa.dataEnvioWhatsApp && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                            <MessageCircle className="w-3 h-3" />
                            WA {formatDate(d.pesquisa.dataEnvioWhatsApp)}
                          </span>
                        )}
                        {d.pesquisa.historicoLigacoes.map((lig) => (
                          <span
                            key={lig.id}
                            className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md"
                          >
                            <Phone className="w-3 h-3" />
                            {lig.observacao || lig.resultado || 'Ligação'} · {formatDate(lig.data)}
                          </span>
                        ))}
                        {d.pesquisa.respostaVitima && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3 h-3" /> Respondida
                          </span>
                        )}
                        {d.pesquisa.status === StatusPesquisa.Concluida &&
                          !d.pesquisa.respostaVitima &&
                          d.pesquisa.observacoes && (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                              <PhoneOff className="w-3 h-3" /> Encerrada
                            </span>
                          )}
                      </div>
                    )}

                    {/* Dados para entrevista */}
                    {isPendente && (
                      <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                          Dados para entrevista
                        </p>
                        <div className="space-y-1">
                          {[
                            { label: 'ID Evento', value: d.ccc },
                            { label: 'Nome', value: nomeEfetivo },
                            { label: 'Cargo', value: d.cargo },
                            { label: 'Empresa', value: d.empresa },
                            { label: 'Localidade', value: `${d.cidade}/${d.uf}` },
                          ].map(({ label, value }) => {
                            const key = `${d.id}-${label}`
                            return (
                              <div key={label} className="flex items-center justify-between gap-2">
                                <div className="flex items-baseline gap-1.5 min-w-0">
                                  <span className="text-[10px] text-slate-400 shrink-0 w-16">{label}:</span>
                                  <span className="text-xs font-medium text-slate-700 truncate">{value || '—'}</span>
                                </div>
                                <button
                                  onClick={() => copyToClipboard(value || '', key)}
                                  className="shrink-0 p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                  title={`Copiar ${label}`}
                                >
                                  {copiedField === key
                                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                    : <Copy className="w-3.5 h-3.5" />
                                  }
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Ações */}
                    {isPendente ? (
                      <div className="flex flex-col items-start gap-1.5 pt-1 border-t border-slate-100">
                        {/* Linha 1: Ligar + WhatsApp — um par por telefone */}
                        {phones.map((phone, idx) => (
                          <div key={phone} className="flex gap-1.5 flex-wrap items-center">
                            {phones.length > 1 && (
                              <span className="text-[10px] text-slate-400 font-medium w-4 text-right shrink-0">
                                {idx + 1}.
                              </span>
                            )}
                            <a
                              href={`tel:+55${cleanPhone(phone)}`}
                              onClick={() => registrarLigacaoIniciada(d)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              Ligar{phones.length > 1 ? ` · ${formatPhone(phone)}` : ''}
                            </a>
                            <button
                              onClick={() => handleEnviarWhatsApp(d, phone)}
                              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                                d.pesquisa.dataEnvioWhatsApp
                                  ? 'border-green-300 bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                              }`}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              {d.pesquisa.dataEnvioWhatsApp ? 'Reenviar WA' : 'WhatsApp'}
                              {phones.length > 1 ? ` · ${formatPhone(phone)}` : ''}
                            </button>
                          </div>
                        ))}
                        {/* Linha 2: Agendar retorno */}
                        <button
                          onClick={() => setModalRetorno({ diligenciaId: d.id, vitima: nomeEfetivo })}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Calendar className="w-3.5 h-3.5" /> Agendar retorno
                        </button>
                        {/* Linha 3: Respondeu + Encerrar */}
                        <div className="flex gap-1.5 flex-wrap">
                          <button
                            onClick={() => setModalResposta({ diligenciaId: d.id, vitima: nomeEfetivo })}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Respondeu
                          </button>
                          <button
                            onClick={() => setModalEncerramento({ diligenciaId: d.id, vitima: nomeEfetivo })}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <PhoneOff className="w-3.5 h-3.5" /> Encerrar
                          </button>
                        </div>
                        {/* Linha 4: Formulário de entrevista */}
                        <a
                          href={buildFormUrl(d.ccc, nomeEfetivo, d.cargo, d.empresa, d.cidade)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Abrir formulário de entrevista
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-xs">
                          {d.pesquisa.respostaVitima
                            ? <span className="text-emerald-600 font-medium">✔ Pesquisa respondida</span>
                            : <span className="text-slate-400">✖ {d.pesquisa.observacoes}</span>
                          }
                        </span>
                        <Link href={`/pesquisa/${d.id}`}>
                          <Button size="sm" variant="ghost">Ver detalhes</Button>
                        </Link>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardBody>
        )}
      </Card>

      {/* Barra flutuante — WA em lote */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700">
          <span className="text-sm font-medium">
            {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <div className="w-px h-4 bg-slate-600" />
          <button
            onClick={startBatchWA}
            className="inline-flex items-center gap-2 text-sm font-semibold bg-green-500 hover:bg-green-400 transition-colors px-4 py-1.5 rounded-xl"
          >
            <MessageCircle className="w-4 h-4" />
            Iniciar envio em fila
          </button>
          <button
            onClick={clearSelection}
            className="text-slate-400 hover:text-white transition-colors text-xs px-2 py-1.5"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Modal: Fila guiada de WA em lote */}
      {batchQueue.length > 0 && (() => {
        const current = batchQueue[batchIdx]
        const isLast = batchIdx + 1 >= batchQueue.length
        return (
          <Modal open={true} onClose={closeBatch} title="Envio de WhatsApp em fila" size="sm">
            <div className="p-5 space-y-4">
              {/* Progresso */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Progresso</span>
                  <span className="font-semibold text-slate-700">{batchIdx + 1} de {batchQueue.length}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-300"
                    style={{ width: `${((batchIdx + 1) / batchQueue.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Pessoa atual */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-0.5">
                <p className="font-semibold text-slate-800">{current.d.vitima}</p>
                <p className="text-xs text-slate-500">{formatPhone(current.phone)}</p>
              </div>

              <p className="text-xs text-slate-500">
                Clique em <strong>Abrir WhatsApp</strong> para abrir a conversa com a mensagem pronta.
                Depois clique <strong>Enviado — Próximo</strong> para avançar.
              </p>

              <a
                href={current.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors"
              >
                <MessageCircle className="w-4 h-4" /> Abrir WhatsApp
              </a>

              <div className="flex gap-2">
                <button
                  onClick={() => handleBatchNext(true)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
                >
                  {isLast ? 'Enviado — Concluir' : 'Enviado — Próximo →'}
                </button>
                <button
                  onClick={() => handleBatchNext(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm transition-colors"
                  title="Avançar sem marcar como enviado"
                >
                  Pular
                </button>
              </div>

              <button onClick={closeBatch} className="w-full text-xs text-slate-400 hover:text-slate-600 py-1 transition-colors">
                Cancelar e fechar
              </button>
            </div>
          </Modal>
        )
      })()}

      {/* Modal: Agendar retorno */}
      <Modal
        open={!!modalRetorno}
        onClose={() => { setModalRetorno(null); setRetornoData(''); setRetornoHora('') }}
        title={`Agendar retorno — ${modalRetorno?.vitima}`}
        size="sm"
      >
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Data (opcional)"
              type="date"
              value={retornoData}
              onChange={(e) => setRetornoData(e.target.value)}
            />
            <Input
              label="Horário *"
              type="time"
              value={retornoHora}
              onChange={(e) => setRetornoHora(e.target.value)}
            />
          </div>
          {retornoHora && (
            <p className="text-xs text-slate-400 -mt-1">
              {retornoData
                ? `Retorno agendado para ${retornoData.split('-').reverse().join('/')} às ${retornoHora}`
                : `Sem data fixa — retorno: qualquer dia após ${retornoHora}`
              }
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary" size="sm"
              onClick={() => { setModalRetorno(null); setRetornoData(''); setRetornoHora('') }}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSalvarRetorno} disabled={!retornoHora}>
              <Calendar className="w-3.5 h-3.5" /> Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Pesquisa respondida */}
      <Modal
        open={!!modalResposta}
        onClose={() => setModalResposta(null)}
        title={`Pesquisa respondida — ${modalResposta?.vitima}`}
        size="sm"
      >
        <div className="p-5 space-y-4">
          <Textarea
            label="Resposta da vítima (opcional)"
            value={textoResposta}
            onChange={(e) => setTextoResposta(e.target.value)}
            placeholder="Descreva o que a vítima respondeu..."
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setModalResposta(null)}>Cancelar</Button>
            <Button variant="success" size="sm" onClick={handleSalvarResposta}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Encerrar sem resposta */}
      <Modal
        open={!!modalEncerramento}
        onClose={() => { setModalEncerramento(null); setObsEncerramento('') }}
        title={`Encerrar — ${modalEncerramento?.vitima}`}
        size="sm"
      >
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            Informe o motivo do encerramento. A pesquisa será marcada como{' '}
            <strong>concluída</strong>.
          </p>
          <Textarea
            label="Motivo *"
            value={obsEncerramento}
            onChange={(e) => setObsEncerramento(e.target.value)}
            placeholder="Ex: Número incorreto, não atende após várias tentativas, recusou atendimento..."
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary" size="sm"
              onClick={() => { setModalEncerramento(null); setObsEncerramento('') }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger" size="sm"
              onClick={handleConfirmarEncerramento}
              disabled={!obsEncerramento.trim()}
            >
              <PhoneOff className="w-3.5 h-3.5" /> Encerrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function PesquisaPage() {
  return (
    <Suspense>
      <PesquisaContent />
    </Suspense>
  )
}
