'use client'

import { useState, useMemo } from 'react'
import { AlertCircle, Download, CheckCircle2, XCircle } from 'lucide-react'
import { useEventos } from '@/context/EventosContext'
import { useDiligencias } from '@/context/DiligenciasContext'
import { EventoCard } from '@/components/triagem/EventoCard'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Evento, StatusEvento } from '@/types'

const filtros = [
  { key: 'todos', label: 'Todos' },
  { key: StatusEvento.Pendente, label: 'Pendentes' },
  { key: StatusEvento.Criado, label: 'Diligência criada' },
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

function GrupoHeader({ titulo, count }: { titulo: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
        {titulo}
      </span>
      <span className="text-xs font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
        {count}
      </span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  )
}

export default function TriagemPage() {
  const { eventos, importarSimulados } = useEventos()
  const { diligencias } = useDiligencias()
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<string>('todos')
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

    if (filtro !== 'todos') {
      list = list.filter((e) => effectiveStatus(e, finalizadosSet) === filtro)
    }

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (e) =>
          e.ccc.toLowerCase().includes(q) ||
          e.nomeVitima.toLowerCase().includes(q) ||
          e.empresa.toLowerCase().includes(q) ||
          e.tipoEvento.toLowerCase().includes(q) ||
          e.cidade.toLowerCase().includes(q) ||
          e.uf.toLowerCase().includes(q)
      )
    }

    list.sort((a, b) => {
      const statusOrder = { pendente: 0, criado: 1, arquivado: 2 }
      const sa = statusOrder[effectiveStatus(a, finalizadosSet)] ?? 3
      const sb = statusOrder[effectiveStatus(b, finalizadosSet)] ?? 3
      if (sa !== sb) return sa - sb
      // Dentro do mesmo grupo: mais antigo primeiro (ordem de chegada)
      const ta = new Date(`${a.dataRecebimento}T${a.horaRecebimento || '00:00'}:00`).getTime()
      const tb = new Date(`${b.dataRecebimento}T${b.horaRecebimento || '00:00'}:00`).getTime()
      return ta - tb
    })

    return list
  }, [eventos, search, filtro, finalizadosSet])

  const grupos = useMemo(() => ({
    emAndamento: lista.filter((e) => effectiveStatus(e, finalizadosSet) === StatusEvento.Criado),
    finalizados: lista.filter((e) =>
      e.statusEvento === StatusEvento.Criado && !!e.diligenciaId && finalizadosSet.has(e.diligenciaId)
    ),
    arquivados: lista.filter((e) => effectiveStatus(e, finalizadosSet) === StatusEvento.Arquivado),
    pendentes: lista.filter((e) => effectiveStatus(e, finalizadosSet) === StatusEvento.Pendente),
  }), [lista, finalizadosSet])

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
          {filtros.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filtro === f.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          title="Nenhum evento encontrado"
          description="Nenhum evento encontrado com os filtros selecionados."
        />
      ) : filtro === 'todos' ? (
        <div className="space-y-6">
          {grupos.pendentes.length > 0 && (
            <div>
              <GrupoHeader titulo="Pendentes" count={grupos.pendentes.length} />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {grupos.pendentes.map((e) => (
                  <EventoCard
                    key={e.id}
                    evento={e}
                    diligenciaFinalizada={false}
                    antigo={isAntigo(e.dataEvento, e.horaEvento)}
                  />
                ))}
              </div>
            </div>
          )}
          {grupos.emAndamento.length > 0 && (
            <div>
              <GrupoHeader titulo="Diligências em andamento" count={grupos.emAndamento.length} />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {grupos.emAndamento.map((e) => (
                  <EventoCard
                    key={e.id}
                    evento={e}
                    diligenciaFinalizada={false}
                    antigo={isAntigo(e.dataEvento, e.horaEvento)}
                  />
                ))}
              </div>
            </div>
          )}
          {grupos.finalizados.length > 0 && (
            <div>
              <GrupoHeader titulo="Ciclos finalizados" count={grupos.finalizados.length} />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {grupos.finalizados.map((e) => (
                  <EventoCard
                    key={e.id}
                    evento={e}
                    diligenciaFinalizada={true}
                    antigo={isAntigo(e.dataEvento, e.horaEvento)}
                  />
                ))}
              </div>
            </div>
          )}
          {grupos.arquivados.length > 0 && (
            <div>
              <GrupoHeader titulo="Arquivados" count={grupos.arquivados.length} />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {grupos.arquivados.map((e) => (
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
            </div>
          )}
        </div>
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
