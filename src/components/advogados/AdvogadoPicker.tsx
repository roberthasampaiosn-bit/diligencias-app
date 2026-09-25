'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, Search, UserPlus, ChevronDown } from 'lucide-react'
import { cn, normalizarBusca } from '@/lib/utils'
import type { Advogado } from '@/types'

interface AdvogadoPickerProps {
  label?: string
  value: string
  onChange: (id: string) => void
  advogados: Advogado[]
  error?: string
  placeholder?: string
}

function rotulo(a: Advogado) {
  return `${a.nomeCompleto} — ${a.cidadePrincipal}/${a.uf}`
}

// Adicionado na lista hoje (data local) — em geral é o advogado que acabou de se
// cadastrar pelo link e foi aprovado para ser usado na diligência do momento.
function adicionadoHoje(a: Advogado) {
  if (!a.createdAt) return false
  const d = new Date(a.createdAt)
  return !isNaN(d.getTime()) && d.toDateString() === new Date().toDateString()
}

function horaDe(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function AdvogadoPicker({ label, value, onChange, advogados, error, placeholder = 'Selecione o advogado' }: AdvogadoPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [ativo, setAtivo] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputId = label?.toLowerCase().replace(/\s+/g, '-')
  const listId = useId()

  const selecionado = advogados.find((a) => a.id === value)

  const novosHoje = useMemo(
    () => advogados.filter(adicionadoHoje).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [advogados],
  )

  const { hoje, demais } = useMemo(() => {
    const termos = normalizarBusca(query).split(/\s+/).filter(Boolean)
    const casa = (a: Advogado) => {
      if (termos.length === 0) return true
      const alvo = normalizarBusca(`${a.nomeCompleto} ${a.cidadePrincipal} ${a.uf} ${a.oab}`)
      return termos.every((t) => alvo.includes(t))
    }
    const idsHoje = new Set(novosHoje.map((a) => a.id))
    return {
      hoje: novosHoje.filter(casa),
      demais: advogados
        .filter((a) => !idsHoje.has(a.id) && casa(a))
        .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR')),
    }
  }, [advogados, novosHoje, query])

  const visiveis = useMemo(() => [...hoje, ...demais], [hoje, demais])

  useEffect(() => {
    if (!open) return
    function fora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [open])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector(`[data-idx="${ativo}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [ativo, open])

  function escolher(id: string) {
    onChange(id)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  function abrir() {
    setQuery('')
    setAtivo(0)
    setOpen(true)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { e.preventDefault(); abrir(); return }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((i) => Math.min(i + 1, visiveis.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (visiveis[ativo]) escolher(visiveis[ativo].id) }
    else if (e.key === 'Escape') { setOpen(false); setQuery('') }
    else if (e.key === 'Tab') setOpen(false)
  }

  const destaque = novosHoje.filter((a) => a.id !== value)

  function linha(a: Advogado, idx: number, novo: boolean) {
    const sel = a.id === value
    return (
      <button
        key={a.id}
        type="button"
        data-idx={idx}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => escolher(a.id)}
        onMouseEnter={() => setAtivo(idx)}
        className={cn(
          'w-full text-left flex items-center gap-2 px-3 py-2 border-t border-slate-100 first:border-t-0',
          idx === ativo ? 'bg-blue-50' : 'bg-white',
        )}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-800 truncate">{a.nomeCompleto}</p>
          <p className="text-xs text-slate-500 truncate">
            {a.cidadePrincipal}/{a.uf}{a.oab ? ` · OAB ${a.oab}` : ''}
          </p>
        </div>
        {novo && (
          <span className="flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
            Novo hoje
          </span>
        )}
        {sel && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
      </button>
    )
  }

  return (
    <div ref={wrapRef} className="flex flex-col gap-1">
      {destaque.map((a) => (
        <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl border border-emerald-200 bg-emerald-50">
          <UserPlus className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-emerald-700">Adicionado hoje às {horaDe(a.createdAt)}</p>
            <p className="text-sm font-semibold text-emerald-900 truncate">{a.nomeCompleto}</p>
            <p className="text-xs text-emerald-700 truncate">
              {a.cidadePrincipal}/{a.uf}{a.oab ? ` · OAB ${a.oab}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => escolher(a.id)}
            className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100"
          >
            Usar este
          </button>
        </div>
      ))}

      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-slate-600">{label}</label>
      )}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          value={open ? query : (selecionado ? rotulo(selecionado) : '')}
          placeholder={open ? 'Digite nome, cidade, UF ou OAB' : placeholder}
          onFocus={abrir}
          onClick={() => { if (!open) abrir() }}
          onChange={(e) => { setQuery(e.target.value); setAtivo(0); setOpen(true) }}
          onKeyDown={onKeyDown}
          className={cn(
            'w-full pl-9 pr-8 py-2 text-sm rounded-lg border bg-white text-slate-900 placeholder-slate-400',
            'border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            !open && !selecionado && 'placeholder-slate-500',
            error && 'border-red-400 focus:ring-red-400',
          )}
        />
        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />

        {open && (
          <div ref={listRef} id={listId} className="absolute z-30 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {visiveis.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-500">Nenhum advogado encontrado para &quot;{query}&quot;</p>
            ) : (
              <>
                {hoje.length > 0 && (
                  <>
                    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 bg-white">Adicionados hoje</p>
                    {hoje.map((a, i) => linha(a, i, true))}
                  </>
                )}
                {demais.length > 0 && (
                  <>
                    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 bg-white border-t border-slate-100">
                      {query ? `Resultados (${demais.length})` : `Todos (${demais.length})`}
                    </p>
                    {demais.map((a, i) => linha(a, hoje.length + i, false))}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
