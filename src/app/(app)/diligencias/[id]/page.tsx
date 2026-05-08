'use client'

import { use, useMemo, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Phone, MessageCircle, Edit, CheckCircle2,
  DollarSign, FileText, User, MapPin, Building, AlertCircle,
  ExternalLink, Plus, Upload, Download, Star, Package, Send,
} from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useAdvogados } from '@/context/AdvogadosContext'
import { gerarPDFFinal } from '@/lib/pdfFinal'
import { gerarContratoPDF, gerarReciboPDF, gerarContratoBase64Only, gerarReciboBase64Only } from '@/lib/pdf'
import { useToast } from '@/context/ToastContext'
import { CCCHistorico } from '@/components/diligencias/CCCHistorico'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { StatusDiligenciaBadge, StatusPagamentoBadge, StatusPesquisaBadge, EmpresaBadge } from '@/components/shared/StatusBadge'
import { formatCurrency, formatDate, formatPhone, formatCPF, buildWhatsAppUrl, buildPesquisaMessage } from '@/lib/utils'
import { StatusDiligencia, StatusPagamento, AvaliacaoAdvogado, Anexos, Diligencia } from '@/types'
import { buildWhatsAppZapSign, buildWhatsAppAdriana } from '@/services/zapsignService'
import type { EnviarZapSignResult } from '@/app/api/zapsign/enviar/route'

interface Params { id: string }

const NOTA_LABELS: Record<number, string> = {
  1: 'Ruim',
  2: 'Regular',
  3: 'Bom',
  4: 'Muito bom',
  5: 'Excelente',
}

// ── Progresso da diligência ───────────────────────────────────────────────────

const ETAPAS_PROGRESSO = [
  { label: 'Triagem' },
  { label: 'Em andamento' },
  { label: 'Diligência realizada', sub: 'Atendimento executado' },
  { label: 'Diligência concluída', sub: 'Processo interno finalizado' },
]

function etapaAtual(d: Diligencia): number {
  if (d.cicloFinalizado) return 3                          // Diligência concluída
  if (d.status === StatusDiligencia.Realizada) return 2    // Diligência realizada
  return 1                                                  // Em andamento
}

export default function DiligenciaDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = use(params)
  const { diligencias, marcarRealizada, marcarPago, finalizarCiclo, uploadAnexo, updateDiligencia, atualizarAnexo } = useDiligencias()
  const { advogadoMap } = useAdvogados()
  const { addToast } = useToast()

  const [gerandoContrato, setGerandoContrato] = useState(false)
  const [gerandoRecibo, setGerandoRecibo] = useState(false)
  const [modalRealizada, setModalRealizada] = useState(false)
  const [modalPago, setModalPago] = useState(false)
  const [modalFinalizar, setModalFinalizar] = useState(false)
  const [modalPendencia, setModalPendencia] = useState(false)
  const [showDownloads, setShowDownloads] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfErro, setPdfErro] = useState<string | null>(null)

  // Observação interna
  const [editandoObs, setEditandoObs] = useState(false)
  const [obsInterna, setObsInterna] = useState('')
  const [salvandoObs, setSalvandoObs] = useState(false)

  // Avaliação do advogado
  const [notaAdv, setNotaAdv] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [obsAdv, setObsAdv] = useState('')
  const [contratarNovamente, setContratarNovamente] = useState<boolean | undefined>(undefined)

  // Estado de upload por campo: 'idle' | 'uploading' | 'error'
  const [uploadState, setUploadState] = useState<Record<string, 'idle' | 'uploading' | 'error'>>({})

  // Refs para inputs de arquivo ocultos
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // ZapSign — loading states (links são derivados do DB via d.linkAssinatura*)
  const [enviandoContratoZap, setEnviandoContratoZap] = useState(false)
  const [enviandoReciboZap, setEnviandoReciboZap] = useState(false)

  const d = useMemo(() => diligencias.find((x) => x.id === id), [diligencias, id])
  const adv = d ? advogadoMap.get(d.advogadoId) : undefined

  if (!d) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertCircle className="w-12 h-12 text-slate-300" />
        <p className="text-slate-600 font-medium">Diligência não encontrada</p>
        <Link href="/diligencias"><Button variant="secondary">Voltar</Button></Link>
      </div>
    )
  }

  // Links de assinatura derivados do DB — persistem entre recarregamentos
  const linkContratoZap = d.linkAssinaturaAdvogadoContrato ?? null
  const linkReciboZap = d.linkAssinaturaAdvogadoRecibo ?? null

  const whatsappVitima = buildWhatsAppUrl(d.telefoneVitima, buildPesquisaMessage(d.vitima, d.tipoEvento))
  const isRemoto = d.modoDiligencia === 'Remoto'
  const podeFinalizar = d.status === StatusDiligencia.Realizada
    && (isRemoto || d.statusPagamento === StatusPagamento.Pago)
    && !d.cicloFinalizado

  const advPhone = adv ? (adv.whatsapp || adv.telefone).replace(/\D/g, '') : ''
  const whatsappAdv = adv ? `https://wa.me/55${advPhone}?text=${encodeURIComponent(`Olá ${adv.nomeCompleto.split(' ')[0]}, tudo bem? Referente à diligência ${d.ccc}.`)}` : '#'

  // Pendência documental (presencial): falta contrato assinado, recibo assinado ou comprovante pgto
  const pendenciasDocumentais = !isRemoto ? [
    !d.anexos.contratoAssinado && 'contrato assinado',
    !d.anexos.reciboAssinado && 'recibo assinado',
    !d.anexos.comprovantePagamento && 'comprovante de pagamento',
  ].filter(Boolean) as string[] : []
  const temPendenciaDocumental = d.cicloFinalizado && pendenciasDocumentais.length > 0

  const whatsappZapContrato = adv && linkContratoZap
    ? buildWhatsAppZapSign(adv.whatsapp || adv.telefone, adv.nomeCompleto, d.ccc, 'contrato', linkContratoZap)
    : null

  const whatsappZapRecibo = adv && linkReciboZap
    ? buildWhatsAppZapSign(adv.whatsapp || adv.telefone, adv.nomeCompleto, d.ccc, 'recibo', linkReciboZap)
    : null

  const whatsappZapAdriana = d.linkAssinaturaAdriana
    ? buildWhatsAppAdriana(d.ccc, 'contrato', d.linkAssinaturaAdriana)
    : null

  function handleUpload(campo: keyof Anexos) {
    const input = inputRefs.current[campo]
    if (!input) return
    input.value = ''   // permite re-selecionar o mesmo arquivo
    input.click()
  }

  const handleFileChange = useCallback(async (campo: keyof Anexos, file: File | undefined) => {
    if (!file) return
    setUploadState((s) => ({ ...s, [campo]: 'uploading' }))
    try {
      await uploadAnexo(id, campo, file)
      setUploadState((s) => ({ ...s, [campo]: 'idle' }))
    } catch (err) {
      console.error('[upload anexo]', err)
      setUploadState((s) => ({ ...s, [campo]: 'error' }))
    }
  }, [id, uploadAnexo])

  function handleFinalizar() {
    if (!notaAdv) return
    const avaliacao: AvaliacaoAdvogado = {
      nota: notaAdv,
      observacao: obsAdv || undefined,
      contratariaNovamente: contratarNovamente,
    }
    finalizarCiclo(id, avaliacao)
    setModalFinalizar(false)
  }

  // Itens de upload da seção de documentos
  const itensUpload = [
    { campo: 'contratoAssinado' as const, label: 'Contrato assinado', descricao: 'Contrato assinado pelo advogado' },
    { campo: 'comprovanteServico' as const, label: 'Comprovante de serviço', descricao: 'Arquivo da advogada comprovando a realização' },
    { campo: 'comprovantePagamento' as const, label: 'Comprovante de pagamento', descricao: 'Recibo/comprovante do pagamento efetuado' },
    { campo: 'reciboAssinado' as const, label: 'Recibo assinado', descricao: 'Recibo assinado pelo advogado' },
  ]

  // Verifica quantos documentos estão anexados com URL real
  const totalDocs = itensUpload.filter((i) => !!d.anexos[i.campo]).length

  async function handleEnviarContratoZapSign() {
    if (!adv) { addToast('error', 'Advogado não encontrado para esta diligência.'); return }
    setEnviandoContratoZap(true)
    try {
      // Regenera o PDF como base64 (sem disparar download — já foi baixado antes)
      const { filename, base64 } = gerarContratoBase64Only(d!, adv)
      const res = await fetch('/api/zapsign/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64: base64,
          filename,
          tipo: 'contrato',
          diligenciaId: id,
          nomeAdvogado: adv.nomeCompleto,
          whatsappAdvogado: adv.whatsapp,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        addToast('error', `ZapSign: ${errData.error ?? 'Falha ao enviar contrato.'}`)
        console.error('[zapsign contrato]', errData)
        return
      }
      const zapResult: EnviarZapSignResult = await res.json()
      // Persiste no banco — d.linkAssinaturaAdvogadoContrato é derivado do contexto após o update
      await updateDiligencia(id, {
        zapsignDocumentIdContrato: zapResult.documentToken,
        linkAssinaturaAdriana: zapResult.linkAdriana,
        linkAssinaturaAdvogadoContrato: zapResult.linkAdvogado,
        statusAssinaturaContrato: 'pendente',
      })
      addToast('success', 'Contrato enviado para assinatura. Use o botão de WhatsApp para enviar o link.')
    } catch (err) {
      addToast('error', 'Erro ao enviar contrato para assinatura.')
      console.error('[zapsign contrato]', err)
    } finally {
      setEnviandoContratoZap(false)
    }
  }

  async function handleEnviarReciboZapSign() {
    if (!adv) { addToast('error', 'Advogado não encontrado para esta diligência.'); return }
    setEnviandoReciboZap(true)
    try {
      // Regenera o PDF como base64 (sem disparar download)
      const { filename, base64 } = gerarReciboBase64Only(d!, adv)
      const res = await fetch('/api/zapsign/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64: base64,
          filename,
          tipo: 'recibo',
          diligenciaId: id,
          nomeAdvogado: adv.nomeCompleto,
          whatsappAdvogado: adv.whatsapp,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        addToast('error', `ZapSign: ${errData.error ?? 'Falha ao enviar recibo.'}`)
        console.error('[zapsign recibo]', errData)
        return
      }
      const zapResult: EnviarZapSignResult = await res.json()
      // Persiste no banco — d.linkAssinaturaAdvogadoRecibo é derivado do contexto após o update
      await updateDiligencia(id, {
        zapsignDocumentIdRecibo: zapResult.documentToken,
        linkAssinaturaAdvogadoRecibo: zapResult.linkAdvogado,
        statusAssinaturaRecibo: 'pendente',
      })
      addToast('success', 'Recibo enviado para assinatura. Use o botão de WhatsApp para enviar o link.')
    } catch (err) {
      addToast('error', 'Erro ao enviar recibo para assinatura.')
      console.error('[zapsign recibo]', err)
    } finally {
      setEnviandoReciboZap(false)
    }
  }

  async function handleGerarContrato() {
    if (!adv) { addToast('error', 'Advogado não encontrado para esta diligência.'); return }
    setGerandoContrato(true)
    try {
      const filename = gerarContratoPDF(d!, adv)
      atualizarAnexo(id, 'contratoGerado', filename)
      addToast('success', 'Contrato gerado com sucesso.')
    } catch (err) {
      addToast('error', 'Erro ao gerar contrato.')
      console.error('[gerar contrato]', err)
    } finally {
      setGerandoContrato(false)
    }
  }

  async function handleGerarRecibo() {
    if (!adv) { addToast('error', 'Advogado não encontrado para esta diligência.'); return }
    setGerandoRecibo(true)
    try {
      const filename = gerarReciboPDF(d!, adv)
      atualizarAnexo(id, 'reciboGerado', filename)
      addToast('success', 'Recibo gerado com sucesso.')
    } catch (err) {
      addToast('error', 'Erro ao gerar recibo.')
      console.error('[gerar recibo]', err)
    } finally {
      setGerandoRecibo(false)
    }
  }

  async function handleBaixarPDF() {
    const dLocal = d!   // seguro: função só é acessível após o guard `if (!d) return`
    const itens = itensUpload
      .filter((i) => {
        const url = dLocal.anexos[i.campo]
        return url && url.startsWith('http')
      })
      .map((i) => ({
        url: dLocal.anexos[i.campo]!,
        nome: i.label,
      }))

    if (itens.length === 0) return

    setPdfLoading(true)
    setPdfErro(null)
    try {
      await gerarPDFFinal(dLocal.ccc, itens)
    } catch (err) {
      setPdfErro((err as Error).message)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Navegação */}
      <div className="flex items-center gap-2">
        <Link href="/diligencias">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-800 truncate">{d.vitima}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-blue-600 font-mono">{d.ccc}</p>
            <EmpresaBadge empresaCliente={d.empresaCliente} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {d.cicloFinalizado && !temPendenciaDocumental && <Badge variant="success">Ciclo finalizado</Badge>}
          {temPendenciaDocumental && <Badge variant="warning">Pendência documental</Badge>}
          <Link href={`/diligencias/${id}/editar`}>
            <Button variant="secondary" size="sm"><Edit className="w-3.5 h-3.5" /> Editar</Button>
          </Link>
        </div>
      </div>

      {/* ── STICKY ACTION BAR ── */}
      <div className="sticky top-0 z-20 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex flex-wrap gap-2 items-center">

        {/* ── Grupo 1: Documentos e assinatura ── */}
        {!isRemoto && (
          <Button variant="secondary" size="sm" loading={gerandoContrato} onClick={handleGerarContrato}>
            <FileText className="w-3.5 h-3.5" /> Gerar contrato
          </Button>
        )}
        {!isRemoto && (
          <Button variant="secondary" size="sm" loading={gerandoRecibo} onClick={handleGerarRecibo}>
            <FileText className="w-3.5 h-3.5" /> Gerar recibo
          </Button>
        )}
        {!isRemoto && d.anexos.contratoGerado && !d.statusAssinaturaContrato && (
          <Button variant="secondary" size="sm" loading={enviandoContratoZap} onClick={handleEnviarContratoZapSign}>
            <Send className="w-3.5 h-3.5" /> Enviar contrato p/ assinatura
          </Button>
        )}
        {!isRemoto && d.anexos.reciboGerado && !d.statusAssinaturaRecibo && (
          <Button variant="secondary" size="sm" loading={enviandoReciboZap} onClick={handleEnviarReciboZapSign}>
            <Send className="w-3.5 h-3.5" /> Enviar recibo p/ assinatura
          </Button>
        )}
        {d.linkAssinaturaAdriana && whatsappZapAdriana && d.statusAssinaturaContrato !== 'assinado' && (
          <a href={whatsappZapAdriana} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm">
              <MessageCircle className="w-3.5 h-3.5 text-green-600" /> WA Adriana — contrato
            </Button>
          </a>
        )}
        {linkContratoZap && whatsappZapContrato && d.statusAssinaturaContrato !== 'assinado' && (
          <a href={whatsappZapContrato} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm">
              <MessageCircle className="w-3.5 h-3.5 text-green-600" /> WA advogado — contrato
            </Button>
          </a>
        )}
        {linkReciboZap && whatsappZapRecibo && d.statusAssinaturaRecibo !== 'assinado' && (
          <a href={whatsappZapRecibo} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm">
              <MessageCircle className="w-3.5 h-3.5 text-green-600" /> WA advogado — recibo
            </Button>
          </a>
        )}

        {/* Divisor visual */}
        {!isRemoto && <span className="w-px h-5 bg-slate-200 mx-1 flex-shrink-0" />}

        {/* ── Grupo 2: Ações operacionais ── */}
        {d.status !== StatusDiligencia.Realizada && (
          <Button variant="success" size="sm" onClick={() => setModalRealizada(true)}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Marcar realizada
          </Button>
        )}
        {d.status === StatusDiligencia.Realizada && !d.anexos.comprovanteServico && !isRemoto && (
          <Button variant="secondary" size="sm" onClick={() => handleUpload('comprovanteServico')}>
            <Upload className="w-3.5 h-3.5" /> Comprov. serviço
          </Button>
        )}
        {d.statusPagamento !== StatusPagamento.Pago && !isRemoto && (
          <Button variant="primary" size="sm" onClick={() => setModalPago(true)}>
            <DollarSign className="w-3.5 h-3.5" /> Registrar pagamento
          </Button>
        )}
        {d.statusPagamento === StatusPagamento.Pago && !d.anexos.comprovantePagamento && !isRemoto && (
          <Button variant="secondary" size="sm" onClick={() => handleUpload('comprovantePagamento')}>
            <Upload className="w-3.5 h-3.5" /> Comprov. pgto
          </Button>
        )}
        {podeFinalizar && (
          <Button variant="success" size="sm" onClick={() => {
            if (pendenciasDocumentais.length > 0) setModalPendencia(true)
            else setModalFinalizar(true)
          }}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Finalizar ciclo
          </Button>
        )}

        {/* ── Grupo 3: Contatos — empurrado para a direita ── */}
        <span className="flex-1" />
        {adv && (
          <a href={whatsappAdv} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm">
              <MessageCircle className="w-3.5 h-3.5 text-green-600" /> WA advogado
            </Button>
          </a>
        )}
        {!isRemoto && (
          <Link href={`/pesquisa/${id}`}>
            <Button variant="ghost" size="sm">
              <Phone className="w-3.5 h-3.5" /> Pesquisa
            </Button>
          </Link>
        )}
        <a href={whatsappVitima} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">
            <MessageCircle className="w-3.5 h-3.5 text-green-600" /> WA vítima
          </Button>
        </a>
      </div>

      {/* Tipo + Progresso */}
      <div className="space-y-3 px-1">
        {/* Badges secundários: tipo e status operacionais */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Tipo:</span>
          <Badge variant={d.modoDiligencia === 'Presencial' ? 'default' : 'info'}>
            {d.modoDiligencia}
          </Badge>
          <span className="text-slate-200 select-none">|</span>
          {!isRemoto && <StatusPagamentoBadge status={d.statusPagamento} />}
          <StatusPesquisaBadge status={d.pesquisa.status} />
        </div>

        {/* Indicador de progresso */}
        <DiligenciaProgressBar d={d} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Vítima */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-400" /><CardTitle>Dados da Vítima</CardTitle></div>
          </CardHeader>
          <CardBody className="space-y-3">
            <DR label="Nome" value={d.vitima} />
            <DR label="Cargo" value={d.cargo} />
            <DR label="Empresa" value={d.empresa} />
            <DR label="Telefone" value={
              <a href={`tel:${d.telefoneVitima}`} className="flex items-center gap-1.5 text-blue-600 hover:underline">
                <Phone className="w-3.5 h-3.5" />{formatPhone(d.telefoneVitima)}
              </a>
            } />
            <DR label="Cidade/UF" value={<span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" />{d.cidade}/{d.uf}</span>} />
            {d.dpRegistrou && <DR label="DP" value={d.dpRegistrou} />}
          </CardBody>
        </Card>

        {/* Evento */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Building className="w-4 h-4 text-slate-400" /><CardTitle>Dados do Evento</CardTitle></div>
          </CardHeader>
          <CardBody className="space-y-3">
            <DR label="CCC" value={<span className="font-mono text-blue-700">{d.ccc}</span>} />
            <DR label="Tipo de evento" value={d.tipoEvento} />
            <DR label="Tipo de diligência" value={d.tipoDiligencia} />
            <DR label="Modo" value={d.modoDiligencia} />
            <DR label="Valor" value={<span className="font-semibold">{formatCurrency(d.valorDiligencia)}</span>} />
            {d.observacoes && <DR label="Observações" value={d.observacoes} />}
          </CardBody>
        </Card>

        {/* Advogado */}
        {adv && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-400" /><CardTitle>Advogado</CardTitle></div>
                <Link href={`/advogados/${adv.id}`}><Button variant="ghost" size="sm"><ExternalLink className="w-3.5 h-3.5" /></Button></Link>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <DR label="Nome" value={adv.nomeCompleto} />
              {adv.cpf && <DR label="CPF" value={formatCPF(adv.cpf)} />}
              <DR label="OAB" value={adv.oab} />
              <DR label="WhatsApp" value={
                <a href={`https://wa.me/55${(adv.whatsapp || adv.telefone).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-green-600 hover:underline">
                  <MessageCircle className="w-3.5 h-3.5" />{formatPhone(adv.whatsapp || adv.telefone)}
                </a>
              } />
              <DR label="Pix" value={adv.chavePix} />
              {d.avaliacao && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-medium text-slate-400 mb-1">Avaliação</p>
                  <div className="flex items-center gap-1 mb-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`w-4 h-4 ${n <= d.avaliacao!.nota ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                    ))}
                    <span className="text-xs text-slate-500 ml-1">{NOTA_LABELS[d.avaliacao.nota]}</span>
                  </div>
                  {d.avaliacao.observacao && <p className="text-xs text-slate-600 italic">"{d.avaliacao.observacao}"</p>}
                  {d.avaliacao.contratariaNovamente !== undefined && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Contrataria novamente: <strong>{d.avaliacao.contratariaNovamente ? 'Sim' : 'Não'}</strong>
                    </p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* Pesquisa */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-slate-400" /><CardTitle>Pesquisa</CardTitle></div>
              <Link href={`/pesquisa/${id}`}><Button variant="ghost" size="sm">Gerenciar</Button></Link>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <StatusPesquisaBadge status={d.pesquisa.status} />
            {d.pesquisa.dataEnvioWhatsApp && <DR label="WA enviado" value={formatDate(d.pesquisa.dataEnvioWhatsApp)} />}
            {d.pesquisa.dataCombinada && <DR label="Retorno" value={formatDate(d.pesquisa.dataCombinada)} />}
            {d.pesquisa.respostaVitima && <DR label="Resposta" value={d.pesquisa.respostaVitima} />}
          </CardBody>
        </Card>
      </div>

      {/* ── DOCUMENTOS E COMPROVANTES ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-400" />
              <CardTitle>Documentos e Comprovantes</CardTitle>
              <span className="text-xs text-slate-400">({totalDocs}/{itensUpload.length} anexados)</span>
            </div>
            {totalDocs > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDownloads((v) => !v)}
                >
                  <FileText className="w-3.5 h-3.5" />
                  {showDownloads ? 'Ocultar links' : 'Links individuais'}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleBaixarPDF}
                  disabled={pdfLoading}
                >
                  {pdfLoading
                    ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Gerando PDF...</>
                    : <><Download className="w-3.5 h-3.5" /> Baixar PDF final</>
                  }
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {/* Erro do PDF */}
          {pdfErro && (
            <div className="mb-3 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {pdfErro}
              <button className="ml-auto text-red-500 hover:text-red-700" onClick={() => setPdfErro(null)}>✕</button>
            </div>
          )}

          {/* Painel de links individuais */}
          {showDownloads && totalDocs > 0 && (
            <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Links de download</p>
              {itensUpload.map((item) => {
                const url = d.anexos[item.campo]
                if (!url) return null
                const isUrl = url.startsWith('http')
                return (
                  <div key={item.campo} className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    {isUrl ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="text-sm text-blue-600 hover:underline truncate flex-1"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <span className="text-sm text-slate-500 truncate flex-1">{item.label} — {url}</span>
                    )}
                    {isUrl && (
                      <a href={url} target="_blank" rel="noopener noreferrer" download>
                        <Download className="w-3.5 h-3.5 text-slate-400 hover:text-blue-600" />
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {itensUpload.map((item) => {
              const valor = d.anexos[item.campo]
              const estado = uploadState[item.campo] ?? 'idle'
              const uploading = estado === 'uploading'
              const erro = estado === 'error'
              return (
                <div
                  key={item.campo}
                  className={`border rounded-xl p-3.5 flex items-start gap-3 ${
                    uploading ? 'border-blue-200 bg-blue-50'
                    : erro ? 'border-red-200 bg-red-50'
                    : valor ? 'border-emerald-200 bg-emerald-50'
                    : 'border-dashed border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className={`mt-0.5 rounded-lg p-1.5 ${
                    uploading ? 'bg-blue-100'
                    : erro ? 'bg-red-100'
                    : valor ? 'bg-emerald-100'
                    : 'bg-slate-100'
                  }`}>
                    {uploading
                      ? <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      : valor
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      : <FileText className="w-4 h-4 text-slate-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${
                      uploading ? 'text-blue-800'
                      : erro ? 'text-red-700'
                      : valor ? 'text-emerald-800'
                      : 'text-slate-700'
                    }`}>{item.label}</p>

                    {uploading && <p className="text-xs text-blue-600 mt-0.5">Enviando...</p>}
                    {erro && <p className="text-xs text-red-600 mt-0.5">Erro no upload. Tente novamente.</p>}
                    {!uploading && !erro && valor && (
                      valor.startsWith('http') ? (
                        <a
                          href={valor}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-600 hover:underline truncate block mt-0.5"
                          title={valor}
                        >
                          Arquivo anexado — ver
                        </a>
                      ) : (
                        <p className="text-xs text-emerald-600 truncate mt-0.5" title={valor}>{valor}</p>
                      )
                    )}
                    {!uploading && !erro && !valor && (
                      <p className="text-xs text-slate-400 mt-0.5">{item.descricao}</p>
                    )}

                    <div className="mt-2">
                      <button
                        disabled={uploading}
                        onClick={() => handleUpload(item.campo)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          uploading ? 'bg-blue-100 text-blue-700'
                          : valor ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        <Upload className="w-3 h-3 inline mr-1" />
                        {uploading ? 'Enviando...' : valor ? 'Substituir' : 'Anexar'}
                      </button>
                    </div>
                  </div>

                  {/* Input file oculto */}
                  <input
                    ref={(el) => { inputRefs.current[item.campo] = el }}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    onChange={(e) => handleFileChange(item.campo, e.target.files?.[0])}
                  />
                </div>
              )
            })}
          </div>

          {/* Contrato e recibo gerados (somente status — geração via /documentos) */}
          {(d.anexos.contratoGerado || d.anexos.reciboGerado) && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 mb-2">Gerados automaticamente</p>
              <div className="flex flex-wrap gap-2">
                {d.anexos.contratoGerado && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Contrato gerado
                  </span>
                )}
                {d.anexos.reciboGerado && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Recibo gerado
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ZapSign — status de assinatura digital (lê do DB — persiste entre recarregamentos) */}
          {(d.statusAssinaturaContrato || d.statusAssinaturaRecibo) && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 mb-2">Assinatura digital (ZapSign)</p>
              <div className="space-y-2">
                {d.statusAssinaturaContrato && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {d.statusAssinaturaContrato === 'assinado' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3 h-3" /> Contrato assinado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg">
                        <Send className="w-3 h-3" /> Contrato enviado — aguardando assinatura
                      </span>
                    )}
                    {d.anexos.contratoAssinado && (
                      <a href={d.anexos.contratoAssinado} target="_blank" rel="noopener noreferrer">
                        <button className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                          <Download className="w-3 h-3" /> Baixar assinado
                        </button>
                      </a>
                    )}
                    {whatsappZapContrato && d.statusAssinaturaContrato !== 'assinado' && (
                      <a href={whatsappZapContrato} target="_blank" rel="noopener noreferrer">
                        <button className="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium px-2 py-1 rounded-lg hover:bg-green-50 transition-colors">
                          <MessageCircle className="w-3 h-3" /> WA advogado
                        </button>
                      </a>
                    )}
                    {whatsappZapAdriana && d.statusAssinaturaContrato !== 'assinado' && (
                      <a href={whatsappZapAdriana} target="_blank" rel="noopener noreferrer">
                        <button className="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium px-2 py-1 rounded-lg hover:bg-green-50 transition-colors">
                          <MessageCircle className="w-3 h-3" /> WA Adriana
                        </button>
                      </a>
                    )}
                  </div>
                )}
                {d.statusAssinaturaRecibo && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {d.statusAssinaturaRecibo === 'assinado' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3 h-3" /> Recibo assinado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg">
                        <Send className="w-3 h-3" /> Recibo enviado — aguardando assinatura
                      </span>
                    )}
                    {d.anexos.reciboAssinado && (
                      <a href={d.anexos.reciboAssinado} target="_blank" rel="noopener noreferrer">
                        <button className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                          <Download className="w-3 h-3" /> Baixar assinado
                        </button>
                      </a>
                    )}
                    {whatsappZapRecibo && d.statusAssinaturaRecibo !== 'assinado' && (
                      <a href={whatsappZapRecibo} target="_blank" rel="noopener noreferrer">
                        <button className="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium px-2 py-1 rounded-lg hover:bg-green-50 transition-colors">
                          <MessageCircle className="w-3 h-3" /> WA advogado
                        </button>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* CCC histórico */}
      <CCCHistorico ccc={d.ccc} diligenciaAtualId={id} todasDiligencias={diligencias} />

      {/* Observação interna */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <CardTitle>Observação interna</CardTitle>
            </div>
            {!editandoObs && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setObsInterna(d.observacaoInterna ?? ''); setEditandoObs(true) }}
              >
                <Edit className="w-3.5 h-3.5" /> {d.observacaoInterna ? 'Editar' : 'Adicionar'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {editandoObs ? (
            <div className="space-y-3">
              <Textarea
                label=""
                value={obsInterna}
                onChange={(e) => setObsInterna(e.target.value)}
                placeholder="Anotações internas — não aparecem no contrato nem no recibo."
                rows={4}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditandoObs(false)}
                  disabled={salvandoObs}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={salvandoObs}
                  onClick={async () => {
                    setSalvandoObs(true)
                    try {
                      await updateDiligencia(id, { observacaoInterna: obsInterna || undefined })
                      setEditandoObs(false)
                    } finally {
                      setSalvandoObs(false)
                    }
                  }}
                >
                  {salvandoObs ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          ) : d.observacaoInterna ? (
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{d.observacaoInterna}</p>
          ) : (
            <p className="text-sm text-slate-400 italic">Nenhuma observação interna registrada.</p>
          )}
        </CardBody>
      </Card>

      {/* Nova diligência CCC */}
      <div className="pb-6">
        <Link href={`/diligencias/nova?ccc=${d.ccc}&empresa=${encodeURIComponent(d.empresa)}`}>
          <Button variant="secondary" size="sm">
            <Plus className="w-3.5 h-3.5" /> Nova diligência para {d.ccc}
          </Button>
        </Link>
      </div>

      {/* Modal pendência documental — antes de finalizar */}
      <Modal open={modalPendencia} onClose={() => setModalPendencia(false)} title="Pendências documentais" size="sm">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 mb-1">Faltam os seguintes documentos:</p>
              <ul className="space-y-0.5">
                {pendenciasDocumentais.map((p) => (
                  <li key={p} className="text-sm text-amber-700">• {p}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-xs text-slate-500">Você pode voltar e anexar os documentos, ou concluir mesmo assim — a diligência ficará marcada com pendência documental.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setModalPendencia(false)}>Voltar e anexar</Button>
            <Button variant="warning" size="sm" onClick={() => { setModalPendencia(false); setModalFinalizar(true) }}>Concluir mesmo assim</Button>
          </div>
        </div>
      </Modal>

      {/* Modal confirmar realização */}
      <Modal open={modalRealizada} onClose={() => setModalRealizada(false)} title="Confirmar realização" size="sm">
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">Confirma que a diligência foi <strong>realizada</strong>?</p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setModalRealizada(false)}>Cancelar</Button>
            <Button variant="success" size="sm" onClick={() => { marcarRealizada(id); setModalRealizada(false) }}>Confirmar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal registrar pagamento */}
      <Modal open={modalPago} onClose={() => setModalPago(false)} title="Registrar pagamento" size="sm">
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">Confirma pagamento de <strong>{formatCurrency(d.valorDiligencia)}</strong>?</p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setModalPago(false)}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={() => { marcarPago(id); setModalPago(false) }}>Confirmar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal finalizar ciclo com avaliação do advogado */}
      <Modal open={modalFinalizar} onClose={() => setModalFinalizar(false)} title="Finalizar ciclo" size="md">
        <div className="p-5 space-y-5">
          <p className="text-sm text-slate-600">Antes de finalizar, avalie o desempenho do advogado:</p>

          {/* Nota */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">
              Nota do advogado <span className="text-red-500">*</span>
            </p>
            <div className="flex gap-2">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNotaAdv(n)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-medium transition-colors ${
                    notaAdv === n
                      ? 'border-amber-400 bg-amber-50 text-amber-800'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <Star className={`w-5 h-5 ${notaAdv !== null && n <= notaAdv ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                  {n}
                </button>
              ))}
            </div>
            {notaAdv && (
              <p className="text-xs text-amber-700 mt-1.5 text-center font-medium">{NOTA_LABELS[notaAdv]}</p>
            )}
          </div>

          {/* Observação */}
          <Textarea
            label="Observação"
            value={obsAdv}
            onChange={(e) => setObsAdv(e.target.value)}
            placeholder="Pontualidade, qualidade do serviço, comunicação..."
            rows={3}
          />

          {/* Contrataria novamente */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Contrataria novamente? <span className="text-slate-400">(opcional)</span></p>
            <div className="flex gap-2">
              {[
                { value: true, label: 'Sim' },
                { value: false, label: 'Não' },
              ].map((op) => (
                <button
                  key={String(op.value)}
                  type="button"
                  onClick={() => setContratarNovamente(contratarNovamente === op.value ? undefined : op.value)}
                  className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors ${
                    contratarNovamente === op.value
                      ? op.value ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-800'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" size="sm" onClick={() => setModalFinalizar(false)}>Cancelar</Button>
            <Button
              variant="success"
              size="sm"
              onClick={handleFinalizar}
              disabled={!notaAdv}
            >
              Finalizar ciclo
            </Button>
          </div>
          {!notaAdv && (
            <p className="text-xs text-red-500 text-right -mt-3">Nota obrigatória para finalizar</p>
          )}
        </div>
      </Modal>
    </div>
  )
}

function DiligenciaProgressBar({ d }: { d: Diligencia }) {
  const atual = etapaAtual(d)
  const total = ETAPAS_PROGRESSO.length
  const todaConcluida = d.cicloFinalizado

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm">
      <div className="overflow-x-auto pb-1">
        <div className="flex items-start min-w-max">
          {ETAPAS_PROGRESSO.map((etapa, i) => {
            const done = todaConcluida || i < atual
            const active = !todaConcluida && i === atual
            return (
              <div key={i} className="flex items-start">
                {/* Etapa */}
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 flex-shrink-0 transition-all ${
                    done
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : active
                      ? 'bg-blue-600 border-blue-600 text-white ring-2 ring-offset-1 ring-blue-200'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}>
                    {done ? '✓' : i + 1}
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={`text-xs whitespace-nowrap text-center leading-tight ${
                      done ? 'text-emerald-600 font-medium'
                      : active ? 'text-blue-700 font-semibold'
                      : 'text-slate-400'
                    }`}>
                      {etapa.label}
                    </span>
                    {etapa.sub && (
                      <span className={`text-[10px] whitespace-nowrap text-center leading-tight ${
                        done ? 'text-emerald-400' : active ? 'text-blue-400' : 'text-slate-300'
                      }`}>
                        {etapa.sub}
                      </span>
                    )}
                  </div>
                </div>

                {/* Conector */}
                {i < total - 1 && (
                  <div className={`h-px w-10 mt-4 mx-2 flex-shrink-0 ${
                    todaConcluida || i < atual ? 'bg-emerald-400' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DR({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className="text-sm text-slate-800">{value || '—'}</span>
    </div>
  )
}
