'use client'

import {
  createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, ReactNode,
} from 'react'
import { fetchAdvogados, insertAdvogado, patchAdvogado, deleteAdvogado } from '@/services/advogadosDB'
import { Advogado } from '@/types'
import { useToast } from './ToastContext'
import { supabase } from '@/lib/supabase'
import { fetchComRetry, aoReconectar } from '@/lib/resilientLoad'

export interface AdvogadosContextValue {
  advogados: Advogado[]
  advogadoMap: Map<string, Advogado>
  loading: boolean
  error: string | null
  refetch: () => void
  createAdvogado: (data: Omit<Advogado, 'id' | 'createdAt'>) => Promise<Advogado>
  updateAdvogado: (id: string, patch: Partial<Advogado>) => Promise<void>
  removeAdvogado: (id: string) => Promise<void>
}

const AdvogadosContext = createContext<AdvogadosContextValue | null>(null)

export function AdvogadosProvider({ children }: { children: ReactNode }) {
  const [advogados, setAdvogados] = useState<Advogado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()
  const advogadosRef = useRef<Advogado[]>([])
  useEffect(() => { advogadosRef.current = advogados }, [advogados])

  const carregar = useCallback(async () => {
    if (!advogadosRef.current.length) setLoading(true)
    try {
      const data = await fetchComRetry((signal) => fetchAdvogados(signal))
      setAdvogados(data)
      setError(null)
    } catch (err) {
      console.error('[AdvogadosContext] fetch:', err)
      if (!advogadosRef.current.length) setError('Não foi possível carregar os advogados.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
    const desconectar = aoReconectar(() => { carregar() })

    const channel = supabase
      .channel('advogados-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advogados' }, () => {
        fetchAdvogados()
          .then((data) => setAdvogados(data))
          .catch((err) => console.error('[AdvogadosContext] realtime refetch:', err))
      })
      .subscribe()

    return () => { desconectar(); supabase.removeChannel(channel) }
  }, [carregar])

  const advogadoMap = useMemo(
    () => new Map(advogados.map((a) => [a.id, a])),
    [advogados],
  )

  const createAdvogado = useCallback(async (
    data: Omit<Advogado, 'id' | 'createdAt'>,
  ): Promise<Advogado> => {
    try {
      const novo = await insertAdvogado(data)
      setAdvogados((prev) => [novo, ...prev])
      return novo
    } catch (err) {
      console.error('[createAdvogado] falhou:', err)
      throw err
    }
  }, [])

  const updateAdvogado = useCallback(async (id: string, patch: Partial<Advogado>): Promise<void> => {
    setAdvogados((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a))
    try {
      await patchAdvogado(id, patch)
      addToast('success', 'Advogado atualizado.')
    } catch (err) {
      console.error(err)
      addToast('error', 'Não foi possível salvar. Verifique sua conexão.')
      throw err
    }
  }, [addToast])

  const removeAdvogado = useCallback(async (id: string): Promise<void> => {
    try {
      await deleteAdvogado(id)
      setAdvogados((prev) => prev.filter((a) => a.id !== id))
      addToast('success', 'Cadastro do advogado excluído.')
    } catch (err) {
      console.error('[removeAdvogado] falhou:', err)
      addToast('error', 'Não foi possível excluir. Verifique sua conexão.')
      throw err
    }
  }, [addToast])

  return (
    <AdvogadosContext.Provider value={{
      advogados, advogadoMap, loading, error, refetch: carregar,
      createAdvogado, updateAdvogado, removeAdvogado,
    }}>
      {children}
    </AdvogadosContext.Provider>
  )
}

export function useAdvogados(): AdvogadosContextValue {
  const ctx = useContext(AdvogadosContext)
  if (!ctx) throw new Error('useAdvogados fora do AdvogadosProvider')
  return ctx
}
