'use client'

import {
  createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode,
} from 'react'
import { applyUpdate } from '@/services/diligenciaService'
import {
  fetchDiligencias, insertDiligencia, patchDiligencia,
  patchPesquisa, patchAnexo, insertLigacao, uploadArquivoAnexo, removerAnexoDB,
} from '@/services/diligenciasDB'
import { supabase } from '@/lib/supabase'
import {
  Diligencia, Pesquisa, Ligacao, Anexos, AvaliacaoAdvogado,
  StatusPesquisa, StatusDiligencia, StatusPagamento,
} from '@/types'
import { useToast } from './ToastContext'
import { useAuth } from './AuthContext'
import { logAudit } from '@/services/auditLogDB'

export interface DiligenciasContextValue {
  diligencias: Diligencia[]
  loading: boolean
  error: string | null
  createDiligencia: (data: Omit<Diligencia, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Diligencia>
  updateDiligencia: (id: string, patch: Partial<Diligencia>) => Promise<void>
  marcarRealizada: (id: string, dataAtendimento?: string) => void
  marcarPago: (id: string) => Promise<void>
  finalizarCiclo: (id: string, avaliacao?: AvaliacaoAdvogado) => void
  atualizarAnexo: (id: string, campo: keyof Anexos, valor: string) => void
  uploadAnexo: (id: string, campo: keyof Anexos, file: File) => Promise<string>
  removerAnexo: (id: string, campo: keyof Anexos) => Promise<void>
  registrarWhatsApp: (id: string, mensagem: string) => void
  registrarLigacao: (id: string, ligacao: Omit<Ligacao, 'id'>) => Promise<void>
  agendarRetorno: (id: string, data: string) => void
  marcarRespondida: (id: string, resposta: string) => void
  encerrarSemResposta: (id: string, observacao: string) => void
  dispensarPesquisa: (id: string, motivo: string) => void
  reabrirPesquisa: (id: string) => void
  atualizarPesquisa: (id: string, patch: Partial<Pesquisa>) => Promise<void>
}

const DiligenciasContext = createContext<DiligenciasContextValue | null>(null)

// Nome amigável do entrevistador a partir do e-mail logado (o Supabase Auth
// nem sempre traz nome). Fallback: metadata do usuário → e-mail.
const NOME_POR_EMAIL: Record<string, string> = {
  'roberthasampaiosn@gmail.com': 'Roberta Sampaio',
}

// Retorna string ISO local (sem conversão UTC) para evitar drift de fuso horário.
function localISOString(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

// Repete uma gravação algumas vezes antes de desistir — cobre falhas transitórias
// de rede que, em fire-and-forget, fariam o dado se perder silenciosamente.
async function comRetry<T>(fn: () => Promise<T>, tentativas = 3, baseMs = 600): Promise<T> {
  let ultimoErro: unknown
  for (let i = 0; i < tentativas; i++) {
    try { return await fn() }
    catch (err) {
      ultimoErro = err
      if (i < tentativas - 1) await new Promise((r) => setTimeout(r, baseMs * (i + 1)))
    }
  }
  throw ultimoErro
}

export function DiligenciasProvider({ children }: { children: ReactNode }) {
  const [diligencias, setDiligencias] = useState<Diligencia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()
  const { user } = useAuth()
  const userEmail = user?.email ?? 'desconhecido'
  // Quem está registrando a pesquisa — vira o "entrevistador" no relatório
  const entrevistadorNome =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    NOME_POR_EMAIL[userEmail] ||
    (userEmail !== 'desconhecido' ? userEmail : undefined)

  // Ref sincronizado com o estado — permite leituras síncronas dentro de useCallback
  // sem adicionar `diligencias` nas dependências e gerar loops.
  const diligenciasRef = useRef<Diligencia[]>([])
  useEffect(() => { diligenciasRef.current = diligencias }, [diligencias])

  useEffect(() => {
    fetchDiligencias()
      .then((data) => { setDiligencias(data); setLoading(false) })
      .catch((err) => {
        console.error('[DiligenciasContext] fetch:', err)
        setError('Não foi possível carregar as diligências.')
        setLoading(false)
      })

    // Sincronização em tempo real — qualquer alteração feita por outro usuário
    // (ex: Anne criando uma diligência) atualiza a lista automaticamente.
    // O merge preserva ligações em memória que ainda não chegaram no banco
    // (evita race condition entre insertLigacao e o refetch disparado pelo realtime).
    function mergeComEstadoAtual(fetchedData: Diligencia[], prev: Diligencia[]): Diligencia[] {
      return fetchedData.map((fetched) => {
        const inMem = prev.find((x) => x.id === fetched.id)
        if (!inMem) return fetched
        let pesquisa = fetched.pesquisa

        // Preserva ligações em memória ainda não persistidas no banco
        const memLigs = inMem.pesquisa.historicoLigacoes
        const dbLigs  = fetched.pesquisa.historicoLigacoes
        if (memLigs.length > dbLigs.length) {
          pesquisa = { ...pesquisa, historicoLigacoes: memLigs }
        }

        // Preserva o "WhatsApp enviado" otimista quando o banco ainda não
        // recebeu o UPDATE — evita que um refetch disparado pelo INSERT da
        // diligência apague o registro recém-feito (race condition).
        if (inMem.pesquisa.dataEnvioWhatsApp && !fetched.pesquisa.dataEnvioWhatsApp) {
          pesquisa = {
            ...pesquisa,
            dataEnvioWhatsApp:  inMem.pesquisa.dataEnvioWhatsApp,
            mensagemEnviada:    inMem.pesquisa.mensagemEnviada,
            tentativasWhatsApp: Math.max(
              inMem.pesquisa.tentativasWhatsApp ?? 0,
              pesquisa.tentativasWhatsApp ?? 0,
            ),
          }
        }

        return pesquisa === fetched.pesquisa ? fetched : { ...fetched, pesquisa }
      })
    }

    const channel = supabase
      .channel('diligencias-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'diligencias' }, () => {
        fetchDiligencias()
          .then((data) => setDiligencias((prev) => mergeComEstadoAtual(data, prev)))
          .catch((err) => console.error('[DiligenciasContext] realtime refetch:', err))
      })
      // Subscription na tabela ligacoes: garante que insertLigacao seja refletido no estado
      // mesmo quando o refetch de diligencias ocorre antes de o INSERT completar.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ligacoes' }, () => {
        fetchDiligencias()
          .then((data) => setDiligencias((prev) => mergeComEstadoAtual(data, prev)))
          .catch((err) => console.error('[DiligenciasContext] ligacoes realtime refetch:', err))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
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
    // Trava anti-duplicata: se já existe diligência para este evento (mesmo
    // evento_id) ou para o mesmo CCC de evento ("BR-..."), devolve a existente em
    // vez de criar outra — evita 2 cards do mesmo CCC por cliques rápidos na triagem.
    const jaExiste = diligenciasRef.current.find((d) =>
      (!!data.eventoId && d.eventoId === data.eventoId) ||
      (!!data.ccc && data.ccc.startsWith('BR-') && d.ccc === data.ccc)
    )
    if (jaExiste) return jaExiste
    // Fadel quase nunca tem documento a anexar → já nasce com "sem documentos"
    // marcado, evitando ficar como pendência. Continua podendo anexar/desmarcar.
    if (data.dispensarDocumentos == null && /fadel/i.test(data.empresa ?? '')) {
      data = { ...data, dispensarDocumentos: true }
    }
    const nova = await insertDiligencia(data)
    setDiligencias((prev) => [nova, ...prev])
    logAudit({ usuarioEmail: userEmail, acao: 'criou_diligencia', entidadeId: nova.id, detalhes: nova.ccc })
    return nova
  }, [userEmail])

  const updateDiligencia = useCallback(async (id: string, patch: Partial<Diligencia>): Promise<void> => {
    patchD(id, patch)
    try {
      await patchDiligencia(id, patch)
      const d = diligenciasRef.current.find((x) => x.id === id)
      logAudit({ usuarioEmail: userEmail, acao: 'editou_diligencia', entidadeId: id, detalhes: d?.ccc })
    } catch (err) {
      console.error(err)
      addToast('error', 'Não foi possível salvar. Verifique sua conexão.')
      throw err
    }
  }, [patchD, addToast, userEmail])

  const marcarRealizada = useCallback((id: string, dataAtendimento?: string) => {
    const patch: Partial<Diligencia> = { status: StatusDiligencia.Realizada }
    if (dataAtendimento) patch.dataAtendimento = dataAtendimento
    patchD(id, patch)
    patchDiligencia(id, patch)
      .then(() => {
        addToast('success', 'Diligência marcada como realizada.')
        const d = diligenciasRef.current.find((x) => x.id === id)
        logAudit({ usuarioEmail: userEmail, acao: 'marcou_realizada', entidadeId: id, detalhes: d?.ccc })
      })
      .catch((err) => { console.error(err); addToast('error', 'Não foi possível salvar. Verifique sua conexão.') })
  }, [patchD, addToast, userEmail])

  const marcarPago = useCallback(async (id: string): Promise<void> => {
    patchD(id, { statusPagamento: StatusPagamento.Pago })
    try {
      await patchDiligencia(id, { statusPagamento: StatusPagamento.Pago })
      addToast('success', 'Pagamento registrado.')
      const d = diligenciasRef.current.find((x) => x.id === id)
      logAudit({ usuarioEmail: userEmail, acao: 'registrou_pagamento', entidadeId: id, detalhes: d?.ccc })
    } catch (err) {
      console.error(err)
      addToast('error', 'Não foi possível registrar o pagamento.')
      throw err
    }
  }, [patchD, addToast, userEmail])

  const finalizarCiclo = useCallback((id: string, avaliacao?: AvaliacaoAdvogado) => {
    patchD(id, { cicloFinalizado: true, ...(avaliacao && { avaliacao }) })
    patchDiligencia(id, { cicloFinalizado: true, ...(avaliacao && { avaliacao }) })
      .then(() => {
        addToast('success', 'Ciclo finalizado.')
        const d = diligenciasRef.current.find((x) => x.id === id)
        logAudit({ usuarioEmail: userEmail, acao: 'finalizou_ciclo', entidadeId: id, detalhes: d?.ccc })
      })
      .catch((err) => { console.error(err); addToast('error', 'Não foi possível salvar. Verifique sua conexão.') })
  }, [patchD, addToast, userEmail])

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
    const d = diligenciasRef.current.find((x) => x.id === id)
    // Guarda o estado anterior para reverter se a gravação falhar de vez —
    // assim nunca mostramos "enviado" sem ter salvo no banco.
    const anterior: Partial<Pesquisa> = {
      dataEnvioWhatsApp: d?.pesquisa.dataEnvioWhatsApp,
      mensagemEnviada: d?.pesquisa.mensagemEnviada,
      tentativasWhatsApp: d?.pesquisa.tentativasWhatsApp ?? 0,
    }
    const novoCount = (d?.pesquisa.tentativasWhatsApp ?? 0) + 1
    const pp = {
      dataEnvioWhatsApp: new Date().toISOString().split('T')[0],
      mensagemEnviada: mensagem,
      tentativasWhatsApp: novoCount,
    }
    patchP(id, pp)
    comRetry(() => patchPesquisa(id, pp))
      .then(() => logAudit({ usuarioEmail: userEmail, acao: 'enviou_whatsapp', entidadeId: id, detalhes: d?.ccc }))
      .catch((err) => {
        console.error('[registrarWhatsApp] falha ao persistir após retries:', err)
        patchP(id, anterior) // reverte o badge local: a pessoa volta para "Sem WA"
        addToast('error', 'Não consegui registrar o envio (sem conexão). A pessoa segue como "Sem WA" — reenvie quando a internet voltar.')
      })
  }, [patchP, addToast, userEmail])

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
      const d = diligenciasRef.current.find((x) => x.id === id)
      logAudit({ usuarioEmail: userEmail, acao: 'registrou_ligacao', entidadeId: id, detalhes: d?.ccc })
    } catch (err) {
      console.error('[registrarLigacao] insertLigacao:', err)
      addToast('error', err instanceof Error ? err.message : 'Não foi possível registrar a ligação.')
      throw err
    }
  }, [addToast, userEmail])

  const agendarRetorno = useCallback((id: string, data: string) => {
    const pp = { dataCombinada: data }
    patchP(id, pp)
    patchPesquisa(id, pp).catch((err) => { console.error(err); addToast('error', 'Não foi possível salvar. Verifique sua conexão.') })
  }, [patchP, addToast])

  const marcarRespondida = useCallback((id: string, resposta: string) => {
    const pp: Partial<Pesquisa> = {
      status: StatusPesquisa.Concluida,
      respostaVitima: resposta || undefined,
      dataConclusao: localISOString(),
      entrevistador: entrevistadorNome,
    }
    patchP(id, pp)
    patchPesquisa(id, pp).catch((err) => { console.error(err); addToast('error', 'Não foi possível salvar. Verifique sua conexão.') })
  }, [patchP, addToast, entrevistadorNome])

  const encerrarSemResposta = useCallback((id: string, observacao: string) => {
    const pp: Partial<Pesquisa> = {
      status: StatusPesquisa.Concluida,
      observacoes: observacao,
      dataConclusao: localISOString(),
      entrevistador: entrevistadorNome,
    }
    patchP(id, pp)
    patchPesquisa(id, pp).catch((err) => { console.error(err); addToast('error', 'Não foi possível salvar. Verifique sua conexão.') })
  }, [patchP, addToast, entrevistadorNome])

  // Dispensa a pesquisa: o caso não é de entrevista (audiência, sem vítima, V.TAL
  // rotulado como BAT, etc.). Sai da fila de pendentes SEM contar como concluída.
  const dispensarPesquisa = useCallback((id: string, motivo: string) => {
    const pp: Partial<Pesquisa> = {
      status: StatusPesquisa.Dispensada,
      observacoes: motivo || 'Não é caso de pesquisa',
      dataConclusao: undefined,
      respostaVitima: undefined,
    }
    patchP(id, pp)
    patchPesquisa(id, pp)
      .then(() => {
        const d = diligenciasRef.current.find((x) => x.id === id)
        logAudit({ usuarioEmail: userEmail, acao: 'dispensou_pesquisa', entidadeId: id, detalhes: d?.ccc })
      })
      .catch((err) => { console.error(err); addToast('error', 'Não foi possível dispensar. Verifique sua conexão.') })
  }, [patchP, addToast, userEmail])

  // Reabre uma pesquisa concluída: volta para Pendente e limpa a conclusão
  // (resposta / motivo de encerramento / data). Usado quando a pessoa que havia
  // sido encerrada sem contato depois respondeu — permite refazer o resultado.
  const reabrirPesquisa = useCallback((id: string) => {
    const pp: Partial<Pesquisa> = {
      status: StatusPesquisa.Pendente,
      respostaVitima: undefined,
      observacoes: undefined,
      dataConclusao: undefined,
    }
    patchP(id, pp)
    patchPesquisa(id, pp)
      .then(() => {
        addToast('success', 'Pesquisa reaberta.')
        const d = diligenciasRef.current.find((x) => x.id === id)
        logAudit({ usuarioEmail: userEmail, acao: 'reabriu_pesquisa', entidadeId: id, detalhes: d?.ccc })
      })
      .catch((err) => { console.error(err); addToast('error', 'Não foi possível reabrir. Verifique sua conexão.') })
  }, [patchP, addToast, userEmail])

  const atualizarPesquisa = useCallback(async (id: string, patch: Partial<Pesquisa>): Promise<void> => {
    patchP(id, patch)
    try {
      await patchPesquisa(id, patch)
      addToast('success', 'Pesquisa salva.')
      const d = diligenciasRef.current.find((x) => x.id === id)
      logAudit({ usuarioEmail: userEmail, acao: 'atualizou_pesquisa', entidadeId: id, detalhes: d?.ccc })
    } catch (err) {
      console.error(err)
      addToast('error', 'Não foi possível salvar. Verifique sua conexão.')
      throw err
    }
  }, [patchP, addToast, userEmail])

  return (
    <DiligenciasContext.Provider value={{
      diligencias, loading, error,
      createDiligencia, updateDiligencia, marcarRealizada, marcarPago, finalizarCiclo,
      atualizarAnexo, uploadAnexo, removerAnexo, registrarWhatsApp, registrarLigacao, agendarRetorno,
      marcarRespondida, encerrarSemResposta, dispensarPesquisa, reabrirPesquisa, atualizarPesquisa,
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
