'use client'

import { use, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, AlertTriangle, Upload, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { useConsultasPlacas } from '@/context/ConsultaPlacasContext'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { erroPlaca, normalizarPlaca, formatDate } from '@/lib/utils'
import type { ResultadoConsultaPlaca } from '@/types'

export default function EditarConsultaPlacaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { consultasPlacas, updateConsultaPlaca, uploadAnexoConsulta } = useConsultasPlacas()
  const consulta = consultasPlacas.find((c) => c.id === id)

  const [placa, setPlaca] = useState(consulta?.placa ?? '')
  const [solicitante, setSolicitante] = useState(consulta?.solicitante ?? '')
  const [dataConsulta, setDataConsulta] = useState(consulta?.dataConsulta ?? '')
  const [resultado, setResultado] = useState<ResultadoConsultaPlaca | ''>(consulta?.resultado ?? '')
  const [observacoes, setObservacoes] = useState(consulta?.observacoes ?? '')
  const [valor, setValor] = useState(consulta?.valor != null ? String(consulta.valor) : '')
  const [fileResultado, setFileResultado] = useState<File | null>(null)
  const [fileComprovante, setFileComprovante] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Normaliza em tempo real: remove espaços e força maiúsculo
  function handlePlacaChange(raw: string) {
    const normalizado = normalizarPlaca(raw)
    setPlaca(normalizado)
    clearError('placa')
  }

  // Outras consultas com a mesma placa (excluindo a atual)
  const historicoDuplicatas = useMemo(() => {
    if (!placa || placa.length < 7) return []
    if (erroPlaca(placa) !== null) return []
    return consultasPlacas
      .filter((c) => c.placa === placa && c.id !== id)
      .sort((a, b) => b.dataConsulta.localeCompare(a.dataConsulta))
  }, [consultasPlacas, placa, id])

  function clearError(field: string) {
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n })
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    const msgPlaca = erroPlaca(placa)
    if (msgPlaca) e.placa = msgPlaca
    if (!solicitante.trim()) e.solicitante = 'Solicitante é obrigatório.'
    if (!dataConsulta) e.dataConsulta = 'Data é obrigatória.'
    if (resultado === 'Localizada') {
      if (valor && isNaN(parseFloat(valor.replace(',', '.')))) e.valor = 'Valor inválido.'
    }
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      const valorNum = resultado === 'Localizada' && valor ? parseFloat(valor.replace(',', '.')) : undefined
      await updateConsultaPlaca(id, {
        placa,
        solicitante: solicitante.trim(),
        dataConsulta,
        resultado: resultado || undefined,
        observacoes: observacoes.trim() || undefined,
        valor: valorNum,
        ...(resultado !== 'Localizada' ? { anexoResultado: undefined, comprovantePagamento: undefined, valor: undefined } : {}),
      })
      if (resultado === 'Localizada') {
        if (fileResultado) await uploadAnexoConsulta(id, 'anexoResultado', fileResultado)
        if (fileComprovante) await uploadAnexoConsulta(id, 'comprovantePagamento', fileComprovante)
      }
      router.push(`/consulta-placas/${id}`)
    } catch (err) {
      setErrors({ _: err instanceof Error ? err.message : 'Erro ao salvar.' })
      setSaving(false)
    }
  }

  if (!consulta) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-slate-500 font-medium">Consulta não encontrada</p>
        <Link href="/consulta-placas" className="mt-3">
          <Button variant="secondary" size="sm"><ArrowLeft className="w-3.5 h-3.5" /> Voltar</Button>
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2">
        <Link href={`/consulta-placas/${id}`}>
          <Button type="button" variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Editar consulta — <span className="font-mono">{consulta.placa}</span></h1>
        </div>
      </div>

      {errors._ && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{errors._}</div>
      )}

      <Card>
        <CardHeader><CardTitle>Dados da consulta</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Input
                label="Placa consultada *"
                value={placa}
                onChange={(e) => handlePlacaChange(e.target.value)}
                placeholder="ABC1234 ou ABC1D23"
                maxLength={7}
                error={errors.placa}
                helper="Espaços e traços são removidos automaticamente"
              />

              {/* Alerta de placa já consultada — com histórico de resultados */}
              {historicoDuplicatas.length > 0 && !errors.placa && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Esta placa já foi consultada anteriormente
                  </p>
                  <ul className="space-y-1">
                    {historicoDuplicatas.map((c) => (
                      <li key={c.id} className="flex items-center justify-between text-xs text-amber-700">
                        <span>{formatDate(c.dataConsulta)} · {c.solicitante}</span>
                        {c.resultado === 'Localizada' ? (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" /> Localizada
                          </span>
                        ) : c.resultado === 'Não localizada' ? (
                          <span className="inline-flex items-center gap-1 font-medium text-red-700">
                            <XCircle className="w-3 h-3" /> Não localizada
                          </span>
                        ) : (
                          <span className="text-amber-500">Sem resultado</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Input
              label="Solicitante *"
              value={solicitante}
              onChange={(e) => { setSolicitante(e.target.value); clearError('solicitante') }}
              error={errors.solicitante}
            />
          </div>

          <div className="w-48">
            <Input
              label="Data da consulta *"
              type="date"
              value={dataConsulta}
              onChange={(e) => { setDataConsulta(e.target.value); clearError('dataConsulta') }}
              error={errors.dataConsulta}
            />
          </div>

          <Textarea
            label="Observações"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Resultado</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">Resultado da consulta</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setResultado('Localizada'); clearError('resultado') }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  resultado === 'Localizada'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" /> Localizada
              </button>
              <button
                type="button"
                onClick={() => { setResultado('Não localizada'); clearError('resultado') }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  resultado === 'Não localizada'
                    ? 'bg-red-50 border-red-400 text-red-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <XCircle className="w-4 h-4" /> Não localizada
              </button>
            </div>
          </div>

          {resultado === 'Localizada' && (
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <div className="w-48">
                <Input
                  label="Valor pago"
                  type="number"
                  step="0.01"
                  min="0"
                  value={valor}
                  onChange={(e) => { setValor(e.target.value); clearError('valor') }}
                  error={errors.valor}
                  helper="Pode ser preenchido depois"
                />
              </div>

              {/* Resultado da consulta (arquivo) */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1">Resultado da consulta (arquivo)</p>
                {consulta.anexoResultado && !fileResultado ? (
                  <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-emerald-300 bg-emerald-50">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="text-sm text-emerald-700 font-medium">Arquivo já anexado</span>
                      <a href={consulta.anexoResultado} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800 ml-1">
                        Ver <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <label className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 underline whitespace-nowrap flex-shrink-0">
                      Substituir
                      <input type="file" className="sr-only" accept="image/*,.pdf" onChange={(e) => setFileResultado(e.target.files?.[0] ?? null)} />
                    </label>
                  </div>
                ) : (
                  <label className={`flex items-center gap-2 w-full cursor-pointer px-4 py-3 rounded-lg border-2 border-dashed text-sm transition-colors ${
                    fileResultado ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                  }`}>
                    <Upload className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{fileResultado ? fileResultado.name : 'Clique para selecionar (opcional)'}</span>
                    <input type="file" className="sr-only" accept="image/*,.pdf" onChange={(e) => setFileResultado(e.target.files?.[0] ?? null)} />
                  </label>
                )}
              </div>

              {/* Comprovante de pagamento */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1">Comprovante de pagamento</p>
                {consulta.comprovantePagamento && !fileComprovante ? (
                  <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-emerald-300 bg-emerald-50">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="text-sm text-emerald-700 font-medium">Arquivo já anexado</span>
                      <a href={consulta.comprovantePagamento} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800 ml-1">
                        Ver <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <label className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 underline whitespace-nowrap flex-shrink-0">
                      Substituir
                      <input type="file" className="sr-only" accept="image/*,.pdf" onChange={(e) => setFileComprovante(e.target.files?.[0] ?? null)} />
                    </label>
                  </div>
                ) : (
                  <label className={`flex items-center gap-2 w-full cursor-pointer px-4 py-3 rounded-lg border-2 border-dashed text-sm transition-colors ${
                    fileComprovante ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                  }`}>
                    <Upload className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{fileComprovante ? fileComprovante.name : 'Clique para selecionar (opcional)'}</span>
                    <input type="file" className="sr-only" accept="image/*,.pdf" onChange={(e) => setFileComprovante(e.target.files?.[0] ?? null)} />
                  </label>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex gap-3 justify-end pb-6">
        <Link href={`/consulta-placas/${id}`}>
          <Button type="button" variant="secondary">Cancelar</Button>
        </Link>
        <Button type="submit" loading={saving}>
          <Save className="w-4 h-4" /> Salvar alterações
        </Button>
      </div>
    </form>
  )
}
