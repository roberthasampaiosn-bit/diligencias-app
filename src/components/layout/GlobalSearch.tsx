'use client'

import { useState, useRef, useEffect, useMemo, memo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, ClipboardList, Users } from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useAdvogados } from '@/context/AdvogadosContext'
import { cn } from '@/lib/utils'

interface Result {
  type: 'diligencia' | 'advogado'
  id: string
  label: string
  sublabel: string
  href: string
}

function useDebounce(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

// Separado para só montar (e subscrever context) quando o dropdown está aberto
const SearchDropdown = memo(function SearchDropdown({
  query,
  onQueryChange,
  onSelect,
  onClose,
  inputRef,
}: {
  query: string
  onQueryChange: (v: string) => void
  onSelect: (href: string) => void
  onClose: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  const { diligencias } = useDiligencias()
  const { advogados } = useAdvogados()
  const debounced = useDebounce(query, 150)

  const results = useMemo<Result[]>(() => {
    if (debounced.length < 2) return []
    const q = debounced.toLowerCase()
    const qDigits = q.replace(/\D/g, '')
    const out: Result[] = []

    for (const d of diligencias) {
      if (out.filter((r) => r.type === 'diligencia').length >= 5) break
      if (
        d.ccc.toLowerCase().includes(q) ||
        d.vitima.toLowerCase().includes(q) ||
        d.empresa.toLowerCase().includes(q) ||
        (qDigits.length >= 4 && d.telefoneVitima.includes(qDigits))
      ) {
        out.push({
          type: 'diligencia',
          id: d.id,
          label: d.vitima,
          sublabel: `${d.ccc} · ${d.cidade}/${d.uf} · ${d.status}`,
          href: `/diligencias/${d.id}`,
        })
      }
    }

    for (const a of advogados) {
      if (out.filter((r) => r.type === 'advogado').length >= 5) break
      if (
        a.nomeCompleto.toLowerCase().includes(q) ||
        (qDigits.length >= 4 && (a.cpf.includes(qDigits) || a.telefone.includes(qDigits)))
      ) {
        out.push({
          type: 'advogado',
          id: a.id,
          label: a.nomeCompleto,
          sublabel: `${a.oab} · ${a.cidadePrincipal}/${a.uf}`,
          href: `/advogados/${a.id}`,
        })
      }
    }

    return out
  }, [debounced, diligencias, advogados])

  const dilResults = results.filter((r) => r.type === 'diligencia')
  const advResults = results.filter((r) => r.type === 'advogado')

  return (
    <div className="absolute right-0 top-full mt-1 w-80 lg:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="CCC, vítima, empresa, CPF, telefone..."
          className="flex-1 text-sm outline-none text-slate-800 placeholder-slate-400"
          autoComplete="off"
        />
        {query && (
          <button onClick={() => onQueryChange('')} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {debounced.length < 2 ? (
        <p className="text-xs text-slate-400 text-center py-6">Digite pelo menos 2 caracteres</p>
      ) : results.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">Nenhum resultado encontrado</p>
      ) : (
        <div className="max-h-80 overflow-y-auto py-1">
          {dilResults.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 px-3 py-1.5">
                <ClipboardList className="w-3 h-3 text-slate-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Diligências ({dilResults.length})
                </span>
              </div>
              {dilResults.map((r) => (
                <button key={r.id} onClick={() => onSelect(r.href)} className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors">
                  <p className="text-sm font-medium text-slate-800">{r.label}</p>
                  <p className="text-xs text-slate-500">{r.sublabel}</p>
                </button>
              ))}
            </>
          )}
          {advResults.length > 0 && (
            <>
              <div className={cn('flex items-center gap-1.5 px-3 py-1.5', dilResults.length > 0 && 'border-t border-slate-50 mt-1')}>
                <Users className="w-3 h-3 text-slate-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Advogados ({advResults.length})
                </span>
              </div>
              {advResults.map((r) => (
                <button key={r.id} onClick={() => onSelect(r.href)} className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors">
                  <p className="text-sm font-medium text-slate-800">{r.label}</p>
                  <p className="text-xs text-slate-500">{r.sublabel}</p>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
})

// Componente externo não lê context — só controla open/query
export const GlobalSearch = memo(function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') { setOpen(false); setQuery('') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function handleOpen() {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleSelect(href: string) {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors w-48 lg:w-64"
      >
        <Search className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1 text-left text-xs truncate">Buscar... (Ctrl+K)</span>
      </button>

      {open && (
        <SearchDropdown
          query={query}
          onQueryChange={setQuery}
          onSelect={handleSelect}
          onClose={() => { setOpen(false); setQuery('') }}
          inputRef={inputRef}
        />
      )}
    </div>
  )
})
