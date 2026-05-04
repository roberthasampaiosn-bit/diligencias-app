'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, CheckCircle2, Star } from 'lucide-react'
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
  ModoDiligencia, TipoDiligencia, TipoEvento,
} from '@/types'
import { cleanPhone, toTitleCase } from '@/lib/utils'

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

function NovaForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { createDiligencia, diligencias } = useDiligencias()
  const { advogados } = useAdvogados()
  const { eventos, processarEvento } = useEventos()

  const cccParam = searchParams.get('ccc') || ''
  const eventoId = searchParams.get('eventoId') || ''
  const modoParam = searchParams.get('modo') || ''

  const evento = useMemo(
    () => (eventoId ? eventos.find((e) => e.id === eventoId) ?? null : null),
    [eventos, eventoId]
  )

  const [form, setForm] = useState({
    ccc: cccParam,
    vitima: '',
    telefoneVitima: '',
    cargo: 'Motorista',
    empresa: '',
    cidade: '',
    uf: '',
    tipoEvento: TipoEvento.Assalto,
    tipoDiligencia: TipoDiligencia.Oitiva,
    modoDiligencia: modoParam === 'remoto' ? ModoDiligencia.Remoto : ModoDiligencia.Presencial,
    advogadoId: '',
    valorDiligencia: '',
    observacoes: '',
    dpRegistrou: '',
  })

  const [autoFilled, setAutoFilled] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Pre-fill form from evento when it loads
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
      // Garante string mesmo se evento.uf chegar null/undefined do banco
      uf: (evento.uf && UFS.includes(evento.uf)) ? evento.uf : prev.uf,
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

  function validate() {
    const e: Record<string, string> = {}
    if (!form.ccc) e.ccc = 'Obrigatório'
    if (!form.vitima) e.vitima = 'Obrigatório'
    if (!form.telefoneVitima) e.telefoneVitima = 'Obrigatório'
    else {
      const d = cleanPhone(form.telefoneVitima)
      if (d.length < 10 || d.length > 11) e.telefoneVitima = '10 ou 11 dígitos'
    }
    if (!form.empresa) e.empresa = 'Obrigatório'
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
        ccc: form.ccc,
        vitima: toTitleCase(form.vitima),
        telefoneVitima: cleanPhone(form.telefoneVitima),
        cargo: form.cargo,
        empresa: form.empresa,
        cidade: toTitleCase(form.cidade),
        uf: form.uf,
        tipoEvento: form.tipoEvento as TipoEvento,
        tipoDiligencia: form.tipoDiligencia as TipoDiligencia,
        modoDiligencia: form.modoDiligencia as ModoDiligencia,
        advogadoId: form.advogadoId,
        valorDiligencia: form.valorDiligencia ? parseFloat(form.valorDiligencia) : 0,
        observacoes: form.observacoes,
        dpRegistrou: form.dpRegistrou,
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
      const msg = err instanceof Error
        ? err.message
        : 'Erro ao salvar. Verifique sua conexão e tente novamente.'
      setErrors({ _: msg })
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <Link href="/diligencias">
          <Button variant="ghost" size="sm" type="button"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Nova Diligência</h1>
          {eventoId && <p className="text-xs text-slate-500 mt-0.5">Criada a partir do evento · Modo: {form.modoDiligencia}</p>}
        </div>
      </div>

      {errors._ && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {errors._}
        </div>
      )}

      {autoFilled && evento && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Dados preenchidos automaticamente a partir do evento <strong>{evento.ccc}</strong>. Selecione o advogado e confirme.
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
          <Input label="CCC" value={form.ccc} onChange={(e) => set('ccc', e.target.value)} error={errors.ccc} placeholder="BR-2026XXXXXX" />
          <Select label="Tipo de evento" value={form.tipoEvento} onChange={(e) => set('tipoEvento', e.target.value)} options={Object.values(TipoEvento).map((v) => ({ value: v, label: v }))} />
          <Select label="Tipo de diligência" value={form.tipoDiligencia} onChange={(e) => set('tipoDiligencia', e.target.value)} options={Object.values(TipoDiligencia).map((v) => ({ value: v, label: v }))} />
          <Select label="Modo" value={form.modoDiligencia} onChange={(e) => set('modoDiligencia', e.target.value)} options={Object.values(ModoDiligencia).map((v) => ({ value: v, label: v }))} />
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
            <Input label="Empresa" value={form.empresa} onChange={(e) => set('empresa', e.target.value)} error={errors.empresa} />
          </div>
          <Input label="Cidade" value={form.cidade} onChange={(e) => set('cidade', e.target.value)} error={errors.cidade} />
          <Select label="UF" value={form.uf} onChange={(e) => set('uf', e.target.value)} options={UFS.map((u) => ({ value: u, label: u }))} error={errors.uf} placeholder="Selecione" />
          <div className="sm:col-span-2">
            <Input label="DP que registrou" value={form.dpRegistrou} onChange={(e) => set('dpRegistrou', e.target.value)} placeholder="Opcional" />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Advogado e Valor</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Select label="Advogado responsável" value={form.advogadoId} onChange={(e) => set('advogadoId', e.target.value)}
              options={advogados.map((a) => ({ value: a.id, label: `${a.nomeCompleto} — ${a.cidadePrincipal}/${a.uf}` }))}
              error={errors.advogadoId} placeholder="Selecione o advogado" />
          </div>

          {sugestoes.length > 0 && (
            <div className="sm:col-span-2 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Sugestões para {form.cidade}
              </p>
              {sugestoes.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => set('advogadoId', a.id)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                    form.advogadoId === a.id
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{a.nomeCompleto}</p>
                    <p className="text-xs text-slate-500">{a.cidadePrincipal}/{a.uf}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0 text-xs">
                    {a.media != null && (
                      <span className="flex items-center gap-0.5 text-amber-600 font-medium">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {a.media.toFixed(1)}
                      </span>
                    )}
                    <span className="text-slate-400">{a.totalDiligencias} dilig.</span>
                  </div>
                  {form.advogadoId === a.id && (
                    <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  )}
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

export default function NovaDiligenciaPage() {
  return <Suspense><NovaForm /></Suspense>
}
