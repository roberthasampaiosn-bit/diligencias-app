'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck, Copy, ExternalLink, FileSignature, MessageCircle, MinusCircle, Paperclip, RefreshCw, Send } from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useAdvogados } from '@/context/AdvogadosContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { documentosFaltando, formatCurrency, formatDate, tituloDiligencia, cn } from '@/lib/utils'
import { gerarContratoBase64Only, gerarReciboBase64Only } from '@/lib/pdf'
import { buildWhatsAppZapSign, buildWhatsAppLembreteZapSign, buildWhatsAppAdriana } from '@/services/zapsignService'
import type { EnviarZapSignResult } from '@/app/api/zapsign/enviar/route'
import type { StatusZapSignResult } from '@/app/api/zapsign/status/route'
import { Advogado, Anexos, Diligencia } from '@/types'

// "Resolver pendências": todas as diligências concluídas com documento faltando,
// por mês, com a ação de cada documento na própria linha — gerar e enviar
// contrato/recibo pela ZapSign, lembrar quem não assinou (advogado ou Adriana),
// puxar o assinado, anexar comprovantes ou marcar "não se aplica".
// Mesma regra do Dashboard (documentosFaltando), então os números batem.

type Campo = 'contratoAssinado' | 'reciboAssinado' | 'comprovantePagamento' | 'comprovanteServico'
const CAMPO_POR_ROTULO: Record<string, Campo> = {
  'Contrato assinado': 'contratoAssinado',
  'Recibo assinado': 'reciboAssinado',
  'Comprovante de pagamento': 'comprovantePagamento',
  'Comprovante de serviço': 'comprovanteServico',
}
const ROTULO_CURTO: Record<Campo, string> = {
  contratoAssinado: 'Contrato',
  reciboAssinado: 'Recibo',
  comprovantePagamento: 'Comprovante de pagamento',
  comprovanteServico: 'Comprovante de serviço',
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const mesDe = (d: Diligencia) => (d.dataAtendimento ?? d.dataEvento ?? d.createdAt ?? '').slice(0, 7)
const rotuloMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
const dataDe = (d: Diligencia) => (d.dataAtendimento ?? d.createdAt).slice(0, 10)

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }
}

export default function PendenciasPage() {
  const { diligencias } = useDiligencias()
  const { advogadoMap } = useAdvogados()
  const { addToast } = useToast()
  const [mesSel, setMesSel] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusZapSignResult>({})
  const [carregandoStatus, setCarregandoStatus] = useState(false)

  const itens = useMemo(() => diligencias
    .filter((d) => !d.incompleta)
    .map((d) => ({ d, faltam: documentosFaltando(d).map((r) => CAMPO_POR_ROTULO[r]).filter(Boolean) as Campo[] }))
    .filter((x) => x.faltam.length > 0), [diligencias])

  const meses = useMemo(() => Array.from(new Set(itens.map((x) => mesDe(x.d)))).filter(Boolean).sort((a, b) => b.localeCompare(a)), [itens])
  const mes = mesSel ?? meses[0] ?? ''
  const linhas = useMemo(() => itens.filter((x) => mesDe(x.d) === mes)
    .sort((a, b) => dataDe(a.d).localeCompare(dataDe(b.d))), [itens, mes])

  const tokensKey = linhas.flatMap((x) => [x.d.zapsignDocumentIdContrato, x.d.zapsignDocumentIdRecibo]).filter(Boolean).sort().join(',')

  async function carregarStatus(tokens: string) {
    if (!tokens) { setStatus({}); return }
    setCarregandoStatus(true)
    try {
      const res = await fetch('/api/zapsign/status', { method: 'POST', headers: await authHeader(), body: JSON.stringify({ tokens: tokens.split(',') }) })
      if (res.ok) setStatus(await res.json())
    } finally {
      setCarregandoStatus(false)
    }
  }

  useEffect(() => {
    let cancel = false
    ;(async () => {
      if (!tokensKey) return
      const res = await fetch('/api/zapsign/status', { method: 'POST', headers: await authHeader(), body: JSON.stringify({ tokens: tokensKey.split(',') }) })
      if (!cancel && res.ok) setStatus(await res.json())
    })()
    return () => { cancel = true }
  }, [tokensKey])

  const nomeAdv = (d: Diligencia) => advogadoMap.get(d.advogadoId)?.nomeCompleto ?? 'Advogado não definido'

  // Listas para copiar (comprovantes de pagamento p/ buscar no banco; serviço p/ a Anne)
  function copiar(campo: Campo) {
    const l = linhas.filter((x) => x.faltam.includes(campo))
    const texto = l.map((x) => campo === 'comprovantePagamento'
      ? `${formatDate(dataDe(x.d))} — ${nomeAdv(x.d)} — ${formatCurrency(x.d.valorDiligencia ?? 0)}`
      : `${formatDate(dataDe(x.d))} — ${x.d.cidade}/${x.d.uf} — ${x.d.ccc || tituloDiligencia(x.d)} — ${nomeAdv(x.d)}`).join('\n')
    const titulo = campo === 'comprovantePagamento' ? 'Comprovantes de pagamento faltando' : 'Comprovantes de serviço faltando'
    navigator.clipboard.writeText(`${titulo} (${rotuloMes(mes)}):\n${texto}`)
    addToast('success', `Lista copiada (${l.length}).`)
  }

  const conta = (c: Campo) => linhas.filter((x) => x.faltam.includes(c)).length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ClipboardCheck className="w-5 h-5" /> Resolver pendências</h1>
          <p className="text-sm text-slate-500 mt-0.5">Documentos faltando nas diligências concluídas — resolva direto na linha</p>
        </div>
        {meses.length > 0 && (
          <select value={mes} onChange={(e) => setMesSel(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white capitalize">
            {meses.map((m) => <option key={m} value={m}>{rotuloMes(m)} ({itens.filter((x) => mesDe(x.d) === m).length})</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(['contratoAssinado', 'reciboAssinado', 'comprovantePagamento', 'comprovanteServico'] as Campo[]).map((c) => (
          <Card key={c}><CardBody>
            <p className="text-xs font-medium text-slate-500 uppercase">{ROTULO_CURTO[c]}</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{conta(c)}</p>
            {(c === 'comprovantePagamento' || c === 'comprovanteServico') && conta(c) > 0 && (
              <button onClick={() => copiar(c)} className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                <Copy className="w-3 h-3" /> Copiar lista
              </button>
            )}
          </CardBody></Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600"><strong>{linhas.length}</strong> diligência{linhas.length === 1 ? '' : 's'} com pendência em {rotuloMes(mes || '2000-01')}</p>
        <Button variant="ghost" size="sm" loading={carregandoStatus} onClick={() => carregarStatus(tokensKey)}>
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar assinaturas
        </Button>
      </div>

      <div className="space-y-3">
        {linhas.map(({ d, faltam }) => (
          <LinhaPendencia key={d.id} d={d} faltam={faltam} adv={advogadoMap.get(d.advogadoId)} status={status}
            onStatusMudou={() => carregarStatus(tokensKey)} />
        ))}
        {linhas.length === 0 && (
          <Card><CardBody><p className="text-center text-slate-400 py-6">Nenhuma pendência de documento. 🎉</p></CardBody></Card>
        )}
      </div>
    </div>
  )
}

function LinhaPendencia({ d, faltam, adv, status, onStatusMudou }: {
  d: Diligencia; faltam: Campo[]; adv?: Advogado; status: StatusZapSignResult; onStatusMudou: () => void
}) {
  const { updateDiligencia, atualizarAnexo, uploadAnexo, refetch } = useDiligencias()
  const { addToast } = useToast()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const inputs = useRef<Partial<Record<Campo, HTMLInputElement | null>>>({})
  const ref = d.ccc || tituloDiligencia(d)
  const telAdv = adv?.whatsapp || adv?.telefone

  async function gerarEEnviar(tipo: 'contrato' | 'recibo') {
    if (!adv) { addToast('error', 'Defina o advogado desta diligência primeiro.'); return }
    setOcupado(tipo)
    try {
      const { filename, base64 } = tipo === 'contrato' ? gerarContratoBase64Only(d, adv) : gerarReciboBase64Only(d, adv)
      const res = await fetch('/api/zapsign/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64, filename, tipo, diligenciaId: d.id, nomeAdvogado: adv.nomeCompleto, whatsappAdvogado: adv.whatsapp }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        addToast('error', `ZapSign: ${err.error ?? 'falha ao enviar.'}`)
        return
      }
      const z: EnviarZapSignResult = await res.json()
      if (tipo === 'contrato') {
        atualizarAnexo(d.id, 'contratoGerado', filename)
        await updateDiligencia(d.id, { zapsignDocumentIdContrato: z.documentToken, linkAssinaturaAdriana: z.linkAdriana, linkAssinaturaAdvogadoContrato: z.linkAdvogado, statusAssinaturaContrato: 'pendente' })
      } else {
        atualizarAnexo(d.id, 'reciboGerado', filename)
        await updateDiligencia(d.id, { zapsignDocumentIdRecibo: z.documentToken, linkAssinaturaAdvogadoRecibo: z.linkAdvogado, statusAssinaturaRecibo: 'pendente' })
      }
      addToast('success', `${tipo === 'contrato' ? 'Contrato' : 'Recibo'} enviado à ZapSign. Agora mande o link pelo WhatsApp.`)
    } catch {
      addToast('error', 'Erro ao gerar/enviar.')
    } finally {
      setOcupado(null)
    }
  }

  // Documento já assinado na ZapSign mas sem o PDF anexado → baixa e anexa
  async function puxarAssinado(tipo: 'contrato' | 'recibo', token: string) {
    setOcupado(tipo)
    try {
      const res = await fetch('/api/avulso/vincular', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diligenciaId: d.id, [tipo]: { token } }),
      })
      const r = await res.json().catch(() => ({}))
      const ok = tipo === 'contrato' ? r.contratoAssinado : r.reciboAssinado
      if (!res.ok || !ok) addToast('error', 'Ainda não foi possível baixar o assinado.')
      else { addToast('success', 'Documento assinado anexado.'); await refetch(); onStatusMudou() }
    } finally {
      setOcupado(null)
    }
  }

  async function naoSeAplica(campo: Campo) {
    const atual = new Set(d.documentosDispensados ?? [])
    atual.add(campo)
    await updateDiligencia(d.id, { documentosDispensados: Array.from(atual) as (keyof Anexos)[] })
    addToast('success', `${ROTULO_CURTO[campo]}: marcado como "não se aplica".`)
  }

  async function anexar(campo: Campo, file: File) {
    setOcupado(campo)
    try {
      await uploadAnexo(d.id, campo, file)
      addToast('success', `${ROTULO_CURTO[campo]} anexado.`)
    } catch {
      addToast('error', 'Erro ao anexar. Tente de novo.')
    } finally {
      setOcupado(null)
    }
  }

  function acoesAssinatura(tipo: 'contrato' | 'recibo') {
    const token = tipo === 'contrato' ? d.zapsignDocumentIdContrato : d.zapsignDocumentIdRecibo
    const linkAdv = tipo === 'contrato' ? d.linkAssinaturaAdvogadoContrato : d.linkAssinaturaAdvogadoRecibo
    if (!token) {
      return (
        <Button variant="primary" size="sm" loading={ocupado === tipo} onClick={() => gerarEEnviar(tipo)}>
          <FileSignature className="w-3.5 h-3.5" /> Gerar e enviar
        </Button>
      )
    }
    const st = status[token]
    if (st?.status === 'signed') {
      return (
        <Button variant="success" size="sm" loading={ocupado === tipo} onClick={() => puxarAssinado(tipo, token)}>
          <Paperclip className="w-3.5 h-3.5" /> Assinado — anexar
        </Button>
      )
    }
    const faltaAdriana = st?.signers.some((s) => s.adriana && !s.assinou)
    const faltaAdv = st ? st.signers.some((s) => !s.adriana && !s.assinou) : true
    return (
      <>
        <span className="text-xs text-slate-500">
          {st ? `Falta assinar: ${[faltaAdv && 'advogado', faltaAdriana && 'Adriana'].filter(Boolean).join(' e ') || '—'}` : 'Enviado à ZapSign'}
        </span>
        {faltaAdv && linkAdv && telAdv && (
          <a href={buildWhatsAppLembreteZapSign(telAdv, adv!.nomeCompleto, ref, tipo, linkAdv)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-900">
            <MessageCircle className="w-3.5 h-3.5" /> Lembrar advogado
          </a>
        )}
        {faltaAdv && linkAdv && telAdv && !st?.signers.length && (
          <a href={buildWhatsAppZapSign(telAdv, adv!.nomeCompleto, ref, tipo, linkAdv)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-900">
            <Send className="w-3.5 h-3.5" /> Enviar link
          </a>
        )}
        {faltaAdriana && d.linkAssinaturaAdriana && (
          <a href={buildWhatsAppAdriana(ref, tipo, d.linkAssinaturaAdriana)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 hover:text-purple-900">
            <MessageCircle className="w-3.5 h-3.5" /> Mandar p/ Adriana
          </a>
        )}
      </>
    )
  }

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div>
            <p className="font-semibold text-slate-800">{adv?.nomeCompleto ?? 'Advogado não definido'}</p>
            <p className="text-xs text-slate-500">
              {formatDate(dataDe(d))} · {d.cidade}/{d.uf} · {ref} · {formatCurrency(d.valorDiligencia ?? 0)} · {d.empresaCliente}
            </p>
          </div>
          <Link href={`/diligencias/${d.id}`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
            Abrir <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {faltam.map((campo) => (
            <div key={campo} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
              <span className={cn('text-sm font-medium w-52 flex-shrink-0',
                campo === 'contratoAssinado' || campo === 'reciboAssinado' ? 'text-slate-700' : 'text-slate-600')}>
                {ROTULO_CURTO[campo]}
              </span>
              {campo === 'contratoAssinado' && acoesAssinatura('contrato')}
              {campo === 'reciboAssinado' && acoesAssinatura('recibo')}
              {(campo === 'comprovantePagamento' || campo === 'comprovanteServico') && (
                <>
                  <input type="file" className="hidden" accept="application/pdf,image/*"
                    ref={(el) => { inputs.current[campo] = el }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) anexar(campo, f); e.target.value = '' }} />
                  <Button variant="secondary" size="sm" loading={ocupado === campo} onClick={() => inputs.current[campo]?.click()}>
                    <Paperclip className="w-3.5 h-3.5" /> Anexar
                  </Button>
                </>
              )}
              <button onClick={() => naoSeAplica(campo)} className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700">
                <MinusCircle className="w-3 h-3" /> Não se aplica
              </button>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}
