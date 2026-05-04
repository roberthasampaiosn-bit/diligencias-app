'use client'

import {
  createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode,
} from 'react'
import { fetchAdvogados, insertAdvogado, patchAdvogado } from '@/services/advogadosDB'
import { Advogado } from '@/types'
import { useToast } from './ToastContext'

export interface AdvogadosContextValue {
  advogados: Advogado[]
  advogadoMap: Map<string, Advogado>
  loading: boolean
  error: string | null
  createAdvogado: (data: Omit<Advogado, 'id' | 'createdAt'>) => Promise<Advogado>
  updateAdvogado: (id: string, patch: Partial<Advogado>) => Promise<void>
}

const AdvogadosContext = createContext<AdvogadosContextValue | null>(null)

export function AdvogadosProvider({ children }: { children: ReactNode }) {
  const [advogados, setAdvogados] = useState<Advogado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    fetchAdvogados()
      .then((data) => { setAdvogados(data); setLoading(false) })
      .catch((err) => {
        console.error('[AdvogadosContext] fetch:', err)
        setError('Não foi possível carregar os advogados.')
        setLoading(false)
      })
  }, [])

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

  return (
    <AdvogadosContext.Provider value={{
      advogados, advogadoMap, loading, error,
      createAdvogado, updateAdvogado,
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
