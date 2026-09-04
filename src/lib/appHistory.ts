// Distingue navegação FEITA dentro do app de páginas externas/anteriores que já
// estavam no histórico do navegador quando o app abriu. Serve para o botão
// "Voltar" saber se `router.back()` continua dentro do app (volta pra tela de
// origem real) ou se cairia fora dele — caso em que usamos um fallback.
//
// O marcador é gravado em sessionStorage para SOBREVIVER a um reload — inclusive
// o reload automático do auto-atualizador (UpdateChecker). O window.history
// também sobrevive ao reload, então após recarregar o "voltar" continua sabendo
// que há telas internas atrás. Estado de módulo é só um fallback para quando o
// sessionStorage não está disponível.

const KEY = 'app:entryLength'
let entryLengthFallback: number | null = null

// Chamado quando o AppShell monta no cliente. Grava (uma vez por sessão da aba)
// quantas entradas o histórico já tinha ao ENTRAR no app.
export function markAppEntry() {
  if (typeof window === 'undefined') return
  try {
    if (sessionStorage.getItem(KEY) === null) {
      sessionStorage.setItem(KEY, String(window.history.length))
    }
  } catch {
    if (entryLengthFallback === null) entryLengthFallback = window.history.length
  }
}

// Existe uma tela anterior DENTRO do app para onde `router.back()` pode voltar?
// (histórico cresceu depois de entrarmos = houve navegação interna).
export function canGoBackInApp() {
  if (typeof window === 'undefined') return false
  let base = entryLengthFallback
  try {
    const s = sessionStorage.getItem(KEY)
    if (s !== null) base = Number(s)
  } catch {
    // usa o fallback de módulo
  }
  if (base === null || Number.isNaN(base)) return false
  return window.history.length > base
}
