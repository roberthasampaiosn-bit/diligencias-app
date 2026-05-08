'use client'

import { use, useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Plus, X } from 'lucide-react'
import { AlertCircle } from 'lucide-react'
import { useAdvogados } from '@/context/AdvogadosContext'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { cleanPhone, toTitleCase, maskCPF, validarCPF } from '@/lib/utils'

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

interface Params { id: string }

export default function EditarAdvogadoPage({ params }: { params: Promise<Params> }) {
  const { id } = use(params)
  const router = useRouter()
  const { advogados, updateAdvogado } = useAdvogados()

  const advogado = useMemo(() => advogados.find((a) => a.id === id), [advogados, id])

  const [form, setForm] = useState({
    nomeCompleto: '',
    cpf: '',
    oab: '',
    endereco: '',
    cidadePrincipal: '',
    uf: '',
    telefone: '',
    chavePix: '',
    observacoes: '',
  })
  const [cidadesAtendidas, setCidadesAtendidas] = useState<string[]>([])
  const [novaCidade, setNovaCidade] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (advogado && !initialized) {
      setForm({
        nomeCompleto: advogado.nomeCompleto,
        cpf: advogado.cpf ?? '',
        oab: advogado.oab,
        endereco: advogado.endereco,
        cidadePrincipal: advogado.cidadePrincipal,
        uf: advogado.uf,
        telefone: advogado.telefone,
        chavePix: advogado.chavePix ?? '',
        observacoes: advogado.observacoes ?? '',
      })
      setCidadesAtendidas(advogado.cidadesAtendidas)
      setInitialized(true)
    }
  }, [advogado, initialized])

  if (!advogado && initialized === false && advogados.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertCircle className="w-12 h-12 text-slate-300" />
        <p className="text-slate-600 font-medium">Advogado não encontrado</p>
        <Link href="/advogados"><Button variant="secondary">Voltar</Button></Link>
      </div>
    )
  }

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n })
  }

  function addCidade() {
    const cidade = toTitleCase(novaCidade.trim())
    if (cidade && !cidadesAtendidas.includes(cidade)) {
      setCidadesAtendidas((prev) => [...prev, cidade])
      setNovaCidade('')
    }
  }

  function removeCidade(c: string) {
    setCidadesAtendidas((prev) => prev.filter((x) => x !== c))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.nomeCompleto) e.nomeCompleto = 'Campo obrigatório'
    if (form.cpf && !validarCPF(form.cpf)) e.cpf = 'CPF inválido'
    if (!form.oab) e.oab = 'Campo obrigatório'
    if (!form.endereco) e.endereco = 'Campo obrigatório'
    if (!form.cidadePrincipal) e.cidadePrincipal = 'Campo obrigatório'
    if (!form.uf) e.uf = 'Campo obrigatório'
    if (!form.telefone) e.telefone = 'Campo obrigatório'
    else {
      const d = cleanPhone(form.telefone)
      if (d.length < 10 || d.length > 11) e.telefone = 'Deve ter 10 ou 11 dígitos'
    }
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      const telefone = cleanPhone(form.telefone)
      await updateAdvogado(id, {
        nomeCompleto: toTitleCase(form.nomeCompleto),
        cpf: form.cpf ? form.cpf.replace(/\D/g, '') : undefined,
        oab: form.oab,
        endereco: form.endereco,
        cidadePrincipal: toTitleCase(form.cidadePrincipal),
        uf: form.uf,
        cidadesAtendidas: cidadesAtendidas.map((c) => toTitleCase(c)),
        telefone,
        whatsapp: telefone,
        chavePix: form.chavePix || undefined,
        observacoes: form.observacoes || undefined,
      })
      router.push(`/advogados/${id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verifique sua conexão e tente novamente.'
      console.error('[editar handleSubmit]', err)
      setErrors({ _: `Erro ao salvar — ${msg}` })
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <Link href={`/advogados/${id}`}>
          <Button variant="ghost" size="sm" type="button"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <h1 className="text-xl font-bold text-slate-800">Editar Advogado</h1>
      </div>

      {errors._ && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {errors._}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Dados Pessoais</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Nome completo"
              value={form.nomeCompleto}
              onChange={(e) => set('nomeCompleto', e.target.value)}
              onBlur={(e) => set('nomeCompleto', toTitleCase(e.target.value))}
              error={errors.nomeCompleto}
            />
          </div>
          <Input
            label="CPF (opcional)"
            value={form.cpf}
            onChange={(e) => set('cpf', maskCPF(e.target.value))}
            error={errors.cpf}
            placeholder="000.000.000-00"
          />
          <Input
            label="OAB nº"
            value={form.oab}
            onChange={(e) => set('oab', e.target.value)}
            error={errors.oab}
            placeholder="SP 123456"
            helper="Usado em contratos e recibos"
          />
          <div className="sm:col-span-2">
            <Input label="Endereço completo" value={form.endereco} onChange={(e) => set('endereco', e.target.value)} error={errors.endereco} placeholder="Rua, número, bairro, cidade - UF, CEP" />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Atuação</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Cidade principal" value={form.cidadePrincipal} onChange={(e) => set('cidadePrincipal', e.target.value)} error={errors.cidadePrincipal} />
          <Select label="UF" value={form.uf} onChange={(e) => set('uf', e.target.value)} options={UFS.map((u) => ({ value: u, label: u }))} error={errors.uf} placeholder="Selecione" />
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-slate-600 mb-1.5">Cidades atendidas</p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={novaCidade}
                onChange={(e) => setNovaCidade(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCidade())}
                placeholder="Digite uma cidade e pressione Enter"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button type="button" variant="secondary" size="sm" onClick={addCidade}>
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cidadesAtendidas.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-md">
                  {c}
                  <button type="button" onClick={() => removeCidade(c)} className="hover:text-blue-900"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contato e Pagamento</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input label="Telefone/WhatsApp" value={form.telefone} onChange={(e) => set('telefone', e.target.value)} error={errors.telefone} placeholder="11987654321" helper="Com DDD — usado para ligação e WhatsApp" />
          </div>
          <div className="sm:col-span-2">
            <Input label="Chave Pix (opcional)" value={form.chavePix} onChange={(e) => set('chavePix', e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" />
          </div>
          <div className="sm:col-span-2">
            <Textarea label="Observações" value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} placeholder="Informações adicionais..." />
          </div>
        </CardBody>
      </Card>

      <div className="flex gap-3 justify-end pb-6">
        <Link href={`/advogados/${id}`}>
          <Button variant="secondary" type="button">Cancelar</Button>
        </Link>
        <Button type="submit" loading={saving}>
          <Save className="w-4 h-4" /> Salvar alterações
        </Button>
      </div>
    </form>
  )
}
