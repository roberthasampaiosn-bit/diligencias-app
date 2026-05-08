'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, AlertTriangle, Upload, CheckCircle2, XCircle } from 'lucide-react'
import { useConsultasPlacas } from '@/context/ConsultaPlacasContext'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { erroPlaca, normalizarPlaca, formatDate } from '@/lib/utils'
import type { ResultadoConsultaPlaca } from '@/types'

export default function NovaConsultaPlacaPage() {
  const router = useRouter()
  const { createConsultaPlaca, uploadAnexoConsulta, consultasPlacas } = useConsultasPlacas()

  const hoje = new Date().toISOString().split('T')[0]

  const [placa, setPlaca] = useState('')
  const [solicitante, setSolicitante] = useState('')
  const [dataConsulta, setDataConsulta] = useState(hoje)
  const [resultado, setResultado] = useState<ResultadoConsultaPlaca | ''>('')
  const [observacoes, setObservacoes] = useState('')
  const [valor, setValor] = useState('')
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

  // Consultas anteriores com a mesma placa (para exibir resultados)
  const historicoDuplicatas = useMemo(() => {
    if (!placa || placa.length < 7) return []
    if (erroPlaca(placa) !== null) return []
    return consultasPlacas
      .filter((c) => c.placa === placa)
      .sort((a, b) => b.dataConsulta.localeCompare(a.dataConsulta))
  }, [consultasPlacas, placa])

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
      const nova = await createConsultaPlaca({
        placa,
        solicitante: solicitante.trim(),
        dataConsulta,
        resultado: resultado || undefined,
        observacoes: observacoes.trim() || undefined,
        valor: valorNum,
      })
      if (resultado === 'Localizada') {
        if (fileResultado) await uploadAnexoConsulta(nova.id, 'anexoResultado', fileResultado)
        if (fileComprovante) await uploadAnexoConsulta(nova.id, 'comprovantePagamento', fileComprovante)
      }
      router.push(`/consulta-placas/${nova.id}`)
    } catch (err) {
      setErrors({ _: err instanceof Error ? err.message : 'Erro ao salvar.' })
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2">
        <Link href="/consulta-placas">
          <Button type="button" variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Nova consulta de placa</h1>
          <p className="text-sm text-slate-500">Registrar nova consulta solicitada à Anne</p>
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
                  <p className="text-xs text-amber-600">O novo cadastro será salvo normalmente.</p>
                </div>
              )}
            </div>

            <Input
              label="Solicitante *"
              value={solicitante}
              onChange={(e) => { setSolicitante(e.target.value); clearError('solicitante') }}
              placeholder="Nome de quem pediu a consulta"
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
            placeholder="Ex: imagem ruim, dúvida entre B e 8, solicitação repetida..."
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
                  placeholder="0,00"
                  error={errors.valor}
                  helper="Pode ser preenchido depois"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                Os anexos abaixo são opcionais. Você pode salvar agora e adicionar depois via edição.
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Resultado da consulta (arquivo)
                </label>
                <label className={`flex items-center gap-2 w-full cursor-pointer px-4 py-3 rounded-lg border-2 border-dashed text-sm transition-colors ${
                  fileResultado
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                }`}>
                  <Upload className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{fileResultado ? fileResultado.name : 'Clique para selecionar o arquivo (opcional)'}</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/*,.pdf"
                    onChange={(e) => { setFileResultado(e.target.files?.[0] ?? null) }}
                  />
                </label>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Comprovante de pagamento
                </label>
                <label className={`flex items-center gap-2 w-full cursor-pointer px-4 py-3 rounded-lg border-2 border-dashed text-sm transition-colors ${
                  fileComprovante
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                }`}>
                  <Upload className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{fileComprovante ? fileComprovante.name : 'Clique para selecionar o arquivo (opcional)'}</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/*,.pdf"
                    onChange={(e) => { setFileComprovante(e.target.files?.[0] ?? null) }}
                  />
                </label>
              </div>
            </div>
          )}

          {resultado === 'Não localizada' && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-500">
              Consulta não localizada não gera custo e não requer anexos.
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex gap-3 justify-end pb-6">
        <Link href="/consulta-placas">
          <Button type="button" variant="secondary">Cancelar</Button>
        </Link>
        <Button type="submit" loading={saving}>
          <Save className="w-4 h-4" /> Registrar consulta
        </Button>
      </div>
    </form>
  )
}
