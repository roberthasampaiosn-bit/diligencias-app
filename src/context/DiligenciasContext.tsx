'use client'

import {
  createContext, useContext, useState, useCallback, useEffect, ReactNode,
} from 'react'
import { applyUpdate } from '@/services/diligenciaService'
import {
  fetchDiligencias, insertDiligencia, patchDiligencia,
  patchPesquisa, patchAnexo, insertLigacao, uploadArquivoAnexo, removerAnexoDB,
} from '@/services/diligenciasDB'
import {
  Diligencia, Pesquisa, Ligacao, Anexos, AvaliacaoAdvogado,
  StatusPesquisa, StatusDiligencia, StatusPagamento,
} from '@/types'
import { useToast } from './ToastContext'

export interface DiligenciasContextValue {
  diligencias: Diligencia[]
  loading: boolean
  error: string | null
  createDiligencia: (data: Omit<Diligencia, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Diligencia>
  updateDiligencia: (id: string, patch: Partial<Diligencia>) => Promise<void>
  marcarRealizada: (id: string) => void
  marcarPago: (id: string) => Promise<void>
  finalizarCiclo: (id: string, avaliacao: AvaliacaoAdvogado) => void
  atualizarAnexo: (id: string, campo: keyof Anexos, valor: string) => void
  uploadAnexo: (id: string, campo: keyof Anexos, file: File) => Promise<string>
  removerAnexo: (id: string, campo: keyof Anexos) => Promise<void>
  registrarWhatsApp: (id: string, mensagem: string) => void
  registrarLigacao: (id: string, ligacao: Omit<Ligacao, 'id'>) => Promise<void>
  agendarRetorno: (id: string, data: string) => void
  marcarRespondida: (id: string, resposta: string) => void
  encerrarSemResposta: (id: string, observacao: string) => void
  atualizarPesquisa: (id: string, patch: Partial<Pesquisa>) => Promise<void>
}

const DiligenciasContext = createContext<DiligenciasContextValue | null>(null)

export function DiligenciasProvider({ children }: { children: ReactNode }) {
  const [diligencias, setDiligencias] = useState<Diligencia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    fetchDiligencias()
      .then((data) => { setDiligencias(data); setLoading(false) })
      .catch((err) => {
        console.error('[DiligenciasContext] fetch:', err)
        setError('Não foi possível carregar as diligências.')
        setLoading(false)
      })
  }, [])

  const patchD = useCallback((id: string, patch: Partial<Diligencia>) => {
    setDiligencias((prev) => prev.map((d) => d.id === id ? applyUpdate(d, patch) : d))
  }, [])

  const patchP = useCallback((id: string, pp: Partial<Pesquisa>) => {
    setDiligencias((prev) =>
      prev.map((d) =>
        d.id === id ? applyUpdate(d, { pesquisa: { ...d.pesquisa, ...pp } }) : d
      )
    )
  }, [])

  const createDiligencia = useCallback(async (
    data: Omit<Diligencia, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Diligencia> => {
    const nova = await insertDiligencia(data)
    setDiligencias((prev) => [nova, ...prev])
    return nova
  }, [])

  const updateDiligencia = useCallback(async (id: string, patch: Partial<Diligencia>): Promise<void> => {
    patchD(id, patch)
    try {
      await patchDiligencia(id, patch)
    } catch (err) {
      console.error(err)
      addToast('error', 'Não foi possível salvar. Verifique sua conexão.')
      throw err
    }
  }, [patchD, addToast])

  const marcarRealizada = useCallback((id: string) => {
    patchD(id, { status: StatusDiligencia.Realizada })
    patchDiligencia(id, { status: StatusDiligencia.Realizada })
      .then(() => addToast('success', 'Diligência marcada como realizada.'))
      .catch((err) => { console.error(err); addToast('error', 'Não foi possível salvar. Verifique sua conexão.') })
  }, [patchD, addToast])

  const marcarPago = useCallback(async (id: string): Promise<void> => {
    patchD(id, { statusPagamento: StatusPagamento.Pago })
    try {
      await patchDiligencia(id, { statusPagamento: StatusPagamento.Pago })
      addToast('success', 'Pagamento registrado.')
    } catch (err) {
      console.error(err)
      addToast('error', 'Não foi possível registrar o pagamento.')
      throw err
    }
  }, [patchD, addToast])

  const finalizarCiclo = useCallback((id: string, avaliacao: AvaliacaoAdvogado) => {
    patchD(id, { cicloFinalizado: true, avaliacao })
    patchDiligencia(id, { cicloFinalizado: true, avaliacao })
      .then(() => addToast('success', 'Ciclo finalizado.'))
      .catch((err) => { console.error(err); addToast('error', 'Não foi possível salvar. Verifique sua conexão.') })
  }, [patchD, addToast])

  const atualizarAnexo = useCallback((id: string, campo: keyof Anexos, valor: string) => {
    setDiligencias((prev) =>
      prev.map((d) =>
        d.id === id ? applyUpdate(d, { anexos: { ...d.anexos, [campo]: valor } }) : d
      )
    )
    patchAnexo(id, campo, valor)
      .catch((err) => { console.error(err); addToast('error', 'Não foi possível salvar o anexo.') })
  }, [addToast])

  const uploadAnexo = useCallback(async (id: string, campo: keyof Anexos, file: File): Promise<string> => {
    const publicUrl = await uploadArquivoAnexo(id, campo, file)
    setDiligencias((prev) =>
      prev.map((d) =>
        d.id === id ? applyUpdate(d, { anexos: { ...d.anexos, [campo]: publicUrl } }) : d
      )
    )
    return publicUrl
  }, [])

  const removerAnexo = useCallback(async (id: string, campo: keyof Anexos): Promise<void> => {
    setDiligencias((prev) =>
      prev.map((d) =>
        d.id === id ? applyUpdate(d, { anexos: { ...d.anexos, [campo]: undefined } }) : d
      )
    )
    await removerAnexoDB(id, campo)
  }, [])

  const registrarWhatsApp = useCallback((id: string, mensagem: string) => {
    const pp = {
      dataEnvioWhatsApp: new Date().toISOString().split('T')[0],
      mensagemEnviada: mensagem,
    }
    patchP(id, pp)
    patchPesquisa(id, pp).catch((err) => { console.error(err); addToast('error', 'Não foi possível salvar. Verifique sua conexão.') })
  }, [patchP, addToast])

  const registrarLigacao = useCallback(async (id: string, ligacao: Omit<Ligacao, 'id'>): Promise<void> => {
    try {
      const novaLig = await insertLigacao(id, ligacao)
      setDiligencias((prev) =>
        prev.map((d) => {
          if (d.id !== id) return d
          return applyUpdate(d, {
            pesquisa: {
              ...d.pesquisa,
              historicoLigacoes: [...d.pesquisa.historicoLigacoes, novaLig],
            },
          })
        })
      )
      addToast('success', 'Ligação registrada.')
    } catch (err) {
      console.error('[registrarLigacao] insertLigacao:', err)
      addToast('error', err instanceof Error ? err.message : 'Não foi possível registrar a ligação.')
      throw err
    }
  }, [addToast])

  const agendarRetorno = useCallback((id: string, data: string) => {
    const pp = { dataCombinada: data }
    patchP(id, pp)
    patchPesquisa(id, pp).catch((err) => { console.error(err); addToast('error', 'Não foi possível salvar. Verifique sua conexão.') })
  }, [patchP, addToast])

  const marcarRespondida = useCallback((id: string, resposta: string) => {
    const pp: Partial<Pesquisa> = { status: StatusPesquisa.Concluida, respostaVitima: resposta || undefined }
    patchP(id, pp)
    patchPesquisa(id, pp).catch((err) => { console.error(err); addToast('error', 'Não foi possível salvar. Verifique sua conexão.') })
  }, [patchP, addToast])

  const encerrarSemResposta = useCallback((id: string, observacao: string) => {
    const pp: Partial<Pesquisa> = { status: StatusPesquisa.Concluida, observacoes: observacao }
    patchP(id, pp)
    patchPesquisa(id, pp).catch((err) => { console.error(err); addToast('error', 'Não foi possível salvar. Verifique sua conexão.') })
  }, [patchP, addToast])

  const atualizarPesquisa = useCallback(async (id: string, patch: Partial<Pesquisa>): Promise<void> => {
    patchP(id, patch)
    try {
      await patchPesquisa(id, patch)
      addToast('success', 'Pesquisa salva.')
    } catch (err) {
      console.error(err)
      addToast('error', 'Não foi possível salvar. Verifique sua conexão.')
      throw err
    }
  }, [patchP, addToast])

  return (
    <DiligenciasContext.Provider value={{
      diligencias, loading, error,
      createDiligencia, updateDiligencia, marcarRealizada, marcarPago, finalizarCiclo,
      atualizarAnexo, uploadAnexo, removerAnexo, registrarWhatsApp, registrarLigacao, agendarRetorno,
      marcarRespondida, encerrarSemResposta, atualizarPesquisa,
    }}>
      {children}
    </DiligenciasContext.Provider>
  )
}

export function useDiligencias(): DiligenciasContextValue {
  const ctx = useContext(DiligenciasContext)
  if (!ctx) throw new Error('useDiligencias fora do DiligenciasProvider')
  return ctx
}
