'use client'

import { useState } from 'react'
import { UserPlus, Check, Trash2, AlertTriangle, RefreshCw, MapPin, Phone, CreditCard, FileText } from 'lucide-react'
import { useCadastros } from '@/context/CadastrosContext'
import { useAdvogados } from '@/context/AdvogadosContext'
import { useToast } from '@/context/ToastContext'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Advogado, CadastroAdvogado } from '@/types'
import { formatCPF, formatPhone, timeElapsed } from '@/lib/utils'

export default function CadastrosPage() {
  const { cadastros, loading, resolver } = useCadastros()
  const { advogados, createAdvogado, updateAdvogado } = useAdvogados()
  const { addToast } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  // Procura um advogado já cadastrado com o mesmo CPF (comparando só dígitos).
  function advogadoExistente(c: CadastroAdvogado): Advogado | undefined {
    if (!c.cpf) return undefined
    const cpf = c.cpf.replace(/\D/g, '')
    return advogados.find((a) => (a.cpf ?? '').replace(/\D/g, '') === cpf)
  }

  // Monta os dados do advogado a partir do cadastro recebido.
  function toAdvogadoData(c: CadastroAdvogado): Omit<Advogado, 'id' | 'createdAt'> {
    return {
      nomeCompleto: c.nomeCompleto,
      cpf: c.cpf || undefined,
      oab: c.oab ?? '',
      endereco: c.endereco ?? '',
      cidadePrincipal: c.cidadePrincipal ?? '',
      uf: c.uf ?? '',
      cidadesAtendidas: c.cidadesAtendidas ?? [],
      telefone: c.telefone ?? '',
      whatsapp: c.telefone || undefined,
      chavePix: c.chavePix || undefined,
      observacoes: c.observacoes || undefined,
    }
  }

  // Patch só com os campos preenchidos — não apaga dado bom do advogado existente.
  function toPatch(c: CadastroAdvogado): Partial<Advogado> {
    const p: Partial<Advogado> = {}
    if (c.nomeCompleto) p.nomeCompleto = c.nomeCompleto
    if (c.cpf) p.cpf = c.cpf
    if (c.oab) p.oab = c.oab
    if (c.endereco) p.endereco = c.endereco
    if (c.cidadePrincipal) p.cidadePrincipal = c.cidadePrincipal
    if (c.uf) p.uf = c.uf
    if (c.cidadesAtendidas?.length) p.cidadesAtendidas = c.cidadesAtendidas
    if (c.telefone) { p.telefone = c.telefone; p.whatsapp = c.telefone }
    if (c.chavePix) p.chavePix = c.chavePix
    return p
  }

  async function aprovarNovo(c: CadastroAdvogado) {
    setBusyId(c.id)
    try {
      const novo = await createAdvogado(toAdvogadoData(c))
      await resolver(c.id, 'aprovado', novo.id)
      addToast('success', `${c.nomeCompleto.split(' ')[0]} foi cadastrado(a).`)
    } catch {
      addToast('error', 'Não foi possível cadastrar. Tente novamente.')
    } finally {
      setBusyId(null)
    }
  }

  async function atualizarExistente(c: CadastroAdvogado, existente: Advogado) {
    setBusyId(c.id)
    try {
      await updateAdvogado(existente.id, toPatch(c))
      await resolver(c.id, 'aprovado', existente.id)
      addToast('success', `Dados de ${existente.nomeCompleto.split(' ')[0]} atualizados.`)
    } catch {
      addToast('error', 'Não foi possível atualizar. Tente novamente.')
    } finally {
      setBusyId(null)
    }
  }

  async function descartar(c: CadastroAdvogado) {
    setBusyId(c.id)
    try {
      await resolver(c.id, 'descartado')
      addToast('info', 'Cadastro descartado.')
    } catch {
      addToast('error', 'Não foi possível descartar. Tente novamente.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-slate-800">Cadastros recebidos</h1>
        {cadastros.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 text-xs font-bold rounded-full bg-amber-500 text-white">
            {cadastros.length}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-500 -mt-3">
        Cadastros enviados pelos advogados pelo link público, aguardando sua aprovação.
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : cadastros.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Nenhum cadastro pendente"
          description="Quando um advogado preencher o link, o cadastro aparece aqui para você revisar e aprovar."
        />
      ) : (
        <div className="space-y-4">
          {cadastros.map((c) => {
            const existente = advogadoExistente(c)
            const busy = busyId === c.id
            return (
              <Card key={c.id}>
                <CardBody className="space-y-4">
                  {/* Cabeçalho do cartão */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-800">{c.nomeCompleto}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Recebido {timeElapsed(c.createdAt)}</p>
                    </div>
                    {c.oab && (
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md whitespace-nowrap">
                        OAB {c.oab}
                      </span>
                    )}
                  </div>

                  {/* Dados enviados */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {c.cpf && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span>{formatCPF(c.cpf)}</span>
                      </div>
                    )}
                    {c.telefone && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span>{formatPhone(c.telefone)}</span>
                      </div>
                    )}
                    {c.chavePix && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <CreditCard className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="truncate">Pix: {c.chavePix}</span>
                      </div>
                    )}
                    {(c.cidadePrincipal || c.uf) && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span>{[c.cidadePrincipal, c.uf].filter(Boolean).join(' - ')}</span>
                      </div>
                    )}
                  </div>

                  {c.endereco && (
                    <p className="text-sm text-slate-500 flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      {c.endereco}
                    </p>
                  )}

                  {c.cidadesAtendidas.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {c.cidadesAtendidas.map((cidade) => (
                        <span key={cidade} className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-md">
                          {cidade}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Alerta de CPF já cadastrado */}
                  {existente && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>
                        Este CPF já está cadastrado como <strong>{existente.nomeCompleto}</strong>.
                        Você pode atualizar os dados dele(a) com o que foi enviado.
                      </span>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {existente ? (
                      <>
                        <Button variant="warning" size="sm" loading={busy} onClick={() => atualizarExistente(c, existente)}>
                          <RefreshCw className="w-4 h-4" /> Atualizar {existente.nomeCompleto.split(' ')[0]}
                        </Button>
                        <Button variant="secondary" size="sm" disabled={busy} onClick={() => aprovarNovo(c)}>
                          <Check className="w-4 h-4" /> Criar novo mesmo assim
                        </Button>
                      </>
                    ) : (
                      <Button variant="success" size="sm" loading={busy} onClick={() => aprovarNovo(c)}>
                        <Check className="w-4 h-4" /> Aprovar e cadastrar
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => descartar(c)}>
                      <Trash2 className="w-4 h-4" /> Descartar
                    </Button>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
