import { TipoDiligencia, TipoEvento } from '@/types'

// ─── Elegibilidade para a fila de Pesquisa ──────────────────────────────────
//
// Alguns tipos NUNCA são caso de entrevista/pesquisa com a vítima e não devem
// entrar na fila de atendimento:
//   • Audiências (TJ / custódia) — ato processual, não é contato com a vítima.
//   • Acidentes (com ou sem vítima) — não geram pesquisa de atendimento.
//
// Em vez de a pessoa ter que "Dispensar" cada um na mão, o app classifica esses
// casos sozinho: eles saem da fila de pendentes e aparecem já na lista de
// "Dispensadas" (com o motivo automático abaixo).
//
// Aceita tanto Diligência quanto Evento (o Evento não tem tipoDiligencia — só o
// tipoEvento é avaliado nesse caso).

export function motivoNaoEhPesquisa(alvo: {
  tipoDiligencia?: TipoDiligencia | string
  tipoEvento?: TipoEvento | string
}): string | null {
  const td = alvo.tipoDiligencia
  if (td === TipoDiligencia.AudienciaTJ || td === TipoDiligencia.AudienciaCustodia) {
    return 'Audiência — não é caso de pesquisa'
  }

  const te = alvo.tipoEvento
  if (te === TipoEvento.AcidenteComVitima || te === TipoEvento.AcidenteSemVitima) {
    return `${te} — não é caso de pesquisa`
  }

  return null
}

export function naoEhCasoDePesquisa(alvo: {
  tipoDiligencia?: TipoDiligencia | string
  tipoEvento?: TipoEvento | string
}): boolean {
  return motivoNaoEhPesquisa(alvo) !== null
}
