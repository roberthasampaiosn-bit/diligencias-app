'use client'

import { use, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Phone, MessageCircle, MapPin, Edit, Briefcase, Star } from 'lucide-react'
import { AlertCircle } from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useAdvogados } from '@/context/AdvogadosContext'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatusDiligenciaBadge, StatusPagamentoBadge } from '@/components/shared/StatusBadge'
import { formatCPF, formatPhone, formatCurrency, formatDate } from '@/lib/utils'
import { StatusPagamento } from '@/types'

interface Params { id: string }

export default function AdvogadoDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = use(params)
  const { diligencias } = useDiligencias()
  const { advogados } = useAdvogados()

  const advogado = useMemo(() => advogados.find((a) => a.id === id), [advogados, id])
  const advDiligencias = useMemo(
    () => diligencias.filter((d) => d.advogadoId === id),
    [diligencias, id]
  )

  const finalizadas = useMemo(
    () => advDiligencias.filter((d) => d.cicloFinalizado),
    [advDiligencias]
  )

  const mediaAvaliacao = useMemo(() => {
    const comNota = finalizadas.filter((d) => d.avaliacao?.nota)
    if (comNota.length === 0) return null
    const soma = comNota.reduce((acc, d) => acc + d.avaliacao!.nota, 0)
    return +(soma / comNota.length).toFixed(1)
  }, [finalizadas])

  if (!advogado) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertCircle className="w-12 h-12 text-slate-300" />
        <p className="text-slate-600 font-medium">Advogado não encontrado</p>
        <Link href="/advogados"><Button variant="secondary">Voltar</Button></Link>
      </div>
    )
  }

  const totalPago = advDiligencias
    .filter((d) => d.statusPagamento === StatusPagamento.Pago)
    .reduce((acc, d) => acc + d.valorDiligencia, 0)

  const totalPendente = advDiligencias
    .filter((d) => d.statusPagamento === StatusPagamento.Pendente)
    .reduce((acc, d) => acc + d.valorDiligencia, 0)

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/advogados">
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{advogado.nomeCompleto}</h1>
            <p className="text-xs text-slate-500">{advogado.oab}</p>
          </div>
        </div>
        <Link href={`/advogados/${id}/editar`}>
          <Button variant="secondary" size="sm"><Edit className="w-3.5 h-3.5" /> Editar</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={`tel:${advogado.telefone}`}>
          <Button variant="secondary" size="sm">
            <Phone className="w-3.5 h-3.5" /> {formatPhone(advogado.telefone)}
          </Button>
        </a>
        <a href={`https://wa.me/55${(advogado.whatsapp || advogado.telefone).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
          <Button variant="secondary" size="sm">
            <MessageCircle className="w-3.5 h-3.5 text-green-600" /> WhatsApp
          </Button>
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Dados Pessoais</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <DetailRow label="Nome completo" value={advogado.nomeCompleto} />
            {advogado.cpf && <DetailRow label="CPF" value={formatCPF(advogado.cpf)} />}
            <DetailRow label="OAB" value={advogado.oab} />
            <DetailRow label="Endereço" value={advogado.endereco} />
            {advogado.chavePix && <DetailRow label="Chave Pix" value={advogado.chavePix} />}
            {advogado.observacoes && <DetailRow label="Observações" value={advogado.observacoes} />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Área de Atuação</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <DetailRow
              label="Cidade principal"
              value={
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {advogado.cidadePrincipal}/{advogado.uf}
                </span>
              }
            />
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1.5">Cidades atendidas</p>
              <div className="flex flex-wrap gap-1.5">
                {advogado.cidadesAtendidas.map((c) => (
                  <Badge key={c} variant="slate">{c}</Badge>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Resumo Financeiro</CardTitle></CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-0.5">Diligências</p>
                <p className="text-xl font-bold text-slate-800">{advDiligencias.length}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-xs text-emerald-600 mb-0.5">Total pago</p>
                <p className="text-sm font-bold text-emerald-700">{formatCurrency(totalPago)}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-xs text-amber-600 mb-0.5">Pendente</p>
                <p className="text-sm font-bold text-amber-700">{formatCurrency(totalPendente)}</p>
              </div>
            </div>

            {/* Média de avaliação */}
            {mediaAvaliacao !== null && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-500">Média de avaliação</p>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`w-3.5 h-3.5 ${n <= Math.round(mediaAvaliacao) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                    ))}
                  </div>
                  <span className="text-sm font-bold text-amber-700">{mediaAvaliacao}</span>
                  <span className="text-xs text-slate-400">({finalizadas.filter((d) => d.avaliacao?.nota).length} avaliações)</span>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Histórico de diligências */}
      {advDiligencias.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-slate-400" />
              <CardTitle>Histórico de Diligências ({advDiligencias.length})</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-slate-50">
              {advDiligencias.map((d) => (
                <Link key={d.id} href={`/diligencias/${d.id}`} className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50 group">
                  <div className="flex-1 min-w-0">
                    {/* Linha 1: CCC + nome vítima */}
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-mono text-xs text-blue-600 font-semibold">{d.ccc}</span>
                      <span className="text-sm font-medium text-slate-800 group-hover:text-blue-700 truncate">{d.vitima}</span>
                    </div>
                    {/* Linha 2: cidade/UF + valor + data */}
                    <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 mb-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{d.cidade}/{d.uf}
                      </span>
                      <span className="font-semibold text-emerald-600">{formatCurrency(d.valorDiligencia)}</span>
                      <span>{formatDate(d.createdAt.split('T')[0])}</span>
                    </div>
                    {/* Avaliação (se tiver) */}
                    {d.avaliacao && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} className={`w-3 h-3 ${n <= d.avaliacao!.nota ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                          ))}
                        </div>
                        {d.avaliacao.observacao && (
                          <span className="text-xs text-slate-500 italic truncate max-w-xs">"{d.avaliacao.observacao}"</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <StatusDiligenciaBadge status={d.status} />
                    <StatusPagamentoBadge status={d.statusPagamento} />
                  </div>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className="text-sm text-slate-800">{value || '—'}</span>
    </div>
  )
}
