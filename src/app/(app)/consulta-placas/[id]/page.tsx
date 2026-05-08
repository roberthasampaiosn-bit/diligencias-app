'use client'

import { use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Pencil, CarFront, CheckCircle2, XCircle,
  AlertTriangle, ExternalLink, DollarSign, Paperclip,
} from 'lucide-react'
import { useConsultasPlacas } from '@/context/ConsultaPlacasContext'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/utils'

function ResultadoBadge({ resultado }: { resultado?: string }) {
  if (!resultado) {
    return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-500">Sem resultado</span>
  }
  if (resultado === 'Localizada') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="w-4 h-4" /> Localizada
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
      <XCircle className="w-4 h-4" /> Não localizada
    </span>
  )
}

function AnexoLink({ url, label }: { url?: string; label: string }) {
  if (!url) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        Pendente
      </span>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
    >
      <Paperclip className="w-3.5 h-3.5" />
      {label}
      <ExternalLink className="w-3 h-3" />
    </a>
  )
}

export default function ConsultaPlacaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { consultasPlacas } = useConsultasPlacas()
  const consulta = consultasPlacas.find((c) => c.id === id)

  // Conta quantas vezes esta placa foi consultada
  const repeticoes = consulta
    ? consultasPlacas.filter((c) => c.placa === consulta.placa).length
    : 0

  if (!consulta) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <CarFront className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-slate-500 font-medium">Consulta não encontrada</p>
        <Link href="/consulta-placas" className="mt-3">
          <Button variant="secondary" size="sm"><ArrowLeft className="w-3.5 h-3.5" /> Voltar</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/consulta-placas">
            <Button type="button" variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800 font-mono">{consulta.placa}</h1>
            <p className="text-sm text-slate-500">Consulta de placa</p>
          </div>
        </div>
        <Link href={`/consulta-placas/${id}/editar`}>
          <Button variant="secondary" size="sm"><Pencil className="w-3.5 h-3.5" /> Editar</Button>
        </Link>
      </div>

      {/* Alerta de placa repetida */}
      {repeticoes > 1 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Esta placa já foi consultada <strong>{repeticoes} vezes</strong> no histórico.
          </p>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Dados da consulta</CardTitle></CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Placa</dt>
              <dd className="mt-1 text-sm font-bold font-mono text-slate-800">{consulta.placa}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Solicitante</dt>
              <dd className="mt-1 text-sm text-slate-800">{consulta.solicitante}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Data da consulta</dt>
              <dd className="mt-1 text-sm text-slate-800">{formatDate(consulta.dataConsulta)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Resultado</dt>
              <dd className="mt-1"><ResultadoBadge resultado={consulta.resultado} /></dd>
            </div>
            {consulta.observacoes && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Observações</dt>
                <dd className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{consulta.observacoes}</dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>

      {consulta.resultado === 'Localizada' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-slate-400" />
                <CardTitle>Dados financeiros</CardTitle>
              </div>
              {(!consulta.valor || !consulta.anexoResultado || !consulta.comprovantePagamento) && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                  <AlertTriangle className="w-3 h-3" /> Dados pendentes
                </span>
              )}
            </div>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Valor pago</dt>
                <dd className="mt-1 text-lg font-bold text-emerald-700">
                  {consulta.valor != null ? formatCurrency(consulta.valor) : <span className="text-slate-400">—</span>}
                </dd>
              </div>
              <div className="sm:col-span-2 flex flex-col gap-3">
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Resultado da consulta (arquivo)</dt>
                  <AnexoLink url={consulta.anexoResultado} label="Ver resultado" />
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Comprovante de pagamento</dt>
                  <AnexoLink url={consulta.comprovantePagamento} label="Ver comprovante" />
                </div>
              </div>
            </dl>
          </CardBody>
        </Card>
      )}

      {consulta.resultado === 'Não localizada' && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-sm text-slate-500">
          Consulta não localizada — sem custo associado.
        </div>
      )}
    </div>
  )
}
