'use client'

import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MessageCircle, Phone, Plus, Save, AlertCircle, Clock, Calendar, CheckCircle2, PhoneOff, ClipboardCopy, ExternalLink } from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'
import { StatusPesquisaBadge } from '@/components/shared/StatusBadge'
import { buildWhatsAppUrl, buildPesquisaMessage, formatDate, formatPhone } from '@/lib/utils'
import { StatusPesquisa, ResultadoLigacao, Pesquisa } from '@/types'

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

interface Params { id: string }

const RESULTADO_COLOR: Record<ResultadoLigacao, string> = {
  [ResultadoLigacao.NaoAtendeu]: 'text-slate-500',
  [ResultadoLigacao.PediuRetorno]: 'text-amber-600',
  [ResultadoLigacao.Respondeu]: 'text-emerald-600',
}

function currentTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function formatDataRetorno(s: string | undefined): string {
  if (!s) return '-'
  const [date, time] = s.split(' ')
  const [y, m, d] = (date || '').split('-')
  if (!y || !m || !d) return s
  return time ? `${d}/${m}/${y} às ${time}` : `${d}/${m}/${y}`
}

export default function PesquisaDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = use(params)
  const { diligencias, atualizarPesquisa, registrarLigacao, marcarRespondida, encerrarSemResposta } = useDiligencias()

  const diligencia = useMemo(() => diligencias.find((d) => d.id === id), [diligencias, id])

  const [localPesquisa, setLocalPesquisa] = useState<Pesquisa | null>(null)

  // Retorno agendado: data e hora separados, combinados na string dataCombinada
  const existingRetorno = diligencia?.pesquisa.dataCombinada || ''
  const [retornoData, setRetornoData] = useState(() => existingRetorno.split(' ')[0] || '')
  const [retornoHora, setRetornoHora] = useState(() => existingRetorno.split(' ')[1] || '')

  const [novaLig, setNovaLig] = useState({
    data: new Date().toISOString().split('T')[0],
    hora: currentTime(),
    duracao: '',
    resultado: ResultadoLigacao.NaoAtendeu,
    observacao: '',
  })
  const [saving, setSaving] = useState(false)
  const [savingLig, setSavingLig] = useState(false)
  const [ligError, setLigError] = useState<string | null>(null)

  // Modal marcar respondida
  const [modalResposta, setModalResposta] = useState(false)
  const [textoResposta, setTextoResposta] = useState('')

  // Modal encerrar sem resposta
  const [modalEncerramento, setModalEncerramento] = useState(false)
  const [obsEncerramento, setObsEncerramento] = useState('')

  const pesquisa = localPesquisa ?? diligencia?.pesquisa

  if (!diligencia || !pesquisa) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertCircle className="w-12 h-12 text-slate-300" />
        <p className="text-slate-600 font-medium">Diligência não encontrada</p>
        <Link href="/pesquisa"><Button variant="secondary">Voltar</Button></Link>
      </div>
    )
  }

  const whatsappUrl = buildWhatsAppUrl(diligencia.telefoneVitima, buildPesquisaMessage(diligencia.vitima, diligencia.tipoEvento, diligencia.empresaCliente))
  const hasRetornoAgendado = !!pesquisa.dataCombinada

  const [copied, setCopied] = useState<string | null>(null)
  function copyField(label: string, value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  const formUrl = buildFormUrl(diligencia.ccc, diligencia.vitima, diligencia.cargo, diligencia.empresa, diligencia.cidade)

  function setPesquisa(patch: Partial<Pesquisa>) {
    setLocalPesquisa((prev) => ({ ...(prev ?? diligencia!.pesquisa), ...patch }))
  }

  function handleAgendarRetorno() {
    if (!retornoData) return
    const combinado = retornoHora ? `${retornoData} ${retornoHora}` : retornoData
    setPesquisa({ dataCombinada: combinado })
  }

  async function handleSave() {
    if (!localPesquisa) return
    setSaving(true)
    try {
      await atualizarPesquisa(id, localPesquisa)
      window.history.back()
    } catch {
      setSaving(false)
    }
  }

  async function addLigacao() {
    if (!novaLig.hora) return
    setLigError(null)
    setSavingLig(true)
    try {
      await registrarLigacao(id, {
        data: novaLig.data,
        hora: novaLig.hora,
        duracao: novaLig.duracao || undefined,
        resultado: novaLig.resultado,
        observacao: novaLig.observacao || undefined,
      })
      setNovaLig({ data: new Date().toISOString().split('T')[0], hora: currentTime(), duracao: '', resultado: ResultadoLigacao.NaoAtendeu, observacao: '' })
      setLocalPesquisa(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao registrar ligação'
      setLigError(msg)
      console.error('[addLigacao]', err)
    } finally {
      setSavingLig(false)
    }
  }

  function handleMarcarRespondida() {
    marcarRespondida(id, textoResposta)
    setModalResposta(false)
    setTextoResposta('')
  }

  function handleEncerrarSemResposta() {
    if (!obsEncerramento.trim()) return
    encerrarSemResposta(id, obsEncerramento.trim())
    setModalEncerramento(false)
    setObsEncerramento('')
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2">
        <Link href="/pesquisa">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Pesquisa — {diligencia.vitima}</h1>
          <p className="text-xs font-mono text-blue-600">{diligencia.ccc}</p>
        </div>
      </div>

      {/* Contato rápido com a vítima */}
      <div className="flex flex-wrap gap-2">
        <a href={`tel:${diligencia.telefoneVitima}`}>
          <Button variant="primary" size="sm">
            <Phone className="w-3.5 h-3.5" /> Ligar — {formatPhone(diligencia.telefoneVitima)}
          </Button>
        </a>
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="secondary" size="sm">
            <MessageCircle className="w-3.5 h-3.5 text-green-600" /> WhatsApp vítima
          </Button>
        </a>
      </div>

      {/* Card Entrevista Plataforma 6S */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Entrevista Plataforma 6S</CardTitle>
            <a href={formUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="primary">
                <ExternalLink className="w-3.5 h-3.5" /> Abrir formulário
              </Button>
            </a>
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-xs text-slate-500 mb-3">Dados da 1ª página — clique para copiar cada campo:</p>
          <div className="space-y-2">
            {([
              ['ID evento',     diligencia.ccc],
              ['Nome completo', diligencia.vitima],
              ['Cargo',         diligencia.cargo],
              ['Empresa',       diligencia.empresa],
              ['Localidade',    diligencia.cidade],
            ] as [string, string][]).map(([label, value]) => (
              <button
                key={label}
                type="button"
                onClick={() => copyField(label, value)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left group"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-medium text-slate-700 truncate">{value || '—'}</p>
                </div>
                <ClipboardCopy className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${copied === label ? 'text-emerald-500' : 'text-slate-300 group-hover:text-blue-400'}`} />
              </button>
            ))}
          </div>
          {copied && (
            <p className="text-xs text-emerald-600 text-center mt-2">"{copied}" copiado!</p>
          )}
        </CardBody>
      </Card>

      {/* Banner retorno agendado */}
      {hasRetornoAgendado && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-300 text-amber-800 text-sm px-4 py-3 rounded-xl">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <div>
            <span className="font-semibold">Retorno agendado: </span>
            {formatDataRetorno(pesquisa.dataCombinada)}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Status da Pesquisa</CardTitle>
            <StatusPesquisaBadge status={pesquisa.status} />
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* Botões de finalização — só aparecem se ainda Pendente */}
          {pesquisa.status === StatusPesquisa.Pendente && (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="success" onClick={() => setModalResposta(true)}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Marcar como respondida
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setModalEncerramento(true)}>
                <PhoneOff className="w-3.5 h-3.5 text-slate-400" /> Encerrar sem resposta
              </Button>
            </div>
          )}

          {/* Resposta registrada */}
          {pesquisa.respostaVitima && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-emerald-700 mb-1">Resposta da vítima</p>
              <p className="text-sm text-emerald-800 italic">"{pesquisa.respostaVitima}"</p>
            </div>
          )}

          {/* Motivo encerramento sem resposta */}
          {pesquisa.status === StatusPesquisa.Concluida && pesquisa.observacoes && !pesquisa.respostaVitima && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-slate-500 mb-1">Motivo do encerramento</p>
              <p className="text-sm text-slate-700">{pesquisa.observacoes}</p>
            </div>
          )}

          {/* Agendamento de retorno — data + hora */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Agendar retorno
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Data"
                type="date"
                value={retornoData}
                onChange={(e) => setRetornoData(e.target.value)}
              />
              <Input
                label="Hora"
                type="time"
                value={retornoHora}
                onChange={(e) => setRetornoHora(e.target.value)}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!retornoData || !retornoHora}
              onClick={handleAgendarRetorno}
            >
              <Clock className="w-3.5 h-3.5" /> Confirmar agendamento
            </Button>
          </div>

          <Input
            label="Data envio WhatsApp"
            type="date"
            value={pesquisa.dataEnvioWhatsApp || ''}
            onChange={(e) => setPesquisa({ dataEnvioWhatsApp: e.target.value })}
          />
          <Textarea
            label="Mensagem enviada"
            value={pesquisa.mensagemEnviada || ''}
            onChange={(e) => setPesquisa({ mensagemEnviada: e.target.value })}
            rows={4}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Histórico de Ligações ({diligencia.pesquisa.historicoLigacoes.length})</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          {diligencia.pesquisa.historicoLigacoes.length > 0 && (
            <div className="space-y-2">
              {diligencia.pesquisa.historicoLigacoes.map((lig) => (
                <div key={lig.id} className="bg-slate-50 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700">{formatDate(lig.data)} às {lig.hora}</p>
                    <div className="flex items-center gap-2">
                      {lig.duracao && <span className="text-xs text-slate-400">{lig.duracao}</span>}
                      {lig.resultado && (
                        <span className={`text-xs font-medium ${RESULTADO_COLOR[lig.resultado]}`}>{lig.resultado}</span>
                      )}
                    </div>
                  </div>
                  {lig.observacao && <p className="text-xs text-slate-500 mt-0.5">{lig.observacao}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="border border-dashed border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-600">Registrar nova ligação</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Data" type="date" value={novaLig.data} onChange={(e) => setNovaLig((p) => ({ ...p, data: e.target.value }))} />
              <Input label="Hora (auto)" type="time" value={novaLig.hora} onChange={(e) => setNovaLig((p) => ({ ...p, hora: e.target.value }))} />
              <Input label="Duração" value={novaLig.duracao} onChange={(e) => setNovaLig((p) => ({ ...p, duracao: e.target.value }))} placeholder="Ex: 10 min" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Resultado</p>
              <div className="flex gap-2">
                {Object.values(ResultadoLigacao).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNovaLig((p) => ({ ...p, resultado: r }))}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg border transition-colors ${novaLig.resultado === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <Textarea label="Observação" value={novaLig.observacao} onChange={(e) => setNovaLig((p) => ({ ...p, observacao: e.target.value }))} rows={2} />

            {ligError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                {ligError}
              </div>
            )}

            <Button type="button" variant="secondary" size="sm" onClick={addLigacao} disabled={!novaLig.hora} loading={savingLig}>
              <Plus className="w-3.5 h-3.5" /> Adicionar ligação
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="flex gap-3 justify-end pb-6">
        <Link href="/pesquisa">
          <Button variant="secondary" type="button">Cancelar</Button>
        </Link>
        <Button onClick={handleSave} loading={saving} disabled={!localPesquisa}>
          <Save className="w-4 h-4" /> Salvar pesquisa
        </Button>
      </div>

      {/* Modal marcar respondida */}
      <Modal open={modalResposta} onClose={() => setModalResposta(false)} title="Marcar como respondida" size="sm">
        <div className="p-5 space-y-4">
          <Textarea
            label="Resposta da vítima (opcional)"
            value={textoResposta}
            onChange={(e) => setTextoResposta(e.target.value)}
            placeholder="Descreva o que a vítima respondeu..."
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setModalResposta(false)}>Cancelar</Button>
            <Button variant="success" size="sm" onClick={handleMarcarRespondida}>Confirmar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal encerrar sem resposta */}
      <Modal open={modalEncerramento} onClose={() => { setModalEncerramento(false); setObsEncerramento('') }} title="Encerrar sem resposta" size="sm">
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">Informe o motivo do encerramento. A pesquisa será marcada como <strong>concluída</strong>.</p>
          <Textarea
            label="Motivo *"
            value={obsEncerramento}
            onChange={(e) => setObsEncerramento(e.target.value)}
            placeholder="Ex: Número inexistente, vítima não retornou após 3 tentativas..."
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => { setModalEncerramento(false); setObsEncerramento('') }}>Cancelar</Button>
            <Button variant="danger" size="sm" onClick={handleEncerrarSemResposta} disabled={!obsEncerramento.trim()}>
              <PhoneOff className="w-3.5 h-3.5" /> Encerrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
