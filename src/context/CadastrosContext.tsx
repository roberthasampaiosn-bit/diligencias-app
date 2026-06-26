'use client'

import {
  createContext, useContext, useState, useCallback, useEffect, ReactNode,
} from 'react'
import { fetchCadastrosPendentes, updateCadastroStatus } from '@/services/cadastrosDB'
import { CadastroAdvogado, StatusCadastro } from '@/types'
import { supabase } from '@/lib/supabase'

export interface CadastrosContextValue {
  cadastros: CadastroAdvogado[]
  count: number
  loading: boolean
  /** Marca um cadastro como aprovado/descartado e o remove da caixa. */
  resolver: (id: string, status: StatusCadastro, advogadoId?: string) => Promise<void>
}

const CadastrosContext = createContext<CadastrosContextValue | null>(null)

export function CadastrosProvider({ children }: { children: ReactNode }) {
  const [cadastros, setCadastros] = useState<CadastroAdvogado[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCadastrosPendentes()
      .then((data) => { setCadastros(data); setLoading(false) })
      .catch((err) => {
        console.error('[CadastrosContext] fetch:', err)
        setLoading(false)
      })

    const channel = supabase
      .channel('cadastros-advogados-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadastros_advogados' }, () => {
        fetchCadastrosPendentes()
          .then((data) => setCadastros(data))
          .catch((err) => console.error('[CadastrosContext] realtime refetch:', err))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const resolver = useCallback(async (id: string, status: StatusCadastro, advogadoId?: string) => {
    await updateCadastroStatus(id, status, advogadoId)
    setCadastros((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return (
    <CadastrosContext.Provider value={{ cadastros, count: cadastros.length, loading, resolver }}>
      {children}
    </CadastrosContext.Provider>
  )
}

export function useCadastros(): CadastrosContextValue {
  const ctx = useContext(CadastrosContext)
  if (!ctx) throw new Error('useCadastros fora do CadastrosProvider')
  return ctx
}
