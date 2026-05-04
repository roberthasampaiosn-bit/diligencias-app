'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Phone, Archive, Plus, ExternalLink, AlertTriangle, Clock } from 'lucide-react'
import { useEventos } from '@/context/EventosContext'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDate, formatPhone } from '@/lib/utils'
import { Evento, StatusEvento } from '@/types'
import { cn } from '@/lib/utils'

const nivelConfig = {
  1: { border: 'border-l-slate-300', bg: '' },
  2: { border: 'border-l-amber-400', bg: 'bg-amber-50/30' },
  3: { border: 'border-l-red-500', bg: 'bg-red-50/30' },
}

interface EventoCardProps {
  evento: Evento
  diligenciaFinalizada?: boolean
  antigo?: boolean
}

export const EventoCard = memo(function EventoCard({ evento: e, diligenciaFinalizada = false, antigo = false }: EventoCardProps) {
  const { arquivarEvento } = useEventos()
  const nivel = (Math.min(e.nivelAgressao, 3) as 1 | 2 | 3)
  const cfg = nivelConfig[nivel] ?? nivelConfig[1]
  const isPendente = e.statusEvento === StatusEvento.Pendente
  const isCriado = e.statusEvento === StatusEvento.Criado
  const isArquivado = e.statusEvento === StatusEvento.Arquivado
  const isFinalizado = isCriado && diligenciaFinalizada

  return (
    <div className={cn(
      'bg-white rounded-xl border border-slate-200 border-l-4 shadow-sm p-4',
      isFinalizado ? 'border-l-slate-300' : cfg.border,
      cfg.bg,
      (isArquivado || isFinalizado) && 'opacity-60'
    )}>
      {/* Cabeçalho: nível + badges */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {isCriado && !isFinalizado && <Badge variant="success">Diligência criada</Badge>}
          {isFinalizado && <Badge variant="slate">Ciclo finalizado</Badge>}
          {isArquivado && <Badge variant="slate">Arquivado</Badge>}
          {isPendente && antigo && (
            <Badge variant="slate"><Clock className="w-3 h-3" /> +24h</Badge>
          )}
          {isPendente && e.motoristaAgredido && (
            <Badge variant="danger"><AlertTriangle className="w-3 h-3" /> Motorista agredido</Badge>
          )}
        </div>
        <div className={cn(
          'flex items-center justify-center w-8 h-8 rounded-lg text-white font-bold text-sm flex-shrink-0',
          e.nivelAgressao >= 3 ? 'bg-red-500' : e.nivelAgressao === 2 ? 'bg-amber-500' : 'bg-slate-400'
        )}>
          {e.nivelAgressao}
        </div>
      </div>

      {/* LINHA 1: Nome da vítima — CCC */}
      <div className="mb-1">
        <span className="font-semibold text-slate-800 text-sm">
          {e.nomeVitima || '(vítima não informada)'}
        </span>
        <span className="text-slate-400 mx-1.5">—</span>
        <span className="font-mono text-xs font-bold text-blue-700">{e.ccc}</span>
      </div>

      {/* LINHA 2: Empresa • Cidade/UF • Tipo de evento */}
      <p className="text-xs text-slate-600 mb-1">
        <span>{e.empresa}</span>
        <span className="mx-1.5 text-slate-300">•</span>
        <span>{e.cidade}/{e.uf}</span>
        <span className="mx-1.5 text-slate-300">•</span>
        <span className="italic">{e.tipoEvento}</span>
      </p>

      {/* LINHA 3: Data e hora do evento */}
      <p className="text-xs text-slate-500 mb-1">
        Evento: {formatDate(e.dataEvento)} às {e.horaEvento}
      </p>

      {/* LINHA 4: Telefone • Motorista agredido */}
      <p className="text-xs text-slate-500 mb-3">
        {e.telefoneVitima
          ? <span>{formatPhone(e.telefoneVitima)}</span>
          : <span className="italic text-slate-400">Telefone não informado</span>
        }
        <span className="mx-1.5 text-slate-300">•</span>
        <span className={e.motoristaAgredido ? 'text-red-600 font-medium' : ''}>
          Agredido: {e.motoristaAgredido ? 'sim' : 'não'}
        </span>
      </p>

      {/* Ações */}
      {isPendente && (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
          <Link href={`/diligencias/nova?ccc=${e.ccc}&eventoId=${e.id}&modo=presencial`}>
            <Button size="sm" variant="primary"><Plus className="w-3.5 h-3.5" /> Presencial</Button>
          </Link>
          <Link href={`/diligencias/nova?ccc=${e.ccc}&eventoId=${e.id}&modo=remoto`}>
            <Button size="sm" variant="secondary"><Plus className="w-3.5 h-3.5" /> Remota</Button>
          </Link>
          {e.telefoneVitima && (
            <a href={`tel:${e.telefoneVitima}`}>
              <Button size="sm" variant="ghost" className="text-slate-500">
                <Phone className="w-3.5 h-3.5" />
              </Button>
            </a>
          )}
          <Button size="sm" variant="ghost" onClick={() => arquivarEvento(e.id)} className="text-slate-400 ml-auto">
            <Archive className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {isCriado && e.diligenciaId && (
        <div className="pt-3 border-t border-slate-100">
          <Link href={`/diligencias/${e.diligenciaId}`}>
            <Button size="sm" variant="ghost" className="text-blue-600">
              <ExternalLink className="w-3.5 h-3.5" /> Ver diligência
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
})
