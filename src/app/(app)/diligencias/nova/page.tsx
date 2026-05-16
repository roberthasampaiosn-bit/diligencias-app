'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, CheckCircle2, Star, UserPlus } from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useAdvogados } from '@/context/AdvogadosContext'
import { useEventos } from '@/context/EventosContext'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import {
  StatusDiligencia, StatusPagamento, StatusPesquisa,
  ModoDiligencia, TipoDiligencia, TipoEvento, EmpresaCliente, normalizeEmpresa,
} from '@/types'
import { cleanPhone, toTitleCase, normalizarCccBat, validarCccBat } from '@/lib/utils'
import { TIPOS_EVENTO_BAT, MACROS_VTAL, TIPOS_DILIGENCIA_BAT, TIPOS_DILIGENCIA_VTAL, OPERACOES_BAT, SEGMENTOS_BAT, SOBRA_MERCADORIA_OPS } from '@/lib/constants'

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const SESSION_KEY_BAT = 'nova-diligencia-bat-draft'
const SESSION_KEY_VTAL = 'nova-diligencia-vtal-draft'

// ── BAT BRASIL form ───────────────────────────────────────────────────────────

function FormBatBrasil() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { createDiligencia, diligencias } = useDiligencias()
  const { advogados } = useAdvogados()
  const { eventos, processarEvento } = useEventos()

  const cccParam = searchParams.get('ccc') || ''
  const eventoId = searchParams.get('eventoId') || ''
  const modoParam = searchParams.get('modo') || ''
  const empresaParam = searchParams.get('empresa') || ''

  const evento = useMemo(
    () => (eventoId ? eventos.find((e) => e.id === eventoId) ?? null : null),
    [eventos, eventoId]
  )

  const [form, setForm] = useState({
    ccc: cccParam,
    vitima: '',
    telefoneVitima: '',
    cargo: 'Motorista',
    empresa: empresaParam,
    cidade: '',
    uf: '',
    tipoEvento: TipoEvento.Roubo,
    dataInformativo: '',
    horaInformativo: '',
    horaEvento: '',
    tipoDiligencia: modoParam === 'remoto' ? TipoDiligencia.AssistenciaJuridicaRemota : TipoDiligencia.RegistroBO,
    tipoDiligenciaDescricao: '',
    modoDiligencia: modoParam === 'remoto' ? ModoDiligencia.Remoto : ModoDiligencia.Presencial,
    advogadoId: '',
    valorDiligencia: '',
    observacoes: '',
    dpRegistrou: '',
    operacao: '',
    segmento: '',
    sobraMercadoria: '',
    numeroBOProcesso: '',
    regiaoGtsc: '',
    motoristaAgredido: '',
    dataLigacaoAdvogado: '',
    horaLigacaoAdvogado: '',
  })

  const [autoFilled, setAutoFilled] = useState(false)
  const [cccMatch, setCccMatch] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Restaurar form do sessionStorage ao voltar da criação de advogado
  useEffect(() => {
    const newAdvId = searchParams.get('newAdvogadoId')
    if (!newAdvId) return
    const saved = sessionStorage.getItem(SESSION_KEY_BAT)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Record<string, string>
        setForm((prev) => ({ ...prev, ...parsed, advogadoId: newAdvId }))
        setAutoFilled(true)
      } catch { /* ignore */ }
      sessionStorage.removeItem(SESSION_KEY_BAT)
    } else {
      setForm((prev) => ({ ...prev, advogadoId: newAdvId }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!evento || autoFilled) return
    setForm((prev) => ({
      ...prev,
      ccc: evento.ccc || prev.ccc,
      vitima: evento.nomeVitima || prev.vitima,
      telefoneVitima: evento.telefoneVitima || prev.telefoneVitima,
      cargo: evento.cargoVitima || prev.cargo,
      empresa: evento.empresa || prev.empresa,
      cidade: evento.cidade || prev.cidade,
      uf: (evento.uf && UFS.includes(evento.uf)) ? evento.uf : prev.uf,
      tipoEvento: (() => {
        if (!evento.tipoEvento) return prev.tipoEvento
        const match = Object.values(TipoEvento).find(
          (v) => v.toLowerCase() === evento.tipoEvento.toLowerCase()
        )
        return (match as TipoEvento) ?? prev.tipoEvento
      })(),
      dataInformativo: evento.dataRecebimento || prev.dataInformativo,
      horaInformativo: evento.horaRecebimento || prev.horaInformativo,
      horaEvento: evento.horaEvento || prev.horaEvento,
      operacao: evento.operacao || prev.operacao,
      segmento: evento.segmento || prev.segmento,
      regiaoGtsc: evento.gtsc || prev.regiaoGtsc,
      motoristaAgredido: evento.motoristaAgredido ? 'Sim' : prev.motoristaAgredido,
    }))
    setAutoFilled(true)
  }, [evento, autoFilled])

  const sugestoes = useMemo(() => {
    if (form.modoDiligencia !== ModoDiligencia.Presencial) return []
    const cidade = form.cidade.trim()
    if (cidade.length < 3) return []
    const cidadeLower = cidade.toLowerCase()

    const contagem = new Map<string, number>()
    const avaliacoes = new Map<string, number[]>()
    diligencias.forEach((d) => {
      contagem.set(d.advogadoId, (contagem.get(d.advogadoId) ?? 0) + 1)
      if (d.avaliacao?.nota != null) {
        const arr = avaliacoes.get(d.advogadoId) ?? []
        arr.push(d.avaliacao.nota)
        avaliacoes.set(d.advogadoId, arr)
      }
    })

    return advogados
      .filter((a) =>
        a.cidadePrincipal.toLowerCase().includes(cidadeLower) ||
        a.cidadesAtendidas.some((c) => c.toLowerCase().includes(cidadeLower))
      )
      .map((a) => {
        const notas = avaliacoes.get(a.id) ?? []
        return {
          ...a,
          totalDiligencias: contagem.get(a.id) ?? 0,
          media: notas.length > 0 ? notas.reduce((s, n) => s + n, 0) / notas.length : null,
        }
      })
      .sort((a, b) => {
        if (b.totalDiligencias !== a.totalDiligencias) return b.totalDiligencias - a.totalDiligencias
        return (b.media ?? 0) - (a.media ?? 0)
      })
      .slice(0, 5)
  }, [form.cidade, form.modoDiligencia, advogados, diligencias])

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n })
  }

  function handleCccBlur() {
    const normalized = normalizarCccBat(form.ccc)
    if (normalized !== form.ccc) set('ccc', normalized)
    const ccc = normalized
    if (!ccc || ccc === cccMatch) return
    const match = diligencias.find((d) => d.ccc === ccc && d.empresaCliente === EmpresaCliente.BatBrasil)
    if (!match) return
    setForm((prev) => ({
      ...prev,
      vitima: match.vitima || prev.vitima,
      telefoneVitima: match.telefoneVitima || prev.telefoneVitima,
      cargo: match.cargo || prev.cargo,
      empresa: match.empresa || prev.empresa,
      cidade: match.cidade || prev.cidade,
      uf: match.uf || prev.uf,
      tipoEvento: match.tipoEvento || prev.tipoEvento,
    }))
    setCccMatch(ccc)
  }

  function handleNovoAdvogadoBat(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault()
    sessionStorage.setItem(SESSION_KEY_BAT, JSON.stringify(form))
    const returnParams = new URLSearchParams({ cliente: 'bat' })
    if (eventoId) returnParams.set('eventoId', eventoId)
    if (cccParam) returnParams.set('ccc', cccParam)
    if (modoParam) returnParams.set('modo', modoParam)
    if (empresaParam) returnParams.set('empresa', empresaParam)
    const returnTo = `/diligencias/nova?${returnParams.toString()}`
    router.push(`/advogados/novo?returnTo=${encodeURIComponent(returnTo)}`)
  }

  function validate() {
    const e: Record<string, string> = {}
    const erroCcc = validarCccBat(form.ccc)
    if (erroCcc) e.ccc = erroCcc
    if (form.telefoneVitima) {
      const d = cleanPhone(form.telefoneVitima)
      if (d.length < 10 || d.length > 11) e.telefoneVitima = '10 ou 11 dígitos'
    }
    if (!form.cidade) e.cidade = 'Obrigatório'
    if (!form.uf) e.uf = 'Obrigatório'
    if (!form.advogadoId) e.advogadoId = 'Selecione um advogado'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      const nova = await createDiligencia({
        empresaCliente: EmpresaCliente.BatBrasil,
        ccc: form.ccc,
        vitima: toTitleCase(form.vitima),
        telefoneVitima: cleanPhone(form.telefoneVitima),
        cargo: form.cargo,
        empresa: form.empresa,
        cidade: toTitleCase(form.cidade),
        uf: form.uf,
        tipoEvento: form.tipoEvento as TipoEvento,
        tipoDiligencia: form.tipoDiligencia as TipoDiligencia,
        tipoDiligenciaDescricao: form.tipoDiligencia === TipoDiligencia.Outro ? form.tipoDiligenciaDescricao : undefined,
        modoDiligencia: form.modoDiligencia as ModoDiligencia,
        advogadoId: form.advogadoId,
        valorDiligencia: form.valorDiligencia ? parseFloat(form.valorDiligencia) : 0,
        observacoes: form.observacoes,
        dpRegistrou: form.dpRegistrou,
        dataInformativo: form.dataInformativo || undefined,
        horaInformativo: form.horaInformativo || undefined,
        horaEvento: form.horaEvento || undefined,
        operacao: form.operacao || undefined,
        segmento: form.segmento || undefined,
        sobraMercadoria: form.sobraMercadoria || undefined,
        numeroBOProcesso: form.numeroBOProcesso || undefined,
        regiaoGtsc: form.regiaoGtsc || undefined,
        motoristaAgredido: form.motoristaAgredido || undefined,
        dataLigacaoAdvogado: form.dataLigacaoAdvogado || undefined,
        horaLigacaoAdvogado: form.horaLigacaoAdvogado || undefined,
        status: StatusDiligencia.EmAndamento,
        statusPagamento: StatusPagamento.Pendente,
        cicloFinalizado: false,
        pesquisa: { status: StatusPesquisa.Pendente, historicoLigacoes: [] },
        anexos: {},
        eventoId: eventoId || undefined,
      })
      if (eventoId) processarEvento(eventoId, nova.id)
      router.push(`/diligencias/${nova.id}`)
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'Erro ao salvar. Verifique sua conexão e tente novamente.'
      setErrors({ _: msg })
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
      {errors._ && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{errors._}</div>
      )}

      {autoFilled && evento && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Dados preenchidos automaticamente a partir do evento <strong>{evento.ccc}</strong>. Selecione o advogado e confirme.
        </div>
      )}

      {cccMatch && !evento && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-3 rounded-xl">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Dados da vítima preenchidos a partir de uma diligência existente com o CCC <strong>{cccMatch}</strong>. Revise e confirme antes de salvar.
        </div>
      )}

      {modoParam && (
        <div className={`border rounded-xl px-4 py-3 text-sm font-medium ${modoParam === 'presencial' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-purple-50 border-purple-200 text-purple-800'}`}>
          Modo pré-selecionado: <strong>{form.modoDiligencia}</strong>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Identificação</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="CCC" value={form.ccc} onChange={(e) => set('ccc', e.target.value.toUpperCase())} onBlur={handleCccBlur} error={errors.ccc} placeholder="BR-2026030019" />
          <Select label="Tipo de evento" value={form.tipoEvento} onChange={(e) => set('tipoEvento', e.target.value)} options={TIPOS_EVENTO_BAT.map((v) => ({ value: v, label: v }))} />
          <Input label="Horário do evento" value={form.horaEvento} onChange={(e) => set('horaEvento', e.target.value)} placeholder="HH:MM" />
          <Select label="Modo de assistência" value={form.modoDiligencia} onChange={(e) => {
            const modo = e.target.value
            setForm((prev) => ({
              ...prev,
              modoDiligencia: modo,
              tipoDiligencia: modo === ModoDiligencia.Remoto
                ? TipoDiligencia.AssistenciaJuridicaRemota
                : prev.tipoDiligencia === TipoDiligencia.AssistenciaJuridicaRemota
                  ? TipoDiligencia.RegistroBO
                  : prev.tipoDiligencia,
            }))
          }} options={Object.values(ModoDiligencia).map((v) => ({ value: v, label: v }))} />
          <Select label="Tipo de diligência" value={form.tipoDiligencia} onChange={(e) => set('tipoDiligencia', e.target.value)} options={TIPOS_DILIGENCIA_BAT.map((v) => ({ value: v, label: v }))} />
          <Select label="Operação" value={form.operacao} onChange={(e) => set('operacao', e.target.value)} options={OPERACOES_BAT.map((v) => ({ value: v, label: v }))} placeholder="Selecione" />
          <Select label="Segmento" value={form.segmento} onChange={(e) => set('segmento', e.target.value)} options={SEGMENTOS_BAT.map((v) => ({ value: v, label: v }))} placeholder="Selecione" />
          {form.tipoDiligencia === TipoDiligencia.Outro && (
            <div className="sm:col-span-2">
              <Input label="Descrição do tipo (Outro)" value={form.tipoDiligenciaDescricao} onChange={(e) => set('tipoDiligenciaDescricao', e.target.value)} placeholder="Descreva o tipo de diligência" />
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Dados da Vítima</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input label="Nome completo" value={form.vitima} onChange={(e) => set('vitima', e.target.value)} error={errors.vitima} />
          </div>
          <Input label="Telefone" value={form.telefoneVitima} onChange={(e) => set('telefoneVitima', e.target.value)} error={errors.telefoneVitima} placeholder="11987654321" helper="Apenas números com DDD" />
          <Input label="Cargo" value={form.cargo} onChange={(e) => set('cargo', e.target.value)} />
          <div className="sm:col-span-2">
            <Input label="Empresa da vítima" value={form.empresa} onChange={(e) => set('empresa', e.target.value)} placeholder="Nome da empresa onde a vítima trabalha" />
          </div>
          <Input label="Cidade" value={form.cidade} onChange={(e) => set('cidade', e.target.value)} error={errors.cidade} />
          <Select label="UF" value={form.uf} onChange={(e) => set('uf', e.target.value)} options={UFS.map((u) => ({ value: u, label: u }))} error={errors.uf} placeholder="Selecione" />
          <div className="sm:col-span-2">
            <Input label="DP que registrou" value={form.dpRegistrou} onChange={(e) => set('dpRegistrou', e.target.value)} placeholder="Opcional" />
          </div>
          <Input label="Número do BO / Processo" value={form.numeroBOProcesso} onChange={(e) => set('numeroBOProcesso', e.target.value)} placeholder="Ex: BO nº 123/2026" />
          <Select label="Sobra de mercadoria" value={form.sobraMercadoria} onChange={(e) => set('sobraMercadoria', e.target.value)} options={SOBRA_MERCADORIA_OPS.map((v) => ({ value: v, label: v }))} placeholder="Selecione" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ligação do Advogado</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Data da ligação" type="date" value={form.dataLigacaoAdvogado} onChange={(e) => set('dataLigacaoAdvogado', e.target.value)} />
          <Input label="Horário da ligação" value={form.horaLigacaoAdvogado} onChange={(e) => set('horaLigacaoAdvogado', e.target.value)} placeholder="HH:MM" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Advogado e Valor</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1">
            <Select label="Advogado responsável" value={form.advogadoId} onChange={(e) => set('advogadoId', e.target.value)}
              options={advogados.map((a) => ({ value: a.id, label: `${a.nomeCompleto} — ${a.cidadePrincipal}/${a.uf}` }))}
              error={errors.advogadoId} placeholder="Selecione o advogado" />
            <a href="#" onClick={handleNovoAdvogadoBat} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium mt-0.5">
              <UserPlus className="w-3 h-3" /> Novo advogado
            </a>
          </div>

          {sugestoes.length > 0 && (
            <div className="sm:col-span-2 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sugestões para {form.cidade}</p>
              {sugestoes.map((a) => (
                <button key={a.id} type="button" onClick={() => set('advogadoId', a.id)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                    form.advogadoId === a.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{a.nomeCompleto}</p>
                    <p className="text-xs text-slate-500">{a.cidadePrincipal}/{a.uf}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0 text-xs">
                    {a.media != null && (
                      <span className="flex items-center gap-0.5 text-amber-600 font-medium">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{a.media.toFixed(1)}
                      </span>
                    )}
                    <span className="text-slate-400">{a.totalDiligencias} dilig.</span>
                  </div>
                  {form.advogadoId === a.id && <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}

          <Input label="Valor (R$)" type="number" step="0.01" min="0" value={form.valorDiligencia} onChange={(e) => set('valorDiligencia', e.target.value)} placeholder="Opcional" />
          <div className="sm:col-span-2">
            <Textarea label="Observações" value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
          </div>
        </CardBody>
      </Card>

      <div className="flex gap-3 justify-end pb-6">
        <Link href="/diligencias"><Button variant="secondary" type="button">Cancelar</Button></Link>
        <Button type="submit" loading={saving}><Save className="w-4 h-4" /> Criar diligência</Button>
      </div>
    </form>
  )
}

// ── V.TAL form ────────────────────────────────────────────────────────────────

function FormVTAL() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { createDiligencia } = useDiligencias()
  const { advogados } = useAdvogados()

  const [form, setForm] = useState({
    ccc: '',
    dataAtendimento: '',
    uf: '',
    cidade: '',
    tipoDiligencia: TipoDiligencia.PrisaoFlagrante,
    tipoDiligenciaDescricao: '',
    macro: '',
    observacoes: '',
    localAtendimento: '',
    resultadoDemanda: '',
    status: StatusDiligencia.EmAndamento,
    modoDiligencia: ModoDiligencia.Presencial,
    advogadoId: '',
    centroCusto: '',
    valorDiligencia: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Restaurar form do sessionStorage ao voltar da criação de advogado
  useEffect(() => {
    const newAdvId = searchParams.get('newAdvogadoId')
    if (!newAdvId) return
    const saved = sessionStorage.getItem(SESSION_KEY_VTAL)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Record<string, string>
        setForm((prev) => ({ ...prev, ...parsed, advogadoId: newAdvId }))
      } catch { /* ignore */ }
      sessionStorage.removeItem(SESSION_KEY_VTAL)
    } else {
      setForm((prev) => ({ ...prev, advogadoId: newAdvId }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n })
  }

  function handleNovoAdvogadoVtal(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault()
    sessionStorage.setItem(SESSION_KEY_VTAL, JSON.stringify(form))
    const returnTo = '/diligencias/nova?cliente=vtal'
    router.push(`/advogados/novo?returnTo=${encodeURIComponent(returnTo)}`)
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.cidade) e.cidade = 'Obrigatório'
    if (!form.uf) e.uf = 'Obrigatório'
    if (!form.advogadoId) e.advogadoId = 'Selecione um advogado'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      const nova = await createDiligencia({
        empresaCliente: EmpresaCliente.VTAL,
        ccc: form.ccc,
        vitima: 'N/A',
        telefoneVitima: '00000000000',
        cargo: '',
        empresa: '',
        cidade: toTitleCase(form.cidade),
        uf: form.uf,
        tipoEvento: TipoEvento.Outro,
        tipoDiligencia: form.tipoDiligencia as TipoDiligencia,
        tipoDiligenciaDescricao: form.tipoDiligencia === TipoDiligencia.Outro ? form.tipoDiligenciaDescricao : undefined,
        modoDiligencia: form.modoDiligencia as ModoDiligencia,
        advogadoId: form.advogadoId,
        valorDiligencia: form.valorDiligencia ? parseFloat(form.valorDiligencia) : 0,
        observacoes: form.observacoes,
        dpRegistrou: '',
        status: form.status as StatusDiligencia,
        statusPagamento: StatusPagamento.Pendente,
        cicloFinalizado: false,
        pesquisa: { status: StatusPesquisa.Pendente, historicoLigacoes: [] },
        anexos: {},
        dataAtendimento: form.dataAtendimento || undefined,
        macro: form.macro || undefined,
        localAtendimento: form.localAtendimento || undefined,
        resultadoDemanda: form.resultadoDemanda || undefined,
        centroCusto: form.centroCusto || undefined,
      })
      router.push(`/diligencias/${nova.id}`)
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'Erro ao salvar. Verifique sua conexão e tente novamente.'
      setErrors({ _: msg })
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
      {errors._ && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{errors._}</div>
      )}

      <Card>
        <CardHeader><CardTitle>Identificação</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nº Processo / Boletim de Ocorrência" value={form.ccc} onChange={(e) => set('ccc', e.target.value)} error={errors.ccc} placeholder="Opcional" />
          <Input label="Data de atendimento" type="date" value={form.dataAtendimento} onChange={(e) => set('dataAtendimento', e.target.value)} />
          <Select label="UF" value={form.uf} onChange={(e) => set('uf', e.target.value)} options={UFS.map((u) => ({ value: u, label: u }))} error={errors.uf} placeholder="Selecione" />
          <Input label="Cidade" value={form.cidade} onChange={(e) => set('cidade', e.target.value)} error={errors.cidade} />
          <Select label="Tipo de diligência" value={form.tipoDiligencia} onChange={(e) => set('tipoDiligencia', e.target.value)} options={TIPOS_DILIGENCIA_VTAL.map((v) => ({ value: v, label: v }))} />
          <Select label="Modo de atendimento" value={form.modoDiligencia} onChange={(e) => {
            const modo = e.target.value
            setForm((prev) => ({
              ...prev,
              modoDiligencia: modo,
              tipoDiligencia: modo === ModoDiligencia.Remoto
                ? TipoDiligencia.AssistenciaJuridicaRemota
                : prev.tipoDiligencia === TipoDiligencia.AssistenciaJuridicaRemota
                  ? TipoDiligencia.PrisaoFlagrante
                  : prev.tipoDiligencia,
            }))
          }} options={Object.values(ModoDiligencia).map((v) => ({ value: v, label: v }))} />
          <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value)} options={Object.values(StatusDiligencia).map((v) => ({ value: v, label: v }))} />
          {form.tipoDiligencia === TipoDiligencia.Outro && (
            <div className="sm:col-span-2">
              <Input label="Descrição do tipo (Outro)" value={form.tipoDiligenciaDescricao} onChange={(e) => set('tipoDiligenciaDescricao', e.target.value)} placeholder="Descreva o tipo de diligência" />
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Detalhes do Atendimento</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Select label="Macro" value={form.macro} onChange={(e) => set('macro', e.target.value)}
              options={MACROS_VTAL.map((v) => ({ value: v, label: v }))} placeholder="Selecione a macro" />
          </div>
          <div className="sm:col-span-2">
            <Input label="Local de atendimento" value={form.localAtendimento} onChange={(e) => set('localAtendimento', e.target.value)} placeholder="Local onde a diligência ocorreu" />
          </div>
          <div className="sm:col-span-2">
            <Input label="Resultado da demanda" value={form.resultadoDemanda} onChange={(e) => set('resultadoDemanda', e.target.value)} placeholder="Resultado obtido" />
          </div>
          <div className="sm:col-span-2">
            <Textarea label="Observações" value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Advogado e Financeiro</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1">
            <Select label="Advogado responsável" value={form.advogadoId} onChange={(e) => set('advogadoId', e.target.value)}
              options={advogados.map((a) => ({ value: a.id, label: `${a.nomeCompleto} — ${a.cidadePrincipal}/${a.uf}` }))}
              error={errors.advogadoId} placeholder="Selecione o advogado" />
            <a href="#" onClick={handleNovoAdvogadoVtal} className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium mt-0.5">
              <UserPlus className="w-3 h-3" /> Novo advogado
            </a>
          </div>
          <Input label="Centro de custo" value={form.centroCusto} onChange={(e) => set('centroCusto', e.target.value)} placeholder="Ex.: CC-001" />
          <Input label="Valor (R$)" type="number" step="0.01" min="0" value={form.valorDiligencia} onChange={(e) => set('valorDiligencia', e.target.value)} placeholder="Opcional" />
        </CardBody>
      </Card>

      <div className="flex gap-3 justify-end pb-6">
        <Link href="/diligencias"><Button variant="secondary" type="button">Cancelar</Button></Link>
        <Button type="submit" loading={saving}><Save className="w-4 h-4" /> Criar diligência V.TAL</Button>
      </div>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function NovaForm() {
  const searchParams = useSearchParams()
  const clienteParam = searchParams.get('cliente') || ''

  const isVTAL = clienteParam === 'vtal'
  const isBat = clienteParam === 'bat' || !isVTAL

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/diligencias">
          <Button variant="ghost" size="sm" type="button"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800">Nova Diligência</h1>
            {isVTAL
              ? <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">V.TAL</span>
              : <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">BAT BRASIL</span>
            }
          </div>
          <div className="flex gap-2 mt-1">
            <Link href="/diligencias/nova?cliente=bat">
              <button type="button" className={`text-xs px-2 py-0.5 rounded border transition-colors ${isBat ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-300 hover:border-blue-300'}`}>
                BAT BRASIL
              </button>
            </Link>
            <Link href="/diligencias/nova?cliente=vtal">
              <button type="button" className={`text-xs px-2 py-0.5 rounded border transition-colors ${isVTAL ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-500 border-slate-300 hover:border-purple-300'}`}>
                V.TAL
              </button>
            </Link>
          </div>
        </div>
      </div>

      {isVTAL ? <FormVTAL /> : <FormBatBrasil />}
    </div>
  )
}

export default function NovaDiligenciaPage() {
  return <Suspense><NovaForm /></Suspense>
}
