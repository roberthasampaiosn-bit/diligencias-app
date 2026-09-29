import { TipoDiligencia, TipoEvento, StatusPesquisa, StatusDiligencia } from '@/types'

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

// ─── Uma pesquisa por sinistro (CCC) ────────────────────────────────────────
//
// A pesquisa é pós-sinistro: uma entrevista por CCC. Quando o mesmo CCC tem 2ª
// diligência/aditamento, só UMA delas (a "principal") entra na fila de Pesquisa;
// as demais ficam de fora para não duplicar a vítima.
// Critério da principal: pesquisa já Concluída > Dispensada > Realizada > tem
// informativo (é a original) > a mais antiga (createdAt).
// Devolve os ids das diligências que NÃO são a principal do seu CCC.

type DiligenciaPesquisa = {
  id: string
  ccc: string
  createdAt: string
  status: string
  dataInformativo?: string
  pesquisa: { status: string }
}

function pesoPrincipal(d: DiligenciaPesquisa): number[] {
  return [
    d.pesquisa.status === StatusPesquisa.Concluida ? 1 : 0,
    d.pesquisa.status === StatusPesquisa.Dispensada ? 1 : 0,
    d.status === StatusDiligencia.Realizada ? 1 : 0,
    d.dataInformativo ? 1 : 0,
  ]
}

export function idsAditamentoPesquisa(diligencias: DiligenciaPesquisa[]): Set<string> {
  const principal = new Map<string, DiligenciaPesquisa>()
  for (const d of diligencias) {
    const ccc = (d.ccc ?? '').trim()
    if (!ccc) continue
    const atual = principal.get(ccc)
    if (!atual) { principal.set(ccc, d); continue }
    const pd = pesoPrincipal(d), pa = pesoPrincipal(atual)
    let melhor = 0
    for (let i = 0; i < pd.length && melhor === 0; i++) melhor = pd[i] - pa[i]
    if (melhor > 0 || (melhor === 0 && d.createdAt < atual.createdAt)) principal.set(ccc, d)
  }
  const fora = new Set<string>()
  for (const d of diligencias) {
    const ccc = (d.ccc ?? '').trim()
    if (ccc && principal.get(ccc)?.id !== d.id) fora.add(d.id)
  }
  return fora
}
