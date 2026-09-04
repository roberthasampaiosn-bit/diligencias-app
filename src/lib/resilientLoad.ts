// Carregamento resiliente para o celular.
//
// Problema que isto resolve: ao abrir o app no telefone (retorno de background,
// PWA em cold start, rede ainda reconectando no 4G/Wi-Fi), a PRIMEIRA e ÚNICA
// tentativa de buscar os dados falhava e a tela ficava presa em "Não foi possível
// carregar...". Nada tentava de novo sem um reload manual da página.
//
// Aqui a busca ganha (1) retry com backoff, (2) um timeout que transforma uma
// conexão travada em erro retryável (em vez de spinner infinito) e (3) gatilhos
// para recarregar sozinho quando o app volta a ficar visível ou a rede volta.

// Executa `fn` com algumas tentativas e um timeout por tentativa. Uma requisição
// que trava (comum em rede móvel instável) é abortada e vira uma nova tentativa.
export async function fetchComRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  { tentativas = 3, baseMs = 700, timeoutMs = 15_000 }: {
    tentativas?: number; baseMs?: number; timeoutMs?: number
  } = {},
): Promise<T> {
  let ultimoErro: unknown
  for (let i = 0; i < tentativas; i++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      return await fn(ctrl.signal)
    } catch (err) {
      ultimoErro = err
      if (i < tentativas - 1) await new Promise((r) => setTimeout(r, baseMs * (i + 1)))
    } finally {
      clearTimeout(timer)
    }
  }
  throw ultimoErro
}

// Chama `recarregar` quando o app volta a ficar visível (usuário reabre a aba/PWA)
// ou quando a rede reconecta. Retorna uma função de cleanup para o useEffect.
//
// `deveRecarregar` decide se vale a pena refazer a busca naquele momento — por
// padrão só recarrega quando há realmente conexão de rede, para não disparar
// buscas fadadas a falhar enquanto o telefone está offline.
export function aoReconectar(
  recarregar: () => void,
  deveRecarregar: () => boolean = () => (typeof navigator === 'undefined' ? true : navigator.onLine),
): () => void {
  if (typeof window === 'undefined') return () => {}

  const onVisible = () => {
    if (document.visibilityState === 'visible' && deveRecarregar()) recarregar()
  }
  const onOnline = () => { if (deveRecarregar()) recarregar() }

  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
  }
}
