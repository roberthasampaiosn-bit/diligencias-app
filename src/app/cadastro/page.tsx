'use client'

import { useState } from 'react'
import { Scale, Plus, X, Check, CircleCheck } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { maskCPF, validarCPF, cleanPhone, toTitleCase } from '@/lib/utils'

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

// Máscara de telefone ao digitar: (11) 98765-4321
function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export default function CadastroPublicoPage() {
  const [form, setForm] = useState({
    nomeCompleto: '',
    cpf: '',
    oabUf: '',
    oabNumero: '',
    telefone: '',
    endereco: '',
    chavePix: '',
    cidadePrincipal: '',
    uf: '',
  })
  const [cidadesAtendidas, setCidadesAtendidas] = useState<string[]>([])
  const [novaCidade, setNovaCidade] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)

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
    if (!form.nomeCompleto.trim()) e.nomeCompleto = 'Por favor, preencha seu nome.'
    if (!form.cpf) e.cpf = 'Por favor, preencha seu CPF.'
    else if (!validarCPF(form.cpf)) e.cpf = 'Esse CPF não parece válido. Confira os números.'
    if (!form.oabUf) e.oabUf = 'Selecione o estado da OAB.'
    if (!form.oabNumero.trim()) e.oabNumero = 'Preencha o número da OAB.'
    if (!form.telefone) e.telefone = 'Por favor, preencha seu telefone.'
    else {
      const d = cleanPhone(form.telefone)
      if (d.length < 10 || d.length > 11) e.telefone = 'Inclua o DDD + número (ex.: (11) 98765-4321).'
    }
    if (!form.endereco.trim()) e.endereco = 'Por favor, preencha seu endereço.'
    if (!form.chavePix.trim()) e.chavePix = 'Por favor, informe sua chave Pix.'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      // leva o usuário até o primeiro campo com erro
      const first = document.querySelector('[data-error="true"]')
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/cadastro-advogado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomeCompleto: toTitleCase(form.nomeCompleto),
          cpf: form.cpf.replace(/\D/g, ''),
          oab: `${form.oabUf} ${form.oabNumero.trim()}`,
          endereco: form.endereco.trim(),
          cidadePrincipal: form.cidadePrincipal.trim(),
          uf: form.uf,
          cidadesAtendidas,
          telefone: cleanPhone(form.telefone),
          chavePix: form.chavePix.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Não foi possível enviar. Tente novamente.')
      }
      setSent(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verifique sua conexão e tente novamente.'
      setErrors({ _: msg })
      setSaving(false)
    }
  }

  if (sent) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CircleCheck className="w-9 h-9 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Cadastro recebido!</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Obrigado, <span className="font-medium text-slate-700">{toTitleCase(form.nomeCompleto).split(' ')[0]}</span>!
            Recebemos seus dados com sucesso. Não precisa enviar de novo — entraremos em contato em breve.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <form onSubmit={handleSubmit} className="w-full max-w-lg mx-auto space-y-5">
        {/* Cabeçalho */}
        <div className="text-center pb-2">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-3">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Cadastro de Advogado</h1>
          <p className="text-base text-slate-600 mt-2 leading-relaxed">
            Que bom ter você com a gente! Preencha seus dados abaixo — leva só
            alguns minutos e dá pra fazer pelo celular.
          </p>
        </div>

        {errors._ && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {errors._}
          </div>
        )}

        {/* Seus dados */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Seus dados</h2>

          <div data-error={!!errors.nomeCompleto}>
            <Input
              label="Nome completo"
              value={form.nomeCompleto}
              onChange={(e) => set('nomeCompleto', e.target.value)}
              onBlur={(e) => set('nomeCompleto', toTitleCase(e.target.value))}
              error={errors.nomeCompleto}
              placeholder="Seu nome completo"
              autoComplete="name"
            />
          </div>

          <div data-error={!!errors.cpf}>
            <Input
              label="CPF"
              value={form.cpf}
              onChange={(e) => set('cpf', maskCPF(e.target.value))}
              error={errors.cpf}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
          </div>

          {/* OAB: estado (sigla maiúscula) + número */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-1">OAB</p>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <div data-error={!!errors.oabUf}>
                <Select
                  value={form.oabUf}
                  onChange={(e) => set('oabUf', e.target.value)}
                  options={UFS.map((u) => ({ value: u, label: u }))}
                  placeholder="UF"
                  error={errors.oabUf}
                  aria-label="Estado da OAB"
                />
              </div>
              <div data-error={!!errors.oabNumero}>
                <Input
                  value={form.oabNumero}
                  onChange={(e) => set('oabNumero', e.target.value.replace(/\D/g, ''))}
                  error={errors.oabNumero}
                  placeholder="Número (ex.: 123456)"
                  inputMode="numeric"
                  aria-label="Número da OAB"
                />
              </div>
            </div>
          </div>

          <div data-error={!!errors.telefone}>
            <Input
              label="Telefone / WhatsApp"
              value={form.telefone}
              onChange={(e) => set('telefone', maskPhone(e.target.value))}
              error={errors.telefone}
              placeholder="(11) 98765-4321"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>

          <div data-error={!!errors.endereco}>
            <Input
              label="Endereço completo"
              value={form.endereco}
              onChange={(e) => set('endereco', e.target.value)}
              error={errors.endereco}
              placeholder="Rua, número, bairro, cidade - UF, CEP"
            />
          </div>

          <div data-error={!!errors.chavePix}>
            <Input
              label="Chave Pix"
              value={form.chavePix}
              onChange={(e) => set('chavePix', e.target.value)}
              error={errors.chavePix}
              placeholder="CPF, telefone, e-mail ou chave aleatória"
            />
            <p className="text-xs text-slate-500 mt-2 mb-1.5">
              Sua chave Pix é o CPF ou o telefone? Toque para preencher automaticamente:
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => set('chavePix', maskCPF(form.cpf))}
                disabled={!form.cpf}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Usar meu CPF
              </button>
              <button
                type="button"
                onClick={() => set('chavePix', cleanPhone(form.telefone))}
                disabled={!form.telefone}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Usar meu telefone
              </button>
            </div>
            {!form.cpf && !form.telefone && (
              <p className="text-xs text-slate-400 mt-1.5">
                Preencha o CPF ou o telefone acima para liberar os atalhos.
              </p>
            )}
          </div>
        </div>

        {/* Onde atua (opcional) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">
            Onde você atua <span className="font-normal text-slate-400">(opcional)</span>
          </h2>

          <div className="grid grid-cols-[1fr_110px] gap-2">
            <Input
              label="Cidade principal"
              value={form.cidadePrincipal}
              onChange={(e) => set('cidadePrincipal', e.target.value)}
              onBlur={(e) => set('cidadePrincipal', toTitleCase(e.target.value))}
              placeholder="Cidade onde atua"
            />
            <Select
              label="UF"
              value={form.uf}
              onChange={(e) => set('uf', e.target.value)}
              options={UFS.map((u) => ({ value: u, label: u }))}
              placeholder="UF"
            />
          </div>

          <div>
            <p className="text-xs font-medium text-slate-600 mb-1.5">Outras cidades que você atende</p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={novaCidade}
                onChange={(e) => setNovaCidade(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCidade())}
                placeholder="Digite uma cidade e toque em Add"
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
        </div>

        <Button type="submit" loading={saving} className="w-full justify-center" size="lg">
          <Check className="w-4 h-4" /> Enviar cadastro
        </Button>

        <p className="text-center text-xs text-slate-400 pb-4">
          Seus dados são usados apenas para fins de contrato e pagamento das diligências.
        </p>
      </form>
    </main>
  )
}
