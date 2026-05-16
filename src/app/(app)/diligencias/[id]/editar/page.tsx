'use client'

import { use, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, AlertCircle, CheckCircle2, Star } from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useAdvogados } from '@/context/AdvogadosContext'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { StatusDiligencia, StatusPagamento, ModoDiligencia, TipoDiligencia, TipoEvento, EmpresaCliente } from '@/types'
import { cleanPhone, normalizarCccBat, validarCccBat } from '@/lib/utils'
import { TIPOS_EVENTO_BAT } from '@/lib/constants'

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

interface Params { id: string }

export default function EditarDiligenciaPage({ params }: { params: Promise<Params> }) {
  const { id } = use(params)
  const router = useRouter()
  const { diligencias, updateDiligencia } = useDiligencias()
  const { advogados } = useAdvogados()

  const original = useMemo(() => diligencias.find((d) => d.id === id), [diligencias, id])

  const [form, setForm] = useState(() => original ? {
    ccc: original.ccc,
    dataAtendimento: original.dataAtendimento || original.createdAt.split('T')[0],
    vitima: original.vitima,
    telefoneVitima: original.telefoneVitima,
    cargo: original.cargo,
    empresa: original.empresa,
    empresaCliente: original.empresaCliente,
    cidade: original.cidade,
    uf: original.uf,
    tipoEvento: original.tipoEvento,
    tipoDiligencia: original.tipoDiligencia,
    tipoDiligenciaDescricao: original.tipoDiligenciaDescricao || '',
    modoDiligencia: original.modoDiligencia,
    advogadoId: original.advogadoId,
    valorDiligencia: String(original.valorDiligencia),
    observacoes: original.observacoes || '',
    dpRegistrou: original.dpRegistrou || '',
    status: original.status,
    statusPagamento: original.statusPagamento,
  } : null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const sugestoes = useMemo(() => {
    if (!form || form.modoDiligencia !== ModoDiligencia.Presencial) return []
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
  }, [form, advogados, diligencias])

  if (!original || !form) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertCircle className="w-12 h-12 text-slate-300" />
        <p className="text-slate-600 font-medium">Diligência não encontrada</p>
        <Link href="/diligencias"><Button variant="secondary">Voltar</Button></Link>
      </div>
    )
  }

  function set(field: string, value: string) {
    setForm((prev) => prev ? ({ ...prev, [field]: value }) : prev)
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n })
  }

  function handleCccBlur() {
    if (!form || form.empresaCliente !== EmpresaCliente.BatBrasil) return
    const normalized = normalizarCccBat(form.ccc)
    if (normalized !== form.ccc) set('ccc', normalized)
  }

  function validate(f: NonNullable<typeof form>) {
    const e: Record<string, string> = {}
    if (f.empresaCliente === EmpresaCliente.BatBrasil) {
      const erroCcc = validarCccBat(f.ccc)
      if (erroCcc) e.ccc = erroCcc
    } else if (!f.ccc) {
      // VTAL: CCC é o nº processo, opcional
    }
    if (!f.vitima) e.vitima = 'Obrigatório'
    if (!f.cidade) e.cidade = 'Obrigatório'
    if (!f.uf) e.uf = 'Obrigatório'
    if (f.telefoneVitima) {
      const d = cleanPhone(f.telefoneVitima)
      if (d.length < 10 || d.length > 11) e.telefoneVitima = '10 ou 11 dígitos'
    }
    if (!f.advogadoId) e.advogadoId = 'Selecione um advogado'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    const errs = validate(form)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      await updateDiligencia(id, {
        ccc: form.ccc,
        dataAtendimento: form.dataAtendimento || undefined,
        vitima: form.vitima,
        telefoneVitima: cleanPhone(form.telefoneVitima),
        cargo: form.cargo,
        empresa: form.empresa,
        empresaCliente: form.empresaCliente,
        cidade: form.cidade,
        tipoDiligenciaDescricao: form.tipoDiligencia === TipoDiligencia.Outro ? form.tipoDiligenciaDescricao : undefined,
        uf: form.uf,
        tipoEvento: form.tipoEvento as TipoEvento,
        tipoDiligencia: form.tipoDiligencia as TipoDiligencia,
        modoDiligencia: form.modoDiligencia as ModoDiligencia,
        advogadoId: form.advogadoId,
        valorDiligencia: form.valorDiligencia ? parseFloat(form.valorDiligencia) : 0,
        observacoes: form.observacoes,
        dpRegistrou: form.dpRegistrou,
        status: form.status as StatusDiligencia,
        statusPagamento: form.statusPagamento as StatusPagamento,
      })
      router.push(`/diligencias/${id}`)
    } catch {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <Link href={`/diligencias/${id}`}>
          <Button variant="ghost" size="sm" type="button"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Editar Diligência</h1>
          <p className="text-xs font-mono text-blue-600">{original.ccc}</p>
        </div>
      </div>

      {errors._ && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {errors._}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Status</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Status da diligência" value={form.status} onChange={(e) => set('status', e.target.value)}
            options={Object.values(StatusDiligencia).map((v) => ({ value: v, label: v }))} />
          <Select label="Status do pagamento" value={form.statusPagamento} onChange={(e) => set('statusPagamento', e.target.value)}
            options={Object.values(StatusPagamento).map((v) => ({ value: v, label: v }))} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Identificação</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="CCC"
            value={form.ccc}
            onChange={(e) => set('ccc', form.empresaCliente === EmpresaCliente.BatBrasil ? e.target.value.toUpperCase() : e.target.value)}
            onBlur={handleCccBlur}
            error={errors.ccc}
            placeholder={form.empresaCliente === EmpresaCliente.BatBrasil ? 'BR-2026030019' : undefined}
          />
          <Input label="Data de atendimento" type="date" value={form.dataAtendimento} onChange={(e) => set('dataAtendimento', e.target.value)} />
          <Select label="Tipo de evento" value={form.tipoEvento} onChange={(e) => set('tipoEvento', e.target.value)}
            options={form.empresaCliente === EmpresaCliente.BatBrasil
              ? TIPOS_EVENTO_BAT.map((v) => ({ value: v, label: v }))
              : Object.values(TipoEvento).map((v) => ({ value: v, label: v }))} />
          <Select label="Tipo de diligência" value={form.tipoDiligencia} onChange={(e) => set('tipoDiligencia', e.target.value)}
            options={Object.values(TipoDiligencia).map((v) => ({ value: v, label: v }))} />
          <Select label="Modo" value={form.modoDiligencia} onChange={(e) => set('modoDiligencia', e.target.value)}
            options={Object.values(ModoDiligencia).map((v) => ({ value: v, label: v }))} />
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
          <Input label="Telefone" value={form.telefoneVitima} onChange={(e) => set('telefoneVitima', e.target.value)} error={errors.telefoneVitima} />
          <Input label="Cargo" value={form.cargo} onChange={(e) => set('cargo', e.target.value)} />
          <div className="sm:col-span-2">
            <Select label="Cliente (escritório)" value={form.empresaCliente} onChange={(e) => set('empresaCliente', e.target.value)}
              options={Object.values(EmpresaCliente).map((v) => ({ value: v, label: v }))} />
          </div>
          <div className="sm:col-span-2">
            <Input label="Empresa da vítima" value={form.empresa} onChange={(e) => set('empresa', e.target.value)} placeholder="Nome da empresa onde a vítima trabalha" />
          </div>
          <Input label="Cidade" value={form.cidade} onChange={(e) => set('cidade', e.target.value)} error={errors.cidade} />
          <Select label="UF" value={form.uf} onChange={(e) => set('uf', e.target.value)}
            options={UFS.map((u) => ({ value: u, label: u }))} error={errors.uf} />
          <div className="sm:col-span-2">
            <Input label="DP que registrou" value={form.dpRegistrou} onChange={(e) => set('dpRegistrou', e.target.value)} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Advogado e Valor</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Select label="Advogado" value={form.advogadoId} onChange={(e) => set('advogadoId', e.target.value)}
              options={advogados.map((a) => ({ value: a.id, label: `${a.nomeCompleto} — ${a.cidadePrincipal}/${a.uf}` }))}
              error={errors.advogadoId} />
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

          <Input label="Valor (R$)" type="number" step="0.01" value={form.valorDiligencia} onChange={(e) => set('valorDiligencia', e.target.value)} />
          <div className="sm:col-span-2">
            <Textarea label="Observações" value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
          </div>
        </CardBody>
      </Card>

      <div className="flex gap-3 justify-end pb-6">
        <Link href={`/diligencias/${id}`}>
          <Button variant="secondary" type="button">Cancelar</Button>
        </Link>
        <Button type="submit" loading={saving}>
          <Save className="w-4 h-4" /> Salvar alterações
        </Button>
      </div>
    </form>
  )
}
