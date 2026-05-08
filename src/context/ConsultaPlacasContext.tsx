'use client'

import {
  createContext, useContext, useState, useCallback, useEffect, ReactNode,
} from 'react'
import {
  fetchConsultasPlacas, insertConsultaPlaca, patchConsultaPlaca, uploadArquivoConsultaPlaca,
} from '@/services/consultaPlacasDB'
import { ConsultaPlaca } from '@/types'
import { useToast } from './ToastContext'

export interface ConsultaPlacasContextValue {
  consultasPlacas: ConsultaPlaca[]
  loading: boolean
  error: string | null
  createConsultaPlaca: (data: Omit<ConsultaPlaca, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ConsultaPlaca>
  updateConsultaPlaca: (id: string, patch: Partial<ConsultaPlaca>) => Promise<void>
  uploadAnexoConsulta: (id: string, campo: 'anexoResultado' | 'comprovantePagamento', file: File) => Promise<string>
}

const ConsultaPlacasContext = createContext<ConsultaPlacasContextValue | null>(null)

export function ConsultaPlacasProvider({ children }: { children: ReactNode }) {
  const [consultasPlacas, setConsultasPlacas] = useState<ConsultaPlaca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    fetchConsultasPlacas()
      .then((data) => { setConsultasPlacas(data); setLoading(false) })
      .catch((err) => {
        console.error('[ConsultaPlacasContext] fetch:', err)
        setError('Não foi possível carregar as consultas de placas.')
        setLoading(false)
      })
  }, [])

  const createConsultaPlaca = useCallback(async (
    data: Omit<ConsultaPlaca, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ConsultaPlaca> => {
    const nova = await insertConsultaPlaca(data)
    setConsultasPlacas((prev) => [nova, ...prev])
    return nova
  }, [])

  const updateConsultaPlaca = useCallback(async (id: string, patch: Partial<ConsultaPlaca>): Promise<void> => {
    setConsultasPlacas((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c))
    try {
      await patchConsultaPlaca(id, patch)
    } catch (err) {
      console.error(err)
      addToast('error', 'Não foi possível salvar. Verifique sua conexão.')
      throw err
    }
  }, [addToast])

  const uploadAnexoConsulta = useCallback(async (
    id: string,
    campo: 'anexoResultado' | 'comprovantePagamento',
    file: File,
  ): Promise<string> => {
    const dbCampo = campo === 'anexoResultado' ? 'anexo_resultado' : 'comprovante_pagamento'
    const url = await uploadArquivoConsultaPlaca(id, dbCampo as 'anexo_resultado' | 'comprovante_pagamento', file)
    await patchConsultaPlaca(id, { [campo]: url })
    setConsultasPlacas((prev) => prev.map((c) => c.id === id ? { ...c, [campo]: url } : c))
    return url
  }, [])

  return (
    <ConsultaPlacasContext.Provider value={{
      consultasPlacas, loading, error,
      createConsultaPlaca, updateConsultaPlaca, uploadAnexoConsulta,
    }}>
      {children}
    </ConsultaPlacasContext.Provider>
  )
}

export function useConsultasPlacas(): ConsultaPlacasContextValue {
  const ctx = useContext(ConsultaPlacasContext)
  if (!ctx) throw new Error('useConsultasPlacas fora do ConsultaPlacasProvider')
  return ctx
}
