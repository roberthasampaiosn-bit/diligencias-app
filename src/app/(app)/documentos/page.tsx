'use client'

import { useState, useMemo, Suspense, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  FileText, CheckCircle2, Upload, Download, ArrowRight, MessageCircle, PlusCircle, Clock,
} from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useAdvogados } from '@/context/AdvogadosContext'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { Modal } from '@/components/ui/Modal'
import { StatusDiligenciaBadge } from '@/components/shared/StatusBadge'
import { formatCurrency } from '@/lib/utils'
import { gerarContratoPDF, gerarReciboPDF, gerarContratoParaZapSign, gerarReciboParaZapSign, gerarContratoAvulsoParaZapSign, gerarReciboAvulsoParaZapSign } from '@/lib/pdf'
import { buildWhatsAppZapSign, buildWhatsAppAdriana } from '@/services/zapsignService'
import { fetchDocumentosAvulsos, insertDocumentoAvulso } from '@/services/documentosAvulsosDB'
import { Diligencia, Advogado, Anexos, DocumentoAvulso } from '@/types'
import type { EnviarZapSignResult } from '@/app/api/zapsign/enviar/route'

const CAMPOS_ANEXOS: { key: keyof Anexos; label: string; seq: number }[] = [
  { key: 'contratoGerado', label: 'Contrato gerado', seq: 1 },
  { key: 'contratoAssinado', label: 'Contrato assinado', seq: 2 },
  { key: 'reciboGerado', label: 'Recibo gerado', seq: 3 },
  { key: 'reciboAssinado', label: 'Recibo assinado', seq: 4 },
  { key: 'comprovantePagamento', label: 'Comprov. pagamento', seq: 5 },
  { key: 'comprovanteServico', label: 'Comprov. serviço', seq: 6 },
]

function getProgresso(anexos: Anexos): number {
  const preenchidos = CAMPOS_ANEXOS.filter((c) => !!anexos[c.key]).length
  return Math.round((preenchidos / CAMPOS_ANEXOS.length) * 100)
}

function getProximoPasso(anexos: Anexos): { key: keyof Anexos; label: string } | null {
  for (const c of CAMPOS_ANEXOS) {
    if (!anexos[c.key]) return c
  }
  return null
}

function podGerarPDF(anexos: Anexos): boolean {
  return CAMPOS_ANEXOS.every((c) => !!anexos[c.key])
}

// Passos que geram PDF real (os demais são "marcar como feito" / upload manual)
const GERA_PDF: Partial<Record<keyof Anexos, 'contrato' | 'recibo'>> = {
  contratoGerado: 'contrato',
  reciboGerado: 'recibo',
}

function rotuloBotaoProximo(key: keyof Anexos, label: string): string {
  if (key === 'contratoGerado') return 'Gerar + enviar ZapSign'
  if (key === 'reciboGerado') return 'Gerar + enviar ZapSign'
  return `Marcar: ${label}`
}

function rotuloBotaoModal(key: keyof Anexos, presente: boolean): string {
  if (key === 'contratoGerado') return presente ? 'Reenviar ZapSign' : 'Gerar + enviar ZapSign'
  if (key === 'reciboGerado') return presente ? 'Reenviar ZapSign' : 'Gerar + enviar ZapSign'
  return presente ? 'Marcar novamente' : 'Marcar como feito'
}

function DocumentosContent() {
  const searchParams = useSearchParams()
  const dilIdParam = searchParams.get('diligenciaId') || ''
  const { diligencias, atualizarAnexo, updateDiligencia } = useDiligencias()
  const { advogadoMap } = useAdvogados()
  const [search, setSearch] = useState('')
  const [modalDil, setModalDil] = useState<Diligencia | null>(null)
  const [gerando, setGerando] = useState<string | null>(null)

  // ── Estado modal avulso ───────────────────────────────────────────────────
  const [modalAvulso, setModalAvulso] = useState(false)
  const [avulsoAdvogadoId, setAvulsoAdvogadoId] = useState('')
  const [avulsoValor, setAvulsoValor] = useState('')
  const [avulsoTipo, setAvulsoTipo] = useState<'contrato' | 'recibo' | 'ambos'>('contrato')
  const [avulsoData, setAvulsoData] = useState('')
  const [avulsoServico, setAvulsoServico] = useState('')
  const [avulsoGerando, setAvulsoGerando] = useState(false)
  const [avulsoResultado, setAvulsoResultado] = useState<{
    contrato?: EnviarZapSignResult & { filename: string }
    recibo?: EnviarZapSignResult & { filename: string }
  } | null>(null)

  // ── Histórico de avulsos ──────────────────────────────────────────────────
  const [historico, setHistorico] = useState<DocumentoAvulso[]>([])
  const [modalHistorico, setModalHistorico] = useState(false)

  const carregarHistorico = useCallback(async () => {
    try {
      const docs = await fetchDocumentosAvulsos()
      setHistorico(docs)
    } catch {
      // falha silenciosa — histórico não bloqueia a página
    }
  }, [])

  useEffect(() => { carregarHistorico() }, [carregarHistorico])

  function abrirModalAvulso() {
    setAvulsoAdvogadoId('')
    setAvulsoValor('')
    setAvulsoTipo('contrato')
    setAvulsoData('')
    setAvulsoServico('')
    setAvulsoResultado(null)
    setModalAvulso(true)
  }

  async function handleGerarAvulso() {
    const adv = advogadoMap.get(avulsoAdvogadoId)
    if (!adv) { alert('Selecione um advogado.'); return }
    const valor = parseFloat(avulsoValor.replace(',', '.'))
    if (!valor || valor <= 0) { alert('Informe um valor válido.'); return }

    setAvulsoGerando(true)
    try {
      const dados = { valor, dataAtendimento: avulsoData || undefined, tipoServico: avulsoServico || undefined }
      const resultado: typeof avulsoResultado = {}

      if (avulsoTipo === 'contrato' || avulsoTipo === 'ambos') {
        const { filename, base64 } = gerarContratoAvulsoParaZapSign(dados, adv)
        const res = await fetch('/api/zapsign/enviar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64, filename, tipo: 'contrato', nomeAdvogado: adv.nomeCompleto, whatsappAdvogado: adv.whatsapp ?? '' }),
        })
        if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Erro' })); alert(`ZapSign contrato: ${e.error}`); return }
        resultado.contrato = { ...(await res.json() as EnviarZapSignResult), filename }
      }

      if (avulsoTipo === 'recibo' || avulsoTipo === 'ambos') {
        const { filename, base64 } = gerarReciboAvulsoParaZapSign(dados, adv)
        const res = await fetch('/api/zapsign/enviar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64, filename, tipo: 'recibo', nomeAdvogado: adv.nomeCompleto, whatsappAdvogado: adv.whatsapp ?? '' }),
        })
        if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Erro' })); alert(`ZapSign recibo: ${e.error}`); return }
        resultado.recibo = { ...(await res.json() as EnviarZapSignResult), filename }
      }

      setAvulsoResultado(resultado)

      // Persiste no banco para acesso posterior (inclusive no mobile)
      try {
        await insertDocumentoAvulso({
          advogadoId: adv.id,
          advogadoNome: adv.nomeCompleto,
          tipo: avulsoTipo,
          valor,
          dataAtendimento: avulsoData || undefined,
          tipoServico: avulsoServico || undefined,
          filenameContrato: resultado.contrato?.filename,
          zapsignTokenContrato: resultado.contrato?.documentToken,
          linkAssinaturaAdriana: resultado.contrato?.linkAdriana,
          linkAssinaturaAdvogadoContrato: resultado.contrato?.linkAdvogado,
          filenameRecibo: resultado.recibo?.filename,
          zapsignTokenRecibo: resultado.recibo?.documentToken,
          linkAssinaturaAdvogadoRecibo: resultado.recibo?.linkAdvogado,
        })
        await carregarHistorico()
      } catch {
        // falha silenciosa — resultado já está visível no modal
      }
    } finally {
      setAvulsoGerando(false)
    }
  }

  const lista = useMemo(() => {
    let l = dilIdParam ? diligencias.filter((d) => d.id === dilIdParam) : diligencias
    if (search) {
      const q = search.toLowerCase()
      l = l.filter((d) => d.vitima.toLowerCase().includes(q) || d.ccc.toLowerCase().includes(q))
    }
    return [...l].sort((a, b) => getProgresso(a.anexos) - getProgresso(b.anexos))
  }, [diligencias, search, dilIdParam])

  async function handleAcao(dilId: string, campo: keyof Anexos) {
    const tipo = GERA_PDF[campo]
    const diligencia = diligencias.find((d) => d.id === dilId)
    if (!diligencia) return

    if (tipo) {
      const adv: Advogado | undefined = advogadoMap.get(diligencia.advogadoId)
      if (!adv) {
        alert('Advogado não encontrado para esta diligência.')
        return
      }
      const key = `${dilId}-${campo}`
      setGerando(key)
      try {
        // Gera PDF, dispara download local e obtém base64 para ZapSign
        const { filename, base64 } =
          tipo === 'contrato'
            ? gerarContratoParaZapSign(diligencia, adv)
            : gerarReciboParaZapSign(diligencia, adv)

        // Marca o anexo *Gerado como feito imediatamente
        atualizarAnexo(dilId, campo, filename)

        // Envia para ZapSign via rota de API (token fica server-side)
        const res = await fetch('/api/zapsign/enviar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pdfBase64: base64,
            filename,
            tipo,
            diligenciaId: dilId,
            nomeAdvogado: adv.nomeCompleto,
            whatsappAdvogado: adv.whatsapp,
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
          alert(`ZapSign: ${errData.error ?? 'Falha ao enviar documento.'}`)
          return
        }

        const zapResult: EnviarZapSignResult = await res.json()

        // Persiste os dados ZapSign no banco + estado local
        if (tipo === 'contrato') {
          await updateDiligencia(dilId, {
            zapsignDocumentIdContrato: zapResult.documentToken,
            linkAssinaturaAdriana: zapResult.linkAdriana,
            linkAssinaturaAdvogadoContrato: zapResult.linkAdvogado,
            statusAssinaturaContrato: 'pendente',
          })
        } else {
          await updateDiligencia(dilId, {
            zapsignDocumentIdRecibo: zapResult.documentToken,
            linkAssinaturaAdvogadoRecibo: zapResult.linkAdvogado,
            statusAssinaturaRecibo: 'pendente',
          })
        }

        // Atualiza referência do modal se estiver aberto
        setModalDil((prev) => {
          if (!prev || prev.id !== dilId) return prev
          return diligencias.find((d) => d.id === dilId) ?? prev
        })
      } finally {
        setGerando(null)
      }
    } else {
      // Passos manuais: apenas marca como feito com placeholder
      atualizarAnexo(dilId, campo, `${campo}-${dilId}.pdf`)
      setModalDil((prev) => {
        if (!prev || prev.id !== dilId) return prev
        return diligencias.find((d) => d.id === dilId) ?? prev
      })
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Documentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Contratos, recibos e comprovantes por diligência</p>
        </div>
        <div className="flex gap-2">
          {historico.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setModalHistorico(true)}>
              <Clock className="w-4 h-4" />
              Avulsos ({historico.length})
            </Button>
          )}
          <Button size="sm" onClick={abrirModalAvulso}>
            <PlusCircle className="w-4 h-4" />
            Documento avulso
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar vítima, CCC..." className="sm:w-64" />
        </CardHeader>

        <CardBody className="p-0">
          <div className="divide-y divide-slate-50">
            {lista.map((d) => {
              const adv = advogadoMap.get(d.advogadoId)
              const prog = getProgresso(d.anexos)
              const proximo = getProximoPasso(d.anexos)
              const completo = podGerarPDF(d.anexos)
              return (
                <div key={d.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <Link href={`/diligencias/${d.id}`} className="font-semibold text-slate-800 hover:text-blue-600 text-sm">{d.vitima}</Link>
                        <StatusDiligenciaBadge status={d.status} />
                      </div>
                      <p className="text-xs font-mono text-blue-600">{d.ccc}</p>
                      <p className="text-xs text-slate-500">{adv?.nomeCompleto ?? '—'} · {formatCurrency(d.valorDiligencia)}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-slate-500 mb-0.5">{prog}% completo</p>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${completo ? 'bg-emerald-500' : prog >= 50 ? 'bg-amber-400' : 'bg-slate-300'}`}
                            style={{ width: `${prog}%` }}
                          />
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => setModalDil(d)}>
                        Gerenciar
                      </Button>
                    </div>
                  </div>

                  {/* Pipeline visual */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {CAMPOS_ANEXOS.map((c) => {
                      const ok = !!d.anexos[c.key]
                      const isNext = !ok && proximo?.key === c.key
                      return (
                        <div
                          key={c.key}
                          className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-center transition-colors ${
                            ok ? 'border-emerald-200 bg-emerald-50'
                            : isNext ? 'border-blue-300 bg-blue-50'
                            : 'border-dashed border-slate-200 bg-white'
                          }`}
                        >
                          {ok
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            : isNext
                            ? <ArrowRight className="w-4 h-4 text-blue-500" />
                            : <FileText className="w-4 h-4 text-slate-300" />
                          }
                          <span className="text-xs text-slate-500 leading-tight">{c.label}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Próximo passo rápido */}
                  {proximo && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-500">Próximo:</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={gerando === `${d.id}-${proximo.key}`}
                        onClick={() => handleAcao(d.id, proximo.key)}
                      >
                        {GERA_PDF[proximo.key]
                          ? <Download className="w-3.5 h-3.5" />
                          : <Upload className="w-3.5 h-3.5" />
                        }
                        {rotuloBotaoProximo(proximo.key, proximo.label)}
                      </Button>

                      {/* Botões WhatsApp após gerar contrato */}
                      {proximo.key === 'contratoAssinado' && d.linkAssinaturaAdriana && adv && (
                        <>
                          <a
                            href={buildWhatsAppAdriana(d.ccc, 'contrato', d.linkAssinaturaAdriana)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="secondary">
                              <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                              WhatsApp Adriana
                            </Button>
                          </a>
                          {d.linkAssinaturaAdvogadoContrato && (
                            <a
                              href={buildWhatsAppZapSign(adv.whatsapp, adv.nomeCompleto, d.ccc, 'contrato', d.linkAssinaturaAdvogadoContrato)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button size="sm" variant="secondary">
                                <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                                WhatsApp Advogado
                              </Button>
                            </a>
                          )}
                        </>
                      )}

                      {/* Botão WhatsApp após gerar recibo */}
                      {proximo.key === 'reciboAssinado' && d.linkAssinaturaAdvogadoRecibo && adv && (
                        <a
                          href={buildWhatsAppZapSign(adv.whatsapp, adv.nomeCompleto, d.ccc, 'recibo', d.linkAssinaturaAdvogadoRecibo)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" variant="secondary">
                            <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                            WhatsApp Advogado
                          </Button>
                        </a>
                      )}
                    </div>
                  )}

                  {completo && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      Todos os documentos concluídos
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardBody>
      </Card>

      {/* Modal gerenciar */}
      <Modal open={!!modalDil} onClose={() => setModalDil(null)} title={`Documentos — ${modalDil?.vitima}`} size="lg">
        {modalDil && (() => {
          const currentDil = diligencias.find((d) => d.id === modalDil.id) ?? modalDil
          const adv = advogadoMap.get(currentDil.advogadoId)
          return (
            <div className="p-5 space-y-3">
              {CAMPOS_ANEXOS.map((c, i) => {
                const presente = !!currentDil.anexos[c.key]
                const prevDone = i === 0 || !!currentDil.anexos[CAMPOS_ANEXOS[i - 1].key]
                const bloqueado = !presente && !prevDone
                const isGerador = !!GERA_PDF[c.key]
                const loading = gerando === `${currentDil.id}-${c.key}`
                return (
                  <div key={c.key} className={`flex flex-col gap-2 py-3 border-b border-slate-50 last:border-0 ${bloqueado ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${presente ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          {c.seq}
                        </div>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${presente ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                          {presente ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <FileText className="w-4 h-4 text-slate-400" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">{c.label}</p>
                          {presente && <p className="text-xs text-emerald-600 truncate max-w-[200px]">{currentDil.anexos[c.key]}</p>}
                          {bloqueado && <p className="text-xs text-slate-400">Complete o passo anterior primeiro</p>}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {!bloqueado && (
                          <Button
                            size="sm"
                            variant={isGerador ? 'secondary' : 'ghost'}
                            loading={loading}
                            onClick={() => handleAcao(currentDil.id, c.key)}
                          >
                            {isGerador
                              ? <Download className="w-3.5 h-3.5" />
                              : <Upload className="w-3.5 h-3.5" />
                            }
                            {rotuloBotaoModal(c.key, presente)}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Botões WhatsApp — contrato */}
                    {c.key === 'contratoGerado' && presente && (
                      <div className="flex gap-2 flex-wrap pl-16">
                        {currentDil.linkAssinaturaAdriana && (
                          <a
                            href={buildWhatsAppAdriana(currentDil.ccc, 'contrato', currentDil.linkAssinaturaAdriana)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="ghost">
                              <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                              WhatsApp Adriana
                            </Button>
                          </a>
                        )}
                        {currentDil.linkAssinaturaAdvogadoContrato && adv && (
                          <a
                            href={buildWhatsAppZapSign(adv.whatsapp, adv.nomeCompleto, currentDil.ccc, 'contrato', currentDil.linkAssinaturaAdvogadoContrato)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="ghost">
                              <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                              WhatsApp Advogado
                            </Button>
                          </a>
                        )}
                        {currentDil.statusAssinaturaContrato === 'assinado' && (
                          <span className="text-xs text-emerald-600 flex items-center gap-1 self-center">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Contrato assinado
                          </span>
                        )}
                      </div>
                    )}

                    {/* Botões WhatsApp — recibo */}
                    {c.key === 'reciboGerado' && presente && (
                      <div className="flex gap-2 flex-wrap pl-16">
                        {currentDil.linkAssinaturaAdvogadoRecibo && adv && (
                          <a
                            href={buildWhatsAppZapSign(adv.whatsapp, adv.nomeCompleto, currentDil.ccc, 'recibo', currentDil.linkAssinaturaAdvogadoRecibo)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="ghost">
                              <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                              WhatsApp Advogado
                            </Button>
                          </a>
                        )}
                        {currentDil.statusAssinaturaRecibo === 'assinado' && (
                          <span className="text-xs text-emerald-600 flex items-center gap-1 self-center">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Recibo assinado
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })()}
      </Modal>


      {/* ── Modal Histórico de Avulsos ───────────────────────────────────── */}
      <Modal open={modalHistorico} onClose={() => setModalHistorico(false)} title="Documentos avulsos gerados" size="lg">
        <div className="p-5 space-y-3">
          {historico.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhum documento avulso gerado ainda.</p>
          ) : (
            historico.map((doc) => {
              const adv = advogadoMap.get(doc.advogadoId ?? '')
              const data = new Date(doc.createdAt).toLocaleDateString('pt-BR')
              return (
                <div key={doc.id} className="border border-slate-100 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{doc.advogadoNome}</p>
                      <p className="text-xs text-slate-400">{data} · {formatCurrency(doc.valor)}{doc.tipoServico ? ` · ${doc.tipoServico}` : ''}</p>
                    </div>
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 rounded-full px-2.5 py-1 capitalize flex-shrink-0">{doc.tipo}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap pt-1">
                    {doc.linkAssinaturaAdriana && (
                      <a href={buildWhatsAppAdriana('AVULSO', 'contrato', doc.linkAssinaturaAdriana)} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="secondary">
                          <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                          WhatsApp Adriana
                        </Button>
                      </a>
                    )}
                    {doc.linkAssinaturaAdvogadoContrato && (
                      <a href={buildWhatsAppZapSign(adv?.whatsapp, doc.advogadoNome, 'AVULSO', 'contrato', doc.linkAssinaturaAdvogadoContrato)} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="secondary">
                          <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                          WA Advogado (contrato)
                        </Button>
                      </a>
                    )}
                    {doc.linkAssinaturaAdvogadoRecibo && (
                      <a href={buildWhatsAppZapSign(adv?.whatsapp, doc.advogadoNome, 'AVULSO', 'recibo', doc.linkAssinaturaAdvogadoRecibo)} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="secondary">
                          <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                          WA Advogado (recibo)
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Modal>

      {/* ── Modal Documento Avulso ─────────────────────────────────────────── */}
      <Modal open={modalAvulso} onClose={() => setModalAvulso(false)} title="Novo documento avulso" size="lg">
        <div className="p-5 space-y-4">
          {!avulsoResultado ? (
            <>
              {/* Advogado */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600">Advogado</label>
                  <a href="/advogados/novo" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <PlusCircle className="w-3 h-3" /> Cadastrar novo
                  </a>
                </div>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={avulsoAdvogadoId}
                  onChange={(e) => setAvulsoAdvogadoId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {[...advogadoMap.values()].sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto)).map((adv) => (
                    <option key={adv.id} value={adv.id}>{adv.nomeCompleto}</option>
                  ))}
                </select>
              </div>

              {/* Painel de dados do advogado selecionado */}
              {avulsoAdvogadoId && (() => {
                const adv = advogadoMap.get(avulsoAdvogadoId)
                if (!adv) return null
                const precisaContrato = avulsoTipo === 'contrato' || avulsoTipo === 'ambos'
                const precisaRecibo   = avulsoTipo === 'recibo'   || avulsoTipo === 'ambos'
                const campos: { label: string; valor?: string; usadoEm: string }[] = [
                  { label: 'Nome completo', valor: adv.nomeCompleto, usadoEm: 'contrato e recibo' },
                  { label: 'CPF',          valor: adv.cpf,          usadoEm: 'contrato e recibo' },
                  { label: 'OAB',          valor: adv.oab,          usadoEm: 'contrato' },
                  { label: 'Endereço',     valor: adv.endereco,     usadoEm: 'contrato' },
                  { label: 'Chave PIX',    valor: adv.chavePix,     usadoEm: 'recibo' },
                  { label: 'WhatsApp',     valor: adv.whatsapp,     usadoEm: 'envio ZapSign' },
                ]
                const camposFiltrados = campos.filter((c) => {
                  if (c.usadoEm === 'contrato') return precisaContrato
                  if (c.usadoEm === 'recibo') return precisaRecibo
                  return true
                })
                const temFaltando = camposFiltrados.some((c) => !c.valor)
                return (
                  <div className={`rounded-lg border p-3 space-y-1.5 ${temFaltando ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-slate-600">Dados do advogado</p>
                      <a href={`/advogados/${adv.id}/editar`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                        Editar cadastro ↗
                      </a>
                    </div>
                    {camposFiltrados.map((c) => (
                      <div key={c.label} className="flex items-center gap-2 text-xs">
                        {c.valor
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          : <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 flex-shrink-0 inline-block" />
                        }
                        <span className="text-slate-500 w-24 flex-shrink-0">{c.label}</span>
                        <span className={c.valor ? 'text-slate-700 truncate' : 'text-amber-600 font-medium'}>
                          {c.valor || 'não preenchido'}
                        </span>
                      </div>
                    ))}
                    {temFaltando && (
                      <p className="text-xs text-amber-700 pt-1">Campos faltando serão deixados em branco no documento. Clique em "Editar cadastro" para completar.</p>
                    )}
                  </div>
                )
              })()}

              {/* Tipo de documento */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de documento</label>
                <div className="flex gap-2">
                  {(['contrato', 'recibo', 'ambos'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAvulsoTipo(t)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${avulsoTipo === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Valor */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Valor (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 350,00"
                  value={avulsoValor}
                  onChange={(e) => setAvulsoValor(e.target.value)}
                />
              </div>

              {/* Data de atendimento (recibo) */}
              {(avulsoTipo === 'recibo' || avulsoTipo === 'ambos') && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Data do serviço <span className="text-slate-400">(opcional)</span></label>
                  <input
                    type="date"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={avulsoData}
                    onChange={(e) => setAvulsoData(e.target.value)}
                  />
                </div>
              )}

              {/* Tipo de serviço (recibo) */}
              {(avulsoTipo === 'recibo' || avulsoTipo === 'ambos') && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de serviço <span className="text-slate-400">(opcional)</span></label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Registro de BO na DP"
                    value={avulsoServico}
                    onChange={(e) => setAvulsoServico(e.target.value)}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setModalAvulso(false)}>Cancelar</Button>
                <Button loading={avulsoGerando} onClick={handleGerarAvulso}>
                  <Download className="w-4 h-4" />
                  Gerar + enviar ZapSign
                </Button>
              </div>
            </>
          ) : (
            /* Resultado após geração */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600 font-medium">
                <CheckCircle2 className="w-5 h-5" />
                Documento(s) gerado(s) e enviado(s) ao ZapSign!
              </div>

              {avulsoResultado.contrato && (() => {
                const adv = advogadoMap.get(avulsoAdvogadoId)
                return (
                  <div className="border border-slate-100 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contrato</p>
                    <p className="text-xs text-slate-600 font-mono">{avulsoResultado.contrato.filename}</p>
                    <div className="flex gap-2 flex-wrap">
                      {avulsoResultado.contrato.linkAdriana && (
                        <a href={buildWhatsAppAdriana('AVULSO', 'contrato', avulsoResultado.contrato.linkAdriana)} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost"><MessageCircle className="w-3.5 h-3.5 text-green-600" />WhatsApp Adriana</Button>
                        </a>
                      )}
                      {adv && avulsoResultado.contrato.linkAdvogado && (
                        <a href={buildWhatsAppZapSign(adv.whatsapp, adv.nomeCompleto, 'AVULSO', 'contrato', avulsoResultado.contrato.linkAdvogado)} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost"><MessageCircle className="w-3.5 h-3.5 text-green-600" />WhatsApp Advogado</Button>
                        </a>
                      )}
                    </div>
                  </div>
                )
              })()}

              {avulsoResultado.recibo && (() => {
                const adv = advogadoMap.get(avulsoAdvogadoId)
                return (
                  <div className="border border-slate-100 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recibo</p>
                    <p className="text-xs text-slate-600 font-mono">{avulsoResultado.recibo.filename}</p>
                    <div className="flex gap-2 flex-wrap">
                      {adv && avulsoResultado.recibo.linkAdvogado && (
                        <a href={buildWhatsAppZapSign(adv.whatsapp, adv.nomeCompleto, 'AVULSO', 'recibo', avulsoResultado.recibo.linkAdvogado)} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost"><MessageCircle className="w-3.5 h-3.5 text-green-600" />WhatsApp Advogado</Button>
                        </a>
                      )}
                    </div>
                  </div>
                )
              })()}

              <div className="flex justify-end pt-2">
                <Button variant="ghost" onClick={() => setModalAvulso(false)}>Fechar</Button>
                <Button className="ml-2" onClick={abrirModalAvulso}>Novo avulso</Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default function DocumentosPage() {
  return <Suspense><DocumentosContent /></Suspense>
}
