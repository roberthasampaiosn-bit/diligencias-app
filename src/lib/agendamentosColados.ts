import { hojeBR, normalizarBusca, somarDias, telefoneCasaBusca, variantesTelefone } from '@/lib/utils'

// ─── "Colar agendamentos" ─────────────────────────────────────────────────────
// Lê a lista que o Claude (chat) devolve a partir dos prints do WhatsApp:
//
//   AGENDAMENTOS
//   TELEFONE | DATA | HORA | NOME | EVENTO | RESPOSTA
//   55939921... | 06/11/2026 | 16:30 | Antonio Gustavo | 20/10/2026 | "Pode ser amanhã às 16:30?"
//
// TELEFONE pode vir cortado ("..."): o print do iPhone mostra só o começo do número.
// DATA = dd/mm/aaaa (ou dd/mm, hoje, amanhã), QUALQUER ou AGORA.
// EVENTO = data do sinistro citada na nossa mensagem — ajuda a achar a pessoa.
// Também aceita o formato antigo, sem a coluna EVENTO. Linhas fora do formato
// (cabeçalho, ```, texto solto) são ignoradas.

export interface AgendamentoColado {
  linha: number
  telefone: string           // só dígitos, como veio
  telefoneCortado: boolean   // veio com "..." → só o começo do número
  data?: string              // "AAAA-MM-DD" — ausente em QUALQUER / AGORA
  qualquerDia: boolean
  agora: boolean
  hora?: string              // "HH:MM"
  nome: string
  evento?: string            // "AAAA-MM-DD" (data do sinistro)
  resposta: string
  erro?: string
}

function lerHora(s: string): string | undefined {
  const m = s.trim().match(/^(\d{1,2})(?:\s*[:h]\s*(\d{2}))?\s*h?$/i)
  if (!m) return undefined
  const h = Number(m[1])
  const min = Number(m[2] ?? '0')
  if (h > 23 || min > 59) return undefined
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function lerData(s: string): string | undefined {
  const palavra = normalizarBusca(s)
  if (palavra === 'hoje') return hojeBR()
  if (palavra === 'amanha') return somarDias(hojeBR(), 1)
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (!m) return undefined
  const dia = Number(m[1])
  const mes = Number(m[2])
  let ano = m[3] ? Number(m[3]) : Number(hojeBR().slice(0, 4))
  if (ano < 100) ano += 2000
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return undefined
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function lerAgendamentosColados(texto: string): AgendamentoColado[] {
  const out: AgendamentoColado[] = []
  texto.split(/\r?\n/).forEach((bruta, i) => {
    const campos = bruta.split('|').map((c) => c.trim())
    if (campos.length < 3) return
    const telefone = campos[0].replace(/\D/g, '')
    if (telefone.length < 4) return // cabeçalho "TELEFONE | DATA | ..." e afins

    // Coluna EVENTO (nova) só se o 5º campo for uma data
    const evento = campos.length >= 6 ? lerData(campos[4]) : undefined
    const resto = campos.slice(evento ? 5 : 4)

    const dataTxt = (campos[1] ?? '').toUpperCase()
    const item: AgendamentoColado = {
      linha: i + 1,
      telefone,
      telefoneCortado: /\.\.\.|…/.test(campos[0]) || telefone.length < 10,
      qualquerDia: dataTxt.startsWith('QUALQUER'),
      agora: dataTxt.startsWith('AGORA'),
      hora: lerHora(campos[2] ?? ''),
      nome: campos[3] ?? '',
      evento,
      resposta: (resto.join(' | ') || '').replace(/^["“]|["”]$/g, ''),
    }
    if (!item.qualquerDia && !item.agora) {
      item.data = lerData(campos[1] ?? '')
      if (!item.data) item.erro = `Data não entendida: "${campos[1] ?? ''}"`
    }
    if (!item.agora && !item.hora && !item.erro) item.erro = `Horário não entendido: "${campos[2] ?? ''}"`
    out.push(item)
  })
  return out
}

// ─── Casar cada linha com uma pesquisa pendente ───────────────────────────────

export interface CandidatoAgendamento {
  chave: string              // "d:<id>" (diligência) ou "e:<id>" (evento da triagem)
  nome: string
  telefones: string
  ccc: string
  dataEvento?: string        // "AAAA-MM-DD"
}

// Começo do número (telefone cortado) bate com algum dos telefones gravados?
// Cobre o 55 (que também é DDD do RS, então tenta com e sem) e o 9º dígito.
function comecoTelefoneBate(telefones: string, comeco: string): boolean {
  const bases = comeco.startsWith('55') && comeco.length > 4 ? [comeco, comeco.slice(2)] : [comeco]
  const prefixos = bases
    .filter((b) => b.length >= 4)
    .flatMap((b) => [b, b.slice(0, 2) + '9' + b.slice(2)])
  return telefones
    .split(/[;,/]/)
    .map((p) => p.replace(/\D/g, ''))
    .filter(Boolean)
    .some((p) => variantesTelefone(p).some((g) => prefixos.some((pre) => g.startsWith(pre))))
}

// O nome da saudação bate com o da pesquisa? Exige as palavras do nome colado
// (até duas: "Antonio Gustavo" acha "Antonio Gustavo da Silva").
function nomeBate(nomeCandidato: string, nomeColado: string): boolean {
  const partes = normalizarBusca(nomeColado).split(' ').filter((p) => p.length > 2)
  if (partes.length === 0) return false
  const n = normalizarBusca(nomeCandidato)
  return partes.every((p) => n.includes(p))
}

export interface ResultadoCasamento {
  opcoes: CandidatoAgendamento[]   // melhor primeiro
  confiavel: boolean               // pode marcar sozinho
  motivo: string                   // o que bateu (mostrado na prévia)
}

export function casarAgendamento(
  item: AgendamentoColado,
  candidatos: CandidatoAgendamento[],
): ResultadoCasamento {
  // Número completo: telefone basta
  if (!item.telefoneCortado) {
    const porTel = candidatos.filter((c) => telefoneCasaBusca(c.telefones, item.telefone))
    if (porTel.length > 0) {
      return { opcoes: porTel, confiavel: porTel.length === 1, motivo: 'telefone' }
    }
  }

  // Número cortado (ou não achado): soma os sinais — começo do telefone, nome, data do evento
  const pontuados = candidatos
    .map((c) => {
      const tel = comecoTelefoneBate(c.telefones, item.telefone)
      const nome = nomeBate(c.nome, item.nome)
      const evento = !!item.evento && c.dataEvento === item.evento
      return { c, tel, nome, evento, pontos: Number(tel) + Number(nome) + Number(evento) }
    })
    // Telefone cortado sozinho é fraco demais (muita gente com o mesmo DDD)
    .filter((p) => p.nome || (p.tel && p.evento))
    .sort((a, b) => b.pontos - a.pontos)

  if (pontuados.length === 0) return { opcoes: [], confiavel: false, motivo: '' }
  const melhor = pontuados[0]
  const empatados = pontuados.filter((p) => p.pontos === melhor.pontos).length
  const sinais = [melhor.tel && 'começo do telefone', melhor.nome && 'nome', melhor.evento && 'data do evento']
    .filter(Boolean).join(' + ')
  return {
    opcoes: pontuados.map((p) => p.c),
    // Seguro: único com pelo menos dois sinais (ex.: começo do telefone + nome)
    confiavel: empatados === 1 && melhor.pontos >= 2,
    motivo: sinais,
  }
}
