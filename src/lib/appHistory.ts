// Distingue navegação FEITA dentro do app de páginas externas/anteriores que já
// estavam no histórico do navegador quando o app abriu. Serve para o botão
// "Voltar" saber se `router.back()` continua dentro do app (volta pra tela de
// origem real) ou se cairia fora dele — caso em que usamos um fallback.
//
// Estado de módulo: sobrevive à navegação client-side (SPA) desta aba, e
// reinicia num reload/abertura nova — que é exatamente o comportamento que
// queremos para `entryLength`.

let entryLength: number | null = null

// Chamado uma vez quando o AppShell monta no cliente. Grava quantas entradas o
// histórico já tinha ao ENTRAR no app.
export function markAppEntry() {
  if (entryLength === null && typeof window !== 'undefined') {
    entryLength = window.history.length
  }
}

// Existe uma tela anterior DENTRO do app para onde `router.back()` pode voltar?
// (histórico cresceu depois de entrarmos = houve navegação interna).
export function canGoBackInApp() {
  if (typeof window === 'undefined' || entryLength === null) return false
  return window.history.length > entryLength
}
