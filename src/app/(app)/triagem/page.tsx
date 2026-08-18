'use client'

import { useState, useMemo } from 'react'
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { useEventos } from '@/context/EventosContext'
import { useDiligencias } from '@/context/DiligenciasContext'
import { EventoCard } from '@/components/triagem/EventoCard'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { Evento, StatusEvento } from '@/types'
import { normalizarBusca } from '@/lib/utils'

type Ordem = 'recente' | 'antigo'

const ordens: { key: Ordem; label: string }[] = [
  { key: 'recente', label: 'Mais recentes' },
  { key: 'antigo', label: 'Mais antigos' },
]

interface ImportMsg { tipo: 'success' | 'warn' | 'error'; texto: string }

// Retorna o status efetivo do evento na triagem.
// Eventos cujo ciclo de diligência já foi finalizado são tratados como Arquivados,
// mesmo que o statusEvento no banco ainda seja 'criado'.
function effectiveStatus(e: Evento, finalizadosSet: Set<string>): StatusEvento {
  if (
    e.statusEvento === StatusEvento.Criado &&
    e.diligenciaId &&
    finalizadosSet.has(e.diligenciaId)
  ) {
    return StatusEvento.Arquivado
  }
  return e.statusEvento
}

// Evento com mais de 24h sem diligência criada é considerado antigo.
function isAntigo(dataEvento: string, horaEvento: string): boolean {
  const t = new Date(`${dataEvento}T${horaEvento}:00`).getTime()
  return Number.isFinite(t) && Date.now() - t > 24 * 60 * 60 * 1000
}

export default function TriagemPage() {
  const { eventos, importarSimulados } = useEventos()
  const { diligencias } = useDiligencias()
  const [search, setSearch] = useState('')
  const [ordem, setOrdem] = useState<Ordem>('recente')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<ImportMsg | null>(null)

  // IDs das diligências com ciclo finalizado — lookup O(1)
  const finalizadosSet = useMemo(
    () => new Set(diligencias.filter((d) => d.cicloFinalizado).map((d) => d.id)),
    [diligencias]
  )

  const pendentesCount = useMemo(
    () => eventos.filter((e) => effectiveStatus(e, finalizadosSet) === StatusEvento.Pendente).length,
    [eventos, finalizadosSet]
  )

  const lista = useMemo(() => {
    let list = [...eventos]

    if (search) {
      const q = normalizarBusca(search)
      list = list.filter(
        (e) =>
          normalizarBusca(e.ccc).includes(q) ||
          normalizarBusca(e.nomeVitima).includes(q) ||
          normalizarBusca(e.empresa).includes(q) ||
          normalizarBusca(e.tipoEvento).includes(q) ||
          normalizarBusca(e.cidade).includes(q) ||
          normalizarBusca(e.uf).includes(q)
      )
    }

    // Ordena por ordem de chegada do informativo. Padrão: mais recentes primeiro.
    list.sort((a, b) => {
      const ta = new Date(`${a.dataRecebimento}T${a.horaRecebimento || '00:00'}:00`).getTime()
      const tb = new Date(`${b.dataRecebimento}T${b.horaRecebimento || '00:00'}:00`).getTime()
      return ordem === 'recente' ? tb - ta : ta - tb
    })

    return list
  }, [eventos, search, ordem])

  async function handleImportar() {
    setImporting(true)
    setImportMsg(null)
    try {
      const { criados, existentes, erros } = await importarSimulados()
      if (erros > 0) {
        setImportMsg({ tipo: 'error', texto: `${criados} criados · ${existentes} já existiam · ${erros} com erro (ver console)` })
      } else if (criados === 0) {
        setImportMsg({ tipo: 'warn', texto: `Todas as ${existentes} demandas simuladas já estavam na triagem.` })
      } else {
        setImportMsg({ tipo: 'success', texto: `${criados} demanda${criados > 1 ? 's' : ''} importada${criados > 1 ? 's' : ''}${existentes > 0 ? ` · ${existentes} já existia${existentes > 1 ? 'm' : ''}` : ''}.` })
      }
    } catch {
      setImportMsg({ tipo: 'error', texto: 'Falha ao importar. Verifique sua conexão.' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Triagem de Eventos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Eventos recebidos por e-mail — ordenados por ordem de chegada
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {pendentesCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5" />
              {pendentesCount} pendente{pendentesCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Resultado da importação */}
      {importMsg && (
        <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-xl border ${
          importMsg.tipo === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
          importMsg.tipo === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-700' :
          'bg-red-50 border-red-200 text-red-700'
        }`}>
          {importMsg.tipo === 'success'
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            : <XCircle className="w-4 h-4 flex-shrink-0" />
          }
          {importMsg.texto}
          <button className="ml-auto text-xs opacity-60 hover:opacity-100" onClick={() => setImportMsg(null)}>✕</button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Vítima, CCC, empresa, cidade..."
          className="sm:w-64"
        />
        <div className="flex gap-1.5 flex-wrap">
          {ordens.map((o) => (
            <button
              key={o.key}
              onClick={() => setOrdem(o.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                ordem === o.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          title="Nenhum evento encontrado"
          description="Ajuste a busca para encontrar eventos."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {lista.map((e) => (
            <EventoCard
              key={e.id}
              evento={e}
              diligenciaFinalizada={
                e.statusEvento === StatusEvento.Criado &&
                !!e.diligenciaId &&
                finalizadosSet.has(e.diligenciaId)
              }
              antigo={isAntigo(e.dataEvento, e.horaEvento)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
