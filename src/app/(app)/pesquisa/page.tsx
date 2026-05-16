'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import {
  MessageSquare, MessageCircle, Phone, Calendar, CheckCircle2,
  PhoneOff, Clock, AlertCircle, ExternalLink,
} from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { StatusPesquisaBadge } from '@/components/shared/StatusBadge'
import { buildWhatsAppUrl, buildPesquisaMessage, formatDate, formatPhone } from '@/lib/utils'
import { StatusPesquisa, StatusDiligencia, ResultadoLigacao, Diligencia, Pesquisa } from '@/types'

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
  { key: 'pendentes', label: 'Pendentes' },
  { key: 'concluidas', label: 'Concluídas' },
  { key: 'todas', label: 'Todas' },
]

interface ModalRetornoState { diligenciaId: string; vitima: string }
interface ModalRespostaState { diligenciaId: string; vitima: string }
interface ModalEncerramentoState { diligenciaId: string; vitima: string }

// ─── Ordenação ────────────────────────────────────────────────────────────────

function getPendentePriority(d: Diligencia): number {
  const dc = d.pesquisa.dataCombinada
  if (!dc) return 3
  if (/^\d{2}:\d{2}$/.test(dc)) return 3
  const today = new Date().toISOString().split('T')[0]
  return dc.split(' ')[0] <= today ? 1 : 2
}

function sortPesquisa(a: Diligencia, b: Diligencia): number {
  const aConc = a.pesquisa.status === StatusPesquisa.Concluida
  const bConc = b.pesquisa.status === StatusPesquisa.Concluida
  if (aConc !== bConc) return aConc ? 1 : -1
  if (aConc) {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  }
  const pa = getPendentePriority(a)
  const pb = getPendentePriority(b)
  if (pa !== pb) return pa - pb
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

// ─── Retorno ──────────────────────────────────────────────────────────────────

type RetornoVariant = 'normal' | 'late' | 'timeonly'

function parseRetorno(dc: string | undefined): { text: string; variant: RetornoVariant } | null {
  if (!dc) return null
  if (/^\d{2}:\d{2}$/.test(dc)) {
    return { text: `Retorno: qualquer dia após ${dc}`, variant: 'timeonly' }
  }
  const sp = dc.indexOf(' ')
  if (sp === -1) return null
  const datePart = dc.slice(0, sp)
  const timePart = dc.slice(sp + 1)
  const today = new Date().toISOString().split('T')[0]
  const [y, m, d] = datePart.split('-')
  const fmt = `${d}/${m}/${y}`
  if (datePart < today) {
    return { text: `Retorno atrasado: ${fmt} às ${timePart}`, variant: 'late' }
  }
  return { text: `Retorno agendado para ${fmt} às ${timePart}`, variant: 'normal' }
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

export default function PesquisaPage() {
  const {
    diligencias, registrarWhatsApp, registrarLigacao,
    agendarRetorno, marcarRespondida, encerrarSemResposta,
  } = useDiligencias()

  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState('pendentes')
  const [, startTransition] = useTransition()

  // Modal: Agendar retorno
  const [modalRetorno, setModalRetorno] = useState<ModalRetornoState | null>(null)
  const [retornoData, setRetornoData] = useState('')
  const [retornoHora, setRetornoHora] = useState('')

  // Modal: Marcar respondida
  const [modalResposta, setModalResposta] = useState<ModalRespostaState | null>(null)
  const [textoResposta, setTextoResposta] = useState('')

  // Modal: Encerrar
  const [modalEncerramento, setModalEncerramento] = useState<ModalEncerramentoState | null>(null)
  const [obsEncerramento, setObsEncerramento] = useState('')

  const realizadas = useMemo(
    () => diligencias.filter((d) => d.status === StatusDiligencia.Realizada),
    [diligencias],
  )

  const stats = useMemo(() => ({
    total: realizadas.length,
    pendentes: realizadas.filter((d) => d.pesquisa.status === StatusPesquisa.Pendente).length,
    concluidas: realizadas.filter((d) => d.pesquisa.status === StatusPesquisa.Concluida).length,
  }), [realizadas])

  const lista = useMemo(() => {
    let l = realizadas
    if (filtro === 'pendentes') l = l.filter((d) => d.pesquisa.status === StatusPesquisa.Pendente)
    else if (filtro === 'concluidas') l = l.filter((d) => d.pesquisa.status === StatusPesquisa.Concluida)
    if (search) {
      const q = search.toLowerCase()
      l = l.filter((d) => d.vitima.toLowerCase().includes(q) || d.ccc.toLowerCase().includes(q))
    }
    return [...l].sort(sortPesquisa)
  }, [realizadas, filtro, search])

  function handleLigar(d: Diligencia) {
    window.open(`tel:${d.telefoneVitima}`)
    const now = new Date()
    registrarLigacao(d.id, {
      data: now.toISOString().split('T')[0],
      hora: now.toTimeString().slice(0, 5),
      observacao: 'Ligação iniciada',
    })
  }

  function handleEnviarWhatsApp(d: Diligencia) {
    const mensagem = buildPesquisaMessage(d.vitima, d.tipoEvento, d.empresaCliente)
    registrarWhatsApp(d.id, mensagem)
    window.open(buildWhatsAppUrl(d.telefoneVitima, mensagem), '_blank')
  }

  function handleSalvarRetorno() {
    if (!modalRetorno || !retornoHora) return
    const value = retornoData ? `${retornoData} ${retornoHora}` : retornoHora
    agendarRetorno(modalRetorno.diligenciaId, value)
    setModalRetorno(null)
    setRetornoData('')
    setRetornoHora('')
  }

  function handleSalvarResposta() {
    if (!modalResposta) return
    marcarRespondida(modalResposta.diligenciaId, textoResposta)
    setModalResposta(null)
    setTextoResposta('')
  }

  function handleConfirmarEncerramento() {
    if (!modalEncerramento || !obsEncerramento.trim()) return
    encerrarSemResposta(modalEncerramento.diligenciaId, obsEncerramento.trim())
    setModalEncerramento(null)
    setObsEncerramento('')
  }

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
          { label: 'Total', value: stats.total, color: 'bg-slate-50 border-slate-200', text: 'text-slate-800' },
          { label: 'Pendentes', value: stats.pendentes, color: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
          { label: 'Concluídas', value: stats.concluidas, color: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800' },
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
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar vítima, CCC..."
              className="sm:w-64"
            />
            <div className="flex flex-wrap gap-1.5">
              {FILTROS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => startTransition(() => setFiltro(f.key))}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    filtro === f.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
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
            <div className="flex flex-col gap-3">
              {lista.map((d) => {
                const retorno = parseRetorno(d.pesquisa.dataCombinada)
                const ultima = getUltimaTentativa(d.pesquisa)
                const isPendente = d.pesquisa.status === StatusPesquisa.Pendente
                const temHistorico =
                  d.pesquisa.dataEnvioWhatsApp ||
                  d.pesquisa.historicoLigacoes.length > 0 ||
                  d.pesquisa.respostaVitima ||
                  (!d.pesquisa.respostaVitima && d.pesquisa.status === StatusPesquisa.Concluida && d.pesquisa.observacoes)

                return (
                  <div key={d.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
                    {/* Status + indicador WA */}
                    <div className="flex items-center gap-2 flex-wrap">
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
                    </div>

                    {/* Dados principais */}
                    <div>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <Link
                          href={`/diligencias/${d.id}`}
                          className="font-semibold text-slate-800 hover:text-blue-600 transition-colors"
                        >
                          {d.vitima}
                        </Link>
                        <span className="font-mono text-xs text-blue-600 font-semibold">{d.ccc}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {d.tipoEvento} · {d.cidade}/{d.uf}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-slate-400">
                          {formatDate(d.createdAt.split('T')[0])}
                        </span>
                        <a
                          href={`tel:${d.telefoneVitima}`}
                          className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          {formatPhone(d.telefoneVitima)}
                        </a>
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

                    {/* Ações */}
                    {isPendente ? (
                      <div className="flex flex-col items-start gap-1.5 pt-1 border-t border-slate-100">
                        {/* Linha 1: Ligar + WhatsApp */}
                        <div className="flex gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleLigar(d)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" /> Ligar
                          </button>
                          <button
                            onClick={() => handleEnviarWhatsApp(d)}
                            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                              d.pesquisa.dataEnvioWhatsApp
                                ? 'border-green-300 bg-green-100 text-green-800 hover:bg-green-200'
                                : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            {d.pesquisa.dataEnvioWhatsApp ? 'Reenviar WA' : 'WhatsApp'}
                          </button>
                        </div>
                        {/* Linha 2: Agendar retorno */}
                        <button
                          onClick={() => setModalRetorno({ diligenciaId: d.id, vitima: d.vitima })}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Calendar className="w-3.5 h-3.5" /> Agendar retorno
                        </button>
                        {/* Linha 3: Respondeu + Encerrar */}
                        <div className="flex gap-1.5 flex-wrap">
                          <button
                            onClick={() => setModalResposta({ diligenciaId: d.id, vitima: d.vitima })}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Respondeu
                          </button>
                          <button
                            onClick={() => setModalEncerramento({ diligenciaId: d.id, vitima: d.vitima })}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <PhoneOff className="w-3.5 h-3.5" /> Encerrar
                          </button>
                        </div>
                        {/* Linha 4: Abrir formulário de entrevista */}
                        <a
                          href={buildFormUrl(d.ccc, d.vitima, d.cargo, d.empresa, d.cidade)}
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
              variant="secondary"
              size="sm"
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

      {/* Modal: Encerrar */}
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
              variant="secondary"
              size="sm"
              onClick={() => { setModalEncerramento(null); setObsEncerramento('') }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
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
